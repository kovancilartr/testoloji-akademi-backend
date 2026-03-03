import {
    Controller,
    Post,
    Body,
    UseGuards,
    BadRequestException,
} from '@nestjs/common';
import { OmrService } from './omr.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { GetUser } from '../common/decorators/get-user.decorator';

@Controller('omr')
@UseGuards(JwtAuthGuard)
export class OmrController {
    constructor(private readonly omrService: OmrService) { }

    @Post('scan')
    async scanOpticForm(
        @GetUser('userId') userId: string,
        @Body('image') imageBase64: string,
        @Body('assignmentId') assignmentId?: string,
    ) {
        if (!imageBase64) {
            throw new BadRequestException('Lütfen bir görsel yükleyin.');
        }

        // Pass image and optional assignmentId
        const result = await this.omrService.processOpticForm(imageBase64, userId, assignmentId);

        return result;
    }

    @Post('confirm')
    async confirmResult(
        @GetUser('userId') userId: string,
        @Body('assignmentId') assignmentId: string,
        @Body('answers') answers: Record<string, string>,
    ) {
        if (!assignmentId || !answers) {
            throw new BadRequestException('Eksik bilgi (assignmentId veya answers).');
        }

        return this.omrService.saveResult(assignmentId, userId, answers);
    }
}
