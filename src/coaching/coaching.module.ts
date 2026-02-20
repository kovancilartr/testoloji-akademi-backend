import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { CoachingService } from './coaching.service';
import { CoachingController } from './coaching.controller';
import { CoachingProcessor } from './coaching.processor';
import { PrismaModule } from '../prisma/prisma.module';
import { ConfigModule } from '@nestjs/config';
import { AnalyticsModule } from '../analytics/analytics.module';
import { SystemSettingsModule } from '../system-settings/system-settings.module';
import { SchedulesModule } from '../schedules/schedules.module';

@Module({
    imports: [
        PrismaModule,
        ConfigModule,
        AnalyticsModule,
        SystemSettingsModule,
        SchedulesModule,
        BullModule.registerQueue({
            name: 'ai-coaching',
        }),
    ],
    controllers: [CoachingController],
    providers: [CoachingService, CoachingProcessor],
    exports: [CoachingService],
})
export class CoachingModule { }
