import {
  Controller,
  Post,
  Body,
  UseInterceptors,
  UploadedFile,
  Ip,
} from '@nestjs/common';
import { ToolsService } from './tools.service';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { SkipTransform } from '../common/decorators/skip-transform.decorator';
import * as fs from 'fs';

@Controller('tools')
export class ToolsController {
  constructor(private readonly toolsService: ToolsService) {}

  @Post('magic-scan')
  @SkipTransform() // Magic Scan expects raw array from Python
  @UseInterceptors(
    FileInterceptor('image', {
      storage: diskStorage({
        destination: './uploads',
        filename: (req, file, cb) => {
          const uniqueSuffix =
            Date.now() + '-' + Math.round(Math.random() * 1e9);
          cb(
            null,
            `${file.fieldname}-${uniqueSuffix}${extname(file.originalname)}`,
          );
        },
      }),
    }),
  )
  async magicScan(
    @UploadedFile() file: Express.Multer.File,
    @Body('roiX') roiX?: string,
    @Body('roiY') roiY?: string,
    @Body('roiW') roiW?: string,
    @Body('roiH') roiH?: string,
  ) {
    // Ensure uploads directory exists
    if (!fs.existsSync('./uploads')) {
      fs.mkdirSync('./uploads', { recursive: true });
    }

    if (!file) throw new Error('Resim dosyası yüklenemedi.');

    const roi =
      roiX && roiY && roiW && roiH
        ? {
            x: parseInt(roiX),
            y: parseInt(roiY),
            w: parseInt(roiW),
            h: parseInt(roiH),
          }
        : undefined;

    return this.toolsService.magicScan(file.path, roi);
  }

  @Post('feedback')
  @SkipTransform()
  async saveFeedback(@Body() data: any, @Ip() ip: string) {
    return this.toolsService.saveFeedback(data, ip);
  }
}
