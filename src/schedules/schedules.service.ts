import {
  Injectable,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateScheduleDto } from './dto/create-schedule.dto';
import { Role, NotificationType } from '@prisma/client';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class SchedulesService {
  constructor(
    private prisma: PrismaService,
    private notificationsService: NotificationsService,
  ) {}

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

    if (!student)
      throw new ForbiddenException('Öğrenciye erişim yetkiniz yok.');

    return await this.prisma.schedule.findMany({
      where: { studentId },
      orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
    });
  }

  async createItem(teacherId: string, dto: CreateScheduleDto) {
    const student = await this.prisma.student.findFirst({
      where: { id: dto.studentId, teacherId },
    });

    if (!student)
      throw new ForbiddenException('Öğrenciye erişim yetkiniz yok.');

    // Convert date string to Date object if present
    const data: any = {
      studentId: dto.studentId,
      dayOfWeek: dto.dayOfWeek,
      startTime: dto.startTime,
      endTime: dto.endTime,
      isAllDay: dto.isAllDay || false,
      activity: dto.activity,
      isCompleted: false,
      courseId: dto.courseId,
      contentId: dto.contentId,
      subject: dto.subject,
      note: dto.note,
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
        link: '/dashboard/student/schedule',
      });
    }

    return newItem;
  }

  async updateItem(
    teacherId: string,
    scheduleId: string,
    dto: Partial<CreateScheduleDto>,
  ) {
    const existing = await this.prisma.schedule.findFirst({
      where: {
        id: scheduleId,
        student: { teacherId },
      },
    });

    if (!existing) throw new NotFoundException('Kayıt bulunamadı.');

    const data: any = {
      dayOfWeek: dto.dayOfWeek,
      startTime: dto.startTime,
      endTime: dto.endTime,
      isAllDay: dto.isAllDay,
      activity: dto.activity,
      courseId: dto.courseId,
      contentId: dto.contentId,
      subject: dto.subject,
      note: dto.note,
    };

    if (dto.date) {
      data.date = new Date(dto.date);
    }

    return await this.prisma.schedule.update({
      where: { id: scheduleId },
      data,
    });
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

  async toggleComplete(
    userId: string,
    role: Role,
    scheduleId: string,
    isCompleted: boolean,
  ) {
    const where: any = { id: scheduleId };

    if (role === Role.STUDENT) {
      const student = await this.prisma.student.findFirst({
        where: { userId },
      });
      if (!student) throw new ForbiddenException('Profiliniz bulunamadı.');
      where.studentId = student.id;
    } else {
      where.student = { teacherId: userId };
    }

    const check = await this.prisma.schedule.findFirst({ where });
    if (!check) throw new NotFoundException('Kayıt bulunamadı.');

    return await this.prisma.schedule.update({
      where: { id: scheduleId },
      data: { isCompleted },
    });
  }

  async getStats(userId: string, role: Role, studentId?: string) {
    let targetStudentId: string;

    if (role === Role.STUDENT) {
      const student = await this.prisma.student.findFirst({
        where: { userId },
      });
      if (!student) {
        return { total: 0, completed: 0, percentage: 0, daily: [] };
      }
      targetStudentId = student.id;
    } else {
      if (!studentId)
        throw new ForbiddenException('Öğrenci ID belirtilmelidir.');
      const student = await this.prisma.student.findFirst({
        where: { id: studentId, teacherId: userId },
      });
      if (!student)
        throw new ForbiddenException('Öğrenciye erişim yetkiniz yok.');
      targetStudentId = student.id;
    }

    const schedules = await this.prisma.schedule.findMany({
      where: { studentId: targetStudentId },
    });

    const total = schedules.length;
    const completed = schedules.filter((s) => s.isCompleted).length;
    const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;

    // Last 7 days daily stats
    const daily: any[] = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      const dayOfWeek = date.getDay() === 0 ? 7 : date.getDay();

      const dayTasks = schedules.filter((s) => {
        if (s.date) {
          const sDateStr = s.date.toISOString().split('T')[0];
          return sDateStr === dateStr;
        }
        return s.dayOfWeek === dayOfWeek;
      });

      daily.push({
        date: dateStr,
        label:
          i === 0
            ? 'Bugün'
            : date.toLocaleDateString('tr-TR', { weekday: 'short' }),
        total: dayTasks.length,
        completed: dayTasks.filter((s) => s.isCompleted).length,
      });
    }

    return {
      total,
      completed,
      percentage,
      daily,
    };
  }

  async createBulk(teacherId: string, dtos: CreateScheduleDto[]) {
    if (!dtos.length) return { count: 0 };
    const studentId = dtos[0].studentId;

    const student = await this.prisma.student.findFirst({
      where: { id: studentId, teacherId },
    });

    if (!student)
      throw new ForbiddenException('Öğrenciye erişim yetkiniz yok.');

    const data = dtos.map((dto) => ({
      studentId,
      dayOfWeek: dto.dayOfWeek,
      startTime: dto.startTime,
      endTime: dto.endTime,
      isAllDay: dto.isAllDay || false,
      activity: dto.activity,
      isCompleted: false,
      courseId: dto.courseId,
      contentId: dto.contentId,
      subject: dto.subject,
      note: dto.note,
      date: dto.date ? new Date(dto.date) : undefined,
    }));

    const result = await this.prisma.schedule.createMany({
      data,
    });

    // Bildirim gönder
    if (student.userId) {
      await this.notificationsService.create(student.userId, {
        title: 'Ders Programı Güncellendi',
        message: `Takviminize ${dtos.length} yeni etkinlik eklendi.`,
        type: NotificationType.SCHEDULE_UPDATED,
        link: '/dashboard/student/schedule',
      });
    }

    return result;
  }

  async getScheduleSummary(studentId: string) {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const schedules = await this.prisma.schedule.findMany({
      where: {
        studentId,
        OR: [
          { date: { gte: thirtyDaysAgo } },
          { date: null }, // Recurring tasks
        ],
      },
    });

    const total = schedules.length;
    const completed = schedules.filter((s) => s.isCompleted).length;
    const completionRate =
      total > 0 ? Math.round((completed / total) * 100) : 0;

    // Group by subject to see focus areas
    const subjectStats: Record<string, { total: number; completed: number }> =
      {};
    schedules.forEach((s) => {
      const subject = s.subject || 'Diğer';
      if (!subjectStats[subject]) {
        subjectStats[subject] = { total: 0, completed: 0 };
      }
      subjectStats[subject].total++;
      if (s.isCompleted) subjectStats[subject].completed++;
    });

    return {
      period: 'Son 30 Gün',
      totalActivities: total,
      completedActivities: completed,
      completionRate,
      subjectStats,
    };
  }
}
