import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { MaintenancePartAccountabilityService } from './maintenance-part-accountability.service';
import { CreateMaintenancePartAccountabilityDto, UpdateMaintenancePartAccountabilityDto } from './dto/create-maintenance-part-accountability.dto';
import { JwtAuthGuard } from '../../../../modules/auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../../modules/auth/guards/permissions.guard';
import { Permissions } from '../../../../modules/auth/decorators/permissions.decorator';
import { CurrentActiveContext } from '../../../../common/operational-context/current-active-context.decorator';
import { ActiveOperationalContext } from '../../../../common/operational-context/operational-context.types';

@ApiTags('Maintenance Part Accountability')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller({ path: 'maintenance/part-accountabilities', version: '1' })
export class MaintenancePartAccountabilityController {
  constructor(private service: MaintenancePartAccountabilityService) {}

  @Post()
  @Permissions('maintenance-part-accountability:create')
  @ApiOperation({ summary: 'Create part accountability record' })
  create(@Body() dto: CreateMaintenancePartAccountabilityDto, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.create(dto, ctx);
  }

  @Get()
  @Permissions('maintenance-part-accountability:read')
  @ApiOperation({ summary: 'List part accountability records' })
  findAll(@Query() query: { page?: string; limit?: string; maintenanceRequestId?: string; sparePartId?: string; maintenancePersonnelId?: string; machineId?: string; status?: string }, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.findAll({
      page: query.page ? parseInt(query.page, 10) : undefined,
      limit: query.limit ? parseInt(query.limit, 10) : undefined,
      maintenanceRequestId: query.maintenanceRequestId,
      sparePartId: query.sparePartId,
      maintenancePersonnelId: query.maintenancePersonnelId,
      machineId: query.machineId,
      status: query.status,
    }, ctx);
  }

  @Get(':id')
  @Permissions('maintenance-part-accountability:read')
  @ApiOperation({ summary: 'Get part accountability record by id' })
  findOne(@Param('id') id: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.findOne(id, ctx);
  }

  @Patch(':id')
  @Permissions('maintenance-part-accountability:update')
  @ApiOperation({ summary: 'Update part accountability record' })
  update(@Param('id') id: string, @Body() dto: UpdateMaintenancePartAccountabilityDto, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.update(id, dto, ctx);
  }

  @Delete(':id')
  @Permissions('maintenance-part-accountability:delete')
  @ApiOperation({ summary: 'Cancel part accountability record' })
  remove(@Param('id') id: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.remove(id, ctx);
  }
}
