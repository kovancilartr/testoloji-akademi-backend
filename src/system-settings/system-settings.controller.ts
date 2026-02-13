import { Controller, Get, Post, Body, UseGuards, Query } from '@nestjs/common';
import { SystemSettingsService } from './system-settings.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '@prisma/client';

@Controller('system-settings')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SystemSettingsController {
    constructor(private readonly systemSettingsService: SystemSettingsService) { }

    @Get()
    @Roles(Role.ADMIN)
    async getAllSettings() {
        return this.systemSettingsService.getAllSettings();
    }

    @Get('value')
    @Roles(Role.ADMIN)
    async getSettingValue(@Query('key') key: string) {
        const value = await this.systemSettingsService.getSetting(key);
        return { key, value };
    }

    @Post()
    @Roles(Role.ADMIN)
    async updateSetting(
        @Body('key') key: string,
        @Body('value') value: string,
        @Body('encrypt') encrypt: boolean = false
    ) {
        return this.systemSettingsService.setSetting(key, value, encrypt);
    }

    @Get('usage-stats')
    @Roles(Role.ADMIN)
    async getUsageStats() {
        console.log("Fetching Usage Stats...");
        const stats = await this.systemSettingsService.getAiUsageStats();
        console.log("Stats found:", stats);
        return stats;
    }
}
