import { IsString, IsNumber } from 'class-validator';

export class CreateFocusSessionDto {
    @IsString()
    subject: string;

    @IsNumber()
    duration: number;
}
