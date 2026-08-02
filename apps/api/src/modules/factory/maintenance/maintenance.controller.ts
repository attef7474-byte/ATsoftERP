import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { MaintenanceService } from './maintenance.service';
import { CreateMachineDto, UpdateMachineDto, CreateMachinePartDto, CreateMachineDocumentDto, UpdateMachineStatusDto, UpdateMachineLocationDto, UpdateMachineManufacturerDto, UpdateMachineWarrantyDto, UpdateMachineImageDto } from './dto/maintenance.dto';
import { JwtAuthGuard } from '../../../modules/auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../modules/auth/guards/permissions.guard';
import { Permissions } from '../../../modules/auth/decorators/permissions.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { CurrentActiveContext } from '../../../common/operational-context/current-active-context.decorator';
import { ActiveOperationalContext } from '../../../common/operational-context/operational-context.types';

@ApiTags('Maintenance')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller({ path: 'maintenance', version: '1' })
export class MaintenanceController {
  constructor(private service: MaintenanceService) {}

  @Post('machines')
  @Permissions('machines:create')
  @ApiOperation({ summary: 'Create a machine' })
  createMachine(@Body() dto: CreateMachineDto, @CurrentUser('sub') userId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) { return this.service.createMachine(dto, userId, ctx); }

  @Get('machines')
  @Permissions('machines:read')
  @ApiOperation({ summary: 'List machines' })
  findAllMachines(@Query() query: { page?: string; limit?: string; search?: string; categoryId?: string; companyId?: string; branchId?: string; administrationId?: string; departmentId?: string; productionLineId?: string; operationTypeId?: string; status?: string }, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.findAllMachines({
      page: query.page ? parseInt(query.page, 10) : undefined,
      limit: query.limit ? parseInt(query.limit, 10) : undefined,
      search: query.search,
      categoryId: query.categoryId,
      companyId: query.companyId,
      branchId: query.branchId,
      administrationId: query.administrationId,
      departmentId: query.departmentId,
      productionLineId: query.productionLineId,
      operationTypeId: query.operationTypeId,
      status: query.status,
    }, ctx);
  }

  @Get('machines/:id')
  @Permissions('machines:read')
  @ApiOperation({ summary: 'Get machine by ID' })
  findOneMachine(@Param('id') id: string, @CurrentActiveContext() ctx: ActiveOperationalContext) { return this.service.findOneMachine(id, ctx); }

  @Patch('machines/:id')
  @Permissions('machines:update')
  @ApiOperation({ summary: 'Update machine' })
  updateMachine(@Param('id') id: string, @Body() dto: UpdateMachineDto, @CurrentUser('sub') userId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) { return this.service.updateMachine(id, dto, userId, ctx); }

  @Delete('machines/:id')
  @Permissions('machines:delete')
  @ApiOperation({ summary: 'Soft delete machine' })
  removeMachine(@Param('id') id: string, @CurrentUser('sub') userId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) { return this.service.removeMachine(id, userId, ctx); }

  @Patch('machines/:id/activate')
  @Permissions('machines:update')
  @ApiOperation({ summary: 'Activate machine' })
  activateMachine(@Param('id') id: string, @CurrentUser('sub') userId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) { return this.service.activateMachine(id, userId, ctx); }

  @Patch('machines/:id/deactivate')
  @Permissions('machines:update')
  @ApiOperation({ summary: 'Deactivate machine' })
  deactivateMachine(@Param('id') id: string, @CurrentUser('sub') userId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) { return this.service.deactivateMachine(id, userId, ctx); }

  @Patch('machines/:id/status')
  @Permissions('machines:update')
  @ApiOperation({ summary: 'Update machine status' })
  updateMachineStatus(@Param('id') id: string, @Body() dto: UpdateMachineStatusDto, @CurrentUser('sub') userId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) { return this.service.updateMachineStatus(id, dto.status, userId, ctx); }

  @Patch('machines/:id/location')
  @Permissions('machines:update')
  @ApiOperation({ summary: 'Update machine location' })
  updateMachineLocation(@Param('id') id: string, @Body() dto: UpdateMachineLocationDto, @CurrentUser('sub') userId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) { return this.service.updateMachineLocation(id, dto, userId, ctx); }

  @Patch('machines/:id/manufacturer')
  @Permissions('machines:update')
  @ApiOperation({ summary: 'Update machine manufacturer info' })
  updateMachineManufacturer(@Param('id') id: string, @Body() dto: UpdateMachineManufacturerDto, @CurrentUser('sub') userId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) { return this.service.updateMachineManufacturer(id, dto, userId, ctx); }

  @Patch('machines/:id/warranty')
  @Permissions('machines:update')
  @ApiOperation({ summary: 'Update machine warranty' })
  updateMachineWarranty(@Param('id') id: string, @Body() dto: UpdateMachineWarrantyDto, @CurrentUser('sub') userId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) { return this.service.updateMachineWarranty(id, dto, userId, ctx); }

  @Patch('machines/:id/image')
  @Permissions('machines:update')
  @ApiOperation({ summary: 'Update machine image' })
  updateMachineImage(@Param('id') id: string, @Body() dto: UpdateMachineImageDto, @CurrentUser('sub') userId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) { return this.service.updateMachineImage(id, dto, userId, ctx); }

  @Get('machines/:id/card')
  @Permissions('machines:read')
  @ApiOperation({ summary: 'Get machine asset card' })
  getMachineCard(@Param('id') id: string, @CurrentActiveContext() ctx: ActiveOperationalContext) { return this.service.getMachineCard(id, ctx); }

  @Get('machines/:id/operational-status')
  @Permissions('machines:read')
  @ApiOperation({ summary: 'Get machine operational status' })
  getMachineOperationalStatus(@Param('id') id: string, @CurrentActiveContext() ctx: ActiveOperationalContext) { return this.service.getMachineOperationalStatus(id, ctx); }

  @Get('machines/:id/components')
  @Permissions('machines:read')
  @ApiOperation({ summary: 'Get machine components' })
  getMachineComponents(@Param('id') id: string, @CurrentActiveContext() ctx: ActiveOperationalContext) { return this.service.getMachineComponents(id, ctx); }

  @Get('machines/:id/parts')
  @Permissions('machines:read')
  @ApiOperation({ summary: 'Get machine parts' })
  getMachineParts(@Param('id') id: string, @CurrentActiveContext() ctx: ActiveOperationalContext) { return this.service.getMachineParts(id, ctx); }

  @Get('machines/:id/documents')
  @Permissions('machines:read')
  @ApiOperation({ summary: 'Get machine documents' })
  getMachineDocuments(@Param('id') id: string, @CurrentActiveContext() ctx: ActiveOperationalContext) { return this.service.getMachineDocuments(id, ctx); }

  @Get('machines/:id/attachments')
  @Permissions('machines:read')
  @ApiOperation({ summary: 'Get machine attachments' })
  getMachineAttachments(@Param('id') id: string, @CurrentActiveContext() ctx: ActiveOperationalContext) { return this.service.getMachineAttachments(id, ctx); }

  @Get('machines/:id/activity')
  @Permissions('machines:read')
  @ApiOperation({ summary: 'Get machine activity log' })
  getMachineActivity(@Param('id') id: string, @CurrentActiveContext() ctx: ActiveOperationalContext) { return this.service.getMachineActivity(id, ctx); }

  @Post('parts')
  @Permissions('machines:create')
  @ApiOperation({ summary: 'Create machine part' })
  createPart(@Body() dto: CreateMachinePartDto, @CurrentActiveContext() ctx: ActiveOperationalContext) { return this.service.createPart(dto, ctx); }

  @Get('parts')
  @Permissions('machines:read')
  @ApiOperation({ summary: 'List machine parts' })
  findParts(@Query('machineId') machineId: string | undefined, @CurrentActiveContext() ctx: ActiveOperationalContext) { return this.service.findParts(machineId, ctx); }

  @Patch('parts/:id')
  @Permissions('machines:update')
  @ApiOperation({ summary: 'Update machine part' })
  updatePart(@Param('id') id: string, @Body() dto: Partial<CreateMachinePartDto>, @CurrentActiveContext() ctx: ActiveOperationalContext) { return this.service.updatePart(id, dto, ctx); }

  @Delete('parts/:id')
  @Permissions('machines:delete')
  @ApiOperation({ summary: 'Delete machine part' })
  removePart(@Param('id') id: string, @CurrentActiveContext() ctx: ActiveOperationalContext) { return this.service.removePart(id, ctx); }

  @Post('documents')
  @Permissions('machines:create')
  @ApiOperation({ summary: 'Upload machine document' })
  createDocument(@Body() dto: CreateMachineDocumentDto, @CurrentActiveContext() ctx: ActiveOperationalContext) { return this.service.createDocument(dto, ctx); }

  @Get('machines/:machineId/documents')
  @Permissions('machines:read')
  @ApiOperation({ summary: 'Get machine documents' })
  findDocuments(@Param('machineId') machineId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) { return this.service.findDocuments(machineId, ctx); }

  @Delete('documents/:id')
  @Permissions('machines:delete')
  @ApiOperation({ summary: 'Delete machine document' })
  removeDocument(@Param('id') id: string, @CurrentActiveContext() ctx: ActiveOperationalContext) { return this.service.removeDocument(id, ctx); }

  @Get('summary/machines')
  @Permissions('machines:read')
  @ApiOperation({ summary: 'Get machine operational summary' })
  getOperationalSummary(@CurrentActiveContext() ctx: ActiveOperationalContext) { return this.service.getOperationalSummary(ctx); }

  @Get('summary/machines/:id')
  @Permissions('machines:read')
  @ApiOperation({ summary: 'Get single machine operational summary' })
  getMachineSummary(@Param('id') id: string, @CurrentActiveContext() ctx: ActiveOperationalContext) { return this.service.getMachineSummary(id, ctx); }

  @Get('summary/requests')
  @Permissions('maintenance-request:read')
  @ApiOperation({ summary: 'Get maintenance request summary' })
  getRequestSummary(@CurrentActiveContext() ctx: ActiveOperationalContext) { return this.service.getRequestSummary(ctx); }

  @Get('machines/:id/maintenance-log')
  @Permissions('machines:read')
  @ApiOperation({ summary: 'Get maintenance log for a machine' })
  getMachineMaintenanceLog(@Param('id') id: string, @CurrentActiveContext() ctx: ActiveOperationalContext) { return this.service.getMachineMaintenanceLog(id, ctx); }

  @Get('machines/:id/downtime')
  @Permissions('machines:read')
  @ApiOperation({ summary: 'Get downtime logs for a machine' })
  getMachineDowntime(@Param('id') id: string, @CurrentActiveContext() ctx: ActiveOperationalContext) { return this.service.getMachineDowntime(id, ctx); }

  @Get('summary/downtime')
  @Permissions('downtime-log:read')
  @ApiOperation({ summary: 'Get downtime summary' })
  getDowntimeSummary(@CurrentActiveContext() ctx: ActiveOperationalContext) { return this.service.getDowntimeSummary(ctx); }

  @Get('summary/schedules')
  @Permissions('maintenance-schedule:read')
  @ApiOperation({ summary: 'Get maintenance schedule summary' })
  getScheduleSummary(@CurrentActiveContext() ctx: ActiveOperationalContext) { return this.service.getScheduleSummary(ctx); }
}
