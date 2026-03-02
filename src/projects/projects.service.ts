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
  constructor(private prisma: PrismaService) { }

  async create(
    userId: string,
    name: string,
    userRole: Role,
    userTier: SubscriptionTier,
    folderId?: string | null,
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
        ...(folderId ? { folderId } : {}),
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

  async update(userId: string, projectId: string, name: string, folderId?: string | null) {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, userId },
    });

    if (!project) {
      throw new NotFoundException('Proje bulunamadı veya yetkiniz yok.');
    }

    return await this.prisma.project.update({
      where: { id: projectId },
      data: {
        name,
        ...(folderId !== undefined ? { folderId } : {}),
      },
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

  async duplicate(userId: string, projectId: string, userRole: Role, userTier: SubscriptionTier) {
    const original = await this.prisma.project.findFirst({
      where: { id: projectId, userId },
      include: {
        settings: true,
        questions: {
          orderBy: { order: 'asc' },
        },
      },
    });

    if (!original) {
      throw new NotFoundException('Proje bulunamadı.');
    }

    // Limit kontrolü
    const currentCount = await this.prisma.project.count({
      where: { userId },
    });
    const limit = getProjectLimit(userRole, userTier);
    if (currentCount >= limit) {
      throw new ForbiddenException(`Paket limitine ulaşıldı. Lütfen paketinizi yükseltin.`);
    }

    // Yeni projeyi oluştur - İşlem süresini uzatalım (30 saniye)
    return await this.prisma.$transaction(async (tx) => {
      // 1. Ana projeyi oluştur
      const duplicated = await tx.project.create({
        data: {
          name: `${original.name} (Kopya)`,
          userId: original.userId,
          folderId: original.folderId,
        },
      });

      // 2. Ayarları kopyala
      if (original.settings) {
        // ID ve projectId hariç diğer alanları kopyala
        const { id, projectId: oldPid, createdAt, updatedAt, ...settingsData } = original.settings;
        await tx.settings.create({
          data: {
            ...settingsData,
            projectId: duplicated.id,
          },
        });
      }

      // 3. Soruları kopyala
      if (original.questions && original.questions.length > 0) {
        const questionsData = original.questions.map(q => {
          const { id, projectId: oldPid, createdAt, ...qData } = q;
          return {
            ...qData,
            projectId: duplicated.id,
          };
        });

        await tx.question.createMany({
          data: questionsData,
        });
      }

      // Son hali getir (count ile)
      return await tx.project.findUnique({
        where: { id: duplicated.id },
        include: {
          _count: { select: { questions: true } }
        }
      });
    }, {
      timeout: 30000, // 30 saniye
    });
  }
}
