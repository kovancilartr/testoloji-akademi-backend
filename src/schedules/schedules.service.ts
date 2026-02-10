import { Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateScheduleDto } from './dto/create-schedule.dto';
import { Role, NotificationType } from '@prisma/client';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class SchedulesService {
    constructor(
        private prisma: PrismaService,
        private notificationsService: NotificationsService
    ) { }

    async getSchedule(userId: string, role: Role, studentId?: string) {
        if (role === Role.STUDENT) {
            const student = await this.prisma.student.findFirst({
                where: { userId },
            });
            if (!student) return [];

            return await this.prisma.schedule.findMany({
                where: { studentId: student.id },
                orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
            });
        }

        if (!studentId) {
            throw new ForbiddenException('Öğrenci ID belirtilmelidir.');
        }

        const student = await this.prisma.student.findFirst({
            where: { id: studentId, teacherId: userId },
        });

        if (!student) throw new ForbiddenException('Öğrenciye erişim yetkiniz yok.');

        return await this.prisma.schedule.findMany({
            where: { studentId },
            orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
        });
    }

    async createItem(teacherId: string, dto: CreateScheduleDto) {
        const student = await this.prisma.student.findFirst({
            where: { id: dto.studentId, teacherId },
        });

        if (!student) throw new ForbiddenException('Öğrenciye erişim yetkiniz yok.');

        // Convert date string to Date object if present
        const data: any = {
            studentId: dto.studentId,
            dayOfWeek: dto.dayOfWeek,
            startTime: dto.startTime,
            endTime: dto.endTime,
            activity: dto.activity,
            isCompleted: false,
            courseId: dto.courseId,
            contentId: dto.contentId,
        };

        if (dto.date) {
            data.date = new Date(dto.date);
        }

        const newItem = await this.prisma.schedule.create({
            data,
        });

        // Bildirim gönder
        if (student.userId) {
            await this.notificationsService.create(student.userId, {
                title: 'Ders Programı Güncellendi',
                message: `Takviminize yeni bir etkinlik eklendi: ${dto.activity}`,
                type: NotificationType.SCHEDULE_UPDATED,
                link: '/dashboard/student/schedule'
            });
        }

        return newItem;
    }

    async deleteItem(teacherId: string, scheduleId: string) {
        const existing = await this.prisma.schedule.findFirst({
            where: {
                id: scheduleId,
                student: { teacherId },
            },
        });

        if (!existing) throw new NotFoundException('Kayıt bulunamadı.');

        return await this.prisma.schedule.delete({ where: { id: scheduleId } });
    }

    async toggleComplete(userId: string, role: Role, scheduleId: string, isCompleted: boolean) {
        const where: any = { id: scheduleId };

        if (role === Role.STUDENT) {
            const student = await this.prisma.student.findFirst({ where: { userId } });
            if (!student) throw new ForbiddenException('Profiliniz bulunamadı.');
            where.studentId = student.id;
        } else {
            where.student = { teacherId: userId };
        }

        const existing = await this.prisma.schedule.findFirst({ where });
        if (!existing) throw new NotFoundException('Kayıt bulunamadı.');

        return await this.prisma.schedule.update({
            where: { id: scheduleId },
            data: { isCompleted },
        });
    }
}
