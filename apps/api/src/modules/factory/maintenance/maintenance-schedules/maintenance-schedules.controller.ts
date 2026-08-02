import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { MaintenanceSchedulesService } from './maintenance-schedules.service';
import { CreateMaintenanceScheduleDto } from './dto/create-maintenance-schedule.dto';
import { UpdateMaintenanceScheduleDto } from './dto/update-maintenance-schedule.dto';
import { JwtAuthGuard } from '../../../../modules/auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../../modules/auth/guards/permissions.guard';
import { Permissions } from '../../../../modules/auth/decorators/permissions.decorator';
import { CurrentUser } from '../../../../common/decorators/current-user.decorator';
import { CurrentActiveContext } from '../../../../common/operational-context/current-active-context.decorator';
import { ActiveOperationalContext } from '../../../../common/operational-context/operational-context.types';

@ApiTags('Maintenance Schedules')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller({ path: 'maintenance/schedules', version: '1' })
export class MaintenanceSchedulesController {
  constructor(private service: MaintenanceSchedulesService) {}

  @Post()
  @Permissions('maintenance-schedule:create')
  @ApiOperation({ summary: 'Create maintenance schedule' })
  create(@Body() dto: CreateMaintenanceScheduleDto, @CurrentUser('sub') userId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.create(dto, userId, ctx);
  }

  @Get()
  @Permissions('maintenance-schedule:read')
  @ApiOperation({ summary: 'List maintenance schedules' })
  findAll(@Query() query: { page?: string; limit?: string; search?: string; machineId?: string; status?: string; type?: string; dueBefore?: string; dueStatus?: string }, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.findAll({
      page: query.page ? parseInt(query.page, 10) : undefined,
      limit: query.limit ? parseInt(query.limit, 10) : undefined,
      search: query.search,
      machineId: query.machineId,
      status: query.status,
      type: query.type,
      dueBefore: query.dueBefore,
      dueStatus: query.dueStatus,
    }, ctx);
  }

  @Post(':id/execute')
  @Permissions('maintenance-schedule:execute')
  @ApiOperation({ summary: 'Execute maintenance schedule (create checklist execution)' })
  execute(@Param('id') id: string, @Body('requestId') requestId: string, @CurrentUser('sub') userId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.execute(id, requestId, userId, ctx);
  }

  @Post(':id/generate-request')
  @Permissions('maintenance-schedule:generateRequest')
  @ApiOperation({ summary: 'Generate a maintenance request from this schedule' })
  generateRequest(@Param('id') id: string, @CurrentUser('sub') userId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.generateRequest(id, userId, ctx);
  }

  @Get(':id/history')
  @Permissions('maintenance-schedule:history.view')
  @ApiOperation({ summary: 'Get execution history for a schedule' })
  getHistory(@Param('id') id: string, @Query() query: { page?: string; limit?: string }, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.getHistory(id, {
      page: query.page ? parseInt(query.page, 10) : undefined,
      limit: query.limit ? parseInt(query.limit, 10) : undefined,
    }, ctx);
  }

  @Get(':id')
  @Permissions('maintenance-schedule:read')
  @ApiOperation({ summary: 'Get maintenance schedule by ID' })
  findOne(@Param('id') id: string, @CurrentActiveContext() ctx: ActiveOperationalContext) { return this.service.findOne(id, ctx); }

  @Patch(':id')
  @Permissions('maintenance-schedule:update')
  @ApiOperation({ summary: 'Update maintenance schedule' })
  update(@Param('id') id: string, @Body() dto: UpdateMaintenanceScheduleDto, @CurrentUser('sub') userId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.update(id, dto, userId, ctx);
  }

  @Patch(':id/activate')
  @Permissions('maintenance-schedule:activate')
  @ApiOperation({ summary: 'Activate maintenance schedule' })
  activate(@Param('id') id: string, @CurrentUser('sub') userId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.activate(id, userId, ctx);
  }

  @Patch(':id/deactivate')
  @Permissions('maintenance-schedule:deactivate')
  @ApiOperation({ summary: 'Deactivate maintenance schedule' })
  deactivate(@Param('id') id: string, @CurrentUser('sub') userId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.deactivate(id, userId, ctx);
  }

  @Delete(':id')
  @Permissions('maintenance-schedule:delete')
  @ApiOperation({ summary: 'Deactivate maintenance schedule (soft delete)' })
  remove(@Param('id') id: string, @CurrentUser('sub') userId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.remove(id, userId, ctx);
  }
}
