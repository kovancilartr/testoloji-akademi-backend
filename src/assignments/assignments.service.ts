import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAssignmentsDto } from './dto/create-assignments.dto';
import { UpdateAssignmentDto } from './dto/update-assignment.dto';
import { Role, NotificationType } from '@prisma/client';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class AssignmentsService {
    constructor(
        private prisma: PrismaService,
        private notificationsService: NotificationsService
    ) { }

    async listAssignments(userId: string, role: Role, studentId?: string) {
        if (role === Role.STUDENT) {
            const student = await this.prisma.student.findFirst({
                where: { userId },
            });

            if (!student) return [];

            return await this.prisma.assignment.findMany({
                where: { studentId: student.id },
                orderBy: { createdAt: 'desc' },
                include: {
                    student: { select: { id: true, name: true } },
                    project: { select: { id: true, name: true } },
                },
            });
        }

        const whereClause: any = {
            student: { teacherId: userId },
        };

        if (studentId) {
            whereClause.studentId = studentId;
        }

        return await this.prisma.assignment.findMany({
            where: whereClause,
            orderBy: { createdAt: 'desc' },
            include: {
                student: { select: { id: true, name: true } },
                project: { select: { id: true, name: true } },
            },
        });
    }

    async createAssignments(dto: CreateAssignmentsDto) {
        const { studentIds, ...rest } = dto;

        // Ödevleri transaction içinde oluştur
        const assignments = await this.prisma.$transaction(
            studentIds.map((studentId) =>
                this.prisma.assignment.create({
                    data: {
                        ...rest,
                        studentId,
                        dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
                        status: 'PENDING',
                    },
                    include: {
                        student: {
                            select: {
                                id: true,
                                userId: true,
                                name: true
                            }
                        }
                    }
                })
            )
        );

        // Bildirimleri asenkron olarak güvenli bir şekilde gönder
        const notificationPromises = assignments.map(async (assignment) => {
            const userId = assignment.student?.userId;
            if (userId) {
                try {
                    await this.notificationsService.create(userId, {
                        title: 'Yeni Ödev Atandı',
                        message: `"${assignment.title}" başlıklı yeni bir ödeviniz var.`,
                        type: NotificationType.ASSIGNMENT_CREATED,
                        link: assignment.type === 'TEST'
                            ? `/dashboard/student/exam/${assignment.id}`
                            : '/dashboard/student/assignments'
                    });
                } catch (error) {
                    console.error(`Notification failed for user ${userId}:`, error);
                }
            }
        });

        // Bildirimlerin bitmesini bekle ama hata alırlarsa genel işlemi bozma
        await Promise.allSettled(notificationPromises);

        return assignments;
    }

    async updateAssignment(teacherId: string, assignmentId: string, dto: UpdateAssignmentDto) {
        const existing = await this.prisma.assignment.findFirst({
            where: {
                id: assignmentId,
                student: { teacherId },
            },
        });

        if (!existing) throw new NotFoundException('Ödev bulunamadı.');

        return await this.prisma.assignment.update({
            where: { id: assignmentId },
            data: {
                ...dto,
                completedAt: dto.status === 'COMPLETED' ? new Date() : undefined,
            },
        });
    }

    async deleteAssignment(teacherId: string, assignmentId: string) {
        const existing = await this.prisma.assignment.findFirst({
            where: {
                id: assignmentId,
                student: { teacherId },
            },
            include: {
                student: {
                    select: {
                        id: true,
                        userId: true,
                    }
                }
            }
        });

        if (!existing) throw new ForbiddenException('Ödevi silme yetkiniz yok.');

        // Send notification to student if linked to a user
        const studentUserId = existing.student?.userId;
        if (studentUserId) {
            try {
                await this.notificationsService.create(studentUserId, {
                    title: 'Ödev İptal Edildi',
                    message: `"${existing.title}" başlıklı ödeviniz öğretmeniniz tarafından iptal edildi.`,
                    type: NotificationType.INFO,
                });
            } catch (error) {
                console.warn(`Could not send deletion notification to student ${studentUserId}`, error);
            }
        }

        return await this.prisma.assignment.delete({
            where: { id: assignmentId },
        });
    }

    async getAssignmentResult(userId: string, role: Role, assignmentId: string) {
        let where: any = { id: assignmentId };

        if (role === Role.STUDENT) {
            const student = await this.prisma.student.findFirst({ where: { userId } });
            if (!student) throw new NotFoundException('Öğrenci bulunamadı.');
            where.studentId = student.id;
        } else {
            where.student = { teacherId: userId };
        }

        const assignment = await this.prisma.assignment.findFirst({
            where,
            include: {
                student: { select: { id: true, name: true, gradeLevel: true } },
                project: {
                    include: {
                        questions: {
                            orderBy: { order: 'asc' },
                        },
                    },
                },
            },
        });

        if (!assignment) throw new NotFoundException('Ödev bulunamadı.');

        // Security: Hide correct answers if student hasn't completed it
        const isCompleted = assignment.status === 'COMPLETED';
        const isTeacher = role !== Role.STUDENT;

        if (assignment.project && assignment.project.questions) {
            if (!isCompleted && !isTeacher) {
                assignment.project.questions = assignment.project.questions.map((q) => {
                    const { correctAnswer, ...rest } = q;
                    return { ...rest, correctAnswer: null };
                }) as any;
            }
        }

        return assignment;
    }

    async submitAssignment(userId: string, assignmentId: string, answers: Record<string, string>) {
        const student = await this.prisma.student.findFirst({ where: { userId } });
        if (!student) throw new NotFoundException('Öğrenci bulunamadı.');

        const assignment = await this.prisma.assignment.findFirst({
            where: { id: assignmentId, studentId: student.id },
            include: { project: { include: { questions: true } } },
        });

        if (!assignment) throw new NotFoundException('Ödev bulunamadı.');

        if (assignment.status === 'COMPLETED' && assignment.attemptCount >= assignment.allowedAttempts) {
            throw new ForbiddenException('Maksimum deneme hakkına ulaştınız.');
        }

        const isTest = assignment.type === 'TEST';
        const totalQuestions = isTest ? (assignment.project?.questions.length || 0) : 0;
        let correctCount = 0;
        let incorrectCount = 0;

        if (isTest && totalQuestions > 0) {
            assignment.project?.questions.forEach((q) => {
                const answer = answers[q.id];
                if (answer) {
                    if (q.correctAnswer && answer === q.correctAnswer) {
                        correctCount++;
                    } else {
                        incorrectCount++;
                    }
                }
            });
        }

        const grade = totalQuestions > 0 ? (correctCount / totalQuestions) * 100 : (isTest ? 0 : 100);
        const feedback = isTest
            ? `Toplam ${totalQuestions} soruda ${correctCount} doğru. Başarı oranı: %${grade.toFixed(0)}.`
            : 'İçerik başarıyla tamamlandı.';

        return await this.prisma.assignment.update({
            where: { id: assignmentId },
            data: {
                status: 'COMPLETED',
                grade: parseFloat(grade.toFixed(2)),
                correctCount: isTest ? correctCount : null,
                incorrectCount: isTest ? incorrectCount : null,
                completedAt: new Date(),
                feedback,
                answers: isTest ? answers : {},
                attemptCount: { increment: 1 },
            },
        });
    }

    async undoSubmitAssignment(userId: string, assignmentId: string) {
        const student = await this.prisma.student.findFirst({ where: { userId } });
        if (!student) throw new NotFoundException('Öğrenci bulunamadı.');

        const assignment = await this.prisma.assignment.findFirst({
            where: { id: assignmentId, studentId: student.id },
        });

        if (!assignment) throw new NotFoundException('Ödev bulunamadı.');
        if (assignment.type === 'TEST') throw new ForbiddenException('Sınav sonuçları geri alınamaz.');

        return await this.prisma.assignment.update({
            where: { id: assignmentId },
            data: {
                status: 'PENDING',
                completedAt: null,
                grade: null,
                correctCount: null,
                incorrectCount: null,
                feedback: null,
                answers: {}, // Using empty object for JSON reset to satisfy types
            },
        });
    }

    async getMakeUpSuggestions(userId: string) {
        const student = await this.prisma.student.findFirst({ where: { userId } });
        if (!student) throw new NotFoundException('Öğrenci bulunamadı.');

        // Unutma Eğrisi (Spaced Repetition) mantığı:
        // En az 1 yanlışı olan ve daha önce çözülmüş testleri getirir.
        // İleride buraya "tarihe göre (1 hafta önce, 1 ay önce)" gibi zaman filtreleri eklenebilir.
        return await this.prisma.assignment.findMany({
            where: {
                studentId: student.id,
                type: 'TEST',
                status: 'COMPLETED',
                incorrectCount: { gt: 0 },
                NOT: [
                    { title: { contains: 'Tekrar Testi' } },
                    { title: { contains: 'Karma Telafi' } }
                ]
            },
            include: {
                project: { select: { id: true, name: true } }
            },
            orderBy: { completedAt: 'asc' }, // Eskiden yeniye doğru (önce eskileri hatırlatmak için)
            take: 3
        });
    }

    async createMakeUpAssignment(userId: string, originalAssignmentId: string) {
        const student = await this.prisma.student.findFirst({ where: { userId } });
        if (!student) throw new NotFoundException('Öğrenci bulunamadı.');

        const originalAssignment = await this.prisma.assignment.findFirst({
            where: { id: originalAssignmentId, studentId: student.id, status: 'COMPLETED', type: 'TEST' },
            include: { project: { include: { questions: true } } }
        });

        if (!originalAssignment || !originalAssignment.project) {
            throw new NotFoundException('Orijinal sınav bulunamadı veya henüz tamamlanmamış.');
        }

        const answers = (originalAssignment.answers || {}) as Record<string, string>;
        const questionsToReview = originalAssignment.project.questions.filter(q => {
            const studentAnswer = answers[q.id];
            // Boş bırakılanlar veya yanlış cevaplananlar
            return !studentAnswer || studentAnswer !== q.correctAnswer;
        });

        if (questionsToReview.length === 0) {
            throw new ForbiddenException('Bu sınavda tekrar edilecek hatalı veya boş soru bulunmuyor.');
        }

        // Testin orjinal ismini bul (eğer bu testin kendisi zaten bir Tekrar Testi ise onu ayıkla)
        const baseTitleMatch = originalAssignment.title.match(/(?:\(\d+\)\s*)?Tekrar Testi:\s*(.*)/);
        const baseTitle = baseTitleMatch ? baseTitleMatch[1] : originalAssignment.title;

        // Check if there is already a PENDING assignment for this make-up test
        const existingPending = await this.prisma.assignment.findFirst({
            where: {
                studentId: student.id,
                title: {
                    endsWith: baseTitle,
                    contains: "Tekrar Testi"
                },
                status: 'PENDING'
            }
        });

        if (existingPending) {
            return {
                success: true,
                newAssignmentId: existingPending.id,
                message: 'Ödev testiniz zaten mevcut, Ödevlerim kısmında hazır.'
            };
        }

        // Varsa daha önceki tamamlanmış Tekrar Testleri sayısını bul
        const totalMakeUpsCount = await this.prisma.assignment.count({
            where: {
                studentId: student.id,
                title: {
                    endsWith: baseTitle,
                    contains: "Tekrar Testi"
                }
            }
        });

        const prefix = totalMakeUpsCount > 0 ? `(${totalMakeUpsCount + 1}) Tekrar Testi:` : `Tekrar Testi:`;
        const newTitle = `${prefix} ${baseTitle}`;

        // Yeni bir Proje oluştur (öğrencinin kendi profili altında)
        const newProject = await this.prisma.project.create({
            data: {
                name: `Tekrar Testi: ${originalAssignment.project.name}`,
                userId: userId, // Projenin sahibi öğrencinin kendi User hesabı oluyor
                questions: {
                    create: questionsToReview.map(q => ({
                        imageUrl: q.imageUrl,
                        correctAnswer: q.correctAnswer,
                        order: q.order,
                        width: q.width,
                        height: q.height,
                        bottomSpacing: q.bottomSpacing,
                        difficulty: q.difficulty
                    }))
                }
            }
        });

        // Öğrenciye bu projeyi yeni bir Ödev (Sınav) olarak ata
        const newAssignment = await this.prisma.assignment.create({
            data: {
                studentId: student.id,
                title: newTitle,
                type: 'TEST',
                status: 'PENDING',
                projectId: newProject.id,
                duration: 0, // Telafi testinde zaman sınırı esnek bırakılabilir
                allowedAttempts: 1,
            }
        });

        return { success: true, newAssignmentId: newAssignment.id };
    }

    async createCombinedMakeUpAssignment(userId: string) {
        const student = await this.prisma.student.findFirst({ where: { userId } });
        if (!student) throw new NotFoundException('Öğrenci bulunamadı.');

        // Get all completed TEST assignments with mistakes
        const pastAssignments = await this.prisma.assignment.findMany({
            where: {
                studentId: student.id,
                type: 'TEST',
                status: 'COMPLETED',
                incorrectCount: { gt: 0 },
                NOT: [
                    { title: { contains: 'Tekrar Testi' } },
                    { title: { contains: 'Karma Telafi' } }
                ]
            },
            include: { project: { include: { questions: true } } },
            orderBy: { completedAt: 'asc' }
        });

        if (pastAssignments.length === 0) {
            throw new ForbiddenException('Telafi edilecek hatalı testiniz bulunmuyor.');
        }

        const allQuestionsToReview: any[] = [];
        let orderCounter = 0;

        for (const assignment of pastAssignments) {
            if (!assignment.project) continue;

            const answers = (assignment.answers || {}) as Record<string, string>;
            const mistakenQuestions = assignment.project.questions.filter(q => {
                const studentAnswer = answers[q.id];
                return !studentAnswer || studentAnswer !== q.correctAnswer;
            });

            for (const mq of mistakenQuestions) {
                allQuestionsToReview.push({
                    imageUrl: mq.imageUrl,
                    correctAnswer: mq.correctAnswer,
                    order: orderCounter++,
                    width: mq.width,
                    height: mq.height,
                    bottomSpacing: mq.bottomSpacing,
                    difficulty: mq.difficulty
                });
            }
        }

        if (allQuestionsToReview.length === 0) {
            throw new ForbiddenException('Geçmiş testlerde kaydedilmiş hiçbir hatalı veya boş soru bulunamadı.');
        }

        // Limit the number of questions in one go (e.g. 50 questions) to avoid massive exams
        const finalQuestions = allQuestionsToReview.slice(0, 50);

        const combinedTitle = `Karma Telafi Testi`;

        // Check if there is already a PENDING combined assignment
        const existingPending = await this.prisma.assignment.findFirst({
            where: {
                studentId: student.id,
                title: { contains: "Karma Telafi Testi" },
                status: 'PENDING'
            }
        });

        if (existingPending) {
            return {
                success: true,
                newAssignmentId: existingPending.id,
                message: 'Ödev testiniz zaten mevcut, Ödevlerim kısmında hazır.'
            };
        }

        // Karma Telafi Testi sayısını bul
        const totalCombinedCount = await this.prisma.assignment.count({
            where: {
                studentId: student.id,
                title: { contains: "Karma Telafi Testi" }
            }
        });

        const prefix = totalCombinedCount > 0 ? `(${totalCombinedCount + 1}) ` : ``;
        const newCombinedTitle = `${prefix}Karma Telafi Testi`;

        // Yeni bir Proje oluştur (öğrencinin kendi profili altında)
        const newProject = await this.prisma.project.create({
            data: {
                name: `${newCombinedTitle} (${finalQuestions.length} Soru)`,
                userId: userId,
                questions: {
                    create: finalQuestions
                }
            }
        });

        // Öğrenciye bu projeyi yeni bir Ödev (Sınav) olarak ata
        const newAssignment = await this.prisma.assignment.create({
            data: {
                studentId: student.id,
                title: newCombinedTitle,
                type: 'TEST',
                status: 'PENDING',
                projectId: newProject.id,
                duration: 0,
                allowedAttempts: 1,
            }
        });

        return { success: true, newAssignmentId: newAssignment.id };
    }
}
