import { IsNotEmpty, IsNumber, IsOptional, IsString, IsDateString, ValidateIf } from 'class-validator';

export class CreateScheduleDto {
    @IsString()
    @IsNotEmpty()
    studentId: string;

    // Belirli bir tarih için (örn: "2026-02-10")
    @IsDateString()
    @IsOptional()
    @ValidateIf((o) => !o.dayOfWeek) // date veya dayOfWeek'den en az biri olmalı
    date?: string;

    // VEYA haftalık tekrarlayan program için (1=Pazartesi, 7=Pazar)
    @IsNumber()
    @IsOptional()
    @ValidateIf((o) => !o.date) // date veya dayOfWeek'den en az biri olmalı
    dayOfWeek?: number;

    @IsString()
    @IsOptional()
    startTime?: string;

    @IsString()
    @IsOptional()
    endTime?: string;

    @IsString()
    @IsNotEmpty()
    activity: string;

    @IsString()
    @IsOptional()
    courseId?: string;

    @IsString()
    @IsOptional()
    contentId?: string;
}
