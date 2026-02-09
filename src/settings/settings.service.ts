import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpsertSettingsDto } from './dto/upsert-settings.dto';

@Injectable()
export class SettingsService {
    constructor(private prisma: PrismaService) { }

    async upsert(userId: string, projectId: string, dto: UpsertSettingsDto) {
        // Ownership check
        const project = await this.prisma.project.findFirst({
            where: { id: projectId, userId },
        });

        if (!project) throw new ForbiddenException('Projeye erişim yetkiniz yok.');

        return await this.prisma.settings.upsert({
            where: { projectId },
            update: dto,
            create: {
                projectId,
                ...dto,
            },
        });
    }

    async getByProject(userId: string, projectId: string) {
        // Ownership check
        const project = await this.prisma.project.findFirst({
            where: { id: projectId, userId },
        });

        if (!project) throw new ForbiddenException('Projeye erişim yetkiniz yok.');

        const settings = await this.prisma.settings.findUnique({
            where: { projectId },
        });

        if (!settings) return null;
        return settings;
    }
}
