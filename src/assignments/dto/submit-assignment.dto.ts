import { IsNotEmpty, IsObject } from 'class-validator';

export class SubmitAssignmentDto {
    @IsObject()
    @IsNotEmpty()
    answers: Record<string, string>;
}
