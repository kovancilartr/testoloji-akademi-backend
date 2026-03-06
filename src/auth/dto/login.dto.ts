import { IsEmail, IsString, MinLength, IsOptional } from 'class-validator';

export class LoginDto {
  @IsEmail({}, { message: 'Geçersiz e-posta adresi.' })
  email: string;

  @IsString()
  @MinLength(6, { message: 'Şifre hatalı veya çok kısa.' })
  password: string;

  @IsString()
  @IsOptional()
  organizationId?: string;

  @IsString()
  @IsOptional()
  appType?: string;
}
