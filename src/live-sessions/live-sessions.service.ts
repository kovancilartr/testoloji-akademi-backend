import { Injectable, ForbiddenException, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { AccessToken, VideoGrant, EgressClient, EncodedFileOutput, EncodedFileType, RoomServiceClient } from 'livekit-server-sdk';
import { CreateLiveSessionDto, UpdateLiveKitConfigDto } from './dto/live-session.dto';
import { EncryptionUtil } from '../common/utils/encryption.util';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

// Plan bazlı kota limitleri
const PLAN_LIMITS = {
    RESTRICTED: { monthlyClasses: 0, maxParticipants: 0, maxDuration: 0 },
    FREE: { monthlyClasses: 0, maxParticipants: 0, maxDuration: 0 },
    BRONZ: { monthlyClasses: 1, maxParticipants: 5, maxDuration: 60 },
    GUMUS: { monthlyClasses: 4, maxParticipants: 10, maxDuration: 60 },
    ALTIN: { monthlyClasses: 20, maxParticipants: 20, maxDuration: 60 },
};

@Injectable()
export class LiveSessionsService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly config: ConfigService,
    ) { }

    /**
     * Öğretmenin bu aydaki canlı ders kullanımını sorgula
     */
    async getMonthlyUsage(teacherId: string) {
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

        const count = await this.prisma.liveSession.count({
            where: {
                teacherId,
                status: { in: ['LIVE', 'ENDED'] },
                createdAt: { gte: startOfMonth, lte: endOfMonth }
            }
        });

        return count;
    }

    /**
     * Yeni canlı ders oluştur
     */
    async createSession(userId: string, dto: CreateLiveSessionDto) {
        // Kullanıcı bilgisi ve plan kontrolü
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            select: { id: true, name: true, tier: true, role: true }
        });

        if (!user || user.role !== 'TEACHER') {
            throw new ForbiddenException('Sadece öğretmenler canlı ders oluşturabilir.');
        }

        const limits = PLAN_LIMITS[user.tier] || PLAN_LIMITS.FREE;

        if (limits.monthlyClasses === 0) {
            throw new ForbiddenException('Mevcut planınız canlı ders özelliğini desteklemiyor. Lütfen paketinizi yükseltin.');
        }

        // --- LiveKit Yapılandırma Kontrolü ---
        // Öğretmenin özel LiveKit ayarları var mı kontrol et (DB'de kayıtlı olmalı)
        const teacherConfig = await this.prisma.liveKitConfig.findUnique({
            where: { userId: userId }
        });

        if (!teacherConfig) {
            throw new BadRequestException('Canlı ders altyapınız henüz yapılandırılmamış. Lütfen yöneticinizle iletişime geçerek Canlı Ders API anahtarlarınızı sisteme tanımlatın.');
        }

        // Aylık kota kontrolü
        const monthlyUsage = await this.getMonthlyUsage(userId);
        if (monthlyUsage >= limits.monthlyClasses) {
            throw new ForbiddenException(`Bu ay ${limits.monthlyClasses} canlı ders hakkınızı kullandınız. Kalan: 0`);
        }

        // Aynı anda aktif ders kontrolü
        const activeSession = await this.prisma.liveSession.findFirst({
            where: { teacherId: userId, status: 'LIVE' }
        });

        if (activeSession) {
            throw new BadRequestException('Zaten aktif bir canlı dersiniz var. Önce mevcut dersi bitirin.');
        }

        // Unique oda adı oluştur
        const roomName = `testoloji-live-${userId.slice(-6)}-${Date.now()}`;

        // Kayıt özelliklerini başlat (Eğer R2 tanımlıysa)
        let egressId: string | null = null;
        let recordingKey: string | null = null;

        if (teacherConfig) {
            const recording = await this.startRecording(roomName, teacherConfig, userId);
            if (recording) {
                egressId = recording.egressId;
                recordingKey = recording.recordingKey;
            }
        }

        const session = await (this.prisma.liveSession as any).create({
            data: {
                teacherId: userId,
                classroomId: dto.classroomId || null,
                title: dto.title,
                roomName,
                status: 'LIVE',
                maxParticipants: limits.maxParticipants,
                maxDuration: limits.maxDuration,
                startedAt: new Date(),
                egressId,
                recordingKey
            },
            include: {
                classroom: { select: { id: true, name: true } },
            }
        });

        console.log(`[LiveSession] Created session: ${session.id}, Egress: ${egressId}, Key: ${recordingKey}`);

        // Öğretmen için LiveKit token oluştur
        const tokenToken = await this.generateToken(roomName, user.name || 'Öğretmen', userId, true, userId);

        return {
            session,
            token: tokenToken.token,
            livekitUrl: tokenToken.url,
            limits: {
                maxParticipants: limits.maxParticipants,
                maxDuration: limits.maxDuration,
                monthlyRemaining: limits.monthlyClasses - monthlyUsage - 1,
            }
        };
    }

    /**
     * Öğrenci canlı derse katılır
     */
    async joinSession(userId: string, sessionId: string) {
        // Öğrenci profilini bul
        const student = await this.prisma.student.findFirst({
            where: { userId },
            select: { id: true, name: true, teacherId: true }
        });

        if (!student) {
            throw new ForbiddenException('Öğrenci profili bulunamadı.');
        }

        const session = await this.prisma.liveSession.findUnique({
            where: { id: sessionId },
            include: {
                _count: { select: { participants: true } },
            }
        });

        if (!session) {
            throw new NotFoundException('Canlı ders bulunamadı.');
        }

        if (session.status !== 'LIVE') {
            throw new BadRequestException('Bu ders şu anda aktif değil.');
        }

        // Öğretmen eşleşmesi kontrolü
        if (session.teacherId !== student.teacherId) {
            throw new ForbiddenException('Bu derse katılma yetkiniz yok.');
        }

        // Katılımcı limiti kontrolü
        if (session._count.participants >= session.maxParticipants) {
            throw new BadRequestException(`Bu dersin katılımcı limiti (${session.maxParticipants}) dolmuş.`);
        }

        // Zaten katılmış mı kontrol et
        const existing = await this.prisma.liveSessionParticipant.findUnique({
            where: { sessionId_studentId: { sessionId, studentId: student.id } }
        });

        if (!existing) {
            await this.prisma.liveSessionParticipant.create({
                data: { sessionId, studentId: student.id }
            });
        }

        // Öğrenci tokeni oluştur
        const tokenRes = await this.generateToken(session.roomName, student.name, userId, false, session.teacherId);

        return {
            session: {
                id: session.id,
                title: session.title,
                roomName: session.roomName,
                teacherId: session.teacherId,
            },
            token: tokenRes.token,
            livekitUrl: tokenRes.url,
        };
    }

    /**
     * Dersi bitir (sadece öğretmen)
     */
    async endSession(userId: string, sessionId: string) {
        const session = await this.prisma.liveSession.findUnique({
            where: { id: sessionId }
        });

        if (!session) throw new NotFoundException('Ders bulunamadı.');
        if (session.teacherId !== userId) throw new ForbiddenException('Bu dersi sadece dersin sahibi bitirebilir.');
        if (session.status !== 'LIVE') throw new BadRequestException('Bu ders zaten aktif değil.');

        // Kaydı durdur (Eğer varsa)
        if ((session as any).egressId) {
            await this.stopRecording(userId, (session as any).egressId);
        }

        const updated = await this.prisma.liveSession.update({
            where: { id: sessionId },
            data: {
                status: 'ENDED',
                endedAt: new Date(),
            },
            include: {
                _count: { select: { participants: true } },
                classroom: { select: { id: true, name: true } },
            }
        });

        return updated;
    }

    /**
     * Kayıt indirme URL'i oluştur (Pre-signed)
     */
    async getDownloadUrl(userId: string, sessionId: string) {
        const session = await this.prisma.liveSession.findUnique({
            where: { id: sessionId },
            include: {
                teacher: {
                    include: { liveKitConfig: true }
                }
            }
        });

        if (!session || !(session as any).recordingKey) {
            throw new NotFoundException('Ders kaydı bulunamadı.');
        }

        // --- YETKİ KONTROLÜ ---
        // 1. Kullanıcı bu dersin öğretmeni mi?
        if (session.teacherId !== userId) {
            // 2. Değilse, bu öğretmenin öğrencisi mi?
            const student = await this.prisma.student.findFirst({
                where: { userId, teacherId: session.teacherId }
            });

            if (!student) {
                throw new ForbiddenException('Bu kaydı indirme yetkiniz yok.');
            }
        }

        const config = session.teacher.liveKitConfig as any;
        if (!config || !config.s3Endpoint || !config.s3AccessKey || !config.s3SecretKey || !config.s3Bucket) {
            throw new BadRequestException('Depolama yapılandırması (R2/S3) eksik.');
        }

        try {
            const s3Client = new S3Client({
                region: 'auto',
                endpoint: config.s3Endpoint,
                credentials: {
                    accessKeyId: EncryptionUtil.decrypt(config.s3AccessKey),
                    secretAccessKey: EncryptionUtil.decrypt(config.s3SecretKey),
                },
            });

            const command = new GetObjectCommand({
                Bucket: config.s3Bucket,
                Key: (session as any).recordingKey,
            });

            // 1 saatlik indirme linki oluştur
            const url = await getSignedUrl(s3Client, command, { expiresIn: 3600 });
            return { url };
        } catch (error) {
            console.error('S3 Error:', error);
            throw new BadRequestException('İndirme bağlantısı oluşturulamadı.');
        }
    }

    /**
     * Kaydı başlat
     */
    private async startRecording(roomName: string, config: any, teacherId: string) {
        if (!config.s3Endpoint || !config.s3AccessKey || !config.s3SecretKey || !config.s3Bucket) {
            return null;
        }

        try {
            // Egress API expects https instead of wss
            let host = (config as any).url || this.config.get<string>('LIVEKIT_URL') || '';
            host = host.replace('wss://', 'https://').replace('ws://', 'http://');

            const egressClient = new EgressClient(
                host,
                EncryptionUtil.decrypt((config as any).apiKey),
                EncryptionUtil.decrypt((config as any).apiSecret)
            );

            // --- ODAYI ÖNCEDEN OLUŞTUR --- 
            // Oda henüz oluşmadığı için kayıt hatası almamak adına odayı açıkça oluşturuyoruz
            const roomService = new RoomServiceClient(
                host,
                EncryptionUtil.decrypt((config as any).apiKey),
                EncryptionUtil.decrypt((config as any).apiSecret)
            );

            try {
                await roomService.createRoom({ name: roomName, emptyTimeout: 5 * 60 });
                console.log(`[LiveKit] Room created explicitly: ${roomName}`);
                // Oda oluşması için çok kısa bir bekleme
                await new Promise(resolve => setTimeout(resolve, 1500));
            } catch (re) {
                console.warn('[LiveKit] Room creation warning:', re);
            }

            const recordingKey = `recordings/${teacherId}/${roomName}.mp4`;

            // Standard Protobuf-based output object for Egress v2.x
            // The SDK expects this nested structure for RoomCompositeEgress
            const output = {
                file: {
                    fileType: EncodedFileType.MP4,
                    filepath: recordingKey,
                    disableManifest: true,
                    output: {
                        case: 's3',
                        value: {
                            endpoint: config.s3Endpoint,
                            accessKey: EncryptionUtil.decrypt(config.s3AccessKey),
                            secret: EncryptionUtil.decrypt(config.s3SecretKey),
                            bucket: config.s3Bucket,
                            forcePathStyle: true,
                            region: ''
                        }
                    }
                }
            } as any;

            const info = await egressClient.startRoomCompositeEgress(roomName, output);
            console.log(`[Egress] Started for room ${roomName}, EgressID: ${info.egressId}`);

            return { egressId: info.egressId, recordingKey };
        } catch (error: any) {
            console.error('[Egress] Recording start failed:', error.message || error);
            return null;
        }
    }

    /**
     * Kaydı durdur
     */
    private async stopRecording(teacherId: string, egressId: string) {
        const config = await this.prisma.liveKitConfig.findUnique({
            where: { userId: teacherId }
        });

        if (!config) return;

        try {
            let host = (config as any).url || this.config.get<string>('LIVEKIT_URL') || '';
            host = host.replace('wss://', 'https://').replace('ws://', 'http://');

            const egressClient = new EgressClient(
                host,
                EncryptionUtil.decrypt((config as any).apiKey),
                EncryptionUtil.decrypt((config as any).apiSecret)
            );

            await egressClient.stopEgress(egressId);
            console.log(`[Egress] Stopped: ${egressId}`);
        } catch (error: any) {
            console.error('[Egress] Recording stop failed:', error.message || error);
        }
    }

    /**
     * Öğretmenin aktif dersini getir (+ taze token)
     */
    async getActiveSession(userId: string) {
        const session = await this.prisma.liveSession.findFirst({
            where: { teacherId: userId, status: 'LIVE' },
            include: {
                _count: { select: { participants: true } },
                classroom: { select: { id: true, name: true } },
                participants: {
                    include: {
                        student: { select: { id: true, name: true } }
                    }
                }
            }
        });

        if (!session) return null;

        // Her seferinde taze token üret
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            select: { name: true }
        });

        const tokenRes = await this.generateToken(session.roomName, user?.name || 'Öğretmen', userId, true, userId);

        return {
            ...session,
            token: tokenRes.token,
            livekitUrl: tokenRes.url,
        };
    }

    /**
     * Öğrencinin mevcut öğretmeninin aktif dersini getir
     */
    async getStudentActiveSession(userId: string) {
        const student = await this.prisma.student.findFirst({
            where: { userId },
            select: { id: true, teacherId: true }
        });

        if (!student) return null;

        const session = await this.prisma.liveSession.findFirst({
            where: { teacherId: student.teacherId, status: 'LIVE' },
            include: {
                teacher: { select: { name: true } },
                classroom: { select: { id: true, name: true } },
                _count: { select: { participants: true } },
            }
        });

        return session;
    }

    /**
     * Geçmiş dersler listesi (öğretmen)
     */
    async getSessionHistory(userId: string) {
        const sessions = await this.prisma.liveSession.findMany({
            where: { teacherId: userId, status: { in: ['ENDED', 'CANCELLED'] } },
            orderBy: { createdAt: 'desc' },
            take: 20,
            include: {
                classroom: { select: { id: true, name: true } },
                _count: { select: { participants: true } },
            }
        });

        return sessions;
    }

    /**
     * Kota bilgisi — öğretmen
     */
    async getQuota(userId: string) {
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            select: { tier: true }
        });

        if (!user) throw new NotFoundException('Kullanıcı bulunamadı.');

        const limits = PLAN_LIMITS[user.tier] || PLAN_LIMITS.FREE;
        const monthlyUsage = await this.getMonthlyUsage(userId);

        const config = await this.prisma.liveKitConfig.findUnique({
            where: { userId }
        });

        return {
            tier: user.tier,
            limits,
            used: monthlyUsage,
            remaining: Math.max(0, limits.monthlyClasses - monthlyUsage),
            hasConfig: !!config
        };
    }

    /**
     * Geçmiş dersler listesi (Öğrenci)
     */
    async getStudentSessionHistory(userId: string) {
        const student = await this.prisma.student.findFirst({
            where: { userId },
            select: { id: true, teacherId: true, classroomId: true }
        });

        if (!student) return [];

        const sessions = await this.prisma.liveSession.findMany({
            where: {
                teacherId: student.teacherId,
                status: { in: ['ENDED', 'CANCELLED'] },
                OR: [
                    { classroomId: null }, // Genel dersler
                    { classroomId: student.classroomId } // Kendi sınıfına ait dersler
                ]
            },
            orderBy: { createdAt: 'desc' },
            take: 20,
            include: {
                teacher: { select: { name: true } },
                classroom: { select: { id: true, name: true } },
                _count: { select: { participants: true } },
            }
        });

        return sessions;
    }

    // ─── ADMIN ENDPOINTS ───

    /**
     * Tüm öğretmenleri LiveKit konfigürasyonlarıyla birlikte getir
     */
    async getAllTeachersSettings() {
        const teachers: any[] = await this.prisma.user.findMany({
            where: { role: 'TEACHER' },
            select: {
                id: true,
                name: true,
                email: true,
                tier: true,
                liveKitConfig: {
                    select: {
                        id: true,
                        userId: true,
                        apiKey: true,
                        apiSecret: true,
                        url: true,
                        s3Endpoint: true,
                        s3AccessKey: true,
                        s3SecretKey: true,
                        s3Bucket: true,
                    } as any
                }
            }
        }) as any;

        // Hassas verileri "maskelenmiş" olarak dön
        return teachers.map(t => ({
            ...t,
            liveKitConfig: t.liveKitConfig ? {
                ...t.liveKitConfig,
                apiKey: '********',
                apiSecret: '********',
                s3AccessKey: t.liveKitConfig.s3AccessKey ? '********' : null,
                s3SecretKey: t.liveKitConfig.s3SecretKey ? '********' : null,
                isConfigured: true
            } : { isConfigured: false }
        }));
    }

    /**
     * Belirli bir öğretmenin LiveKit konfigürasyonunu getir
     */
    async getTeacherSettings(userId: string) {
        const config = await this.prisma.liveKitConfig.findUnique({
            where: { userId }
        });

        if (!config) return null;

        return {
            apiKey: EncryptionUtil.decrypt(config.apiKey),
            apiSecret: EncryptionUtil.decrypt(config.apiSecret),
            url: config.url,
            s3Endpoint: (config as any).s3Endpoint,
            s3AccessKey: (config as any).s3AccessKey ? EncryptionUtil.decrypt((config as any).s3AccessKey) : null,
            s3SecretKey: (config as any).s3SecretKey ? EncryptionUtil.decrypt((config as any).s3SecretKey) : null,
            s3Bucket: (config as any).s3Bucket
        };
    }

    /**
     * Öğretmen için LiveKit konfigürasyonunu güncelle
     */
    async updateTeacherSettings(dto: UpdateLiveKitConfigDto) {
        const encryptedKey = EncryptionUtil.encrypt(dto.apiKey);
        const encryptedSecret = EncryptionUtil.encrypt(dto.apiSecret);
        const encryptedS3Key = dto.s3AccessKey ? EncryptionUtil.encrypt(dto.s3AccessKey) : null;
        const encryptedS3Secret = dto.s3SecretKey ? EncryptionUtil.encrypt(dto.s3SecretKey) : null;

        return this.prisma.liveKitConfig.upsert({
            where: { userId: dto.userId },
            update: {
                apiKey: encryptedKey,
                apiSecret: encryptedSecret,
                url: dto.url || null,
                s3Endpoint: dto.s3Endpoint || null,
                s3AccessKey: encryptedS3Key,
                s3SecretKey: encryptedS3Secret,
                s3Bucket: dto.s3Bucket || null
            },
            create: {
                userId: dto.userId,
                apiKey: encryptedKey,
                apiSecret: encryptedSecret,
                url: dto.url || null,
                s3Endpoint: dto.s3Endpoint || null,
                s3AccessKey: encryptedS3Key,
                s3SecretKey: encryptedS3Secret,
                s3Bucket: dto.s3Bucket || null
            }
        });
    }

    /**
     * Konfigürasyonu kaldır (varsayılana döner)
     */
    async deleteTeacherSettings(userId: string) {
        return this.prisma.liveKitConfig.delete({
            where: { userId }
        }).catch(() => ({ success: false }));
    }

    /**
     * LiveKit JWT token üretir
     */
    private async generateToken(
        roomName: string,
        participantName: string,
        identity: string,
        isTeacher: boolean,
        teacherId: string
    ): Promise<{ token: string; url: string }> {
        // Öğretmenin özel LiveKit ayarları var mı kontrol et
        const teacherConfig = await this.prisma.liveKitConfig.findUnique({
            where: { userId: teacherId }
        });

        let apiKey = this.config.get('LIVEKIT_API_KEY');
        let apiSecret = this.config.get('LIVEKIT_API_SECRET');
        let url = this.config.get('LIVEKIT_URL') || 'wss://your-app.livekit.cloud';

        if (teacherConfig) {
            apiKey = EncryptionUtil.decrypt(teacherConfig.apiKey);
            apiSecret = EncryptionUtil.decrypt(teacherConfig.apiSecret);
            if (teacherConfig.url) {
                url = teacherConfig.url;
            }
        }

        if (!apiKey || !apiSecret) {
            throw new BadRequestException('LiveKit yapılandırması eksik. Lütfen LIVEKIT_API_KEY ve LIVEKIT_API_SECRET değerlerini ayarlayın.');
        }

        const grant: VideoGrant = {
            room: roomName,
            roomJoin: true,
            canPublish: true,
            canSubscribe: true,
            canPublishData: true,
        };

        // Öğrenciler için yayın yetkisi kısıtlanabilir (opsiyonel)
        if (!isTeacher) {
            grant.canPublish = true; // Öğrenciler de katılabilir (mikrofon/kamera)
        }

        const token = new AccessToken(apiKey, apiSecret, {
            identity,
            name: participantName,
            ttl: '2h', // 2 saat geçerli
        });

        token.addGrant(grant);
        const jwt = await token.toJwt();

        return {
            token: jwt,
            url
        };
    }
}
