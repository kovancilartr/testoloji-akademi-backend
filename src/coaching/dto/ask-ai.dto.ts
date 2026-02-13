import { IsString, IsNotEmpty, IsOptional, IsObject } from 'class-validator';

export class AskAiDto {
    @IsString()
    @IsNotEmpty()
    questionId: string;

    @IsString()
    @IsOptional()
    userAnswer?: string;

    @IsString()
    @IsOptional()
    correctAnswer?: string;

    @IsObject()
    @IsOptional()
    context?: any;
}
