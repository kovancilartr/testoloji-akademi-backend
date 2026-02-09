import { IsArray, IsNotEmpty, IsString } from 'class-validator';

export class ReorderQuestionsDto {
    @IsString()
    @IsNotEmpty()
    projectId: string;

    @IsArray()
    @IsString({ each: true })
    questionIds: string[];
}
