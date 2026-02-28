import {
  Injectable,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Role, SubscriptionTier } from '@prisma/client';
import { getProjectLimit } from '../common/config/limits';

@Injectable()
export class ProjectsService {
  constructor(private prisma: PrismaService) {}

  async create(
    userId: string,
    name: string,
    userRole: Role,
    userTier: SubscriptionTier,
  ) {
    const currentCount = await this.prisma.project.count({
      where: { userId },
    });

    const limit = getProjectLimit(userRole, userTier);
    if (currentCount >= limit) {
      throw new ForbiddenException(
        `Paket limitine ulaşıldı (En fazla ${limit} proje oluşturabilirsiniz). Lütfen paketinizi yükseltin.`,
      );
    }

    return await this.prisma.project.create({
      data: {
        name,
        userId,
      },
    });
  }

  async getAllByUser(userId: string) {
    return await this.prisma.project.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      include: {
        _count: {
          select: { questions: true },
        },
      },
    });
  }

  async getById(userId: string, projectId: string) {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, userId },
      include: {
        settings: true,
        questions: {
          orderBy: { order: 'asc' },
        },
      },
    });

    if (!project) {
      throw new NotFoundException('Proje bulunamadı.');
    }

    return project;
  }

  async update(userId: string, projectId: string, name: string) {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, userId },
    });

    if (!project) {
      throw new NotFoundException('Proje bulunamadı veya yetkiniz yok.');
    }

    return await this.prisma.project.update({
      where: { id: projectId },
      data: { name },
    });
  }

  async delete(userId: string, projectId: string) {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, userId },
    });

    if (!project) {
      throw new NotFoundException('Proje bulunamadı veya yetkiniz yok.');
    }

    return await this.prisma.project.delete({
      where: { id: projectId },
    });
  }
}
