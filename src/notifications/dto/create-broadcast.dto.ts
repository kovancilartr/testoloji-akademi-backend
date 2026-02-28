import { IsString, IsArray, IsOptional, IsDateString } from 'class-validator';

export class CreateBroadcastDto {
  @IsString()
  title: string;

  @IsString()
  message: string;

  @IsOptional()
  @IsString()
  link?: string;

  @IsArray()
  @IsString({ each: true })
  targetUserIds: string[];

  @IsOptional()
  @IsDateString()
  scheduledFor?: string;
}
