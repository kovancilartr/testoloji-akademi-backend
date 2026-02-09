import { IsEnum, IsNumber, IsOptional, IsString } from 'class-validator';
import { AssignmentStatus } from '@prisma/client';

export class UpdateAssignmentDto {
    @IsEnum(AssignmentStatus)
    @IsOptional()
    status?: AssignmentStatus;

    @IsNumber()
    @IsOptional()
    grade?: number;

    @IsString()
    @IsOptional()
    feedback?: string;
}
