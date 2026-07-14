import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { MaintenanceRequestsService } from './maintenance-requests.service';
import { CreateMaintenanceRequestDto } from './dto/create-maintenance-request.dto';
import { UpdateMaintenanceRequestDto } from './dto/update-maintenance-request.dto';
import { JwtAuthGuard } from '../../../../modules/auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../../modules/auth/guards/permissions.guard';
import { Permissions } from '../../../../modules/auth/decorators/permissions.decorator';
import { CurrentUser } from '../../../../common/decorators/current-user.decorator';

@ApiTags('Maintenance Requests')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller({ path: 'maintenance/requests', version: '1' })
export class MaintenanceRequestsController {
  constructor(private service: MaintenanceRequestsService) {}

  @Post()
  @Permissions('maintenance-request:create')
  @ApiOperation({ summary: 'Create maintenance request' })
  create(@Body() dto: CreateMaintenanceRequestDto, @CurrentUser('id') userId: string) {
    return this.service.create(dto, userId);
  }

  @Get()
  @Permissions('maintenance-request:read')
  @ApiOperation({ summary: 'List maintenance requests' })
  findAll(@Query() query: {
    page?: string; limit?: string; search?: string;
    machineId?: string; status?: string; type?: string; priority?: string;
    requestedById?: string; assignedToId?: string;
  }) {
    return this.service.findAll({
      page: query.page ? parseInt(query.page, 10) : undefined,
      limit: query.limit ? parseInt(query.limit, 10) : undefined,
      search: query.search,
      machineId: query.machineId,
      status: query.status,
      type: query.type,
      priority: query.priority,
      requestedById: query.requestedById,
      assignedToId: query.assignedToId,
    });
  }

  @Get(':id')
  @Permissions('maintenance-request:read')
  @ApiOperation({ summary: 'Get maintenance request by ID' })
  findOne(@Param('id') id: string) { return this.service.findOne(id); }

  @Patch(':id')
  @Permissions('maintenance-request:update')
  @ApiOperation({ summary: 'Update maintenance request' })
  update(@Param('id') id: string, @Body() dto: UpdateMaintenanceRequestDto, @CurrentUser('id') userId: string) {
    return this.service.update(id, dto, userId);
  }

  @Patch(':id/start')
  @Permissions('maintenance-request:start')
  @ApiOperation({ summary: 'Start maintenance request' })
  start(@Param('id') id: string, @CurrentUser('id') userId: string) { return this.service.start(id, userId); }

  @Patch(':id/complete')
  @Permissions('maintenance-request:complete')
  @ApiOperation({ summary: 'Complete maintenance request' })
  complete(@Param('id') id: string, @CurrentUser('id') userId: string) { return this.service.complete(id, userId); }

  @Patch(':id/cancel')
  @Permissions('maintenance-request:cancel')
  @ApiOperation({ summary: 'Cancel maintenance request' })
  cancel(@Param('id') id: string, @CurrentUser('id') userId: string) { return this.service.cancel(id, userId); }

  @Delete(':id')
  @Permissions('maintenance-request:delete')
  @ApiOperation({ summary: 'Soft delete maintenance request' })
  remove(@Param('id') id: string, @CurrentUser('id') userId: string) { return this.service.remove(id, userId); }
}
