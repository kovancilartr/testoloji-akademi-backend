import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Query } from '@nestjs/common';
import { AssignmentsService } from './assignments.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { GetUser } from '../common/decorators/get-user.decorator';
import { CreateAssignmentsDto } from './dto/create-assignments.dto';
import { UpdateAssignmentDto } from './dto/update-assignment.dto';
import { SubmitAssignmentDto } from './dto/submit-assignment.dto';
import { Role } from '@prisma/client';

@Controller('assignments')
@UseGuards(JwtAuthGuard)
export class AssignmentsController {
    constructor(private readonly assignmentsService: AssignmentsService) { }

    @Get()
    async listAssignments(
        @GetUser('userId') userId: string,
        @GetUser('role') role: Role,
        @Query('studentId') studentId?: string,
    ) {
        return this.assignmentsService.listAssignments(userId, role, studentId);
    }

    @Post()
    async createAssignments(@Body() dto: CreateAssignmentsDto) {
        return this.assignmentsService.createAssignments(dto);
    }

    @Delete(':id')
    async deleteAssignment(
        @GetUser('userId') userId: string,
        @Param('id') assignmentId: string,
    ) {
        return this.assignmentsService.deleteAssignment(userId, assignmentId);
    }

    @Patch(':id')
    async updateAssignment(
        @GetUser('userId') userId: string,
        @Param('id') assignmentId: string,
        @Body() dto: UpdateAssignmentDto,
    ) {
        return this.assignmentsService.updateAssignment(userId, assignmentId, dto);
    }

    @Post(':id/submit')
    async submitAssignment(
        @GetUser('userId') userId: string,
        @Param('id') assignmentId: string,
        @Body() dto: SubmitAssignmentDto,
    ) {
        return this.assignmentsService.submitAssignment(userId, assignmentId, dto.answers);
    }

    @Get(':id')
    async getAssignmentResult(
        @GetUser('userId') userId: string,
        @GetUser('role') role: Role,
        @Param('id') assignmentId: string,
    ) {
        return this.assignmentsService.getAssignmentResult(userId, role, assignmentId);
    }
}
