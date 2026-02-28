import {
  Injectable,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Role, SubscriptionTier } from '@prisma/client';
import { getQuestionLimit } from '../common/config/limits';

@Injectable()
export class QuestionsService {
  constructor(private prisma: PrismaService) {}

  async create(
    projectId: string,
    imageUrl: string,
    userRole: Role,
    userTier: SubscriptionTier,
    userId: string,
    width: number,
    height: number,
  ) {
    return (
      await this.bulkCreate(
        projectId,
        [{ imageUrl, width, height }],
        userRole,
        userTier,
        userId,
      )
    )[0];
  }

  async bulkCreate(
    projectId: string,
    questions: {
      imageUrl: string;
      width: number;
      height: number;
      difficulty?: number | null;
      correctAnswer?: string | null;
    }[],
    userRole: Role,
    userTier: SubscriptionTier,
    userId: string,
  ) {
    // Check global limits for this user
    const currentCount = await this.prisma.question.count({
      where: { project: { userId } },
    });

    const limit = getQuestionLimit(userRole, userTier);
    if (currentCount + questions.length > limit) {
      throw new ForbiddenException(
        `Paket toplam soru limitine ulaşıldı (En fazla ${limit} soru). Mevcut: ${currentCount}. Lütfen paketinizi yükseltin.`,
      );
    }

    // Determine the next order number
    const lastQuestion = await this.prisma.question.findFirst({
      where: { projectId },
      orderBy: { order: 'desc' },
    });

    let nextOrder = lastQuestion ? lastQuestion.order + 1 : 1;

    // Use transaction for consistency
    const createdQuestions = await this.prisma.$transaction(
      questions.map((q) =>
        this.prisma.question.create({
          data: {
            projectId,
            imageUrl: q.imageUrl,
            width: q.width,
            height: q.height,
            difficulty: q.difficulty ?? null,
            correctAnswer: q.correctAnswer ?? null,
            order: nextOrder++,
          },
        }),
      ),
    );

    return createdQuestions;
  }

  async update(questionId: string, data: any) {
    return await this.prisma.question.update({
      where: { id: questionId },
      data,
    });
  }

  async delete(questionId: string) {
    return await this.prisma.question.delete({
      where: { id: questionId },
    });
  }

  async updateOrder(projectId: string, questionIds: string[]) {
    return await this.prisma.$transaction(
      questionIds.map((id, index) =>
        this.prisma.question.update({
          where: { id, projectId },
          data: { order: index + 1 },
        }),
      ),
    );
  }

  async getByProject(projectId: string) {
    return await this.prisma.question.findMany({
      where: { projectId },
      orderBy: { order: 'asc' },
    });
  }
}
