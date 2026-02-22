import { Module } from '@nestjs/common';
import { FocusService } from './focus.service';
import { FocusController } from './focus.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
    imports: [PrismaModule],
    controllers: [FocusController],
    providers: [FocusService],
    exports: [FocusService]
})
export class FocusModule { }
