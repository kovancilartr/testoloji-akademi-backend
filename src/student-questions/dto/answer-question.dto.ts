import { IsString, IsOptional, IsNotEmpty } from 'class-validator';

export class AnswerQuestionDto {
  @IsString()
  @IsNotEmpty()
  answerUrl: string;

  @IsString()
  @IsOptional()
  answerText?: string;
}
