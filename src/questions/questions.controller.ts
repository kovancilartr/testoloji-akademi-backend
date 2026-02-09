import { Controller, Get, Post, Body, Put, Param, Delete, UseGuards, UseInterceptors, UploadedFile, UploadedFiles } from '@nestjs/common';
import { QuestionsService } from './questions.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { GetUser } from '../common/decorators/get-user.decorator';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import * as fs from 'fs';
import sizeOf from 'image-size';
import { utapi } from '../common/config/uploadthing';
import { Role, SubscriptionTier } from '@prisma/client';

@Controller('questions')
@UseGuards(JwtAuthGuard)
export class QuestionsController {
    constructor(private readonly questionsService: QuestionsService) { }

    @Post('upload')
    @UseInterceptors(
        FileInterceptor('image', {
            storage: diskStorage({
                destination: './uploads',
                filename: (req, file, cb) => {
                    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
                    cb(null, `${file.fieldname}-${uniqueSuffix}${extname(file.originalname)}`);
                },
            }),
        }),
    )
    async create(
        @GetUser('userId') userId: string,
        @GetUser('role') role: Role,
        @GetUser('tier') tier: SubscriptionTier,
        @UploadedFile() file: Express.Multer.File,
        @Body('projectId') projectId: string,
    ) {
        if (!file) throw new Error('Dosya yüklenemedi.');

        const filePath = join(process.cwd(), 'uploads', file.filename);
        const buffer = fs.readFileSync(filePath);
        const dimensions = sizeOf(buffer);
        const width = dimensions.width || 0;
        const height = dimensions.height || 0;

        // Upload to UploadThing
        const webFile = new File([buffer], file.filename, { type: file.mimetype });
        const utResponse = await utapi.uploadFiles(webFile);
        const imageUrl = Array.isArray(utResponse)
            ? (utResponse[0].data?.ufsUrl || utResponse[0].data?.url)
            : (utResponse.data?.ufsUrl || utResponse.data?.url);

        if (!imageUrl) throw new Error('UploadThing yüklemesi başarısız oldu.');

        // Cleanup local file
        fs.unlinkSync(filePath);

        return this.questionsService.create(
            projectId,
            imageUrl,
            role,
            tier,
            userId,
            width,
            height,
        );
    }

    @Post('bulk-upload')
    @UseInterceptors(
        FilesInterceptor('images', 20, {
            storage: diskStorage({
                destination: './uploads',
                filename: (req, file, cb) => {
                    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
                    cb(null, `${file.fieldname}-${uniqueSuffix}${extname(file.originalname)}`);
                },
            }),
        }),
    )
    async bulkCreate(
        @GetUser('userId') userId: string,
        @GetUser('role') role: Role,
        @GetUser('tier') tier: SubscriptionTier,
        @UploadedFiles() files: Express.Multer.File[],
        @Body('projectId') projectId: string,
        @Body('metadata') metadata?: string,
    ) {
        if (!files || files.length === 0) throw new Error('Dosyalar yüklenemedi.');

        let parsedMetadata: any[] = [];
        if (metadata) {
            try {
                parsedMetadata = JSON.parse(metadata);
            } catch (e) {
                console.warn('Metadata ayrıştırma hatası, varsayılanlar kullanılacak.');
            }
        }

        const filesToUpload = files.map(f => {
            const filePath = join(process.cwd(), 'uploads', f.filename);
            const buffer = fs.readFileSync(filePath);
            return new File([buffer], f.filename, { type: f.mimetype });
        });

        const utResponses = await utapi.uploadFiles(filesToUpload);

        const questionData = files.map((file, index) => {
            const utResp = (utResponses as unknown as any[])[index];
            const imageUrl = utResp.data?.ufsUrl || utResp.data?.url;
            if (!imageUrl) throw new Error(`Dosya ${index} için yükleme başarısız.`);

            const filePath = join(process.cwd(), 'uploads', file.filename);
            const buffer = fs.readFileSync(filePath);
            const dimensions = sizeOf(buffer);
            const meta = parsedMetadata[index] || {};

            // Local dosyayı temizle
            fs.unlinkSync(filePath);

            return {
                imageUrl,
                width: dimensions.width || 0,
                height: dimensions.height || 0,
                difficulty: meta.difficulty !== undefined ? Number(meta.difficulty) : null,
                correctAnswer: meta.correctAnswer || null
            };
        });

        return this.questionsService.bulkCreate(
            projectId,
            questionData,
            role,
            tier,
            userId,
        );
    }

    @Post('reorder')
    async reorder(@Body('projectId') projectId: string, @Body('questionIds') questionIds: string[]) {
        return this.questionsService.updateOrder(projectId, questionIds);
    }

    @Put(':id')
    async update(@Param('id') id: string, @Body() data: any) {
        return this.questionsService.update(id, data);
    }

    @Delete(':id')
    async delete(@Param('id') id: string) {
        return this.questionsService.delete(id);
    }

    @Get('project/:projectId')
    async getByProject(@Param('projectId') projectId: string) {
        return this.questionsService.getByProject(projectId);
    }
}
