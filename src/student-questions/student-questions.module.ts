import { Module } from '@nestjs/common';

import { PrismaModule } from '../prisma/prisma.module';
import { ToolsModule } from '../tools/tools.module';
import { StudentQuestionsController } from './student-questions.controller';
import { StudentQuestionsService } from './student-questions.service';

@Module({
    imports: [PrismaModule, ToolsModule],
    controllers: [StudentQuestionsController],
    providers: [StudentQuestionsService],
    exports: [StudentQuestionsService]
})
export class StudentQuestionsModule { }
