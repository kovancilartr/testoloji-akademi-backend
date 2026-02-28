import { IsString, IsNotEmpty } from 'class-validator';

export class CreateQuestionDto {
  @IsString()
  @IsNotEmpty()
  lesson: string;

  @IsString()
  @IsNotEmpty()
  imageUrl: string;
}
