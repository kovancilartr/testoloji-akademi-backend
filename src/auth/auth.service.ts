import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
    constructor(
        private prisma: PrismaService,
        private jwtService: JwtService,
        private configService: ConfigService,
    ) { }

    async register(dto: RegisterDto) {
        const existing = await this.prisma.user.findUnique({
            where: { email: dto.email },
        });

        if (existing) {
            throw new BadRequestException('Bu e-posta adresi zaten kullanımda.');
        }

        const hashedPassword = await bcrypt.hash(dto.password, 10);

        const user = await this.prisma.user.create({
            data: {
                email: dto.email,
                password: hashedPassword,
                name: dto.name,
                role: dto.role,
                tier: dto.tier || 'BRONZ',
            },
        });

        const tokens = await this.generateTokenPair(user);

        return {
            user: this.sanitizeUser(user),
            tokens,
        };
    }

    async login(dto: LoginDto) {
        const user = await this.prisma.user.findUnique({
            where: { email: dto.email },
        });

        if (!user) {
            throw new UnauthorizedException('E-posta adresi veya şifre hatalı.');
        }

        const isPasswordValid = await bcrypt.compare(dto.password, user.password);
        if (!isPasswordValid) {
            throw new UnauthorizedException('E-posta adresi veya şifre hatalı.');
        }

        if (!user.isActive) {
            throw new UnauthorizedException(
                'Hesabınız dondurulmuştur. Lütfen sistem yöneticisi ile iletişime geçin.',
            );
        }

        const tokens = await this.generateTokenPair(user);

        return {
            user: this.sanitizeUser(user),
            tokens,
        };
    }

    async refresh(refreshToken: string) {
        try {
            const payload = await this.jwtService.verifyAsync(refreshToken, {
                secret: this.configService.get('JWT_REFRESH_SECRET'),
            });

            const user = await this.prisma.user.findUnique({
                where: { id: payload.userId },
            });

            if (!user || !user.isActive) {
                throw new UnauthorizedException('Kullanıcı bulunamadı veya hesabı donduruldu.');
            }

            // Check if token exists in DB
            const tokenRecord = await this.prisma.refreshToken.findUnique({
                where: { token: refreshToken },
            });

            if (!tokenRecord || tokenRecord.expiresAt < new Date()) {
                throw new UnauthorizedException('Geçersiz veya süresi dolmuş yenileme jetonu.');
            }

            // Delete old token
            await this.prisma.refreshToken.delete({
                where: { token: refreshToken },
            });

            const tokens = await this.generateTokenPair(user);

            return { tokens };
        } catch (e) {
            throw new UnauthorizedException('Oturum süresi dolmuş, lütfen tekrar giriş yapın.');
        }
    }

    private async generateTokenPair(user: any) {
        const payload = {
            userId: user.id,
            email: user.email,
            role: user.role,
            tier: user.tier,
        };

        const [accessToken, refreshToken] = await Promise.all([
            this.jwtService.signAsync(payload),
            this.jwtService.signAsync(payload, {
                secret: this.configService.get('JWT_REFRESH_SECRET'),
                expiresIn: this.configService.get('JWT_REFRESH_EXPIRY') || '7d',
            }),
        ]);

        // Store refresh token
        await this.prisma.refreshToken.create({
            data: {
                token: refreshToken,
                userId: user.id,
                expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days matching expiry
            },
        });

        return { accessToken, refreshToken };
    }

    async logout(refreshToken: string) {
        await this.prisma.refreshToken.deleteMany({
            where: { token: refreshToken },
        });
    }

    async getProfile(userId: string) {
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
        });
        if (!user) throw new UnauthorizedException('Kullanıcı bulunamadı.');
        return this.sanitizeUser(user);
    }

    async forgotPassword(email: string) {
        const user = await this.prisma.user.findUnique({ where: { email } });
        if (!user) return;

        const token = require('crypto').randomBytes(32).toString('hex');
        const expires = new Date(Date.now() + 3600000); // 1 hour

        await this.prisma.user.update({
            where: { id: user.id },
            data: { resetToken: token, resetTokenExpires: expires },
        });

        console.log(`\n--- ŞİFRE SIFIRLAMA LİNKİ ---`);
        console.log(`Email: ${email}`);
        console.log(`Link: http://localhost:3000/auth/reset-password?token=${token}`);
        console.log(`-----------------------------\n`);
    }

    async resetPassword(token: string, newPassword: string) {
        const user = await this.prisma.user.findFirst({
            where: {
                resetToken: token,
                resetTokenExpires: { gt: new Date() },
            },
        });

        if (!user) throw new BadRequestException('Geçersiz veya süresi dolmuş sıfırlama bağlantısı.');

        const hashedPassword = await bcrypt.hash(newPassword, 10);

        await this.prisma.user.update({
            where: { id: user.id },
            data: {
                password: hashedPassword,
                resetToken: null,
                resetTokenExpires: null,
            },
        });
    }

    async changePassword(userId: string, currentPassword: string, newPassword: string) {
        const user = await this.prisma.user.findUnique({ where: { id: userId } });
        if (!user) throw new UnauthorizedException('Kullanıcı bulunamadı.');

        const isMatch = await bcrypt.compare(currentPassword, user.password);
        if (!isMatch) throw new BadRequestException('Mevcut şifreniz hatalı.');

        const hashedPassword = await bcrypt.hash(newPassword, 10);
        await this.prisma.user.update({
            where: { id: userId },
            data: {
                password: hashedPassword,
                passwordChangeRequired: false
            },
        });
    }

    private sanitizeUser(user: any) {
        const { password, resetToken, resetTokenExpires, ...result } = user;
        return result;
    }
}
