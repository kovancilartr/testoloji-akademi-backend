import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateFocusSessionDto } from './dto/create-focus-session.dto';
import { UpdateFocusSessionDto } from './dto/update-focus-session.dto';
import { FocusStatus, Role } from '@prisma/client';
import { NotificationsGateway } from '../notifications/notifications.gateway';

@Injectable()
export class FocusService {
    constructor(
        private prisma: PrismaService,
        private notificationsGateway: NotificationsGateway
    ) { }

    private async notifyTeacher(teacherId: string | null, session: any) {
        if (!teacherId) {
            console.warn('[FocusService] notifyTeacher: TeacherId is null, skipping socket update.');
            return;
        }
        console.log(`[FocusService] Sending focus update to teacher room: user_${teacherId}`, {
            sessionId: session.id,
            status: session.status,
            studentName: session.student?.name
        });
        this.notificationsGateway.sendToUser(teacherId, 'focus_session_update', session);
    }

    async createSession(userId: string, dto: CreateFocusSessionDto) {
        const student = await this.prisma.student.findUnique({
            where: { userId }
        });

        if (!student) throw new NotFoundException('Öğrenci profili bulunamadı.');

        // Cancel any previous sessions that were left in progress
        await this.prisma.focusSession.updateMany({
            where: {
                studentId: student.id,
                status: FocusStatus.IN_PROGRESS
            },
            data: {
                status: FocusStatus.CANCELLED,
                endTime: new Date()
            }
        });

        const session = await this.prisma.focusSession.create({
            data: {
                studentId: student.id,
                subject: dto.subject,
                duration: dto.duration,
                status: FocusStatus.IN_PROGRESS
            },
            include: { student: true }
        });

        this.notifyTeacher(student.teacherId, session);
        return session;
    }

    async updateSession(userId: string, sessionId: string, dto: UpdateFocusSessionDto) {
        const session = await this.prisma.focusSession.findUnique({
            where: { id: sessionId },
            include: { student: true }
        });

        if (!session) throw new NotFoundException('Oturum bulunamadı.');

        if (session.student.userId !== userId) {
            throw new ForbiddenException('Bu oturumu güncelleme yetkiniz yok.');
        }

        const updateData: any = { ...dto };
        if (dto.status && dto.status !== FocusStatus.IN_PROGRESS) {
            updateData.endTime = new Date();
        }

        const updated = await this.prisma.focusSession.update({
            where: { id: sessionId },
            data: updateData,
            include: { student: true }
        });

        this.notifyTeacher(session.student.teacherId, updated);
        return updated;
    }

    async breakFocus(userId: string, sessionId: string) {
        const session = await this.prisma.focusSession.findUnique({
            where: { id: sessionId },
            include: { student: true }
        });

        if (!session) throw new NotFoundException('Oturum bulunamadı.');
        if (session.student.userId !== userId) {
            throw new ForbiddenException('Yetkisiz işlem.');
        }

        const updated = await this.prisma.focusSession.update({
            where: { id: sessionId },
            data: {
                interruptionCount: { increment: 1 }
            },
            include: { student: true }
        });

        this.notifyTeacher(session.student.teacherId, updated);

        return updated;
    }

    async getStudentHistory(userId: string) {
        const student = await this.prisma.student.findUnique({
            where: { userId }
        });

        if (!student) throw new NotFoundException('Öğrenci profili bulunamadı.');

        return this.prisma.focusSession.findMany({
            where: { studentId: student.id },
            orderBy: { createdAt: 'desc' }
        });
    }

    async getTeacherStudentSessions(teacherId: string, studentId: string) {
        const student = await this.prisma.student.findUnique({
            where: { id: studentId }
        });

        if (!student) throw new NotFoundException('Öğrenci bulunamadı.');
        if (student.teacherId !== teacherId) {
            throw new ForbiddenException('Bu öğrenci size bağlı değil.');
        }

        return this.prisma.focusSession.findMany({
            where: { studentId },
            orderBy: { createdAt: 'desc' }
        });
    }

    async getActiveSessions(teacherId: string) {
        // Auto-cancel stale sessions (older than 3 hours)
        const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000);
        await this.prisma.focusSession.updateMany({
            where: {
                status: FocusStatus.IN_PROGRESS,
                startTime: { lt: threeHoursAgo },
                student: { teacherId }
            },
            data: {
                status: FocusStatus.CANCELLED,
                endTime: new Date()
            }
        });

        return this.prisma.focusSession.findMany({
            where: {
                status: FocusStatus.IN_PROGRESS,
                student: {
                    teacherId: teacherId
                }
            },
            include: {
                student: {
                    select: {
                        id: true,
                        name: true
                    }
                }
            },
            orderBy: { startTime: 'desc' }
        });
    }

    async getTeacherAllStudentsHistory(teacherId: string) {
        return this.prisma.focusSession.findMany({
            where: {
                student: {
                    teacherId: teacherId
                }
            },
            include: {
                student: {
                    select: {
                        id: true,
                        name: true
                    }
                }
            },
            orderBy: { createdAt: 'desc' },
            take: 100 // Limit to last 100 for now
        });
    }

    async clearTeacherAllStudentsHistory(teacherId: string) {
        // Find all student IDs that belong to the teacher
        const students = await this.prisma.student.findMany({
            where: { teacherId },
            select: { id: true }
        });

        const studentIds = students.map(s => s.id);

        if (studentIds.length === 0) return { count: 0 };

        return this.prisma.focusSession.deleteMany({
            where: {
                studentId: { in: studentIds }
            }
        });
    }
}
