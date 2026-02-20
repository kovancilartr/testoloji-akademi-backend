import { Controller, Get, Patch, Param, UseGuards, Post, Delete, Body } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { GetUser } from '../common/decorators/get-user.decorator';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
    constructor(private readonly notificationsService: NotificationsService) { }

    @Get()
    async findAll(@GetUser('userId') userId: string) {
        const notifications = await this.notificationsService.findAll(userId);
        const unreadCount = await this.notificationsService.getUnreadCount(userId);
        return {
            notifications,
            unreadCount
        };
    }

    @Patch(':id/read')
    async markAsRead(
        @GetUser('userId') userId: string,
        @Param('id') id: string
    ) {
        return this.notificationsService.markAsRead(userId, id);
    }

    @Post('read-all')
    async markAllAsRead(@GetUser('userId') userId: string) {
        return this.notificationsService.markAllAsRead(userId);
    }

    @Delete('clear-all')
    async deleteAll(@GetUser('userId') userId: string) {
        return this.notificationsService.deleteAll(userId);
    }

    @Delete(':id')
    async delete(
        @GetUser('userId') userId: string,
        @Param('id') id: string
    ) {
        return this.notificationsService.delete(userId, id);
    }

    @Post('register-device')
    async registerDevice(
        @GetUser('userId') userId: string,
        @Body('token') token: string
    ) {
        return this.notificationsService.registerDeviceToken(userId, token);
    }
}
