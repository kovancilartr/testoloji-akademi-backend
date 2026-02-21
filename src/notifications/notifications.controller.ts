import { Controller, Get, Patch, Param, UseGuards, Post, Delete, Body } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { GetUser } from '../common/decorators/get-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '@prisma/client';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CreateBroadcastDto } from './dto/create-broadcast.dto';

@Controller('notifications')
@UseGuards(JwtAuthGuard, RolesGuard)
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

    @Post('broadcast')
    @Roles(Role.TEACHER, Role.ADMIN)
    async createBroadcast(
        @GetUser('userId') userId: string,
        @Body() dto: CreateBroadcastDto
    ) {
        return this.notificationsService.createBroadcast(userId, dto);
    }

    @Get('broadcast/history')
    @Roles(Role.TEACHER, Role.ADMIN)
    async getBroadcastHistory(@GetUser('userId') userId: string) {
        return this.notificationsService.getBroadcastHistory(userId);
    }

    @Delete('broadcast/:id')
    @Roles(Role.TEACHER, Role.ADMIN)
    async deleteBroadcast(
        @GetUser('userId') userId: string,
        @Param('id') id: string
    ) {
        return this.notificationsService.deleteBroadcast(userId, id);
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
        @Body('token') token: string,
        @Body('oldToken') oldToken?: string
    ) {
        return this.notificationsService.registerDeviceToken(userId, token, oldToken);
    }
}
