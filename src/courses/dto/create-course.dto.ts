import { IsNotEmpty, IsOptional, IsString, IsUrl } from 'class-validator';

export class CreateCourseDto {
  @IsString()
  @IsNotEmpty({ message: 'Kurs başlığı boş bırakılamaz.' })
  title: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  thumbnailUrl?: string;
}
