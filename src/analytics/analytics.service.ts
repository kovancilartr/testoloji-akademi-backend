import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Role } from '@prisma/client';

@Injectable()
export class AnalyticsService {
  constructor(private prisma: PrismaService) {}

  async getStudentOverview(reqUserId: string, role: Role, studentId: string) {
    // Find the student
    const student = (await this.prisma.student.findUnique({
      where: { id: studentId },
      include: {
        user: { select: { id: true, name: true, email: true } },
        enrollments: {
          include: {
            course: {
              include: {
                modules: {
                  include: { contents: true },
                },
              },
            },
          },
        },
        assignments: {
          where: { type: 'TEST', status: 'COMPLETED' },
          orderBy: { createdAt: 'desc' },
          include: {
            project: {
              select: {
                questions: {
                  select: {
                    id: true,
                    imageUrl: true,
                    correctAnswer: true,
                    order: true,
                  },
                },
              },
            },
          },
        },
        contentProgress: true,
      },
    })) as any;

    if (!student) throw new NotFoundException('Öğrenci bulunamadı.');

    // Security check: Teacher can only see their own students, Student can only see themselves
    if (role === Role.STUDENT && student.userId !== reqUserId) {
      throw new ForbiddenException('Bu verileri görme yetkiniz yok.');
    }
    if (role === Role.TEACHER && student.teacherId !== reqUserId) {
      throw new ForbiddenException('Bu öğrenci size bağlı değil.');
    }

    // 1. Calculate Course Progress
    const courseProgress = student.enrollments.map((enrollment) => {
      const course = enrollment.course;
      const totalContents = course.modules.reduce(
        (acc, mod) => acc + mod.contents.length,
        0,
      );
      const completedContents = student.contentProgress.filter(
        (cp) =>
          cp.status === 'COMPLETED' &&
          course.modules.some(
            (mod) =>
              mod.id === cp.contentId ||
              mod.contents.some((c) => c.id === cp.contentId),
          ),
      ).length;

      const percent =
        totalContents > 0
          ? Math.round((completedContents / totalContents) * 100)
          : 0;

      return {
        id: course.id,
        title: course.title,
        percent,
        completed: completedContents,
        total: totalContents,
      };
    });

    // 2. Exam Analysis
    const exams = student.assignments;
    const avgScore =
      exams.length > 0
        ? Math.round(
            exams.reduce((acc, ex) => acc + (ex.grade || 0), 0) / exams.length,
          )
        : 0;

    const scoreHistory = exams
      .map((ex) => {
        const answers = (ex.answers as Record<string, string>) || {};
        const questions = ex.project?.questions || [];

        let correct = 0;
        let wrong = 0;

        questions.forEach((q) => {
          const studentAnswer = answers[q.id];
          if (studentAnswer) {
            if (studentAnswer === q.correctAnswer) {
              correct++;
            } else {
              wrong++;
            }
          }
        });

        // Net calculation: standard 4 wrongs 1 right removed (4y 1d götürür kuralı varsa opsiyonel eklenebilir)
        const net = correct - wrong / 4;

        return {
          id: ex.id,
          assignmentId: ex.id,
          date: ex.completedAt,
          title: ex.title,
          grade: ex.grade,
          correctCount: correct,
          wrongCount: wrong,
          netCount: parseFloat(net.toFixed(2)),
          totalQuestions: questions.length,
          hasAiAnalysis: !!ex.aiAnalysis,
          questions: questions.map((q) => ({
            id: q.id,
            imageUrl: q.imageUrl,
            correctAnswer: q.correctAnswer,
            studentAnswer: answers[q.id] || null,
            order: q.order,
          })),
        };
      })
      .reverse();

    // 3. AI Suggestions (Algorithmic)
    const suggestions = this.generateSuggestions(
      avgScore,
      courseProgress,
      exams,
    );

    return {
      studentName: student.name,
      courseProgress,
      avgScore,
      scoreHistory,
      totalExams: exams.length,
      suggestions,
    };
  }

  async getStudentOverviewByUserId(userId: string) {
    const student = await this.prisma.student.findUnique({
      where: { userId },
    });
    if (!student) throw new NotFoundException('Öğrenci profili bulunamadı.');
    return this.getStudentOverview(userId, Role.STUDENT, student.id);
  }

  private generateSuggestions(
    avgScore: number,
    courseProgress: any[],
    exams: any[],
  ) {
    const suggestions: { type: string; message: string; target: string }[] = [];

    if (avgScore < 50 && exams.length > 0) {
      suggestions.push({
        type: 'WARNING',
        message:
          'Sınav ortalaman düşük görünüyor. Temel konuları tekrar etmeni öneririm.',
        target: 'Tüm Konular',
      });
    }

    const lowProgressCourses = courseProgress.filter((c) => c.percent < 30);
    if (lowProgressCourses.length > 0) {
      suggestions.push({
        type: 'INFO',
        message: `${lowProgressCourses[0].title} kursuna henüz yeni başlamışsın, düzenli çalışmaya özen göster.`,
        target: lowProgressCourses[0].title,
      });
    }

    if (avgScore > 85) {
      suggestions.push({
        type: 'SUCCESS',
        message:
          'Harika gidiyorsun! Sınav sonuçların çok başarılı. Yeni ve daha zorlu konulara geçebilirsin.',
        target: 'Genel Performans',
      });
    }

    // Default suggestion if list is empty
    if (suggestions.length === 0) {
      suggestions.push({
        type: 'INFO',
        message:
          'Çalışmalarına devam et, ilerlemeni buradan takip edebilirsin.',
        target: 'Genel',
      });
    }

    return suggestions;
  }

  async getTeacherOverview(teacherId: string) {
    const students = await this.prisma.student.findMany({
      where: { teacherId },
      include: {
        assignments: {
          where: { status: 'COMPLETED' },
          include: {
            project: {
              select: {
                questions: {
                  select: { id: true, correctAnswer: true },
                },
              },
            },
          },
        },
        enrollments: true,
      },
    });

    const studentData = students.map((s) => {
      const exams = s.assignments;
      let totalCorrect = 0;
      let totalWrong = 0;
      let totalNet = 0;

      exams.forEach((ex) => {
        const answers = (ex.answers as Record<string, string>) || {};
        const questions = ex.project?.questions || [];
        let correct = 0;
        let wrong = 0;

        questions.forEach((q) => {
          const studentAnswer = answers[q.id];
          if (studentAnswer) {
            if (studentAnswer === q.correctAnswer) correct++;
            else wrong++;
          }
        });

        const net = correct - wrong / 4;
        totalCorrect += correct;
        totalWrong += wrong;
        totalNet += net;
      });

      const avgGrade =
        exams.length > 0
          ? exams.reduce((acc, a) => acc + (a.grade || 0), 0) / exams.length
          : 0;

      const avgNet = exams.length > 0 ? totalNet / exams.length : 0;

      return {
        id: s.id,
        name: s.name,
        avgGrade: Math.round(avgGrade),
        enrollmentCount: s.enrollments.length,
        totalCorrect,
        totalWrong,
        avgNet: parseFloat(avgNet.toFixed(2)),
      };
    });

    return {
      totalStudents: students.length,
      studentData,
      averageClassGrade: Math.round(
        studentData.reduce((acc, s) => acc + s.avgGrade, 0) /
          (studentData.length || 1),
      ),
    };
  }
}
