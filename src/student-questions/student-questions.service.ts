import { Injectable, BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';


import { CreateQuestionDto } from './dto/create-question.dto';
import { WhatsAppService } from 'src/tools/whatsapp.service';
import { UploadThingService } from 'src/tools/uploadthing.service';
import { AnswerQuestionDto } from './dto/answer-question.dto';
import { NotificationsService } from 'src/notifications/notifications.service';
import { NotificationType, SubscriptionTier } from '@prisma/client';

@Injectable()
export class StudentQuestionsService {
    constructor(
        private prisma: PrismaService,
        private whatsapp: WhatsAppService,
        private uploadthing: UploadThingService,
        private notifications: NotificationsService
    ) { }

    async create(userId: string, createQuestionDto: CreateQuestionDto) {
        // 1. Öğrenciyi ve limitlerini kontrol et
        const student = await this.prisma.student.findUnique({
            where: { userId },
            include: {
                user: true,
                teacher: true,
                questions: {
                    where: {
                        createdAt: {
                            gte: new Date(new Date().setHours(0, 0, 0, 0)) // Bugünün başlangıcı
                        },
                        OR: [
                            { isDeleted: false },
                            { status: 'ANSWERED' }
                        ]
                    }
                }
            }
        });

        if (!student) {
            throw new NotFoundException('Öğrenci bulunamadı.');
        }

        const tierQuestionLimits = {
            [SubscriptionTier.BRONZ]: 1,
            [SubscriptionTier.GUMUS]: 5,
            [SubscriptionTier.ALTIN]: 20,
            [SubscriptionTier.FREE]: 1
        };

        const DAILY_LIMIT = student.dailyQuestionLimit || tierQuestionLimits[student.user?.tier as SubscriptionTier] || 1;
        const todayCount = student.questions.length;

        if (todayCount >= DAILY_LIMIT) {
            throw new BadRequestException(`Günlük soru limitiniz (${DAILY_LIMIT}) dolmuştur. Paketine göre limitin dolmuştur, yarın tekrar sorabilirsin.`);
        }

        // 2. Base64 ise UploadThing'e yükle
        let finalImageUrl = createQuestionDto.imageUrl;
        if (createQuestionDto.imageUrl.startsWith('data:image')) {
            try {
                const uploadRes = await this.uploadthing.uploadBase64(createQuestionDto.imageUrl, `question_${userId}_${Date.now()}.png`);
                if (uploadRes && uploadRes.url) {
                    finalImageUrl = uploadRes.url;
                }
            } catch (error) {
                console.error("UploadThing upload error:", error);
                throw new BadRequestException('Görsel yüklenirken bir hata oluştu.');
            }
        }

        // 3. Soruyu oluştur
        const question = await this.prisma.studentQuestion.create({
            data: {
                studentId: student.id,
                teacherId: student.teacherId,
                lesson: createQuestionDto.lesson,
                imageUrl: finalImageUrl,
                status: 'PENDING'
            }
        });

        // 3. WhatsApp Bildirimi Gönder (Öğretmene)
        if (student.teacher?.phone) {
            const message = `📚 *Yeni Soru Var!*\n\nÖğrenci: ${student.name}\nDers: ${createQuestionDto.lesson}\n\nSoru Görseli: ${finalImageUrl}\n\nCevaplamak için panele gidin: https://testoloji.com/dashboard/questions`;
            await this.whatsapp.sendMessage(student.teacher.phone, message);
        }

        // 4. Panel Bildirimi Gönder (Öğretmene)
        if (student.teacherId) {
            try {
                await this.notifications.create(student.teacherId, {
                    title: 'Yeni Soru Geldi!',
                    message: `${student.name} isimli öğrenciniz ${createQuestionDto.lesson} dersinden bir soru sordu.`,
                    type: NotificationType.QUESTION_ASKED,
                    link: '/dashboard/questions'
                });
            } catch (error) {
                console.error("Notification error (Teacher):", error);
            }
        }

        return question;
    }

    async findAllForStudent(userId: string) {
        const student = await this.prisma.student.findUnique({
            where: { userId }
        });

        if (!student) return [];

        return this.prisma.studentQuestion.findMany({
            where: {
                studentId: student.id,
                isDeleted: false
            },
            orderBy: { createdAt: 'desc' }
        });
    }

    async findAllForTeacher(userId: string) {
        return this.prisma.studentQuestion.findMany({
            where: {
                teacherId: userId,
                isDeleted: false
            },
            include: { student: true },
            orderBy: { createdAt: 'desc' }
        });
    }

    async answer(teacherId: string, questionId: string, answerDto: AnswerQuestionDto) {
        const question = await this.prisma.studentQuestion.findUnique({
            where: { id: questionId },
            include: { student: true }
        });

        if (!question) {
            throw new NotFoundException('Soru bulunamadı');
        }

        if (question.teacherId !== teacherId) {
            throw new ForbiddenException('Bu soruyu cevaplama yetkiniz yok');
        }

        // Base64 ise UploadThing'e yükle
        let finalAnswerUrl = answerDto.answerUrl;
        if (answerDto.answerUrl && answerDto.answerUrl.startsWith('data:image')) {
            try {
                const uploadRes = await this.uploadthing.uploadBase64(answerDto.answerUrl, `answer_${teacherId}_${Date.now()}.png`);
                if (uploadRes && uploadRes.url) {
                    finalAnswerUrl = uploadRes.url;
                }
            } catch (error) {
                console.error("UploadThing answer upload error:", error);
                throw new BadRequestException('Cevap görseli yüklenirken bir hata oluştu.');
            }
        }

        const updated = await this.prisma.studentQuestion.update({
            where: { id: questionId },
            data: {
                answerUrl: finalAnswerUrl,
                answerText: answerDto.answerText,
                status: 'ANSWERED',
                answeredAt: new Date()
            }
        });

        // 4. Panel Bildirimi Gönder (Öğrenciye)
        if (question.student.userId) {
            try {
                await this.notifications.create(question.student.userId, {
                    title: 'Sorunuz Cevaplandı!',
                    message: `${question.lesson} dersinden sorduğunuz soru öğretmeniniz tarafından çözüldü.`,
                    type: NotificationType.QUESTION_ANSWERED,
                    link: '/dashboard/student/questions'
                });
            } catch (error) {
                console.error("Notification error (Student):", error);
            }
        }

        return updated;
    }

    async findOne(id: string) {
        return this.prisma.studentQuestion.findUnique({
            where: { id },
            include: { student: true }
        });
    }
    async getDailyStats(userId: string) {
        const student = await this.prisma.student.findUnique({
            where: { userId },
            include: {
                user: true,
                questions: {
                    where: {
                        createdAt: {
                            gte: new Date(new Date().setHours(0, 0, 0, 0))
                        },
                        OR: [
                            { isDeleted: false },
                            { status: 'ANSWERED' }
                        ]
                    }
                }
            }
        });

        if (!student) {
            throw new NotFoundException('Öğrenci bulunamadı.');
        }

        const tierQuestionLimits = {
            [SubscriptionTier.BRONZ]: 1,
            [SubscriptionTier.GUMUS]: 5,
            [SubscriptionTier.ALTIN]: 20,
            [SubscriptionTier.FREE]: 1
        };

        const currentLimit = student.dailyQuestionLimit || tierQuestionLimits[student.user?.tier as SubscriptionTier] || 1;

        return {
            limit: currentLimit,
            used: student.questions.length,
            remaining: Math.max(0, currentLimit - student.questions.length)
        };
    }

    async remove(userId: string, id: string) {
        const student = await this.prisma.student.findUnique({
            where: { userId }
        });

        if (!student) {
            throw new NotFoundException('Öğrenci bulunamadı.');
        }

        const question = await this.prisma.studentQuestion.findUnique({
            where: { id }
        });

        if (!question) {
            throw new NotFoundException('Soru bulunamadı.');
        }

        if (question.studentId !== student.id) {
            throw new ForbiddenException('Bu soruyu silme yetkiniz yok.');
        }

        return this.prisma.studentQuestion.update({
            where: { id },
            data: { isDeleted: true }
        });
    }
}
