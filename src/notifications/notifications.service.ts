import { Injectable, Inject, forwardRef } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationType } from '@prisma/client';
import { NotificationsGateway } from './notifications.gateway';

@Injectable()
export class NotificationsService {
    constructor(
        private prisma: PrismaService,
        @Inject(forwardRef(() => NotificationsGateway)) private notificationsGateway: NotificationsGateway
    ) { }

    async create(userId: string, data: {
        title: string;
        message: string;
        type: NotificationType;
        link?: string;
    }) {
        const notification = await this.prisma.notification.create({
            data: {
                userId,
                ...data,
            },
        });

        // Bildirimi gerçek zamanlı olarak gönder
        this.notificationsGateway.sendToUser(userId, 'new_notification', notification);

        return notification;
    }

    async findAll(userId: string) {
        return this.prisma.notification.findMany({
            where: { userId },
            orderBy: { createdAt: 'desc' },
            take: 20,
        });
    }

    async markAsRead(userId: string, notificationId: string) {
        return this.prisma.notification.updateMany({
            where: { id: notificationId, userId },
            data: { isRead: true },
        });
    }

    async markAllAsRead(userId: string) {
        return this.prisma.notification.updateMany({
            where: { userId, isRead: false },
            data: { isRead: true },
        });
    }

    async getUnreadCount(userId: string) {
        return this.prisma.notification.count({
            where: { userId, isRead: false },
        });
    }

    async delete(userId: string, notificationId: string) {
        return this.prisma.notification.deleteMany({
            where: { id: notificationId, userId }
        });
    }

    async deleteAll(userId: string) {
        return this.prisma.notification.deleteMany({
            where: { userId }
        });
    }
}
