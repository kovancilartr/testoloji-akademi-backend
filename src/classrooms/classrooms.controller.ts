import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  ForbiddenException,
} from '@nestjs/common';
import { ClassroomsService } from './classrooms.service';
import { CreateClassroomDto } from './dto/create-classroom.dto';
import { UpdateClassroomDto } from './dto/update-classroom.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { GetUser } from '../common/decorators/get-user.decorator';
import { Role, SubscriptionTier } from '@prisma/client';
import { hasFeatureAccess } from '../common/config/limits';

@Controller('classrooms')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ClassroomsController {
  constructor(private readonly classroomsService: ClassroomsService) { }

  @Post()
  @Roles(Role.TEACHER, Role.ADMIN)
  create(
    @GetUser('userId') userId: string,
    @GetUser('organizationId') organizationId: string,
    @GetUser('role') role: Role,
    @GetUser('tier') tier: SubscriptionTier,
    @Body() createClassroomDto: CreateClassroomDto,
  ) {
    if (!hasFeatureAccess(role, tier, 'CAN_CREATE_CLASSROOM')) {
      throw new ForbiddenException('Sınıf oluşturma özelliği paketinizde (GÜMÜŞ/ALTIN) bulunmamaktadır.');
    }
    return this.classroomsService.create(userId, organizationId, createClassroomDto);
  }

  @Get()
  @Roles(Role.TEACHER, Role.ADMIN)
  findAll(
    @GetUser('userId') userId: string,
    @GetUser('organizationId') organizationId: string,
  ) {
    return this.classroomsService.findAll(userId, organizationId);
  }

  @Get(':id')
  @Roles(Role.TEACHER, Role.ADMIN)
  findOne(@GetUser('userId') userId: string, @Param('id') id: string) {
    return this.classroomsService.findOne(userId, id);
  }

  @Patch(':id')
  @Roles(Role.TEACHER, Role.ADMIN)
  update(
    @GetUser('userId') userId: string,
    @Param('id') id: string,
    @Body() updateClassroomDto: UpdateClassroomDto,
  ) {
    return this.classroomsService.update(userId, id, updateClassroomDto);
  }

  @Delete(':id')
  @Roles(Role.TEACHER, Role.ADMIN)
  remove(@GetUser('userId') userId: string, @Param('id') id: string) {
    return this.classroomsService.remove(userId, id);
  }

  @Post(':id/students')
  @Roles(Role.TEACHER, Role.ADMIN)
  addStudents(
    @GetUser('userId') userId: string,
    @Param('id') id: string,
    @Body('studentIds') studentIds: string[],
  ) {
    return this.classroomsService.addStudents(userId, id, studentIds);
  }

  @Delete(':id/students')
  @Roles(Role.TEACHER, Role.ADMIN)
  removeStudents(
    @GetUser('userId') userId: string,
    @Param('id') id: string,
    @Body('studentIds') studentIds: string[],
  ) {
    return this.classroomsService.removeStudents(userId, id, studentIds);
  }
}
