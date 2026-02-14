import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class WhatsAppService {
    private readonly logger = new Logger(WhatsAppService.name);

    async sendMessage(to: string, message: string): Promise<boolean> {
        // BURASI JENERİK BİR SERVİSTİR.
        // İleride Twilio, MessageBird veya WhatsApp Business API entegre edilebilir.
        // Şimdilik sadece logluyoruz.

        this.logger.log(`[WhatsApp Mock] Sending to ${to}: ${message}`);

        // Simülasyon: Başarılı gönderim
        return true;
    }
}
