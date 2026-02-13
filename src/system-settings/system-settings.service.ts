import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EncryptionUtil } from '../common/utils/encryption.util';

@Injectable()
export class SystemSettingsService {
    constructor(private prisma: PrismaService) { }

    async getSetting(key: string, decrypt = true): Promise<string | null> {
        const setting = await this.prisma.systemSetting.findUnique({
            where: { key },
        });

        if (!setting) return null;

        if (setting.isEncrypted && decrypt) {
            return EncryptionUtil.decrypt(setting.value);
        }

        return setting.value;
    }

    async setSetting(key: string, value: string, encrypt = false): Promise<any> {
        const finalValue = encrypt ? EncryptionUtil.encrypt(value) : value;

        return this.prisma.systemSetting.upsert({
            where: { key },
            update: {
                value: finalValue,
                isEncrypted: encrypt,
            },
            create: {
                key,
                value: finalValue,
                isEncrypted: encrypt,
            },
        });
    }

    async getAllSettings(): Promise<any[]> {
        return this.prisma.systemSetting.findMany({
            select: {
                key: true,
                isEncrypted: true,
                updatedAt: true,
            }
        });
    }

    async getAiUsageStats() {
        const logs = await this.prisma.aiUsageLog.findMany({
            orderBy: { createdAt: 'desc' },
            take: 100,
        });

        const totals = await this.prisma.aiUsageLog.aggregate({
            _sum: {
                promptTokens: true,
                completionTokens: true,
                totalTokens: true
            },
            _count: true
        });

        return {
            logs,
            totals: {
                requests: totals._count,
                promptTokens: totals._sum.promptTokens || 0,
                completionTokens: totals._sum.completionTokens || 0,
                totalTokens: totals._sum.totalTokens || 0
            }
        };
    }
}
