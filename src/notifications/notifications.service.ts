import { Injectable, Inject, forwardRef } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationType } from '@prisma/client';
import { NotificationsGateway } from './notifications.gateway';
import * as admin from 'firebase-admin';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class NotificationsService {
    constructor(
        private prisma: PrismaService,
        private configService: ConfigService,
        @Inject(forwardRef(() => NotificationsGateway)) private notificationsGateway: NotificationsGateway
    ) {
        this.initializeFirebase();
    }

    private initializeFirebase() {
        if (!admin.apps.length) {
            const serviceAccount = this.configService.get('FIREBASE_SERVICE_ACCOUNT');
            if (serviceAccount) {
                try {
                    const parsedAccount = JSON.parse(serviceAccount);
                    admin.initializeApp({
                        credential: admin.credential.cert(parsedAccount),
                    });
                    console.log('Firebase Admin initialized successfully');
                } catch (error) {
                    console.error('Firebase Admin initialization failed:', error);
                }
            } else {
                console.warn('FIREBASE_SERVICE_ACCOUNT not found in environment variables');
            }
        }
    }

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

        // 1. WebSocket üzerinden anlık gönder (Sayfa açıksa)
        this.notificationsGateway.sendToUser(userId, 'new_notification', notification);

        // 2. Push Notification gönder (Cihaz kayıtlıysa)
        await this.sendPushNotification(userId, data.title, data.message, data.link);

        return notification;
    }

    async registerDeviceToken(userId: string, token: string) {
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            select: { deviceTokens: true }
        });

        if (user && !user.deviceTokens.includes(token)) {
            await this.prisma.user.update({
                where: { id: userId },
                data: {
                    deviceTokens: {
                        push: token
                    }
                }
            });
        }
        return { success: true };
    }

    private async sendPushNotification(userId: string, title: string, body: string, link?: string) {
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            select: { deviceTokens: true }
        });

        if (!user || user.deviceTokens.length === 0 || !admin.apps.length) {
            return;
        }

        const message = {
            notification: { title, body },
            data: { link: link || '' },
            tokens: user.deviceTokens,
        };

        try {
            const response = await admin.messaging().sendEachForMulticast(message);
            console.log(`Push notifications sent: ${response.successCount} success, ${response.failureCount} failure`);

            // Check for invalid tokens and remove them
            if (response.failureCount > 0) {
                const invalidTokens: string[] = [];
                response.responses.forEach((resp, idx) => {
                    if (!resp.success && (
                        resp.error?.code === 'messaging/invalid-registration-token' ||
                        resp.error?.code === 'messaging/registration-token-not-registered'
                    )) {
                        invalidTokens.push(user.deviceTokens[idx]);
                    }
                });

                if (invalidTokens.length > 0) {
                    await this.prisma.user.update({
                        where: { id: userId },
                        data: {
                            deviceTokens: {
                                set: user.deviceTokens.filter(t => !invalidTokens.includes(t))
                            }
                        }
                    });
                }
            }
        } catch (error) {
            console.error('Push notification error:', error);
        }
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
