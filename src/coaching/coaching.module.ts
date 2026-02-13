import { Module } from '@nestjs/common';
import { CoachingService } from './coaching.service';
import { CoachingController } from './coaching.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { ConfigModule } from '@nestjs/config';
import { AnalyticsModule } from '../analytics/analytics.module';
import { SystemSettingsModule } from '../system-settings/system-settings.module';

@Module({
    imports: [PrismaModule, ConfigModule, AnalyticsModule, SystemSettingsModule],
    controllers: [CoachingController],
    providers: [CoachingService],
    exports: [CoachingService],
})
export class CoachingModule { }
