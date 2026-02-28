import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
} from '@nestjs/common';
import { LiveSessionsService } from './live-sessions.service';
import {
  CreateLiveSessionDto,
  UpdateLiveKitConfigDto,
} from './dto/live-session.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

@Controller('live-sessions')
@UseGuards(JwtAuthGuard)
export class LiveSessionsController {
  constructor(private readonly service: LiveSessionsService) {}

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

  /** Öğrenciyi at */
  @Post(':id/kick/:participantId')
  kickParticipant(
    @Request() req,
    @Param('id') id: string,
    @Param('participantId') participantId: string,
  ) {
    return this.service.kickParticipant(req.user.userId, id, participantId);
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

  /** Kayıt indirme URL'i */
  @Get(':id/download')
  getDownloadUrl(@Request() req, @Param('id') id: string) {
    return this.service.getDownloadUrl(req.user.userId, id);
  }

  /** İstatistik arttırma */
  @Post(':id/stats/:type')
  trackStat(@Param('id') id: string, @Param('type') type: 'view' | 'download') {
    return this.service.incrementSessionStat(id, type);
  }

  /** Kota bilgisi */
  @Get('quota')
  getQuota(@Request() req) {
    return this.service.getQuota(req.user.userId);
  }

  /** Öğretmen: geçmiş dersini sil */
  @Delete(':id')
  deleteTeacherSession(@Request() req, @Param('id') id: string) {
    return this.service.teacherDeleteSession(req.user.userId, id);
  }

  /** Öğretmen: çoklu ders/kayıt sil */
  @Post('bulk-delete')
  deleteTeacherSessions(@Request() req, @Body('ids') ids: string[]) {
    return this.service.teacherDeleteSessions(req.user.userId, ids);
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

  /** Öğrenci: geçmiş dersler */
  @Get('student/history')
  getStudentHistory(@Request() req) {
    return this.service.getStudentSessionHistory(req.user.userId);
  }

  /** Öğrenci: kayıt indirme URL'i */
  @Get('student/:id/download')
  getStudentDownloadUrl(@Request() req, @Param('id') id: string) {
    return this.service.getDownloadUrl(req.user.userId, id);
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

  @Get('admin/all-sessions')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  getAllSessions() {
    return this.service.getAdminAllSessions();
  }

  @Post('admin/sessions/:id/delete')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  deleteSession(@Param('id') id: string) {
    return this.service.deleteSession(id);
  }

  @Post('admin/sessions/bulk-delete')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  deleteSessions(@Body('ids') ids: string[]) {
    return this.service.deleteSessions(ids);
  }
}
