import { Controller, Get, Post, Body, Param, Delete, UseGuards, Query, Patch } from '@nestjs/common';
import { SchedulesService } from './schedules.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { GetUser } from '../common/decorators/get-user.decorator';
import { CreateScheduleDto } from './dto/create-schedule.dto';
import { Role } from '@prisma/client';

@Controller('schedule')
@UseGuards(JwtAuthGuard)
export class SchedulesController {
    constructor(private readonly schedulesService: SchedulesService) { }

    @Get()
    async getSchedule(
        @GetUser('userId') userId: string,
        @GetUser('role') role: Role,
        @Query('studentId') studentId?: string,
    ) {
        return this.schedulesService.getSchedule(userId, role, studentId);
    }

    @Post()
    async createItem(
        @GetUser('userId') userId: string,
        @Body() dto: CreateScheduleDto,
    ) {
        return this.schedulesService.createItem(userId, dto);
    }

    @Delete(':id')
    async deleteItem(
        @GetUser('userId') userId: string,
        @Param('id') id: string,
    ) {
        return this.schedulesService.deleteItem(userId, id);
    }

    @Patch(':id/complete')
    async toggleComplete(
        @GetUser('userId') userId: string,
        @GetUser('role') role: Role,
        @Param('id') id: string,
        @Body('isCompleted') isCompleted: boolean,
    ) {
        return this.schedulesService.toggleComplete(userId, role, id, isCompleted);
    }
}
