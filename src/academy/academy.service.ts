import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Role, NotificationType } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { CreateStudentDto } from './dto/create-student.dto';
import { UpdateStudentDto } from './dto/update-student.dto';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class AcademyService {
    constructor(
        private prisma: PrismaService,
        private notificationsService: NotificationsService
    ) { }

    async createStudent(teacherId: string, dto: CreateStudentDto) {
        const { name, gradeLevel, email, phone, notes } = dto;

        return await this.prisma.$transaction(async (tx) => {
            let userId: string | null = null;

            if (email && email.length > 0) {
                const existingUser = await tx.user.findUnique({ where: { email } });
                if (existingUser) {
                    throw new BadRequestException('Bu e-posta adresi zaten kullanımda.');
                }

                const hashedPassword = await bcrypt.hash('123456', 10); // Varsayılan şifre

                const newUser = await tx.user.create({
                    data: {
                        name,
                        email,
                        password: hashedPassword,
                        role: Role.STUDENT,
                        passwordChangeRequired: true,
                    },
                });
                userId = newUser.id;
            }

            return await tx.student.create({
                data: {
                    teacherId,
                    userId,
                    name,
                    gradeLevel,
                    email: email || null,
                    phone,
                    notes,
                    dailyQuestionLimit: dto.dailyQuestionLimit || 5, // Varsayılan 5
                },
            });
        });
    }

    async getStudents(teacherId: string) {
        return await this.prisma.student.findMany({
            where: { teacherId },
            orderBy: { createdAt: 'desc' },
            include: {
                _count: {
                    select: { assignments: true },
                },
            },
        });
    }

    async getStudentById(teacherId: string, studentId: string) {
        const student = await this.prisma.student.findFirst({
            where: { id: studentId, teacherId },
            include: {
                assignments: {
                    orderBy: { createdAt: 'desc' },
                    include: {
                        project: { select: { id: true, name: true } },
                    },
                },
                schedules: {
                    orderBy: { dayOfWeek: 'asc' },
                },
            },
        });

        if (!student) {
            throw new NotFoundException('Öğrenci bulunamadı.');
        }

        return student;
    }

    async updateStudent(teacherId: string, studentId: string, dto: UpdateStudentDto) {
        const student = await this.prisma.student.findFirst({
            where: { id: studentId, teacherId }
        });

        if (!student) throw new NotFoundException('Öğrenci bulunamadı.');

        const updatedStudent = await this.prisma.student.update({
            where: { id: studentId, teacherId },
            data: dto,
        });

        // Eğer notlar güncellendiyse bildirim gönder
        if (dto.notes && dto.notes !== student.notes && updatedStudent.userId) {
            await this.notificationsService.create(updatedStudent.userId, {
                title: 'Yeni Koçluk Notu',
                message: 'Öğretmeniniz sizin için yeni bir koçluk notu ekledi.',
                type: NotificationType.COACHING_NOTE,
                link: '/dashboard/student'
            });
        }

        return updatedStudent;
    }

    async deleteStudent(teacherId: string, studentId: string) {
        const student = await this.prisma.student.findFirst({
            where: { id: studentId, teacherId },
        });

        if (!student) {
            throw new NotFoundException('Öğrenci bulunamadı veya yetkiniz yok.');
        }

        return await this.prisma.student.delete({
            where: { id: studentId },
        });
    }
}
