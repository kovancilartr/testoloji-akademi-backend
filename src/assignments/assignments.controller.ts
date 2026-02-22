import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Query } from '@nestjs/common';
import { AssignmentsService } from './assignments.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { GetUser } from '../common/decorators/get-user.decorator';
import { CreateAssignmentsDto } from './dto/create-assignments.dto';
import { UpdateAssignmentDto } from './dto/update-assignment.dto';
import { SubmitAssignmentDto } from './dto/submit-assignment.dto';
import { Role } from '@prisma/client';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

import { CoachingAccessGuard } from '../auth/guards/coaching-access.guard';

@Controller('assignments')
@UseGuards(JwtAuthGuard, RolesGuard, CoachingAccessGuard)
export class AssignmentsController {
    constructor(private readonly assignmentsService: AssignmentsService) { }

    @Get()
    @Roles(Role.TEACHER, Role.ADMIN, Role.STUDENT)
    async listAssignments(
        @GetUser('userId') userId: string,
        @GetUser('role') role: Role,
        @Query('studentId') studentId?: string,
    ) {
        return this.assignmentsService.listAssignments(userId, role, studentId);
    }

    @Get('student/make-up-suggestions')
    @Roles(Role.STUDENT)
    async getMakeUpSuggestions(@GetUser('userId') userId: string) {
        return this.assignmentsService.getMakeUpSuggestions(userId);
    }

    @Post(':id/create-makeup')
    @Roles(Role.STUDENT)
    async createMakeUpAssignment(
        @GetUser('userId') userId: string,
        @Param('id') assignmentId: string
    ) {
        return this.assignmentsService.createMakeUpAssignment(userId, assignmentId);
    }

    @Post('student/create-combined-makeup')
    @Roles(Role.STUDENT)
    async createCombinedMakeUpAssignment(@GetUser('userId') userId: string) {
        return this.assignmentsService.createCombinedMakeUpAssignment(userId);
    }

    @Post()
    @Roles(Role.TEACHER, Role.ADMIN)
    async createAssignments(@Body() dto: CreateAssignmentsDto) {
        return this.assignmentsService.createAssignments(dto);
    }

    @Delete(':id')
    @Roles(Role.TEACHER, Role.ADMIN)
    async deleteAssignment(
        @GetUser('userId') userId: string,
        @Param('id') assignmentId: string,
    ) {
        return this.assignmentsService.deleteAssignment(userId, assignmentId);
    }

    @Patch(':id')
    @Roles(Role.TEACHER, Role.ADMIN)
    async updateAssignment(
        @GetUser('userId') userId: string,
        @Param('id') assignmentId: string,
        @Body() dto: UpdateAssignmentDto,
    ) {
        return this.assignmentsService.updateAssignment(userId, assignmentId, dto);
    }

    @Post(':id/submit')
    @Roles(Role.STUDENT, Role.TEACHER, Role.ADMIN)
    async submitAssignment(
        @GetUser('userId') userId: string,
        @Param('id') assignmentId: string,
        @Body() dto: SubmitAssignmentDto,
    ) {
        return this.assignmentsService.submitAssignment(userId, assignmentId, dto.answers);
    }

    @Post(':id/undo-submit')
    @Roles(Role.STUDENT, Role.TEACHER, Role.ADMIN)
    async undoSubmitAssignment(
        @GetUser('userId') userId: string,
        @Param('id') assignmentId: string,
    ) {
        return this.assignmentsService.undoSubmitAssignment(userId, assignmentId);
    }

    @Get(':id')
    @Roles(Role.TEACHER, Role.ADMIN, Role.STUDENT)
    async getAssignmentResult(
        @GetUser('userId') userId: string,
        @GetUser('role') role: Role,
        @Param('id') assignmentId: string,
    ) {
        return this.assignmentsService.getAssignmentResult(userId, role, assignmentId);
    }
}
