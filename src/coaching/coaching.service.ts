import { Injectable, ForbiddenException, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { Role } from '@prisma/client';
import { GoogleGenerativeAI, Part } from '@google/generative-ai';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { AskAiDto } from './dto/ask-ai.dto';
import { AnalyzeProgressDto } from './dto/analyze-progress.dto';
import { AnalyticsService } from '../analytics/analytics.service';
import { SchedulesService } from '../schedules/schedules.service';
import { SystemSettingsService } from '../system-settings/system-settings.service';
import PDFDocument = require('pdfkit');

/**
 * Öğrenci Koçluğu ve Yapay Zeka (Gemini) entegrasyonunu yöneten servis.
 */
@Injectable()
export class CoachingService {
    private genAI: GoogleGenerativeAI;
    private currentApiKey: string | null = null;

    constructor(
        private prisma: PrismaService,
        private configService: ConfigService,
        private analyticsService: AnalyticsService,
        private schedulesService: SchedulesService,
        private systemSettingsService: SystemSettingsService,
        @InjectQueue('ai-coaching') private aiQueue: Queue,
    ) { }

    /**
     * Gemini AI nesnesini yapılandırır. 
     * Önce veritabanındaki (SystemSettings) API anahtarına bakar, yoksa .env dosyasındakini kullanır.
     */
    private async ensureGenAI() {
        const dbApiKey = await this.systemSettingsService.getSetting('GEMINI_API_KEY');
        const apiKey = dbApiKey || this.configService.get<string>('GEMINI_API_KEY');

        if (!apiKey) {
            throw new InternalServerErrorException('Yapay zeka servisi API anahtarı yapılandırılmamış.');
        }

        if (!this.genAI || this.currentApiKey !== apiKey) {
            this.genAI = new GoogleGenerativeAI(apiKey);
            this.currentApiKey = apiKey;
        }
    }

    /**
     * Yapay zeka kullanım detaylarını (token sayıları vb.) veritabanına loglar.
     */
    private async logAiUsage(model: string, usage: any, action: string, userId?: string) {
        try {
            await this.prisma.aiUsageLog.create({
                data: {
                    model,
                    promptTokens: usage?.promptTokenCount || 0,
                    completionTokens: usage?.candidatesTokenCount || 0,
                    totalTokens: usage?.totalTokenCount || 0,
                    action,
                    userId,
                },
            });
        } catch (error) {
            console.error('AI Usage logging failed:', error);
        }
    }

    /**
     * Belirli bir kullanıcının tanımlanmış günlük yapay zeka kullanım limitini getirir.
     */
    private async getDailyLimit(userId: string): Promise<number> {
        try {
            const user = await this.prisma.user.findUnique({
                where: { id: userId },
                select: { dailyAiLimit: true } as any,
            }) as any;
            return user?.dailyAiLimit || 10;
        } catch {
            return 10;
        }
    }

    /**
     * Kullanıcının bugünkü kullanım adedini, toplam limitini ve kalan hakkını hesaplar.
     */
    async getUsage(userId: string) {
        const today = new Date().toISOString().split('T')[0];
        const dailyLimit = await this.getDailyLimit(userId);
        const usage = await this.prisma.aiUsage.findUnique({
            where: {
                userId_date: {
                    userId,
                    date: today,
                },
            },
        });

        return {
            count: usage?.count || 0,
            limit: dailyLimit,
            remaining: Math.max(0, dailyLimit - (usage?.count || 0)),
        };
    }

    /**
     * Soru bazlı yapay zeka etkileşimini kuyruğa yazar.
     */
    async askAi(userId: string, dto: AskAiDto) {
        const usage = await this.getUsage(userId);
        if (usage.count >= usage.limit) {
            throw new ForbiddenException(`Günlük yapay zeka kullanım limitinize ulaştınız (${usage.limit}/${usage.limit}). Yarın tekrar deneyebilirsiniz.`);
        }

        const job = await this.aiQueue.add('process-ai', {
            type: 'askAi',
            userId,
            payload: dto
        });

        return {
            status: 'queued',
            jobId: job.id,
            message: 'Yapay zeka analizi sıraya alındı. Kısa süre içinde yanıtlanacak.'
        };
    }

    /**
     * Soru bazlı basit yapay zeka etkileşimi. 
     * Kuyruk üzerinden işlemci tarafından çağrılır.
     */
    async processAskAiInternal(userId: string, dto: AskAiDto) {
        const usage = await this.getUsage(userId);

        if (usage.count >= usage.limit) {
            throw new ForbiddenException(`Günlük yapay zeka kullanım limitine ulaşıldı.`);
        }

        await this.ensureGenAI();

        try {
            const modelConfig = await this.systemSettingsService.getSetting('GEMINI_MODEL') || "gemini-2.5-flash";
            const model = this.genAI.getGenerativeModel({ model: modelConfig });

            const prompt = this.buildPrompt(dto);
            const result = await model.generateContent(prompt);
            const response = await result.response;
            let text = response.text();

            text += `\n\n---\n*Bu analiz 'Akademi Kovancılar' için özel olarak hazırlanmış **${modelConfig}** modeli kullanılarak oluşturulmuştur.*`;

            await this.logAiUsage(modelConfig, response.usageMetadata, 'AskAi', userId);

            // Kullanımı artır
            const today = new Date().toISOString().split('T')[0];
            await this.prisma.aiUsage.upsert({
                where: { userId_date: { userId, date: today } },
                update: { count: { increment: 1 } },
                create: { userId, date: today, count: 1 },
            });

            return {
                analysis: text,
                model: modelConfig,
                remaining: usage.remaining - 1,
            };
        } catch (error) {
            console.error('Gemini API Error:', error);
            throw new InternalServerErrorException('Yapay zeka analizi sırasında bir hata oluştu.');
        }
    }

    /**
     * Öğrencinin genel ilerleme analizini kuyruğa yazar.
     */
    async analyzeProgress(userId: string, dto: AnalyzeProgressDto) {
        // Genel gelişim raporu talebi mi kontrol et
        const isGeneralReport = dto.query.includes("Kişisel Gelişim Raporu");

        if (isGeneralReport) {
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            const existingReport = await this.prisma.coachingHistory.findFirst({
                where: {
                    userId,
                    action: 'progress_analysis',
                    createdAt: { gte: today }
                },
                orderBy: { createdAt: 'desc' }
            });

            if (existingReport) {
                return {
                    status: 'cached',
                    analysis: `Bugün senin için hazırladığım raporu tekrar getirdim. Gelişimlerini daha sağlıklı değerlendirebilmem için günde bir kez detaylı rapor hazırlamalıyım. İşte bugünkü değerlendirmen:\n\n${existingReport.response}`,
                    message: 'Bugünkü raporunuz tekrar yüklendi.'
                };
            }
        }

        const usage = await this.getUsage(userId);
        if (usage.count >= usage.limit) {
            throw new ForbiddenException(`Günlük yapay zeka kullanım limitinize ulaştınız (${usage.limit}/${usage.limit}). Yarın tekrar deneyebilirsiniz.`);
        }

        const job = await this.aiQueue.add('process-ai', {
            type: 'analyzeProgress',
            userId,
            payload: dto
        });

        return {
            status: 'queued',
            jobId: job.id,
            message: 'Yapay zeka analiziniz sıraya alındı.'
        };
    }

    /**
     * Öğretmen için öğrenci analizini başlatır.
     */
    async analyzeStudentForTeacher(teacherUserId: string, studentId: string, dto: AnalyzeProgressDto) {
        // Güvenlik kontrolü
        const student = await this.prisma.student.findFirst({
            where: { id: studentId, teacherId: teacherUserId },
            include: { user: true }
        });
        if (!student) throw new ForbiddenException('Bu öğrenciye erişim yetkiniz yok.');

        // Önbellek kontrolü (Öğrenci için bugün rapor oluşturulmuş mu?)
        const isGeneralReport = dto.query.includes("Performans Değerlendirmesi") || dto.query.includes("Gelişim Raporu");
        if (isGeneralReport) {
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            const existingReport = await this.prisma.coachingHistory.findFirst({
                where: {
                    userId: student.userId as string,
                    action: 'progress_analysis',
                    createdAt: { gte: today }
                },
                orderBy: { createdAt: 'desc' }
            });

            if (existingReport) {
                return {
                    status: 'cached',
                    analysis: existingReport.response,
                    message: 'Bu öğrenci için bugün hazırlanmış rapor yüklendi.'
                };
            }
        }

        const usage = await this.getUsage(teacherUserId);
        if (usage.count >= usage.limit) {
            throw new ForbiddenException(`Günlük yapay zeka kullanım limitinize ulaştınız. Yarın tekrar deneyebilirsiniz.`);
        }

        const job = await this.aiQueue.add('process-ai', {
            type: 'analyzeProgress',
            userId: teacherUserId,
            payload: { ...dto, studentId }
        });

        return {
            status: 'queued',
            jobId: job.id,
            message: 'Öğrenci analizi sıraya alındı.'
        };
    }

    /**
     * Öğrencinin genel ilerlemesini veya belirli bir sınavını analiz eden ana fonksiyon.
     * Kuyruk üzerinden işlemci tarafından çağrılır.
     */
    async processAnalyzeProgressInternal(userId: string, dto: AnalyzeProgressDto) {
        const usage = await this.getUsage(userId);

        if (usage.count >= usage.limit) {
            throw new ForbiddenException(`Günlük yapay zeka kullanım limitine ulaşıldı.`);
        }

        await this.ensureGenAI();

        // 1. Kullanıcının seçtiği modeli al
        let modelConfig = await this.systemSettingsService.getSetting('GEMINI_MODEL');
        if (!modelConfig) {
            modelConfig = "gemini-2.5-flash";
        }

        console.log(`Analyzing progress with model: ${modelConfig}`);

        // 2. Sorgunun sınav analiziyle mi yoksa genel koçlukla mı ilgili olduğunu belirle
        const isExamAnalysis = this.isExamAnalysisQuery(dto.query);
        console.log(`Query type: ${isExamAnalysis ? 'SINAV ANALİZİ' : 'GENEL KOÇLUK'}`);

        let response: any;
        let text: string;
        let finalModelUsed = modelConfig;
        let assignmentId: string | null = null;

        try {
            let model = this.genAI.getGenerativeModel({ model: modelConfig });

            // Geçmiş konuşmaları getir (Son 3 mesaj - optimize)
            const history = await this.prisma.coachingHistory.findMany({
                where: { userId },
                orderBy: { createdAt: 'desc' },
                take: 3,
            });
            const reversedHistory = history.reverse();

            // Öğrenci verilerini çek
            let studentData = dto.studentData;
            if (!studentData) {
                try {
                    let targetStudent;
                    if (dto.studentId) {
                        targetStudent = await this.prisma.student.findUnique({ where: { id: dto.studentId } });
                    } else {
                        targetStudent = await this.prisma.student.findUnique({ where: { userId } });
                    }

                    if (targetStudent) {
                        studentData = await this.analyticsService.getStudentOverview(userId, Role.STUDENT, targetStudent.id);

                        // Add schedule summary (last 30 days)
                        const scheduleSummary = await this.schedulesService.getScheduleSummary(targetStudent.id);
                        studentData.scheduleSummary = scheduleSummary;
                    }
                } catch (e) {
                    console.warn('Analytics/Schedule data could not be fetched:', userId, dto.studentId);
                }
            }

            // Part tipine uygun şekilde array oluştur
            const parts: Part[] = [];

            if (isExamAnalysis) {
                // ===== SINAV ANALİZİ MODU =====
                // Önce daha önce bu sınav için analiz yapılmış mı kontrol et
                const latestAssignment = await this.prisma.assignment.findFirst({
                    where: {
                        student: { userId },
                        status: 'COMPLETED',
                        project: { isNot: null },
                    },
                    orderBy: { completedAt: 'desc' },
                    include: {
                        project: {
                            include: {
                                questions: { orderBy: { order: 'asc' } },
                            },
                        },
                    },
                });

                if (latestAssignment) {
                    assignmentId = latestAssignment.id;

                    // Bu sınav için daha önce AI analizi yapılmış mı?
                    if ((latestAssignment as any).aiAnalysis) {
                        console.log(`Cached analysis found for assignment: ${assignmentId}`);

                        // Kullanımı artırma - cache'den döndür
                        return {
                            analysis: (latestAssignment as any).aiAnalysis,
                            remaining: usage.remaining,
                            cached: true,
                            assignmentId,
                        };
                    }
                }

                // Cache yoksa → PDF ile analiz yap
                let promptText = this.buildAnalysisPrompt({ ...dto, studentData }, reversedHistory, true);
                parts.push({ text: promptText });

                if (latestAssignment && latestAssignment.project) {
                    const questions = latestAssignment.project.questions;
                    const answers = latestAssignment.answers as Record<string, string> || {};

                    const pdfBase64 = await this.generateExamAnalysisPdf(
                        latestAssignment.project.name,
                        questions,
                        answers,
                    );

                    if (pdfBase64) {
                        parts.push({
                            inlineData: {
                                mimeType: "application/pdf",
                                data: pdfBase64,
                            },
                        });
                    } else {
                        parts.push({ text: "[PDF oluşturulamadı, lütfen metin bazlı analize devam et.]\n" });
                    }
                } else {
                    parts.push({ text: "[Tamamlanmış sınav bulunamadı. Genel öneriler ver.]\n" });
                }
            } else {
                // ===== GENEL KOÇLUK MODU =====
                // PDF oluşturma! Sadece öğrenci verileriyle cevapla
                let promptText = this.buildAnalysisPrompt({ ...dto, studentData }, reversedHistory, false);
                parts.push({ text: promptText });
            }

            // API çağrısı
            try {
                const result = await model.generateContent(parts);
                response = await result.response;
                text = response.text();
            } catch (genError) {
                console.warn(`Primary model ${modelConfig} failed. Trying fallback... Error: ${genError}`);
                finalModelUsed = "gemini-2.5-flash-lite";
                const fallbackModel = this.genAI.getGenerativeModel({ model: finalModelUsed });

                const result = await fallbackModel.generateContent(parts);
                response = await result.response;
                text = response.text();
            }

            // Temizlik: AI cevabı zaten footer'ı (geçmişten esinlenip) eklemiş olabilir
            const footerBadge = "Bu analiz 'Akademi Kovancılar' için özel olarak hazırlanmış";
            if (!text.includes(footerBadge)) {
                text += `\n\n---\n*Bu analiz 'Akademi Kovancılar' için özel olarak hazırlanmış **${finalModelUsed}** modeli kullanılarak oluşturulmuştur.*`;
            }

            // Detaylı loglama
            await this.logAiUsage(finalModelUsed, response.usageMetadata, isExamAnalysis ? 'AnalyzeExam' : 'CoachChat', userId);

            // Konuşmayı geçmişe kaydet
            let actionText = isExamAnalysis ? 'analysis' : 'chat';
            if (dto.query.includes("Kişisel Gelişim Raporu") || dto.query.includes("Performans Değerlendirmesi") || dto.query.includes("Gelişim Raporu")) {
                actionText = 'progress_analysis';
            }

            // Eğer öğretmen bir öğrenciyi analiz ediyorsa, raporu öğrencinin geçmişine kaydet
            let historyUserId = userId;
            if (dto.studentId) {
                const targetStudent = await this.prisma.student.findUnique({ where: { id: dto.studentId } });
                if (targetStudent?.userId) {
                    historyUserId = targetStudent.userId;
                }
            }

            await this.prisma.coachingHistory.create({
                data: {
                    userId: historyUserId,
                    query: dto.query,
                    response: text,
                    action: actionText,
                    assignmentId: assignmentId,
                } as any,
            });

            // Eğer sınav analizi ise → Assignment'a da kaydet (cache)
            if (isExamAnalysis && assignmentId) {
                try {
                    await this.prisma.assignment.update({
                        where: { id: assignmentId },
                        data: { aiAnalysis: text } as any,
                    });
                    console.log(`AI analysis cached for assignment: ${assignmentId}`);
                } catch (e) {
                    console.warn('Could not cache AI analysis:', e);
                }
            }

            // Kullanımı artır
            const today = new Date().toISOString().split('T')[0];
            await this.prisma.aiUsage.upsert({
                where: { userId_date: { userId, date: today } },
                update: { count: { increment: 1 } },
                create: { userId, date: today, count: 1 },
            });

            return {
                analysis: text,
                remaining: usage.remaining - 1,
                assignmentId,
                cached: false,
            };
        } catch (error) {
            console.error('Gemini API Error:', error);
            throw new InternalServerErrorException('Yapay zeka analizi sırasında bir hata oluştu.');
        }
    }

    /**
     * Kullanıcıdan gelen metnin bir sınav analizi talebi olup olmadığını anahtar kelimelerle kontrol eder.
     */
    private isExamAnalysisQuery(query: string): boolean {
        const examKeywords = [
            'sınav', 'deneme', 'analiz', 'test', 'sonuç', 'soru',
            'yanlış', 'doğru', 'boş', 'net', 'puan', 'not',
            'hata', 'eksik', 'zayıf', 'güçlü',
            'inceleme', 'değerlendir', 'analiz et', 'tekrar analiz',
            'sınavım', 'denemem', 'sınavımı', 'denememi',
            'performans', 'başarı', 'skor', 'notu'
        ];

        const lowerQuery = query.toLowerCase().replace(/ı/g, 'i').replace(/ö/g, 'o').replace(/ü/g, 'u').replace(/ş/g, 's').replace(/ç/g, 'c').replace(/ğ/g, 'g');
        const normalizedKeywords = examKeywords.map(k => k.toLowerCase().replace(/ı/g, 'i').replace(/ö/g, 'o').replace(/ü/g, 'u').replace(/ş/g, 's').replace(/ç/g, 'c').replace(/ğ/g, 'g'));

        return normalizedKeywords.some(keyword => lowerQuery.includes(keyword));
    }

    // ===== PDF Generation =====

    /**
     * Sınav sorularını, öğrenci cevaplarını ve görselleri içeren bir analiz PDF'i oluşturur.
     * Gemini'nin görsel içeriği anlaması veya detaylı rapor sunması için Base64 formatında döner.
     */
    private async generateExamAnalysisPdf(examTitle: string, questions: any[], answers: Record<string, string>): Promise<string | null> {
        return new Promise(async (resolve, reject) => {
            try {
                // @ts-ignore
                const doc = new PDFDocument({ autoFirstPage: false });
                const buffers: Buffer[] = [];

                doc.on('data', buffers.push.bind(buffers));
                doc.on('end', () => {
                    const pdfData = Buffer.concat(buffers);
                    resolve(pdfData.toString('base64'));
                });

                doc.on('error', (err) => {
                    console.error("PDF generation stream error:", err);
                    resolve(null);
                });

                // Kapak Sayfası
                doc.addPage();
                doc.fontSize(20).text(examTitle, { align: 'center' });
                doc.moveDown();
                doc.fontSize(14).text("Sınav Analiz Raporu ve Sorular", { align: 'center' });
                doc.moveDown();

                // Soruları Ekle
                for (const [index, question] of questions.entries()) {
                    doc.addPage();
                    doc.fontSize(12).fillColor('black').text(`Soru ${index + 1}:`, { underline: true });
                    doc.moveDown(0.5);

                    const studentAnswer = answers[question.id];
                    const isCorrect = studentAnswer === question.correctAnswer;
                    const statusText = isCorrect ? "DOĞRU" : (studentAnswer ? "YANLIŞ" : "BOŞ");
                    const color = isCorrect ? 'green' : (studentAnswer ? 'red' : 'gray');

                    doc.fillColor(color).text(`Durum: ${statusText}`);
                    doc.fillColor('black').text(`Öğrenci Cevabı: ${studentAnswer || "BOŞ"}`);
                    doc.text(`Doğru Cevap: ${question.correctAnswer}`);
                    doc.moveDown();

                    if (question.imageUrl) {
                        try {
                            const imgBuffer = await this.fetchImageAsBuffer(question.imageUrl);
                            if (imgBuffer) {
                                doc.image(imgBuffer, {
                                    fit: [450, 400],
                                    align: 'center',
                                    valign: 'center'
                                });
                            } else {
                                doc.text("[Görsel yüklenemedi]");
                            }
                        } catch (e) {
                            console.warn(`Image load failed for Q${index + 1}:`, e);
                            doc.text("[Görsel hatası]");
                        }
                    } else {
                        doc.text("[Görsel yok]");
                    }
                }

                // Cevap Anahtarı Sayfası
                doc.addPage();
                doc.fontSize(16).fillColor('black').text("Cevap Anahtarı", { align: 'center', underline: true });
                doc.moveDown();

                questions.forEach((q, i) => {
                    const studentAnswer = answers[q.id];
                    const isCorrect = studentAnswer === q.correctAnswer;
                    const symbol = isCorrect ? "✅" : (studentAnswer ? "❌" : "⚪️");
                    doc.fontSize(10).text(`${i + 1}. Doğru: ${q.correctAnswer} (Sen: ${studentAnswer || "-"}) ${symbol}`);
                });

                doc.end();

            } catch (error) {
                console.error("Error in generateExamAnalysisPdf:", error);
                resolve(null);
            }
        });
    }

    /**
     * Verilen URL'deki görsele HTTP isteği atarak Buffer olarak indirir (PDF içine eklemek için).
     */
    private async fetchImageAsBuffer(url: string): Promise<Buffer | null> {
        try {
            if (!url.startsWith('http')) return null;
            const response = await fetch(url);
            if (!response.ok) return null;
            const arrayBuffer = await response.arrayBuffer();
            return Buffer.from(arrayBuffer);
        } catch (error) {
            console.error('Error fetching image buffer:', error);
            return null;
        }
    }

    /**
     * Verilen URL'deki görseli indirip Base64 formatına çevirir (AI modeline göndermek için).
     */
    private async fetchImageAsBase64(url: string): Promise<string | null> {
        try {
            if (!url.startsWith('http')) return null;
            const response = await fetch(url);
            if (!response.ok) throw new Error(`Failed to fetch image: ${response.statusText}`);
            const arrayBuffer = await response.arrayBuffer();
            return Buffer.from(arrayBuffer).toString('base64');
        } catch (error) {
            console.error('Error fetching image for AI:', error);
            return null;
        }
    }

    // ===== History =====

    /**
     * Kullanıcının geçmiş AI konuşmalarını sayfalama yapısıyla getirir.
     */
    async getHistory(userId: string, page: number = 1, limit: number = 5, action?: string) {
        const skip = (page - 1) * limit;

        const where: any = { userId };
        if (action) {
            where.action = action;
        }

        const [items, total] = await Promise.all([
            this.prisma.coachingHistory.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                take: limit,
                skip,
            }),
            this.prisma.coachingHistory.count({ where }),
        ]);

        return {
            items,
            total,
            page,
            totalPages: Math.ceil(total / limit),
            hasMore: page * limit < total,
        };
    }

    /**
     * Öğretmen için bir öğrencinin geçmiş AI konuşmalarını getirir.
     */
    async getStudentHistoryForTeacher(teacherUserId: string, studentId: string, page: number = 1, limit: number = 5, action?: string) {
        // Öğrencinin bu öğretmene ait olup olmadığını kontrol et (Eğer admin değilse)
        const teacher = await this.prisma.user.findUnique({ where: { id: teacherUserId } });
        const isAdmin = teacher?.role === 'ADMIN';

        const student = await this.prisma.student.findUnique({
            where: isAdmin ? { id: studentId } : { id: studentId, teacherId: teacherUserId }
        });

        if (!student) {
            throw new ForbiddenException('Bu öğrencinin verilerine erişim yetkiniz yok veya öğrenci bulunamadı.');
        }

        if (!student.userId) {
            return { items: [], total: 0, page, totalPages: 0, hasMore: false };
        }

        return this.getHistory(student.userId, page, limit, action);
    }

    // ===== Assignment AI Analysis =====

    /**
     * Belirli bir sınav ödevi (assignment) için daha önce üretilmiş AI analizini getirir.
     */
    async getAssignmentAnalysis(assignmentId: string, requestUserId: string) {
        const user = await this.prisma.user.findUnique({ where: { id: requestUserId } });
        const isAdmin = user?.role === 'ADMIN';
        const isTeacher = user?.role === 'TEACHER';

        const where: any = { id: assignmentId };

        if (!isAdmin) {
            if (isTeacher) {
                where.student = { teacherId: requestUserId };
            } else {
                where.student = { userId: requestUserId };
            }
        }

        const assignment = await this.prisma.assignment.findFirst({
            where,
            select: {
                id: true,
                title: true,
                aiAnalysis: true,
            } as any,
        });

        if (!assignment) {
            // Eğer hala bulunamadıysa ve kullanıcı öğretmense (belki ortak ödev vs) 
            // ama burada student üzerinden kısıtlıyoruz. 
            return null;
        }

        return {
            assignmentId: assignment.id,
            title: (assignment as any).title,
            aiAnalysis: (assignment as any).aiAnalysis,
        };
    }

    // ===== Admin: Update Daily Limit =====

    /**
     * (Admin) Belirli bir kullanıcının günlük AI kullanım hakkını günceller.
     */
    async updateDailyLimit(userId: string, limit: number) {
        await this.prisma.user.update({
            where: { id: userId },
            data: { dailyAiLimit: limit } as any,
        });
        return { success: true, newLimit: limit };
    }

    /**
     * Kullanıcının koçluk istatistiklerini (toplam soru, günlük kullanım grafiği vb.) derler.
     */
    async getUserCoachingStats(userId: string) {
        const [totalPrompts, dailyUsage, historyResult, user] = await Promise.all([
            this.prisma.coachingHistory.count({ where: { userId } }),
            this.prisma.aiUsage.findMany({
                where: { userId },
                orderBy: { date: 'desc' },
                take: 7,
            }),
            this.getHistory(userId, 1, 50),
            this.prisma.user.findUnique({
                where: { id: userId },
                select: { dailyAiLimit: true } as any,
            }),
        ]);

        return {
            totalPrompts,
            dailyUsage,
            history: historyResult.items,
            dailyLimit: (user as any)?.dailyAiLimit || 10,
        };
    }

    // ===== Prompt Builders =====

    /**
     * İlerleme analizi için kapsamlı sistem talimatlarını (prompt) oluşturur.
     * Geçmiş konuşmaları ve öğrenci verilerini metne entegre eder.
     */
    private buildAnalysisPrompt(dto: AnalyzeProgressDto, history: any[] = [], includeExamInstructions: boolean = true): string {
        const { query, studentData } = dto;

        let prompt = `Sen "Testoloji Akademi"nin uzman eğitim danışmanı ve öğrenci koçusun. \n`;

        if (history.length > 0) {
            prompt += `\nÖnceki Konuşmalarımız:\n`;
            history.forEach(h => {
                // Footer'ı geçmişten temizle ki AI tekrar etmesin
                const cleanResponse = h.response.split('\n\n---\n*Bu analiz')[0];
                prompt += `Öğrenci: ${h.query}\n`;
                prompt += `Sen (Koç): ${cleanResponse}\n\n`;
            });
            prompt += `--- Geçmiş Konuşma Sonu ---\n\n`;
        }

        prompt += `Öğrenci şimdiki sorusu: "${query}" \n\n`;

        if (studentData) {
            prompt += `Öğrencinin Mevcut Durumu:
            - Ortalama Puan: ${studentData.avgScore}
            - Toplam Çözülen Sınav: ${studentData.totalExams}
            - Son Sınav Performansları (Başarı %): ${JSON.stringify(studentData.scoreHistory?.slice(0, 5).map((ex: any) => ({ title: ex.title, grade: ex.grade })))}
            \n`;

            if (studentData.scheduleSummary) {
                prompt += `Öğrencinin Son 30 Günlük Çalışma Programı Özeti:
                - Toplam Planlanan Aktivite: ${studentData.scheduleSummary.totalActivities}
                - Tamamlanan Aktivite: ${studentData.scheduleSummary.completedActivities}
                - Program Uyum Oranı: %${studentData.scheduleSummary.completionRate}
                - Ders Bazlı Çalışma Dağılımı: ${JSON.stringify(studentData.scheduleSummary.subjectStats)}
                \n`;
            }
        }

        if (includeExamInstructions) {
            // Sınav analizi modu
            prompt += `SANA BİR PDF DOSYASI SUNULDU. Bu dosyada sınav soruları ve en son sayfada CEVAP ANAHTARI var. Ayrıca öğrencinin verdiği cevaplar her sorunun üzerinde belirtilmiştir.\n`;
            prompt += `Lütfen şu adımları izle:\n1. PDF'teki soruları (özellikle öğrencinin YANLIŞ yaptığı veya BOŞ bıraktığı soruları) incele.\n2. Soruların hangi konulardan (örn: Türev, integral, optik vb.) geldiğini tespit et.\n3. Öğrencinin yanlışlarına bakarak hangi konuda eksiği olduğunu belirle.\n4. Buna göre "Şu konuda eksiksin, şuna çalışmalısın" gibi nokta atışı tavsiyeler ver.\n`;
        } else {
            // Genel koçluk modu
            prompt += `Bu bir genel koçluk sorusudur. Sınav PDF'i GÖNDERİLMEDİ. Öğrencinin sorusuna doğrudan, samimi ve profesyonel bir şekilde cevap ver.\n`;
            prompt += `Öğrencinin verilerine dayanarak uygun tavsiyeler ve motivasyonel destek ver.\n`;
        }

        prompt += `\nYanıtını verirken:
        1. "Sen" diliyle konuş, samimi ol.
        2. Somut verilere atıfta bulun.
        3. Nokta atışı konu eksiklerini belirle.
        4. Yanıtı Markdown formatında yapılandır.
        5. Matematik ifadelerini LaTeX formatında yaz ($ ... $ veya $$ ... $$).`;

        return prompt;
    }

    /**
     * Tekil soru analizi (askAi) için kısa ve öz bir koçluk metni (prompt) hazırlar.
     */
    private buildPrompt(dto: AskAiDto): string {
        const { userAnswer, correctAnswer, context } = dto;

        let prompt = `Sen "Testoloji Akademi"nin uzman eğitim koçusun. Bir öğrenci çözdüğü bir soru hakkında senden yardım istiyor. \n\n`;

        if (userAnswer && correctAnswer) {
            if (userAnswer === correctAnswer) {
                prompt += `Öğrenci bu soruyu DOĞRU cevaplamış (Cevabı: ${userAnswer}). Ona neden doğru yaptığını pekiştiren, konuyu özetleyen ve motivasyon veren kısa bir analiz yap. \n`;
            } else {
                prompt += `Öğrenci bu soruyu YANLIŞ cevaplamış. Öğrencinin cevabı: ${userAnswer}, Doğru cevap: ${correctAnswer}. \n`;
                prompt += `Lütfen öğrenciye nerede hata yapmış olabileceğini, konunun püf noktalarını ve bir dahaki sefere nelere dikkat etmesi gerektiğini nazik ve teşvik edici bir dille anlat. \n`;
            }
        } else {
            prompt += `Öğrenci bu soruyu boş bırakmış veya sadece konuyu anlamak istiyor. Doğru cevap: ${correctAnswer}. \n`;
            prompt += `Lütfen sorunun çözüm mantığını ve ilgili konuyu açıklayarak öğrenciye yardımcı ol. \n`;
        }

        if (context) {
            prompt += `Ek Bağlam: ${JSON.stringify(context)} \n`;
        }

        prompt += `\nYanıtını verirken:
        1. Samimi ve motive edici bir dil kullan (Örneğin: "Harika gidiyorsun!", "Bu çok yaygın bir hata, üzülme.").
        2. Karmaşık terimlerden kaçın, öğrencinin seviyesine in.
        3. Yanıtın çok uzun olmasın (maksimum 2-3 kısa paragraf).
        4. Markdown formatını kullanabilirsin.
        5. Matematik ifadelerini LaTeX formatında yaz.`;

        return prompt;
    }
}
