import { Injectable, Inject, forwardRef } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationType, BroadcastStatus } from '@prisma/client';
import { NotificationsGateway } from './notifications.gateway';
import * as admin from 'firebase-admin';
import { ConfigService } from '@nestjs/config';
import { CreateBroadcastDto } from './dto/create-broadcast.dto';
import { Cron, CronExpression } from '@nestjs/schedule';

@Injectable()
export class NotificationsService {
  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
    @Inject(forwardRef(() => NotificationsGateway))
    private notificationsGateway: NotificationsGateway,
  ) {
    this.initializeFirebase();
  }

  // Her dakika planlanmış bildirimleri kontrol et
  @Cron(CronExpression.EVERY_MINUTE)
  async handleScheduledNotifications() {
    const now = new Date();
    const pendingBroadcasts = await this.prisma.notificationBroadcast.findMany({
      where: {
        status: BroadcastStatus.SCHEDULED,
        scheduledFor: {
          lte: now,
        },
      },
    });

    for (const broadcast of pendingBroadcasts) {
      await this.executeBroadcast(broadcast);
    }
  }

  private async executeBroadcast(broadcast: any) {
    try {
      // Her bir hedef kullanıcı için bildirim oluştur
      for (const userId of broadcast.targetUserIds) {
        const notification = await this.prisma.notification.create({
          data: {
            userId,
            title: broadcast.title,
            message: broadcast.message,
            link: broadcast.link,
            type: NotificationType.INFO,
          },
        });

        // WebSocket üzerinden anlık gönder
        this.notificationsGateway.sendToUser(
          userId,
          'new_notification',
          notification,
        );

        // Push Notification gönder
        await this.sendPushNotification(
          userId,
          broadcast.title,
          broadcast.message,
          broadcast.link,
          broadcast.id,
        );
      }

      // Durumu güncelle
      await this.prisma.notificationBroadcast.update({
        where: { id: broadcast.id },
        data: { status: BroadcastStatus.SENT },
      });
      console.log(`Broadcast ${broadcast.id} sent successfully.`);
    } catch (error) {
      console.error(`Broadcast ${broadcast.id} failed:`, error);
      await this.prisma.notificationBroadcast.update({
        where: { id: broadcast.id },
        data: { status: BroadcastStatus.FAILED },
      });
    }
  }

  async createBroadcast(teacherId: string, dto: CreateBroadcastDto) {
    const scheduledFor = dto.scheduledFor ? new Date(dto.scheduledFor) : null;
    const status = scheduledFor
      ? BroadcastStatus.SCHEDULED
      : BroadcastStatus.PENDING;

    const broadcast = await this.prisma.notificationBroadcast.create({
      data: {
        senderId: teacherId,
        title: dto.title,
        message: dto.message,
        link: dto.link,
        targetUserIds: dto.targetUserIds,
        scheduledFor,
        status,
      },
    });

    // Eğer planlanmamışsa hemen gönder
    if (status === BroadcastStatus.PENDING) {
      await this.executeBroadcast(broadcast);
    }

    return broadcast;
  }

  async getBroadcastHistory(teacherId: string) {
    return this.prisma.notificationBroadcast.findMany({
      where: { senderId: teacherId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async deleteBroadcast(teacherId: string, broadcastId: string) {
    return this.prisma.notificationBroadcast.delete({
      where: {
        id: broadcastId,
        senderId: teacherId, // Sadece kendi sildiklerini silsin
      },
    });
  }

  async clearBroadcastHistory(teacherId: string) {
    return this.prisma.notificationBroadcast.deleteMany({
      where: {
        senderId: teacherId,
      },
    });
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
        console.warn(
          'FIREBASE_SERVICE_ACCOUNT not found in environment variables',
        );
      }
    }
  }

  async create(
    userId: string,
    data: {
      title: string;
      message: string;
      type: NotificationType;
      link?: string;
    },
  ) {
    const notification = await this.prisma.notification.create({
      data: {
        userId,
        ...data,
      },
    });

    // 1. WebSocket üzerinden anlık gönder (Sayfa açıksa)
    this.notificationsGateway.sendToUser(
      userId,
      'new_notification',
      notification,
    );

    // 2. Push Notification gönder (Cihaz kayıtlıysa)
    await this.sendPushNotification(
      userId,
      data.title,
      data.message,
      data.link,
    );

    return notification;
  }

  async registerDeviceToken(userId: string, token: string, oldToken?: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { deviceTokens: true },
    });

    if (!user) return { success: false };

    let updatedTokens = [...user.deviceTokens];

    // Eğer eski bir token belirtilmişse ve listede varsa, onu çıkar
    if (oldToken && updatedTokens.includes(oldToken)) {
      updatedTokens = updatedTokens.filter((t) => t !== oldToken);
    }

    // Yeni token listede yoksa ekle
    if (!updatedTokens.includes(token)) {
      updatedTokens.push(token);
    }

    // Güvenlik: Bir kullanıcı için çok fazla token birikmesini önleyelim (Limit: 5)
    if (updatedTokens.length > 5) {
      updatedTokens = updatedTokens.slice(-5);
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        deviceTokens: {
          set: updatedTokens,
        },
      },
    });

    return { success: true };
  }

  private async sendPushNotification(
    userId: string,
    title: string,
    body: string,
    link?: string,
    tag?: string,
  ) {
    console.log(`[PUSH] Bildirim süreci başladı. Hedef: ${userId}`);

    if (!admin.apps.length) {
      console.error(
        `[PUSH] HATA: Firebase Admin SDK başlatılmamış! .env dosyasını kontrol edin.`,
      );
      return;
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { deviceTokens: true, name: true },
    });

    if (!user) {
      console.warn(`[PUSH] UYARI: Kullanıcı bulunamadı (ID: ${userId})`);
      return;
    }

    const uniqueTokens = Array.from(
      new Set(user.deviceTokens.filter((t) => !!t)),
    );

    if (uniqueTokens.length === 0) {
      console.log(
        `[PUSH] BILGI: Kullanıcının (${user.name}) kayıtlı cihaz token'ı yok.`,
      );
      return;
    }

    console.log(
      `[PUSH] Gönderiliyor: "${title}" | Alıcı: ${user.name} | Token Sayısı: ${uniqueTokens.length}`,
    );

    const message: any = {
      notification: {
        title,
        body,
      },
      data: {
        title, // Veri kısmına da ekleyelim (yerele göre yedek)
        body,
        link: link || '',
      },
      webpush: {
        headers: {
          Urgency: 'high',
          TTL: '86400', // 24 saat boyunca teslimat denensin
        },
        notification: {
          title,
          body,
          icon: '/icon-192x192.png',
          badge: '/icon-192x192.png',
          tag: tag || 'general-notification',
          renotify: true, // Aynı tag'li yeni bildirimde titreşim/ses tekrar çalışsın
          requireInteraction: true, // Kullanıcı kapatana kadar ekranda kalsın
        },
      },
      android: {
        priority: 'high',
        notification: {
          priority: 'max',
          channelId: 'default',
          defaultSound: true,
          defaultVibrateTimings: true,
        },
      },
      tokens: uniqueTokens,
    };

    try {
      const response = await admin.messaging().sendEachForMulticast(message);
      console.log(
        `[PUSH] SONUÇ (${user.name}): Başarılı: ${response.successCount}, Başarısız: ${response.failureCount}`,
      );

      if (response.failureCount > 0) {
        const invalidTokens: string[] = [];
        response.responses.forEach((resp, idx) => {
          if (!resp.success) {
            const errorCode = resp.error?.code;
            console.error(
              `[PUSH] Cihaz Hatası (${uniqueTokens[idx].substring(0, 10)}...):`,
              errorCode,
            );

            if (
              errorCode === 'messaging/invalid-registration-token' ||
              errorCode === 'messaging/registration-token-not-registered'
            ) {
              invalidTokens.push(uniqueTokens[idx]);
            }
          }
        });

        if (invalidTokens.length > 0) {
          console.log(
            `[PUSH] Temizlik: ${invalidTokens.length} adet geçersiz token siliniyor.`,
          );
          await this.prisma.user.update({
            where: { id: userId },
            data: {
              deviceTokens: {
                set: user.deviceTokens.filter(
                  (t) => !invalidTokens.includes(t),
                ),
              },
            },
          });
        }
      }
    } catch (error) {
      console.error(`[PUSH] KRITIK HATA:`, error);
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
      where: { id: notificationId, userId },
    });
  }

  async deleteAll(userId: string) {
    return this.prisma.notification.deleteMany({
      where: { userId },
    });
  }
}
