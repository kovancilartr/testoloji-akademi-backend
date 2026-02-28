import { IsString, IsNumber, IsOptional, IsEnum } from 'class-validator';
import { FocusStatus } from '@prisma/client';

export class UpdateFocusSessionDto {
  @IsOptional()
  @IsNumber()
  actualTime?: number;

  @IsOptional()
  @IsNumber()
  breakTime?: number;

  @IsOptional()
  @IsEnum(FocusStatus)
  status?: FocusStatus;

  @IsOptional()
  @IsNumber()
  interruptionCount?: number;
}
