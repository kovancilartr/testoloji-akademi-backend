import { Controller, Get, Post, Body, Param, Delete, UseGuards, Query, Patch } from '@nestjs/common';
import { SchedulesService } from './schedules.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { GetUser } from '../common/decorators/get-user.decorator';
import { CreateScheduleDto } from './dto/create-schedule.dto';
import { Role } from '@prisma/client';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

import { CoachingAccessGuard } from '../auth/guards/coaching-access.guard';

@Controller('schedule')
@UseGuards(JwtAuthGuard, RolesGuard, CoachingAccessGuard)
export class SchedulesController {
    constructor(private readonly schedulesService: SchedulesService) { }

    @Get()
    @Roles(Role.TEACHER, Role.ADMIN, Role.STUDENT)
    async getSchedule(
        @GetUser('userId') userId: string,
        @GetUser('role') role: Role,
        @Query('studentId') studentId?: string,
    ) {
        return this.schedulesService.getSchedule(userId, role, studentId);
    }

    @Post()
    @Roles(Role.TEACHER, Role.ADMIN)
    async createItem(
        @GetUser('userId') userId: string,
        @Body() dto: CreateScheduleDto,
    ) {
        return this.schedulesService.createItem(userId, dto);
    }

    @Post('bulk')
    @Roles(Role.TEACHER, Role.ADMIN)
    async createBulk(
        @GetUser('userId') userId: string,
        @Body() dtos: CreateScheduleDto[],
    ) {
        return this.schedulesService.createBulk(userId, dtos);
    }

    @Delete(':id')
    @Roles(Role.TEACHER, Role.ADMIN)
    async deleteItem(
        @GetUser('userId') userId: string,
        @Param('id') id: string,
    ) {
        return this.schedulesService.deleteItem(userId, id);
    }

    @Patch(':id')
    @Roles(Role.TEACHER, Role.ADMIN)
    async updateItem(
        @GetUser('userId') userId: string,
        @Param('id') id: string,
        @Body() dto: Partial<CreateScheduleDto>,
    ) {
        return this.schedulesService.updateItem(userId, id, dto);
    }

    @Patch(':id/complete')
    @Roles(Role.TEACHER, Role.ADMIN, Role.STUDENT)
    async toggleComplete(
        @GetUser('userId') userId: string,
        @GetUser('role') role: Role,
        @Param('id') id: string,
        @Body('isCompleted') isCompleted: boolean,
    ) {
        return this.schedulesService.toggleComplete(userId, role, id, isCompleted);
    }
}
