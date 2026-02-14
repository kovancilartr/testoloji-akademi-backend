import { Module } from '@nestjs/common';
import { ToolsController } from './tools.controller';
import { ToolsService } from './tools.service';

import { WhatsAppService } from './whatsapp.service';
import { UploadThingService } from './uploadthing.service';

@Module({
  controllers: [ToolsController],
  providers: [ToolsService, WhatsAppService, UploadThingService],
  exports: [WhatsAppService, UploadThingService]
})
export class ToolsModule { }
