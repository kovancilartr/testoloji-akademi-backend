import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAssignmentsDto } from './dto/create-assignments.dto';
import { UpdateAssignmentDto } from './dto/update-assignment.dto';
import { Role } from '@prisma/client';

@Injectable()
export class AssignmentsService {
    constructor(private prisma: PrismaService) { }

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

        return await this.prisma.$transaction(
            studentIds.map((studentId: string) =>
                this.prisma.assignment.create({
                    data: {
                        ...rest,
                        studentId,
                        dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
                        status: 'PENDING',
                    },
                }),
            ),
        );
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
        });

        if (!existing) throw new ForbiddenException('Ödevi silme yetkiniz yok.');

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

        const totalQuestions = assignment.project?.questions.length || 0;
        let correctCount = 0;
        let incorrectCount = 0;

        if (totalQuestions > 0) {
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

        const grade = totalQuestions > 0 ? (correctCount / totalQuestions) * 100 : 0;
        const feedback = `Toplam ${totalQuestions} soruda ${correctCount} doğru. Başarı oranı: %${grade.toFixed(0)}.`;

        return await this.prisma.assignment.update({
            where: { id: assignmentId },
            data: {
                status: 'COMPLETED',
                grade: parseFloat(grade.toFixed(2)),
                correctCount,
                incorrectCount,
                completedAt: new Date(),
                feedback,
                answers,
                attemptCount: { increment: 1 },
            },
        });
    }
}
