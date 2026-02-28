import { IsString, IsNotEmpty, IsOptional, IsObject } from 'class-validator';

export class AnalyzeProgressDto {
  @IsString()
  @IsNotEmpty()
  query: string;

  @IsObject()
  @IsOptional()
  studentData?: any;

  @IsString()
  @IsOptional()
  studentId?: string;
}
