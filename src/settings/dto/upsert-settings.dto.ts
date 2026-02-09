import { IsBoolean, IsHexColor, IsNumber, IsOptional, IsString } from 'class-validator';
import { Type, Transform } from 'class-transformer';

export class UpsertSettingsDto {
    @IsString()
    @IsOptional()
    title?: string;

    @IsString()
    @IsOptional()
    subtitle?: string;

    @IsString()
    @IsOptional()
    schoolName?: string;

    @IsNumber()
    @IsOptional()
    @Type(() => Number)
    colCount?: number;

    @IsNumber()
    @IsOptional()
    @Type(() => Number)
    questionSpacing?: number;

    @IsString()
    @IsOptional()
    watermarkText?: string;

    @IsBoolean()
    @IsOptional()
    @Transform(({ value }) => value === 'true' || value === true)
    showDebug?: boolean;

    @IsString()
    @IsOptional()
    primaryColor?: string;

    @IsString()
    @IsOptional()
    fontFamily?: string;

    @IsBoolean()
    @IsOptional()
    @Transform(({ value }) => value === 'true' || value === true)
    showDifficulty?: boolean;

    @IsBoolean()
    @IsOptional()
    @Transform(({ value }) => value === 'true' || value === true)
    showAnswerKey?: boolean;

    @IsString()
    @IsOptional()
    qrCodeUrl?: string;

    @IsString()
    @IsOptional()
    template?: string;

    @IsBoolean()
    @IsOptional()
    @Transform(({ value }) => value === 'true' || value === true)
    showCoverPage?: boolean;

    @IsString()
    @IsOptional()
    coverTitle?: string;
}
