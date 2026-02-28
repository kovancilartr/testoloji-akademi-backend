import {
  IsArray,
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';
import { AssignmentType } from '@prisma/client';

export class CreateAssignmentsDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsEnum(AssignmentType)
  type: AssignmentType;

  @IsArray()
  @IsString({ each: true })
  studentIds: string[];

  @IsString()
  @IsOptional()
  projectId?: string;

  @IsString()
  @IsOptional()
  externalUrl?: string;

  @IsDateString()
  @IsOptional()
  dueDate?: string;

  @IsNumber()
  @IsOptional()
  duration?: number;

  @IsNumber()
  @IsOptional()
  allowedAttempts?: number;
}
