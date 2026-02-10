import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Query } from '@nestjs/common';
import { CoursesService } from './courses.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { GetUser } from '../common/decorators/get-user.decorator';
import { CreateCourseDto } from './dto/create-course.dto';
import { AddModuleDto } from './dto/add-module.dto';
import { AddContentDto } from './dto/add-content.dto';
import { ProgressStatus, Role } from '@prisma/client';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CoachingAccessGuard } from '../auth/guards/coaching-access.guard';

@Controller('courses')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CoursesController {
    constructor(private readonly coursesService: CoursesService) { }

    // --- Admin Routes ---

    @Get('admin/all')
    @Roles(Role.ADMIN)
    async listAllCourses() {
        return this.coursesService.listAllCourses();
    }

    // --- Student Routes ---

    @Get('my-courses')
    @Roles(Role.STUDENT, Role.ADMIN)
    async listStudentCourses(@GetUser('userId') userId: string) {
        // In Express backend, it resolves studentId from userId
        return this.coursesService.listStudentCourses(userId);
    }

    @Get('my-courses/:id')
    @Roles(Role.STUDENT, Role.ADMIN)
    async getStudentCourseDetail(
        @Param('id') courseId: string,
        @GetUser('userId') userId: string,
    ) {
        return this.coursesService.getStudentCourseDetail(courseId, userId);
    }

    @Post('my-courses/:id/progress/:contentId')
    @Roles(Role.STUDENT, Role.ADMIN)
    async updateProgress(
        @GetUser('userId') userId: string,
        @Param('contentId') contentId: string,
        @Body('status') status: ProgressStatus,
    ) {
        return this.coursesService.updateContentProgress(userId, contentId, status);
    }

    @Post('my-courses/:id/start-test/:contentId')
    @Roles(Role.STUDENT, Role.ADMIN)
    async startTest(
        @GetUser('userId') userId: string,
        @Param('contentId') contentId: string,
    ) {
        return this.coursesService.startTest(userId, contentId);
    }

    // --- Instructor Routes ---

    @Get()
    @Roles(Role.TEACHER, Role.ADMIN)
    @UseGuards(CoachingAccessGuard)
    async listInstructorCourses(@GetUser('userId') userId: string) {
        return this.coursesService.listCourses(userId);
    }

    @Post()
    @Roles(Role.TEACHER, Role.ADMIN)
    @UseGuards(CoachingAccessGuard)
    async createCourse(@GetUser('userId') userId: string, @Body() dto: CreateCourseDto) {
        return this.coursesService.createCourse(userId, dto);
    }

    @Get(':id')
    async getCourseDetail(@Param('id') id: string) {
        return this.coursesService.getCourseDetail(id);
    }

    @Patch(':id')
    @Roles(Role.TEACHER, Role.ADMIN)
    @UseGuards(CoachingAccessGuard)
    async updateCourse(@Param('id') id: string, @Body() data: any) {
        return this.coursesService.updateCourse(id, data);
    }

    @Post(':id/modules')
    @Roles(Role.TEACHER, Role.ADMIN)
    @UseGuards(CoachingAccessGuard)
    async addModule(@Param('id') id: string, @Body() dto: AddModuleDto) {
        return this.coursesService.addModule(id, dto);
    }

    @Post('modules/:moduleId/contents')
    @Roles(Role.TEACHER, Role.ADMIN)
    @UseGuards(CoachingAccessGuard)
    async addContent(@Param('moduleId') moduleId: string, @Body() dto: AddContentDto) {
        return this.coursesService.addContent(moduleId, dto);
    }

    @Post(':id/modules/reorder')
    @Roles(Role.TEACHER, Role.ADMIN)
    @UseGuards(CoachingAccessGuard)
    async reorderModules(@Param('id') id: string, @Body('moduleIds') moduleIds: string[]) {
        return this.coursesService.reorderModules(id, moduleIds);
    }

    @Post('modules/:moduleId/contents/reorder')
    @Roles(Role.TEACHER, Role.ADMIN)
    @UseGuards(CoachingAccessGuard)
    async reorderContents(@Param('moduleId') moduleId: string, @Body('contentIds') contentIds: string[]) {
        return this.coursesService.reorderContents(moduleId, contentIds);
    }

    @Patch('modules/:moduleId')
    @Roles(Role.TEACHER, Role.ADMIN)
    @UseGuards(CoachingAccessGuard)
    async updateModule(@Param('moduleId') moduleId: string, @Body('title') title: string) {
        return this.coursesService.updateModule(moduleId, title);
    }

    @Delete('modules/:moduleId')
    @Roles(Role.TEACHER, Role.ADMIN)
    @UseGuards(CoachingAccessGuard)
    async deleteModule(@Param('moduleId') moduleId: string) {
        return this.coursesService.deleteModule(moduleId);
    }

    @Patch('contents/:contentId')
    @Roles(Role.TEACHER, Role.ADMIN)
    @UseGuards(CoachingAccessGuard)
    async updateContent(@Param('contentId') contentId: string, @Body() data: any) {
        return this.coursesService.updateContent(contentId, data);
    }

    @Delete('contents/:contentId')
    @Roles(Role.TEACHER, Role.ADMIN)
    @UseGuards(CoachingAccessGuard)
    async deleteContent(@Param('contentId') contentId: string) {
        return this.coursesService.deleteContent(contentId);
    }

    @Post(':id/enroll')
    @Roles(Role.TEACHER, Role.ADMIN)
    @UseGuards(CoachingAccessGuard)
    async enrollStudent(@Param('id') courseId: string, @Body('studentId') studentId: string) {
        return this.coursesService.enrollStudent(courseId, studentId);
    }

    @Delete(':id/enroll/:studentId')
    @Roles(Role.TEACHER, Role.ADMIN)
    @UseGuards(CoachingAccessGuard)
    async unenrollStudent(@Param('id') courseId: string, @Param('studentId') studentId: string) {
        return this.coursesService.unenrollStudent(courseId, studentId);
    }
}
