import { IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';
import { Type } from 'class-transformer';

export class AddModuleDto {
    @IsString()
    @IsNotEmpty({ message: 'Modül başlığı boş bırakılamaz.' })
    title: string;

    @IsNumber()
    @IsOptional()
    @Type(() => Number)
    order?: number;
}
