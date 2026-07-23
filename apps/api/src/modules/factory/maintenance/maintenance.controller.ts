import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { MaintenanceService } from './maintenance.service';
import { CreateMachineDto, UpdateMachineDto, CreateMachinePartDto, CreateMachineDocumentDto, UpdateMachineStatusDto, UpdateMachineLocationDto, UpdateMachineManufacturerDto, UpdateMachineWarrantyDto, UpdateMachineImageDto } from './dto/maintenance.dto';
import { JwtAuthGuard } from '../../../modules/auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../modules/auth/guards/permissions.guard';
import { Permissions } from '../../../modules/auth/decorators/permissions.decorator';

@ApiTags('Maintenance')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller({ path: 'maintenance', version: '1' })
export class MaintenanceController {
  constructor(private service: MaintenanceService) {}

  @Post('machines')
  @Permissions('machines:create')
  @ApiOperation({ summary: 'Create a machine' })
  createMachine(@Body() dto: CreateMachineDto) { return this.service.createMachine(dto); }

  @Get('machines')
  @Permissions('machines:read')
  @ApiOperation({ summary: 'List machines' })
  findAllMachines(@Query() query: { page?: string; limit?: string; search?: string; categoryId?: string; companyId?: string; branchId?: string; administrationId?: string; departmentId?: string; productionLineId?: string; operationTypeId?: string; status?: string }) {
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
    });
  }

  @Get('machines/:id')
  @Permissions('machines:read')
  @ApiOperation({ summary: 'Get machine by ID' })
  findOneMachine(@Param('id') id: string) { return this.service.findOneMachine(id); }

  @Patch('machines/:id')
  @Permissions('machines:update')
  @ApiOperation({ summary: 'Update machine' })
  updateMachine(@Param('id') id: string, @Body() dto: UpdateMachineDto) { return this.service.updateMachine(id, dto); }

  @Delete('machines/:id')
  @Permissions('machines:delete')
  @ApiOperation({ summary: 'Soft delete machine' })
  removeMachine(@Param('id') id: string) { return this.service.removeMachine(id); }

  @Patch('machines/:id/activate')
  @Permissions('machines:update')
  @ApiOperation({ summary: 'Activate machine' })
  activateMachine(@Param('id') id: string) { return this.service.activateMachine(id); }

  @Patch('machines/:id/deactivate')
  @Permissions('machines:update')
  @ApiOperation({ summary: 'Deactivate machine' })
  deactivateMachine(@Param('id') id: string) { return this.service.deactivateMachine(id); }

  @Patch('machines/:id/status')
  @Permissions('machines:update')
  @ApiOperation({ summary: 'Update machine status' })
  updateMachineStatus(@Param('id') id: string, @Body() dto: UpdateMachineStatusDto) { return this.service.updateMachineStatus(id, dto.status); }

  @Patch('machines/:id/location')
  @Permissions('machines:update')
  @ApiOperation({ summary: 'Update machine location' })
  updateMachineLocation(@Param('id') id: string, @Body() dto: UpdateMachineLocationDto) { return this.service.updateMachineLocation(id, dto); }

  @Patch('machines/:id/manufacturer')
  @Permissions('machines:update')
  @ApiOperation({ summary: 'Update machine manufacturer info' })
  updateMachineManufacturer(@Param('id') id: string, @Body() dto: UpdateMachineManufacturerDto) { return this.service.updateMachineManufacturer(id, dto); }

  @Patch('machines/:id/warranty')
  @Permissions('machines:update')
  @ApiOperation({ summary: 'Update machine warranty' })
  updateMachineWarranty(@Param('id') id: string, @Body() dto: UpdateMachineWarrantyDto) { return this.service.updateMachineWarranty(id, dto); }

  @Patch('machines/:id/image')
  @Permissions('machines:update')
  @ApiOperation({ summary: 'Update machine image' })
  updateMachineImage(@Param('id') id: string, @Body() dto: UpdateMachineImageDto) { return this.service.updateMachineImage(id, dto); }

  @Get('machines/:id/card')
  @Permissions('machines:read')
  @ApiOperation({ summary: 'Get machine asset card' })
  getMachineCard(@Param('id') id: string) { return this.service.getMachineCard(id); }

  @Get('machines/:id/operational-status')
  @Permissions('machines:read')
  @ApiOperation({ summary: 'Get machine operational status' })
  getMachineOperationalStatus(@Param('id') id: string) { return this.service.getMachineOperationalStatus(id); }

  @Get('machines/:id/parts')
  @Permissions('machines:read')
  @ApiOperation({ summary: 'Get machine parts' })
  getMachineParts(@Param('id') id: string) { return this.service.getMachineParts(id); }

  @Get('machines/:id/documents')
  @Permissions('machines:read')
  @ApiOperation({ summary: 'Get machine documents' })
  getMachineDocuments(@Param('id') id: string) { return this.service.getMachineDocuments(id); }

  @Get('machines/:id/attachments')
  @Permissions('machines:read')
  @ApiOperation({ summary: 'Get machine attachments' })
  getMachineAttachments(@Param('id') id: string) { return this.service.getMachineAttachments(id); }

  @Get('machines/:id/activity')
  @Permissions('machines:read')
  @ApiOperation({ summary: 'Get machine activity log' })
  getMachineActivity(@Param('id') id: string) { return this.service.getMachineActivity(id); }

  @Post('parts')
  @Permissions('machines:create')
  @ApiOperation({ summary: 'Create machine part' })
  createPart(@Body() dto: CreateMachinePartDto) { return this.service.createPart(dto); }

  @Get('parts')
  @Permissions('machines:read')
  @ApiOperation({ summary: 'List machine parts' })
  findParts(@Query('machineId') machineId?: string) { return this.service.findParts(machineId); }

  @Patch('parts/:id')
  @Permissions('machines:update')
  @ApiOperation({ summary: 'Update machine part' })
  updatePart(@Param('id') id: string, @Body() dto: Partial<CreateMachinePartDto>) { return this.service.updatePart(id, dto); }

  @Delete('parts/:id')
  @Permissions('machines:delete')
  @ApiOperation({ summary: 'Delete machine part' })
  removePart(@Param('id') id: string) { return this.service.removePart(id); }

  @Post('documents')
  @Permissions('machines:create')
  @ApiOperation({ summary: 'Upload machine document' })
  createDocument(@Body() dto: CreateMachineDocumentDto) { return this.service.createDocument(dto); }

  @Get('machines/:machineId/documents')
  @Permissions('machines:read')
  @ApiOperation({ summary: 'Get machine documents' })
  findDocuments(@Param('machineId') machineId: string) { return this.service.findDocuments(machineId); }

  @Delete('documents/:id')
  @Permissions('machines:delete')
  @ApiOperation({ summary: 'Delete machine document' })
  removeDocument(@Param('id') id: string) { return this.service.removeDocument(id); }

  @Get('summary/machines')
  @Permissions('machines:read')
  @ApiOperation({ summary: 'Get machine operational summary' })
  getOperationalSummary() { return this.service.getOperationalSummary(); }

  @Get('summary/machines/:id')
  @Permissions('machines:read')
  @ApiOperation({ summary: 'Get single machine operational summary' })
  getMachineSummary(@Param('id') id: string) { return this.service.getMachineSummary(id); }

  @Get('summary/requests')
  @Permissions('maintenance-request:read')
  @ApiOperation({ summary: 'Get maintenance request summary' })
  getRequestSummary() { return this.service.getRequestSummary(); }

  @Get('machines/:id/maintenance-log')
  @Permissions('machines:read')
  @ApiOperation({ summary: 'Get maintenance log for a machine' })
  getMachineMaintenanceLog(@Param('id') id: string) { return this.service.getMachineMaintenanceLog(id); }

  @Get('machines/:id/downtime')
  @Permissions('machines:read')
  @ApiOperation({ summary: 'Get downtime logs for a machine' })
  getMachineDowntime(@Param('id') id: string) { return this.service.getMachineDowntime(id); }

  @Get('summary/downtime')
  @Permissions('downtime-log:read')
  @ApiOperation({ summary: 'Get downtime summary' })
  getDowntimeSummary() { return this.service.getDowntimeSummary(); }

  @Get('summary/schedules')
  @Permissions('maintenance-schedule:read')
  @ApiOperation({ summary: 'Get maintenance schedule summary' })
  getScheduleSummary() { return this.service.getScheduleSummary(); }
}
