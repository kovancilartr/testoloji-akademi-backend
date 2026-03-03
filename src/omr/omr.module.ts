import { Module } from '@nestjs/common';
import { OmrController } from './omr.controller';
import { OmrService } from './omr.service';

@Module({
  controllers: [OmrController],
  providers: [OmrService],
})
export class OmrModule { }
