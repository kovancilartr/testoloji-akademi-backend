import { Controller, Get, Post, Body, Param, Patch, UseGuards, Request, Delete } from '@nestjs/common';
import { FocusService } from './focus.service';
import { CreateFocusSessionDto } from './dto/create-focus-session.dto';
import { UpdateFocusSessionDto } from './dto/update-focus-session.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('focus')
@UseGuards(JwtAuthGuard)
export class FocusController {
    constructor(private readonly focusService: FocusService) { }

    @Post('sessions')
    create(@Request() req, @Body() dto: CreateFocusSessionDto) {
        return this.focusService.createSession(req.user.userId, dto);
    }

    @Patch('sessions/:id')
    update(@Request() req, @Param('id') id: string, @Body() dto: UpdateFocusSessionDto) {
        return this.focusService.updateSession(req.user.userId, id, dto);
    }

    @Post('sessions/:id/break')
    breakFocus(@Request() req, @Param('id') id: string) {
        return this.focusService.breakFocus(req.user.userId, id);
    }

    @Get('history')
    getHistory(@Request() req) {
        return this.focusService.getStudentHistory(req.user.userId);
    }

    @Get('student/class-active-count')
    getClassActiveCount(@Request() req) {
        return this.focusService.getClassActiveCount(req.user.userId);
    }

    @Get('teacher/active')
    getActiveSessions(@Request() req) {
        return this.focusService.getActiveSessions(req.user.userId);
    }

    @Get('teacher/student/:studentId')
    getStudentSessions(@Request() req, @Param('studentId') studentId: string) {
        return this.focusService.getTeacherStudentSessions(req.user.userId, studentId);
    }

    @Get('teacher/history')
    getTeacherHistory(@Request() req) {
        return this.focusService.getTeacherAllStudentsHistory(req.user.userId);
    }

    @Delete('teacher/history/clear-all')
    clearTeacherHistory(@Request() req) {
        return this.focusService.clearTeacherAllStudentsHistory(req.user.userId);
    }
}
