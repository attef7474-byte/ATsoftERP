import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { MaintenanceSchedulesService } from './maintenance-schedules.service';
import { CreateMaintenanceScheduleDto } from './dto/create-maintenance-schedule.dto';
import { UpdateMaintenanceScheduleDto } from './dto/update-maintenance-schedule.dto';
import { JwtAuthGuard } from '../../../../modules/auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../../modules/auth/guards/permissions.guard';
import { Permissions } from '../../../../modules/auth/decorators/permissions.decorator';
import { CurrentUser } from '../../../../common/decorators/current-user.decorator';

@ApiTags('Maintenance Schedules')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller({ path: 'maintenance/schedules', version: '1' })
export class MaintenanceSchedulesController {
  constructor(private service: MaintenanceSchedulesService) {}

  @Post()
  @Permissions('maintenance-schedule:create')
  @ApiOperation({ summary: 'Create maintenance schedule' })
  create(@Body() dto: CreateMaintenanceScheduleDto, @CurrentUser('sub') userId: string) {
    return this.service.create(dto, userId);
  }

  @Get()
  @Permissions('maintenance-schedule:read')
  @ApiOperation({ summary: 'List maintenance schedules' })
  findAll(@Query() query: { page?: string; limit?: string; search?: string; machineId?: string; status?: string; type?: string }) {
    return this.service.findAll({
      page: query.page ? parseInt(query.page, 10) : undefined,
      limit: query.limit ? parseInt(query.limit, 10) : undefined,
      search: query.search,
      machineId: query.machineId,
      status: query.status,
      type: query.type,
    });
  }

  @Get(':id')
  @Permissions('maintenance-schedule:read')
  @ApiOperation({ summary: 'Get maintenance schedule by ID' })
  findOne(@Param('id') id: string) { return this.service.findOne(id); }

  @Patch(':id')
  @Permissions('maintenance-schedule:update')
  @ApiOperation({ summary: 'Update maintenance schedule' })
  update(@Param('id') id: string, @Body() dto: UpdateMaintenanceScheduleDto, @CurrentUser('sub') userId: string) {
    return this.service.update(id, dto, userId);
  }

  @Patch(':id/activate')
  @Permissions('maintenance-schedule:activate')
  @ApiOperation({ summary: 'Activate maintenance schedule' })
  activate(@Param('id') id: string, @CurrentUser('sub') userId: string) {
    return this.service.activate(id, userId);
  }

  @Patch(':id/deactivate')
  @Permissions('maintenance-schedule:deactivate')
  @ApiOperation({ summary: 'Deactivate maintenance schedule' })
  deactivate(@Param('id') id: string, @CurrentUser('sub') userId: string) {
    return this.service.deactivate(id, userId);
  }

  @Delete(':id')
  @Permissions('maintenance-schedule:delete')
  @ApiOperation({ summary: 'Deactivate maintenance schedule (soft delete)' })
  remove(@Param('id') id: string, @CurrentUser('sub') userId: string) {
    return this.service.remove(id, userId);
  }
}
