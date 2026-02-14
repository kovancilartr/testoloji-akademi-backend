import { Injectable } from '@nestjs/common';
import { UTApi } from 'uploadthing/server';

@Injectable()
export class UploadThingService {
    private utapi: UTApi;

    constructor() {
        this.utapi = new UTApi();
    }

    async uploadFile(file: Express.Multer.File) {
        // Convert Multer file to a format utapi understands
        // UTApi version 7 can take a File or Blob
        const uint8Array = new Uint8Array(file.buffer);
        const blob = new Blob([uint8Array], { type: file.mimetype });
        const uploadFile = new File([blob], file.originalname, { type: file.mimetype });

        const response = await this.utapi.uploadFiles(uploadFile);

        if (response.error) {
            throw new Error(`UploadThing error: ${response.error.message}`);
        }

        return response.data;
    }

    async uploadBase64(base64: string, fileName: string = 'upload.png') {
        // Remove data:image/png;base64, prefix if exists
        const base64Data = base64.replace(/^data:image\/\w+;base64,/, "");
        const buffer = Buffer.from(base64Data, 'base64');

        // Determine mimetype from base64 string if possible
        const mimeMatch = base64.match(/^data:(image\/\w+);base64,/);
        const mimetype = mimeMatch ? mimeMatch[1] : 'image/png';

        // Uzantıyı mimetype'dan al
        const extension = mimetype.split('/')[1] || 'png';
        // Eğer fileName uzantı içermiyorsa ekle, içeriyorsa değiştir
        const nameWithoutExt = fileName.split('.')[0];
        const finalFileName = `${nameWithoutExt}.${extension}`;

        const uint8Array = new Uint8Array(buffer);
        const blob = new Blob([uint8Array], { type: mimetype });
        const uploadFile = new File([blob], finalFileName, { type: mimetype });

        const response = await this.utapi.uploadFiles(uploadFile);

        if (response.error) {
            throw new Error(`UploadThing error: ${response.error.message}`);
        }

        return response.data;
    }
}
