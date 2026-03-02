import { Controller, Get, Post, Put, Patch, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { FoldersService } from './folders.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { GetUser } from '../common/decorators/get-user.decorator';

@Controller('folders')
@UseGuards(JwtAuthGuard)
export class FoldersController {
    constructor(private readonly foldersService: FoldersService) { }

    @Get()
    async getAll(@GetUser('userId') userId: string) {
        return this.foldersService.getAll(userId);
    }

    @Post()
    async create(
        @GetUser('userId') userId: string,
        @Body('name') name: string,
        @Body('color') color?: string,
    ) {
        return this.foldersService.create(userId, name, color);
    }

    @Put(':id')
    async update(
        @GetUser('userId') userId: string,
        @Param('id') folderId: string,
        @Body('name') name?: string,
        @Body('color') color?: string,
    ) {
        return this.foldersService.update(userId, folderId, name, color);
    }

    @Delete(':id')
    async delete(@GetUser('userId') userId: string, @Param('id') folderId: string) {
        return this.foldersService.delete(userId, folderId);
    }

    // Projeyi klasöre taşı / klasörden çıkar
    @Patch('move-project/:projectId')
    async moveProject(
        @GetUser('userId') userId: string,
        @Param('projectId') projectId: string,
        @Body('folderId') folderId: string | null,
    ) {
        return this.foldersService.moveProject(userId, projectId, folderId ?? null);
    }

    @Post('bulk-move-projects')
    async bulkMoveProjects(
        @GetUser('userId') userId: string,
        @Body('projectIds') projectIds: string[],
        @Body('folderId') folderId: string | null,
    ) {
        return this.foldersService.bulkMoveProjects(userId, projectIds, folderId ?? null);
    }
}
