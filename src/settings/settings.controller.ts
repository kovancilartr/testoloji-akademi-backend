import { Controller, Get, Body, Param, UseGuards, Put } from '@nestjs/common';
import { SettingsService } from './settings.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { GetUser } from '../common/decorators/get-user.decorator';
import { UpsertSettingsDto } from './dto/upsert-settings.dto';

@Controller('settings')
@UseGuards(JwtAuthGuard)
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get(':projectId')
  async getByProject(
    @GetUser('userId') userId: string,
    @Param('projectId') projectId: string,
  ) {
    return this.settingsService.getByProject(userId, projectId);
  }

  @Put(':projectId')
  async upsert(
    @GetUser('userId') userId: string,
    @Param('projectId') projectId: string,
    @Body() dto: UpsertSettingsDto,
  ) {
    return this.settingsService.upsert(userId, projectId, dto);
  }
}
