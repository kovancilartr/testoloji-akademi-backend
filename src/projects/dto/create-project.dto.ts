import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateProjectDto {
  @IsString()
  @IsNotEmpty({ message: 'Proje adı boş bırakılamaz.' })
  @MaxLength(100, { message: 'Proje adı en fazla 100 karakter olabilir.' })
  name: string;

  @IsString()
  @IsOptional()
  folderId?: string | null;
}
