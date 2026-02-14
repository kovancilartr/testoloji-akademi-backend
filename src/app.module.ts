import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { ProjectsModule } from './projects/projects.module';
import { QuestionsModule } from './questions/questions.module';
import { AcademyModule } from './academy/academy.module';
import { CoursesModule } from './courses/courses.module';
import { AssignmentsModule } from './assignments/assignments.module';
import { SchedulesModule } from './schedules/schedules.module';
import { SettingsModule } from './settings/settings.module';
import { ToolsModule } from './tools/tools.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { NotificationsModule } from './notifications/notifications.module';
import { CoachingModule } from './coaching/coaching.module';
import { SystemSettingsModule } from './system-settings/system-settings.module';
import { StudentQuestionsModule } from './student-questions/student-questions.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    UsersModule,
    ProjectsModule,
    QuestionsModule,
    AcademyModule,
    CoursesModule,
    AssignmentsModule,
    SchedulesModule,
    SettingsModule,
    ToolsModule,
    AnalyticsModule,
    NotificationsModule,
    CoachingModule,
    SystemSettingsModule,
    StudentQuestionsModule
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule { }
