import { IsString, IsOptional, IsInt, Min, Max } from 'class-validator';

export class CreateLiveSessionDto {
    @IsString()
    title: string;

    @IsOptional()
    @IsString()
    classroomId?: string;
}

export class JoinLiveSessionDto {
    @IsString()
    sessionId: string;
}

export class UpdateLiveKitConfigDto {
    @IsString()
    userId: string;

    @IsString()
    apiKey: string;

    @IsString()
    apiSecret: string;

    @IsOptional()
    @IsString()
    url?: string;

    @IsOptional()
    @IsString()
    s3Endpoint?: string;

    @IsOptional()
    @IsString()
    s3AccessKey?: string;

    @IsOptional()
    @IsString()
    s3SecretKey?: string;

    @IsOptional()
    @IsString()
    s3Bucket?: string;
}
