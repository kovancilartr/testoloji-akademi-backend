import { Controller, Get, Post, Body, Param, UseGuards, Request } from '@nestjs/common';
import { StudentQuestionsService } from './student-questions.service';
import { CreateQuestionDto } from './dto/create-question.dto';
import { AnswerQuestionDto } from './dto/answer-question.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'; // Assuming this exists

@Controller('student-questions')
export class StudentQuestionsController {
    constructor(private readonly studentQuestionsService: StudentQuestionsService) { }

    @UseGuards(JwtAuthGuard)
    @Post('upload')
    create(@Request() req, @Body() createQuestionDto: CreateQuestionDto) {
        // req.user.userId is the userId from the token
        return this.studentQuestionsService.create(req.user.userId, createQuestionDto);
    }

    @UseGuards(JwtAuthGuard)
    @Get('my-questions') // Student endpoint
    findAllForStudent(@Request() req) {
        return this.studentQuestionsService.findAllForStudent(req.user.userId);
    }

    @UseGuards(JwtAuthGuard)
    @Get('incoming') // Teacher endpoint
    findAllForTeacher(@Request() req) {
        return this.studentQuestionsService.findAllForTeacher(req.user.userId);
    }

    @UseGuards(JwtAuthGuard)
    @Get('daily-stats')
    getDailyStats(@Request() req) {
        return this.studentQuestionsService.getDailyStats(req.user.userId);
    }

    @UseGuards(JwtAuthGuard)
    @Post(':id/answer') // Teacher endpoint
    answer(@Request() req, @Param('id') id: string, @Body() answerDto: AnswerQuestionDto) {
        return this.studentQuestionsService.answer(req.user.userId, id, answerDto);
    }

    @UseGuards(JwtAuthGuard)
    @Get(':id')
    findOne(@Param('id') id: string) {
        return this.studentQuestionsService.findOne(id);
    }

    @UseGuards(JwtAuthGuard)
    @Post(':id/delete') // Bazı frontend kütüphaneleri DELETE ile problem yaşayabildiği için POST da eklenebilir ama standart DELETE
    removePost(@Request() req, @Param('id') id: string) {
        return this.studentQuestionsService.remove(req.user.userId, id);
    }
}
