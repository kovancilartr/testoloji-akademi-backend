import { Controller, Get, Post, Body, Patch, Param, UseGuards, Delete } from '@nestjs/common';
import { OrganizationsService } from './organizations.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '@prisma/client';

@Controller('organizations')
export class OrganizationsController {
    // Kurumsal kimlik ve organizasyon yönetimi controller'ı
    constructor(private readonly organizationsService: OrganizationsService) { }

    @Post()
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.ADMIN)
    create(@Body() createDto: { name: string; slug: string; ownerId?: string }) {
        return this.organizationsService.create(createDto);
    }

    @Get()
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.ADMIN)
    findAll() {
        return this.organizationsService.findAll();
    }

    @Get(':id')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.ADMIN, Role.TEACHER)
    findOne(@Param('id') id: string) {
        return this.organizationsService.findOne(id);
    }

    // Frontend markalama için public erişim
    @Get('public/slug/:slug')
    findBySlug(@Param('slug') slug: string) {
        return this.organizationsService.findBySlug(slug);
    }

    @Get('public/domain/:domain')
    findByDomain(@Param('domain') domain: string) {
        // Fail-safe: Eğer domain .localhost ile bitiyorsa, slug olarak ara
        if (domain.endsWith('.localhost')) {
            const slug = domain.split('.')[0];
            return this.organizationsService.findBySlug(slug);
        }
        return this.organizationsService.findByCustomDomain(domain);
    }

    @Patch(':id')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.ADMIN, Role.TEACHER) // Kurum sahibi hoca veya Admin güncelleyebilir
    update(@Param('id') id: string, @Body() updateDto: any) {
        return this.organizationsService.update(id, updateDto);
    }

    @Delete(':id')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.ADMIN)
    remove(@Param('id') id: string) {
        return this.organizationsService.remove(id);
    }
}
