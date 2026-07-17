import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { MachineCategoriesService } from './machine-categories.service';
import { CreateMachineCategoryDto } from './dto/create-machine-category.dto';
import { UpdateMachineCategoryDto } from './dto/update-machine-category.dto';
import { JwtAuthGuard } from '../../../../modules/auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../../modules/auth/guards/permissions.guard';
import { Permissions } from '../../../../modules/auth/decorators/permissions.decorator';
import { CurrentUser } from '../../../../common/decorators/current-user.decorator';

@ApiTags('Machine Categories')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller({ path: 'maintenance/machine-categories', version: '1' })
export class MachineCategoriesController {
  constructor(private service: MachineCategoriesService) {}

  @Post()
  @Permissions('machine-category:create')
  @ApiOperation({ summary: 'Create machine category' })
  create(@Body() dto: CreateMachineCategoryDto, @CurrentUser('sub') userId: string) {
    return this.service.create(dto, userId);
  }

  @Get()
  @Permissions('machine-category:read')
  @ApiOperation({ summary: 'List machine categories' })
  findAll(@Query() query: { page?: string; limit?: string; search?: string; status?: string }) {
    return this.service.findAll({
      page: query.page ? parseInt(query.page, 10) : undefined,
      limit: query.limit ? parseInt(query.limit, 10) : undefined,
      search: query.search,
      status: query.status,
    });
  }

  @Get('tree')
  @Permissions('machine-category:read')
  @ApiOperation({ summary: 'Get machine category tree' })
  getTree() { return this.service.getTree(); }

  @Get(':id')
  @Permissions('machine-category:read')
  @ApiOperation({ summary: 'Get machine category by ID' })
  findOne(@Param('id') id: string) { return this.service.findOne(id); }

  @Patch(':id')
  @Permissions('machine-category:update')
  @ApiOperation({ summary: 'Update machine category' })
  update(@Param('id') id: string, @Body() dto: UpdateMachineCategoryDto, @CurrentUser('sub') userId: string) {
    return this.service.update(id, dto, userId);
  }

  @Delete(':id')
  @Permissions('machine-category:deactivate')
  @ApiOperation({ summary: 'Soft delete machine category' })
  remove(@Param('id') id: string, @CurrentUser('sub') userId: string) {
    return this.service.remove(id, userId);
  }

  @Patch(':id/activate')
  @Permissions('machine-category:activate')
  @ApiOperation({ summary: 'Activate machine category' })
  activate(@Param('id') id: string, @CurrentUser('sub') userId: string) {
    return this.service.activate(id, userId);
  }

  @Patch(':id/deactivate')
  @Permissions('machine-category:deactivate')
  @ApiOperation({ summary: 'Deactivate machine category' })
  deactivate(@Param('id') id: string, @CurrentUser('sub') userId: string) {
    return this.service.deactivate(id, userId);
  }

  @Get(':id/summary')
  @Permissions('machine-category:read')
  @ApiOperation({ summary: 'Get machine category summary' })
  categorySummary(@Param('id') id: string) { return this.service.categorySummary(id); }

  @Get(':id/machines')
  @Permissions('machine-category:read')
  @ApiOperation({ summary: 'Get machines in this category' })
  categoryMachines(@Param('id') id: string) { return this.service.categoryMachines(id); }
}
