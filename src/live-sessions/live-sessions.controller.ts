import { Controller, Get, Post, Patch, Body, Param, UseGuards, Request } from '@nestjs/common';
import { LiveSessionsService } from './live-sessions.service';
import { CreateLiveSessionDto, UpdateLiveKitConfigDto } from './dto/live-session.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

@Controller('live-sessions')
@UseGuards(JwtAuthGuard)
export class LiveSessionsController {
    constructor(private readonly service: LiveSessionsService) { }

    // ─── ÖĞRETMEN ENDPOINTS ───

    /** Yeni canlı ders oluştur ve başlat */
    @Post()
    create(@Request() req, @Body() dto: CreateLiveSessionDto) {
        return this.service.createSession(req.user.userId, dto);
    }

    /** Aktif dersi getir */
    @Get('active')
    getActive(@Request() req) {
        return this.service.getActiveSession(req.user.userId);
    }

    /** Dersi bitir */
    @Patch(':id/end')
    endSession(@Request() req, @Param('id') id: string) {
        return this.service.endSession(req.user.userId, id);
    }

    /** Geçmiş dersler */
    @Get('history')
    getHistory(@Request() req) {
        return this.service.getSessionHistory(req.user.userId);
    }

    /** Kota bilgisi */
    @Get('quota')
    getQuota(@Request() req) {
        return this.service.getQuota(req.user.userId);
    }

    // ─── ÖĞRENCİ ENDPOINTS ───

    /** Öğrenci: öğretmenin aktif dersini kontrol et */
    @Get('student/active')
    getStudentActive(@Request() req) {
        return this.service.getStudentActiveSession(req.user.userId);
    }

    /** Öğrenci: derse katıl */
    @Post(':id/join')
    joinSession(@Request() req, @Param('id') id: string) {
        return this.service.joinSession(req.user.userId, id);
    }

    // ─── ADMIN SETTINGS ENDPOINTS ───

    @Get('admin/settings')
    @UseGuards(RolesGuard)
    @Roles('ADMIN')
    getAllSettings() {
        return this.service.getAllTeachersSettings();
    }

    @Get('admin/settings/:userId')
    @UseGuards(RolesGuard)
    @Roles('ADMIN')
    getTeacherConfig(@Param('userId') userId: string) {
        return this.service.getTeacherSettings(userId);
    }

    @Patch('admin/settings')
    @UseGuards(RolesGuard)
    @Roles('ADMIN')
    updateSettings(@Body() dto: UpdateLiveKitConfigDto) {
        return this.service.updateTeacherSettings(dto);
    }

    @Post('admin/settings/:userId/reset')
    @UseGuards(RolesGuard)
    @Roles('ADMIN')
    resetSettings(@Param('userId') userId: string) {
        return this.service.deleteTeacherSettings(userId);
    }
}
