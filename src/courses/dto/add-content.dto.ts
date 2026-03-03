import { IsArray, IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString, ValidateNested } from 'class-validator';
import { ContentType } from '@prisma/client';
import { Transform, Type } from 'class-transformer';

export class AttachmentDto {
  @IsString()
  @IsOptional()
  title?: string;

  @IsString()
  @IsOptional()
  projectId?: string;

  @IsString()
  @IsOptional()
  url?: string;
}

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

  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => AttachmentDto)
  attachments?: AttachmentDto[];
}

export class UpdateContentDto extends AddContentDto { }
