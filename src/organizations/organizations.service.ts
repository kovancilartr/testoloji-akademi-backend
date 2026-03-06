import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class OrganizationsService {
    constructor(private prisma: PrismaService) { }

    async create(data: { name: string; slug: string; ownerId?: string }) {
        const existing = await this.prisma.organization.findUnique({
            where: { slug: data.slug },
        });
        if (existing) {
            throw new ConflictException('Bu slug zaten kullanımda.');
        }

        return this.prisma.organization.create({
            data,
        });
    }

    async findAll() {
        const organizations = await this.prisma.organization.findMany({
            include: {
                _count: {
                    select: { users: true, students: true },
                },
            },
        });

        // İstatistikleri daha detaylı hesapla
        const enrichedOrgs = await Promise.all(organizations.map(async (org) => {
            const [teacherCount, studentCount, projectCount, courseCount, classroomCount] = await Promise.all([
                this.prisma.user.count({
                    where: { organizationId: org.id, role: 'TEACHER' },
                }),
                this.prisma.student.count({
                    where: { teacher: { organizationId: org.id } },
                }),
                this.prisma.project.count({
                    where: { user: { organizationId: org.id } },
                }),
                this.prisma.course.count({
                    where: { instructor: { organizationId: org.id } },
                }),
                this.prisma.classroom.count({
                    where: { teacher: { organizationId: org.id } },
                }),
            ]);

            return {
                ...org,
                teacherCount,
                studentCount,
                projectCount,
                courseCount,
                classroomCount,
            };
        }));

        return enrichedOrgs;
    }

    async findBySlug(slug: string) {
        const org = await this.prisma.organization.findUnique({
            where: { slug },
        });
        if (!org) {
            throw new NotFoundException('Organizasyon bulunamadı.');
        }
        return org;
    }

    async findByCustomDomain(domain: string) {
        const org = await this.prisma.organization.findUnique({
            where: { customDomain: domain },
        });
        if (!org) {
            throw new NotFoundException('Organizasyon bulunamadı.');
        }
        return org;
    }

    async update(id: string, data: any) {
        // Slug güncelleniyorsa çakışma kontrolü
        if (data.slug) {
            const existing = await this.prisma.organization.findFirst({
                where: {
                    slug: data.slug,
                    NOT: { id },
                },
            });
            if (existing) {
                throw new ConflictException('Bu slug başka bir kurum tarafından kullanılıyor.');
            }
        }

        return this.prisma.organization.update({
            where: { id },
            data,
        });
    }

    async remove(id: string) {
        const org = await this.findOne(id);
        if (!org) throw new NotFoundException('Kurum bulunamadı.');

        // Bağlı kullanıcılar varsa silmeye izin verme (Veya opsiyonel olarak kademeli sil)
        const userCount = await this.prisma.user.count({ where: { organizationId: id } });
        if (userCount > 0) {
            throw new ConflictException('Bu kuruma bağlı kullanıcılar olduğu için silinemez.');
        }

        return this.prisma.organization.delete({ where: { id } });
    }

    async findOne(id: string) {
        const organization = await this.prisma.organization.findUnique({
            where: { id },
            include: {
                users: {
                    where: { role: 'TEACHER' },
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        isActive: true,
                        tier: true,
                        createdAt: true,
                    },
                },
            },
        });

        if (!organization) {
            throw new NotFoundException('Kurum bulunamadı.');
        }

        // Verileri detaylı çek - Sadece kuruma bağlı öğretmenlerin verilerini getir
        const [students, projects, courses, classrooms] = await Promise.all([
            this.prisma.student.findMany({
                where: { teacher: { organizationId: id } },
                include: {
                    teacher: { select: { name: true, email: true } },
                    classroom: { select: { name: true } },
                },
                orderBy: { createdAt: 'desc' },
            }),
            this.prisma.project.findMany({
                where: { user: { organizationId: id } },
                include: {
                    user: { select: { name: true } },
                    _count: { select: { questions: true } },
                },
                orderBy: { createdAt: 'desc' },
            }),
            this.prisma.course.findMany({
                where: { instructor: { organizationId: id } },
                include: {
                    instructor: { select: { name: true } },
                    _count: { select: { modules: true, enrollments: true } },
                },
                orderBy: { createdAt: 'desc' },
            }),
            this.prisma.classroom.findMany({
                where: { teacher: { organizationId: id } },
                include: {
                    teacher: { select: { name: true } },
                    _count: { select: { students: true } },
                },
                orderBy: { createdAt: 'desc' },
            }),
        ]);

        return {
            ...organization,
            students,
            projects,
            courses,
            classrooms,
            _count: {
                users: organization.users.length,
                students: students.length,
                projects: projects.length,
                courses: courses.length,
                classrooms: classrooms.length,
            },
        };
    }
}
