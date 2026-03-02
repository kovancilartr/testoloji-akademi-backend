import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class FoldersService {
    constructor(private prisma: PrismaService) { }

    async getAll(userId: string) {
        const folders = await this.prisma.projectFolder.findMany({
            where: { userId },
            orderBy: { createdAt: 'asc' },
            include: {
                _count: { select: { projects: true } },
                projects: {
                    orderBy: { updatedAt: 'desc' },
                    include: { _count: { select: { questions: true } } },
                },
            },
        });
        return folders;
    }

    async create(userId: string, name: string, color?: string) {
        return await this.prisma.projectFolder.create({
            data: { name, color: color || '#f97316', userId },
        });
    }

    async update(userId: string, folderId: string, name?: string, color?: string) {
        const folder = await this.prisma.projectFolder.findFirst({ where: { id: folderId, userId } });
        if (!folder) throw new NotFoundException('Klasör bulunamadı.');
        return await this.prisma.projectFolder.update({
            where: { id: folderId },
            data: { ...(name && { name }), ...(color && { color }) },
        });
    }

    async delete(userId: string, folderId: string) {
        const folder = await this.prisma.projectFolder.findFirst({ where: { id: folderId, userId } });
        if (!folder) throw new NotFoundException('Klasör bulunamadı.');
        // Klasör silinince projeler "klasörsüz" olur (folderId → null, onDelete: SetNull)
        return await this.prisma.projectFolder.delete({ where: { id: folderId } });
    }

    async moveProject(userId: string, projectId: string, folderId: string | null) {
        const project = await this.prisma.project.findFirst({ where: { id: projectId, userId } });
        if (!project) throw new NotFoundException('Proje bulunamadı.');

        if (folderId) {
            const folder = await this.prisma.projectFolder.findFirst({ where: { id: folderId, userId } });
            if (!folder) throw new NotFoundException('Klasör bulunamadı.');
        }

        return await this.prisma.project.update({
            where: { id: projectId },
            data: { folderId },
        });
    }

    async bulkMoveProjects(userId: string, projectIds: string[], folderId: string | null) {
        if (folderId) {
            const folder = await this.prisma.projectFolder.findFirst({ where: { id: folderId, userId } });
            if (!folder) throw new NotFoundException('Klasör bulunamadı.');
        }

        // Kullanıcıya ait olmayan projeleri filtrele
        const validProjects = await this.prisma.project.findMany({
            where: { id: { in: projectIds }, userId },
            select: { id: true },
        });

        const validIds = validProjects.map(p => p.id);

        return await this.prisma.project.updateMany({
            where: { id: { in: validIds } },
            data: { folderId },
        });
    }
}
