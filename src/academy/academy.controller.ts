import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards } from '@nestjs/common';
import { AcademyService } from './academy.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { GetUser } from '../common/decorators/get-user.decorator';
import { CreateStudentDto } from './dto/create-student.dto';
import { UpdateStudentDto } from './dto/update-student.dto';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '@prisma/client';

import { CoachingAccessGuard } from '../auth/guards/coaching-access.guard';

@Controller('academy')
@UseGuards(JwtAuthGuard, RolesGuard, CoachingAccessGuard)
@Roles(Role.TEACHER, Role.ADMIN)
export class AcademyController {
    constructor(private readonly academyService: AcademyService) { }

    @Post('students')
    async createStudent(
        @GetUser('userId') userId: string,
        @Body() dto: CreateStudentDto,
    ) {
        return this.academyService.createStudent(userId, dto);
    }

    @Get('students')
    async getStudents(@GetUser('userId') userId: string) {
        return this.academyService.getStudents(userId);
    }

    @Get('students/:id')
    async getStudentById(
        @GetUser('userId') userId: string,
        @Param('id') id: string,
    ) {
        return this.academyService.getStudentById(userId, id);
    }

    @Patch('students/:id')
    async updateStudent(
        @GetUser('userId') userId: string,
        @Param('id') id: string,
        @Body() dto: UpdateStudentDto,
    ) {
        return this.academyService.updateStudent(userId, id, dto);
    }

    @Delete('students/:id')
    async deleteStudent(
        @GetUser('userId') userId: string,
        @Param('id') id: string,
    ) {
        return this.academyService.deleteStudent(userId, id);
    }
}
