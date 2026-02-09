import { IsEmail, IsEnum, IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';
import { Role, SubscriptionTier } from '@prisma/client';

export class RegisterDto {
    @IsEmail({}, { message: 'Geçersiz e-posta adresi.' })
    email: string;

    @IsString()
    @MinLength(6, { message: 'Şifre en az 6 karakter olmalıdır.' })
    password: string;

    @IsString()
    @IsNotEmpty({ message: 'İsim alanı boş bırakılamaz.' })
    name: string;

    @IsEnum(Role, { message: 'Geçersiz rol.' })
    role: Role;

    @IsEnum(SubscriptionTier, { message: 'Geçersiz üyelik tipi.' })
    @IsOptional()
    tier?: SubscriptionTier;
}
