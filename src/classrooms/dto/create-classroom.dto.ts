import { IsString, IsOptional, IsArray } from 'class-validator';

export class CreateClassroomDto {
    @IsString()
    name: string;

    @IsString()
    @IsOptional()
    description?: string;

    @IsArray()
    @IsOptional()
    studentIds?: string[];
}
