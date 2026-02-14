import { IsEmail, IsNotEmpty, IsOptional, IsString, IsInt, Min } from 'class-validator';

export class CreateStudentDto {
    @IsString()
    @IsNotEmpty({ message: 'İsim alanı boş bırakılamaz.' })
    name: string;

    @IsEmail({}, { message: 'Geçersiz e-posta adresi.' })
    @IsOptional()
    email?: string;

    @IsString()
    @IsOptional()
    gradeLevel?: string;

    @IsString()
    @IsOptional()
    phone?: string;

    @IsString()
    @IsOptional()
    notes?: string;

    @IsInt()
    @IsOptional()
    @Min(0)
    dailyQuestionLimit?: number;
}
