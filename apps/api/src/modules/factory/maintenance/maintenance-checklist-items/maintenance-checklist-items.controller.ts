import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { MaintenanceChecklistItemsService } from './maintenance-checklist-items.service';
import { CreateMaintenanceChecklistItemDto } from './dto/create-maintenance-checklist-item.dto';
import { UpdateMaintenanceChecklistItemDto } from './dto/update-maintenance-checklist-item.dto';
import { JwtAuthGuard } from '../../../../modules/auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../../modules/auth/guards/permissions.guard';
import { Permissions } from '../../../../modules/auth/decorators/permissions.decorator';
import { CurrentUser } from '../../../../common/decorators/current-user.decorator';
import { CurrentActiveContext } from '../../../../common/operational-context/current-active-context.decorator';
import { ActiveOperationalContext } from '../../../../common/operational-context/operational-context.types';

@ApiTags('Maintenance Checklist Items')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller({ path: 'maintenance/checklist-items', version: '1' })
export class MaintenanceChecklistItemsController {
  constructor(private service: MaintenanceChecklistItemsService) {}

  @Post()
  @Permissions('maintenance-checklist:create')
  @ApiOperation({ summary: 'Create checklist item' })
  create(@Body() dto: CreateMaintenanceChecklistItemDto, @CurrentUser('sub') userId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.create(dto, userId, ctx);
  }

  @Get()
  @Permissions('maintenance-checklist:read')
  @ApiOperation({ summary: 'List checklist items' })
  findAll(@Query() query: { page?: string; limit?: string; search?: string; scheduleId?: string }, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.findAll({
      page: query.page ? parseInt(query.page, 10) : undefined,
      limit: query.limit ? parseInt(query.limit, 10) : undefined,
      search: query.search,
      scheduleId: query.scheduleId,
    }, ctx);
  }

  @Get(':id')
  @Permissions('maintenance-checklist:read')
  @ApiOperation({ summary: 'Get checklist item by ID' })
  findOne(@Param('id') id: string, @CurrentActiveContext() ctx: ActiveOperationalContext) { return this.service.findOne(id, ctx); }

  @Patch(':id')
  @Permissions('maintenance-checklist:update')
  @ApiOperation({ summary: 'Update checklist item' })
  update(@Param('id') id: string, @Body() dto: UpdateMaintenanceChecklistItemDto, @CurrentUser('sub') userId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.update(id, dto, userId, ctx);
  }

  @Delete(':id')
  @Permissions('maintenance-checklist:delete')
  @ApiOperation({ summary: 'Delete checklist item' })
  remove(@Param('id') id: string, @CurrentUser('sub') userId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.remove(id, userId, ctx);
  }
}
