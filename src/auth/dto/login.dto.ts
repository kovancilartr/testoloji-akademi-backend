import { IsEmail, IsString, MinLength } from 'class-validator';

export class LoginDto {
    @IsEmail({}, { message: 'Geçersiz e-posta adresi.' })
    email: string;

    @IsString()
    @MinLength(6, { message: 'Şifre hatalı veya çok kısa.' })
    password: string;
}
