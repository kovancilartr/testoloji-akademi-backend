import { Injectable, NestMiddleware } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { TenantContext } from './tenant-context.service';

@Injectable()
export class TenantMiddleware implements NestMiddleware {
    constructor(
        private jwtService: JwtService,
        private configService: ConfigService,
    ) { }

    use(req: any, res: any, next: () => void) {
        const authHeader = req.headers.authorization;
        if (!authHeader) {
            return next();
        }

        try {
            const token = authHeader.split(' ')[1];
            const payload = this.jwtService.verify(token, {
                secret: this.configService.get('JWT_ACCESS_SECRET'),
            });

            if (payload && payload.organizationId) {
                // İsteği organizasyon bağlamında çalıştır
                return TenantContext.run(payload.organizationId, () => next());
            }
        } catch (e) {
            // Token geçersizse veya exp olmuşsa sessizce devam et (Guard hata verecektir zaten)
        }

        next();
    }
}
