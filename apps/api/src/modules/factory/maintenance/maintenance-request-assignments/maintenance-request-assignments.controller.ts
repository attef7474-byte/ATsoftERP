import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { MaintenanceRequestAssignmentsService } from './maintenance-request-assignments.service';
import { CreateMaintenanceRequestAssignmentDto, UpdateMaintenanceRequestAssignmentDto } from './dto/create-maintenance-request-assignment.dto';
import { JwtAuthGuard } from '../../../../modules/auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../../modules/auth/guards/permissions.guard';
import { Permissions } from '../../../../modules/auth/decorators/permissions.decorator';

@ApiTags('Maintenance Request Assignments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller({ path: 'maintenance/request-assignments', version: '1' })
export class MaintenanceRequestAssignmentsController {
  constructor(private service: MaintenanceRequestAssignmentsService) {}

  @Post()
  @Permissions('maintenance-request-assignment:create')
  @ApiOperation({ summary: 'Assign personnel to maintenance request' })
  create(@Body() dto: CreateMaintenanceRequestAssignmentDto) {
    return this.service.create(dto);
  }

  @Get()
  @Permissions('maintenance-request-assignment:read')
  @ApiOperation({ summary: 'List maintenance request assignments' })
  findAll(@Query() query: { page?: string; limit?: string; maintenanceRequestId?: string; maintenancePersonnelId?: string; assignmentRole?: string; status?: string }) {
    return this.service.findAll({
      page: query.page ? parseInt(query.page, 10) : undefined,
      limit: query.limit ? parseInt(query.limit, 10) : undefined,
      maintenanceRequestId: query.maintenanceRequestId,
      maintenancePersonnelId: query.maintenancePersonnelId,
      assignmentRole: query.assignmentRole,
      status: query.status,
    });
  }

  @Get(':id')
  @Permissions('maintenance-request-assignment:read')
  @ApiOperation({ summary: 'Get maintenance request assignment by id' })
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Patch(':id')
  @Permissions('maintenance-request-assignment:update')
  @ApiOperation({ summary: 'Update maintenance request assignment' })
  update(@Param('id') id: string, @Body() dto: UpdateMaintenanceRequestAssignmentDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @Permissions('maintenance-request-assignment:delete')
  @ApiOperation({ summary: 'Cancel maintenance request assignment' })
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
