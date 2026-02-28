import { IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';

export class CreateQuestionDto {
  @IsString()
  @IsNotEmpty()
  projectId: string;

  @IsString()
  @IsNotEmpty()
  imageUrl: string;

  @IsNumber()
  width: number;

  @IsNumber()
  height: number;

  @IsNumber()
  @IsOptional()
  difficulty?: number;

  @IsString()
  @IsOptional()
  correctAnswer?: string;
}
