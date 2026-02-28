import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';
import { ContentType } from '@prisma/client';
import { Transform, Type } from 'class-transformer';

export class AddContentDto {
  @IsString()
  @IsNotEmpty({ message: 'İçerik başlığı boş bırakılamaz.' })
  title: string;

  @IsEnum(ContentType)
  type: ContentType;

  @IsString()
  @IsOptional()
  @Transform(({ value }) => (value === '' ? undefined : value))
  url?: string;

  @IsString()
  @IsOptional()
  @Transform(({ value }) => (value === '' ? undefined : value))
  projectId?: string;

  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  order?: number;

  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  duration?: number;

  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  attemptLimit?: number;
}
