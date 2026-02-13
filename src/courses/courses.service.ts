import { Injectable, NotFoundException, BadRequestException, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCourseDto } from './dto/create-course.dto';
import { AddModuleDto } from './dto/add-module.dto';
import { AddContentDto } from './dto/add-content.dto';
import { ProgressStatus } from '@prisma/client';

@Injectable()
export class CoursesService {
    constructor(private prisma: PrismaService) { }

    private async getStudentIdFromUserId(userId: string): Promise<string> {
        const student = await this.prisma.student.findFirst({
            where: { userId },
        });
        if (!student) {
            throw new UnauthorizedException('Öğrenci profili bulunamadı.');
        }
        return student.id;
    }

    async listCourses(instructorId: string) {
        return await this.prisma.course.findMany({
            where: { instructorId },
            include: {
                _count: {
                    select: { modules: true, enrollments: true },
                },
            },
            orderBy: { createdAt: 'desc' },
        });
    }

    async listAllCourses() {
        return await this.prisma.course.findMany({
            include: {
                instructor: {
                    select: { id: true, name: true, email: true },
                },
                _count: {
                    select: { modules: true, enrollments: true },
                },
            },
            orderBy: { createdAt: 'desc' },
        });
    }

    async createCourse(instructorId: string, dto: CreateCourseDto) {
        return await this.prisma.course.create({
            data: {
                ...dto,
                instructorId,
            },
        });
    }

    async getCourseDetail(courseId: string) {
        const course = await this.prisma.course.findUnique({
            where: { id: courseId },
            include: {
                modules: {
                    orderBy: { order: 'asc' },
                    include: {
                        contents: {
                            orderBy: { order: 'asc' },
                            include: {
                                project: {
                                    select: { id: true, name: true },
                                },
                            },
                        },
                    },
                },
                enrollments: {
                    select: { studentId: true },
                },
            },
        });

        if (!course) throw new NotFoundException('Kurs bulunamadı.');
        return course;
    }

    async addModule(courseId: string, dto: AddModuleDto) {
        return await this.prisma.courseModule.create({
            data: {
                courseId,
                ...dto,
            },
        });
    }

    async addContent(moduleId: string, dto: AddContentDto) {
        const data: any = { ...dto };
        if (data.projectId === '') {
            data.projectId = null;
        }
        if (data.url === '') {
            data.url = null;
        }

        return await this.prisma.courseContent.create({
            data: {
                moduleId,
                ...data,
            },
        });
    }

    async enrollStudent(courseId: string, studentId: string) {
        try {
            return await this.prisma.courseEnrollment.create({
                data: {
                    courseId,
                    studentId,
                },
            });
        } catch (e) {
            throw new BadRequestException('Öğrenci zaten bu kursa kayıtlı.');
        }
    }

    async unenrollStudent(courseId: string, studentId: string) {
        return await this.prisma.courseEnrollment.delete({
            where: {
                courseId_studentId: {
                    courseId,
                    studentId,
                },
            },
        });
    }

    async updateCourse(courseId: string, data: Partial<CreateCourseDto> & { isPublished?: boolean }) {
        return await this.prisma.course.update({
            where: { id: courseId },
            data,
        });
    }

    async reorderModules(courseId: string, moduleIds: string[]) {
        return await this.prisma.$transaction(
            moduleIds.map((id, index) =>
                this.prisma.courseModule.update({
                    where: { id, courseId },
                    data: { order: index + 1 },
                }),
            ),
        );
    }

    async reorderContents(moduleId: string, contentIds: string[]) {
        return await this.prisma.$transaction(
            contentIds.map((id, index) =>
                this.prisma.courseContent.update({
                    where: { id, moduleId },
                    data: { order: index + 1 },
                }),
            ),
        );
    }

    async updateModule(moduleId: string, title: string) {
        return await this.prisma.courseModule.update({
            where: { id: moduleId },
            data: { title },
        });
    }

    async deleteModule(moduleId: string) {
        return await this.prisma.courseModule.delete({
            where: { id: moduleId },
        });
    }

    async updateContent(contentId: string, data: any) {
        const updateData: any = { ...data };
        if (updateData.projectId === '') {
            updateData.projectId = null;
        }

        if (updateData.url === '') {
            updateData.url = null;
        }

        return await this.prisma.courseContent.update({
            where: { id: contentId },
            data: updateData,
        });
    }

    async deleteContent(contentId: string) {
        return await this.prisma.courseContent.delete({
            where: { id: contentId },
        });
    }

    async listStudentCourses(userId: string) {
        const studentId = await this.getStudentIdFromUserId(userId);
        return await this.prisma.courseEnrollment.findMany({
            where: { studentId },
            include: {
                course: {
                    include: {
                        instructor: { select: { name: true } },
                        _count: { select: { modules: true } },
                    },
                },
            },
        });
    }

    async getStudentCourseDetail(courseId: string, userId: string) {
        const studentId = await this.getStudentIdFromUserId(userId);
        const course = await this.prisma.course.findUnique({
            where: { id: courseId },
            include: {
                instructor: { select: { name: true, email: true } },
                modules: {
                    orderBy: { order: 'asc' },
                    include: {
                        contents: {
                            orderBy: { order: 'asc' },
                            include: {
                                project: { select: { id: true, name: true } },
                                progress: {
                                    where: { studentId },
                                    select: { status: true },
                                },
                            },
                        },
                    },
                },
            },
        });

        if (!course) return null;

        // Sınav (Assignment) bilgilerini ekle
        const projectIds = course.modules
            .flatMap(m => m.contents)
            .filter(c => c.type === 'TEST' && c.projectId)
            .map(c => c.projectId)
            .filter((id): id is string => id !== null);

        if (projectIds.length > 0) {
            const [allAssignments, allQuestions] = await Promise.all([
                this.prisma.assignment.findMany({
                    where: {
                        studentId,
                        OR: [
                            { projectId: { in: projectIds } },
                            { contentId: { not: null } }
                        ]
                    },
                    orderBy: { createdAt: 'desc' },
                    select: {
                        id: true,
                        projectId: true,
                        contentId: true,
                        title: true,
                        status: true,
                        grade: true,
                        correctCount: true,
                        incorrectCount: true,
                        answers: true,
                        createdAt: true
                    }
                }),
                this.prisma.question.findMany({
                    where: { projectId: { in: projectIds } },
                    select: { id: true, projectId: true, correctAnswer: true }
                })
            ]);

            course.modules.forEach(module => {
                module.contents.forEach((content: any) => {
                    if (content.type === 'TEST' && content.projectId) {
                        let contentAssignments = allAssignments.filter(a => a.contentId === content.id);

                        if (contentAssignments.length === 0) {
                            contentAssignments = allAssignments.filter(a =>
                                a.projectId === content.projectId &&
                                a.contentId === null &&
                                a.title === content.title
                            );
                        }

                        if (contentAssignments.length > 0) {
                            const lastAssignment = contentAssignments[0];
                            const totalAttempts = contentAssignments.length;

                            content.assignment = {
                                ...lastAssignment,
                                attemptCount: totalAttempts,
                                attempts: contentAssignments.map(a => {
                                    let correct = a.correctCount;
                                    let incorrect = a.incorrectCount;

                                    // Eğer DB'de yoksa (eski kayıt), cevaplardan hesapla
                                    if ((correct === null || incorrect === null) && a.answers) {
                                        correct = 0;
                                        incorrect = 0;
                                        const answers = a.answers as Record<string, string>;
                                        const questions = allQuestions.filter(q => q.projectId === a.projectId);

                                        questions.forEach(q => {
                                            const studentAnswer = answers[q.id];
                                            if (studentAnswer) {
                                                if (q.correctAnswer && studentAnswer === q.correctAnswer) {
                                                    if (correct !== null) correct++;
                                                } else {
                                                    if (incorrect !== null) incorrect++;
                                                }
                                            }
                                        });
                                    }

                                    return {
                                        id: a.id,
                                        createdAt: a.createdAt,
                                        grade: a.grade,
                                        status: a.status,
                                        correct: correct || 0,
                                        incorrect: incorrect || 0,
                                        net: (correct || 0) - ((incorrect || 0) / 4)
                                    };
                                })
                            };
                        }
                    }
                });
            });
        }

        return course;
    }

    async updateContentProgress(userId: string, contentId: string, status: ProgressStatus) {
        const studentId = await this.getStudentIdFromUserId(userId);
        return await this.prisma.contentProgress.upsert({
            where: {
                contentId_studentId: { contentId, studentId },
            },
            update: { status },
            create: { contentId, studentId, status },
        });
    }

    async startTest(userId: string, contentId: string) {
        const studentId = await this.getStudentIdFromUserId(userId);
        const content = await this.prisma.courseContent.findUnique({
            where: { id: contentId },
            include: { module: { include: { course: true } } },
        }) as any;

        if (!content || content.type !== 'TEST' || !content.projectId) {
            throw new BadRequestException('Geçerli bir sınav içeriği bulunamadı.');
        }

        let assignment = await this.prisma.assignment.findFirst({
            where: {
                studentId,
                contentId: content.id, // Content ID ile daha spesifik filtrele
                status: { not: 'COMPLETED' },
            },
        });

        if (!assignment) {
            // Check attempt limit
            const limit = content.attemptLimit || 0;
            if (limit > 0) {
                const totalAttempts = await this.prisma.assignment.count({
                    where: {
                        studentId,
                        contentId: content.id
                    }
                });

                if (totalAttempts >= limit) {
                    throw new ForbiddenException("Maksimum giriş hakkınız doldu.");
                }
            }

            assignment = await this.prisma.assignment.create({
                data: {
                    studentId,
                    projectId: content.projectId,
                    contentId: content.id, // Content ID'yi kaydet
                    title: content.title,
                    type: 'TEST',
                    status: 'PENDING',
                    dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
                    duration: content.duration || 0,
                    allowedAttempts: content.attemptLimit || 1,
                },
            });
        } else {
            // Mevcut assignment varsa, süreyi ve hak sayısını güncelle
            assignment = await this.prisma.assignment.update({
                where: { id: assignment.id },
                data: {
                    duration: content.duration || 0,
                    allowedAttempts: content.attemptLimit || 1,
                },
            });
        }

        return { assignmentId: assignment.id };
    }
}
