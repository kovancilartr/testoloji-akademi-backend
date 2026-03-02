import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Delete,
  UseGuards,
} from '@nestjs/common';
import { ProjectsService } from './projects.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { GetUser } from '../common/decorators/get-user.decorator';
import { CreateProjectDto } from './dto/create-project.dto';
import { Role, SubscriptionTier } from '@prisma/client';

@Controller('projects')
@UseGuards(JwtAuthGuard)
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) { }

  @Post()
  async create(
    @GetUser('userId') userId: string,
    @GetUser('role') role: Role,
    @GetUser('tier') tier: SubscriptionTier,
    @Body() dto: CreateProjectDto,
  ) {
    return this.projectsService.create(userId, dto.name, role, tier, dto.folderId ?? null);
  }

  @Get()
  async getAll(@GetUser('userId') userId: string) {
    return this.projectsService.getAllByUser(userId);
  }

  @Get(':id')
  async getById(@GetUser('userId') userId: string, @Param('id') id: string) {
    return this.projectsService.getById(userId, id);
  }

  @Put(':id')
  async update(
    @GetUser('userId') userId: string,
    @Param('id') id: string,
    @Body('name') name: string,
    @Body('folderId') folderId?: string | null,
  ) {
    return this.projectsService.update(userId, id, name, folderId);
  }

  @Delete(':id')
  async delete(@GetUser('userId') userId: string, @Param('id') id: string) {
    return this.projectsService.delete(userId, id);
  }

  @Post(':id/duplicate')
  async duplicate(
    @GetUser('userId') userId: string,
    @GetUser('role') role: Role,
    @GetUser('tier') tier: SubscriptionTier,
    @Param('id') id: string,
  ) {
    return this.projectsService.duplicate(userId, id, role, tier);
  }
}
