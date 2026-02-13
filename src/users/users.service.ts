import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Role, SubscriptionTier } from '@prisma/client';

@Injectable()
export class UsersService {
    constructor(private prisma: PrismaService) { }

    async getAllUsers() {
        const users = await this.prisma.user.findMany({
            select: {
                id: true,
                email: true,
                name: true,
                role: true,
                tier: true,
                isActive: true,
                hasCoachingAccess: true, // Include this field
                dailyAiLimit: true, // AI günlük limit
                subscriptionStarted: true,
                subscriptionExpires: true,
                createdAt: true,
                updatedAt: true,
                _count: {
                    select: {
                        projects: true,
                        students: true // Öğretmenin öğrenci sayısı (TeacherStudents relation)
                    },
                },
                // Eğer bu kullanıcı bir öğrenci ise, bağlı olduğu öğretmeni getir
                studentProfile: {
                    select: {
                        teacher: {
                            select: {
                                name: true,
                                email: true
                            }
                        }
                    }
                }
            } as any,
            orderBy: { createdAt: 'desc' },
        });

        // Veriyi frontend'in beklediği formata düzleştir
        return users.map((user: any) => ({
            ...user,
            teacher: user.studentProfile?.teacher || null
        }));
    }

    async updateUserTier(userId: string, tier: SubscriptionTier, duration?: 'monthly' | 'yearly') {
        const data: any = { tier };

        if (tier === SubscriptionTier.GUMUS || tier === SubscriptionTier.ALTIN) {
            const now = new Date();
            const expires = new Date();

            if (duration === 'yearly') {
                expires.setFullYear(expires.getFullYear() + 1);
            } else {
                expires.setMonth(expires.getMonth() + 1);
            }

            data.subscriptionStarted = now;
            data.subscriptionExpires = expires;
        } else {
            data.subscriptionStarted = null;
            data.subscriptionExpires = null;
        }

        return this.prisma.user.update({
            where: { id: userId },
            data,
        });
    }

    async updateUserRole(userId: string, role: Role) {
        return this.prisma.user.update({
            where: { id: userId },
            data: { role },
        });
    }

    async updateCoachingAccess(userId: string, hasAccess: boolean) {
        return this.prisma.user.update({
            where: { id: userId },
            data: { hasCoachingAccess: hasAccess } as any,
        });
    }

    async toggleUserStatus(userId: string) {
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            select: { isActive: true },
        });
        if (!user) throw new NotFoundException('Kullanıcı bulunamadı.');

        return this.prisma.user.update({
            where: { id: userId },
            data: { isActive: !user.isActive },
        });
    }

    async deleteUser(userId: string) {
        return this.prisma.user.delete({
            where: { id: userId },
        });
    }

    async getAdminStats() {
        const now = new Date();
        const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

        const [
            totalUsers,
            totalProjects,
            totalQuestions,
            totalCourses,
            totalAssignments,
            completedAssignments,
            pendingAssignments,
            totalCoachingSessions,
            totalEnrollments,
            activeUsersLast7Days,
            newUsersLast30Days,
        ] = await Promise.all([
            this.prisma.user.count(),
            this.prisma.project.count(),
            this.prisma.question.count(),
            this.prisma.course.count(),
            this.prisma.assignment.count(),
            this.prisma.assignment.count({ where: { status: 'COMPLETED' } }),
            this.prisma.assignment.count({ where: { status: 'PENDING' } }),
            this.prisma.coachingHistory.count(),
            this.prisma.courseEnrollment.count(),
            this.prisma.user.count({
                where: { updatedAt: { gte: sevenDaysAgo } },
            }),
            this.prisma.user.count({
                where: { createdAt: { gte: thirtyDaysAgo } },
            }),
        ]);

        const usersByRole = await this.prisma.user.groupBy({
            by: ['role'],
            _count: true,
        });

        const usersByTier = await this.prisma.user.groupBy({
            by: ['tier'],
            _count: true,
        });

        // Son 7 günlük kullanıcı kayıt trendi
        const recentUsers = await this.prisma.user.findMany({
            where: { createdAt: { gte: sevenDaysAgo } },
            select: { createdAt: true },
            orderBy: { createdAt: 'asc' },
        });

        // Son 5 kullanıcı
        const latestUsers = await this.prisma.user.findMany({
            take: 5,
            orderBy: { createdAt: 'desc' },
            select: {
                id: true,
                name: true,
                email: true,
                role: true,
                tier: true,
                createdAt: true,
            },
        });

        return {
            totalUsers,
            totalProjects,
            totalQuestions,
            totalCourses,
            totalAssignments,
            completedAssignments,
            pendingAssignments,
            totalCoachingSessions,
            totalEnrollments,
            activeUsersLast7Days,
            newUsersLast30Days,
            usersByRole,
            usersByTier,
            recentUsers,
            latestUsers,
        };
    }

    async getTeacherStats(teacherId: string) {
        const [totalProjects, totalStudents, totalCourses, totalAssignments] = await Promise.all([
            this.prisma.project.count({ where: { userId: teacherId } }),
            this.prisma.student.count({ where: { teacherId } }),
            this.prisma.course.count({ where: { instructorId: teacherId } }),
            this.prisma.assignment.count({
                where: {
                    project: { userId: teacherId },
                    status: 'PENDING',
                },
            }),
        ]);

        return {
            totalProjects,
            totalStudents,
            totalCourses,
            totalAssignments,
        };
    }

    async getStudentStats(userId: string) {
        const student = await this.prisma.student.findUnique({
            where: { userId },
        });

        if (!student) return { pending: 0, completed: 0, courses: 0 };

        const [pending, completed, courses] = await Promise.all([
            this.prisma.assignment.count({ where: { studentId: student.id, status: 'PENDING' } }),
            this.prisma.assignment.count({ where: { studentId: student.id, status: 'COMPLETED' } }),
            this.prisma.courseEnrollment.count({ where: { studentId: student.id } }),
        ]);

        return { pending, completed, courses };
    }
}
