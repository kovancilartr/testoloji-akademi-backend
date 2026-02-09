import { IsArray, IsNotEmpty, IsNumber, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class QuestionItemDto {
    @IsString()
    @IsNotEmpty()
    imageUrl: string;

    @IsNumber()
    width: number;

    @IsNumber()
    height: number;

    @IsNumber()
    @IsOptional()
    difficulty?: number;

    @IsString()
    @IsOptional()
    correctAnswer?: string;
}

export class BulkCreateQuestionsDto {
    @IsString()
    @IsNotEmpty()
    projectId: string;

    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => QuestionItemDto)
    questions: QuestionItemDto[];
}
