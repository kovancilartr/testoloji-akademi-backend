import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { CoachingService } from './coaching.service';
import { NotificationsGateway } from '../notifications/notifications.gateway';
import { Injectable } from '@nestjs/common';

@Processor('ai-coaching')
@Injectable()
export class CoachingProcessor extends WorkerHost {
    constructor(
        private readonly coachingService: CoachingService,
        private readonly notificationsGateway: NotificationsGateway,
    ) {
        super();
    }

    async process(job: Job<any, any, string>): Promise<any> {
        const { userId, type, payload } = job.data;
        try {
            let result;
            if (type === 'askAi') {
                result = await this.coachingService.processAskAiInternal(userId, payload);
            } else if (type === 'analyzeProgress') {
                result = await this.coachingService.processAnalyzeProgressInternal(userId, payload);
            }

            // Başarılı olduğunda Event Fırlat veya WebSockets ile Kullanıcıyı uyar
            this.notificationsGateway.sendToUser(userId, 'ai_analysis_complete', {
                jobId: job.id,
                type,
                result
            });
            return result;
        } catch (error) {
            console.error(`AI Job failed for userId ${userId}:`, error.message);
            this.notificationsGateway.sendToUser(userId, 'ai_analysis_error', {
                jobId: job.id,
                type,
                error: "Yapay zeka analizi sırasında bir hata oluştu."
            });
            throw error;
        }
    }
}
