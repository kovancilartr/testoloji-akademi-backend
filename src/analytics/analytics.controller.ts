import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '@prisma/client';
import { GetUser } from '../common/decorators/get-user.decorator';

@Controller('analytics')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AnalyticsController {
    constructor(private readonly analyticsService: AnalyticsService) { }

    @Get('student/:id/overview')
    @Roles(Role.STUDENT, Role.TEACHER, Role.ADMIN)
    async getStudentOverview(
        @Param('id') studentId: string,
        @GetUser('userId') userId: string,
        @GetUser('role') role: Role,
    ) {
        return this.analyticsService.getStudentOverview(userId, role, studentId);
    }

    @Get('teacher/overview')
    @Roles(Role.TEACHER, Role.ADMIN)
    async getTeacherOverview(@GetUser('userId') userId: string) {
        return this.analyticsService.getTeacherOverview(userId);
    }

    @Get('my-overview')
    @Roles(Role.STUDENT)
    async getMyOverview(@GetUser('userId') userId: string) {
        return this.analyticsService.getStudentOverviewByUserId(userId);
    }
}
