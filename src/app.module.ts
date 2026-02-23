import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { ScheduleModule } from '@nestjs/schedule';
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
import { ClassroomsModule } from './classrooms/classrooms.module';
import { StudentQuestionsModule } from './student-questions/student-questions.module';
import { FocusModule } from './focus/focus.module';
import { LiveSessionsModule } from './live-sessions/live-sessions.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => {
        const redisUrl = configService.get('REDIS_URL');
        let connectionOptions: any = {
          host: configService.get('REDIS_HOST') || 'localhost',
          port: configService.get('REDIS_PORT') || 6379,
        };

        if (redisUrl) {
          const url = new URL(redisUrl);
          connectionOptions = {
            host: url.hostname,
            port: parseInt(url.port, 10),
            username: url.username,
            password: url.password,
          };
        }

        return { connection: connectionOptions };
      },
      inject: [ConfigService],
    }),
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
    ClassroomsModule,
    StudentQuestionsModule,
    FocusModule,
    LiveSessionsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule { }
