import { Controller, Get, Post, Body, UseGuards, Param, Query, Patch } from '@nestjs/common';
import { CoachingService } from './coaching.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { GetUser } from '../common/decorators/get-user.decorator';
import { AskAiDto } from './dto/ask-ai.dto';
import { AnalyzeProgressDto } from './dto/analyze-progress.dto';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '@prisma/client';

@Controller('coaching')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CoachingController {
    constructor(private readonly coachingService: CoachingService) { }

    @Get('usage')
    @Roles(Role.STUDENT, Role.TEACHER, Role.ADMIN)
    async getUsage(@GetUser('userId') userId: string) {
        return this.coachingService.getUsage(userId);
    }

    @Post('ask')
    @Roles(Role.STUDENT, Role.TEACHER, Role.ADMIN)
    async askAi(
        @GetUser('userId') userId: string,
        @Body() dto: AskAiDto,
    ) {
        return this.coachingService.askAi(userId, dto);
    }

    @Post('analyze-progress')
    @Roles(Role.STUDENT, Role.TEACHER, Role.ADMIN)
    async analyzeProgress(
        @GetUser('userId') userId: string,
        @Body() dto: AnalyzeProgressDto,
    ) {
        return this.coachingService.analyzeProgress(userId, dto);
    }

    @Get('history')
    @Roles(Role.STUDENT, Role.TEACHER, Role.ADMIN)
    async getHistory(
        @GetUser('userId') userId: string,
        @Query('page') page?: string,
        @Query('limit') limit?: string,
    ) {
        return this.coachingService.getHistory(
            userId,
            page ? parseInt(page, 10) : 1,
            limit ? parseInt(limit, 10) : 5,
        );
    }

    @Get('assignment/:assignmentId/analysis')
    @Roles(Role.STUDENT, Role.TEACHER, Role.ADMIN)
    async getAssignmentAnalysis(
        @GetUser('userId') userId: string,
        @Param('assignmentId') assignmentId: string,
    ) {
        return this.coachingService.getAssignmentAnalysis(assignmentId, userId);
    }

    @Patch('daily-limit/:userId')
    @Roles(Role.ADMIN)
    async updateDailyLimit(
        @Param('userId') userId: string,
        @Body('limit') limit: number,
    ) {
        return this.coachingService.updateDailyLimit(userId, limit);
    }

    @Get(':userId/stats')
    @Roles(Role.ADMIN)
    async getUserCoachingStats(@Param('userId') userId: string) {
        return this.coachingService.getUserCoachingStats(userId);
    }
}
