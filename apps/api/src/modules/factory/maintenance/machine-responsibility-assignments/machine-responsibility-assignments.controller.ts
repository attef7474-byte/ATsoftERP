import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { MachineResponsibilityAssignmentsService } from './machine-responsibility-assignments.service';
import { CreateMachineResponsibilityAssignmentDto, UpdateMachineResponsibilityAssignmentDto } from './dto/create-machine-responsibility-assignment.dto';
import { JwtAuthGuard } from '../../../../modules/auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../../modules/auth/guards/permissions.guard';
import { Permissions } from '../../../../modules/auth/decorators/permissions.decorator';
import { CurrentUser } from '../../../../common/decorators/current-user.decorator';
import { CurrentActiveContext } from '../../../../common/operational-context/current-active-context.decorator';
import { ActiveOperationalContext } from '../../../../common/operational-context/operational-context.types';

@ApiTags('Machine Responsibility Assignments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller({ path: 'maintenance/machine-responsibilities', version: '1' })
export class MachineResponsibilityAssignmentsController {
  constructor(private service: MachineResponsibilityAssignmentsService) {}

  @Post()
  @Permissions('machine-responsibility:create')
  @ApiOperation({ summary: 'Create machine responsibility assignment' })
  create(
    @Body() dto: CreateMachineResponsibilityAssignmentDto,
    @CurrentUser('id') userId: string,
    @CurrentActiveContext() ctx: ActiveOperationalContext,
  ) {
    return this.service.create(dto, userId, ctx);
  }

  @Get()
  @Permissions('machine-responsibility:read')
  @ApiOperation({ summary: 'List machine responsibility assignments' })
  findAll(
    @Query() query: { page?: string; limit?: string; machineId?: string; maintenancePersonnelId?: string; responsibilityRole?: string; status?: string; isPrimary?: string; scopeType?: string; departmentId?: string; productionLineId?: string },
    @CurrentActiveContext() ctx: ActiveOperationalContext,
  ) {
    return this.service.findAll({
      page: query.page ? parseInt(query.page, 10) : undefined,
      limit: query.limit ? parseInt(query.limit, 10) : undefined,
      machineId: query.machineId,
      maintenancePersonnelId: query.maintenancePersonnelId,
      responsibilityRole: query.responsibilityRole,
      status: query.status,
      isPrimary: query.isPrimary,
      scopeType: query.scopeType,
      departmentId: query.departmentId,
      productionLineId: query.productionLineId,
    }, ctx);
  }

  @Get(':id')
  @Permissions('machine-responsibility:read')
  @ApiOperation({ summary: 'Get machine responsibility assignment by id' })
  findOne(@Param('id') id: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.findOne(id, ctx);
  }

  @Patch(':id')
  @Permissions('machine-responsibility:update')
  @ApiOperation({ summary: 'Update machine responsibility assignment' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateMachineResponsibilityAssignmentDto,
    @CurrentUser('id') userId: string,
    @CurrentActiveContext() ctx: ActiveOperationalContext,
  ) {
    return this.service.update(id, dto, userId, ctx);
  }

  @Delete(':id')
  @Permissions('machine-responsibility:delete')
  @ApiOperation({ summary: 'End/remove machine responsibility assignment' })
  remove(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @CurrentActiveContext() ctx: ActiveOperationalContext,
  ) {
    return this.service.remove(id, userId, ctx);
  }
}
