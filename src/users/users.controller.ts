import { Controller, Get, Body, Patch, Param, Delete, UseGuards, BadRequestException } from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { GetUser } from '../common/decorators/get-user.decorator';
import { Role, SubscriptionTier } from '@prisma/client';

@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UsersController {
    constructor(private readonly usersService: UsersService) { }

    @Get()
    @Roles(Role.ADMIN)
    async getAllUsers() {
        return this.usersService.getAllUsers();
    }

    @Get('stats')
    @Roles(Role.ADMIN)
    async getAdminStats() {
        return this.usersService.getAdminStats();
    }

    @Patch(':id/role')
    @Roles(Role.ADMIN)
    async updateRole(
        @Param('id') id: string,
        @Body('role') role?: any,
        @Body('tier') tier?: SubscriptionTier,
        @Body('duration') duration?: 'monthly' | 'yearly',
    ) {
        // Resolve tier if role is actually a tier name (legacy parity)
        const resolvedTier = tier || (Object.values(SubscriptionTier).includes(role) ? (role as SubscriptionTier) : null);
        const resolvedRole = role && Object.values(Role).includes(role) ? (role as Role) : null;

        if (resolvedTier) {
            return this.usersService.updateUserTier(id, resolvedTier, duration);
        }

        if (resolvedRole) {
            return this.usersService.updateUserRole(id, resolvedRole);
        }

        throw new BadRequestException('Geçerli bir rol veya paket seçilmeli');
    }

    @Patch(':id/status')
    @Roles(Role.ADMIN)
    async toggleStatus(@Param('id') id: string, @GetUser('userId') adminId: string) {
        if (id === adminId) {
            throw new BadRequestException('Kendi hesabınızı donduramazsınız.');
        }
        return this.usersService.toggleUserStatus(id);
    }

    @Delete(':id')
    @Roles(Role.ADMIN)
    async deleteUser(@Param('id') id: string, @GetUser('userId') adminId: string) {
        if (id === adminId) {
            throw new BadRequestException('Kendi hesabınızı silemezsiniz.');
        }
        return this.usersService.deleteUser(id);
    }

    @Patch(':id/coaching-access')
    @Roles(Role.ADMIN)
    async updateCoachingAccess(
        @Param('id') id: string,
        @Body('hasCoachingAccess') hasCoachingAccess: boolean,
    ) {
        return this.usersService.updateCoachingAccess(id, hasCoachingAccess);
    }

    @Get('teacher-stats')
    @Roles(Role.TEACHER, Role.ADMIN)
    async getTeacherStats(@GetUser('userId') userId: string) {
        return this.usersService.getTeacherStats(userId);
    }

    @Get('student-stats')
    @Roles(Role.STUDENT, Role.ADMIN)
    async getStudentStats(@GetUser('userId') userId: string) {
        return this.usersService.getStudentStats(userId);
    }

    @Patch(':id/assign-teacher')
    @Roles(Role.ADMIN)
    async assignTeacher(
        @Param('id') id: string,
        @Body('teacherId') teacherId: string
    ) {
        return this.usersService.assignTeacher(id, teacherId);
    }
}
