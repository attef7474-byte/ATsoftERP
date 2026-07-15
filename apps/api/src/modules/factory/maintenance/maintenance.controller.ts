import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { MaintenanceService } from './maintenance.service';
import { CreateMachineDto, UpdateMachineDto, CreateMachinePartDto, CreateMachineDocumentDto } from './dto/maintenance.dto';
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
  findAllMachines(@Query() query: { page?: string; limit?: string; search?: string; categoryId?: string; companyId?: string; status?: string }) {
    return this.service.findAllMachines({
      page: query.page ? parseInt(query.page, 10) : undefined,
      limit: query.limit ? parseInt(query.limit, 10) : undefined,
      search: query.search,
      categoryId: query.categoryId,
      companyId: query.companyId,
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

  @Get('summary/downtime')
  @Permissions('downtime-log:read')
  @ApiOperation({ summary: 'Get downtime summary' })
  getDowntimeSummary() { return this.service.getDowntimeSummary(); }

  @Get('summary/schedules')
  @Permissions('maintenance-schedule:read')
  @ApiOperation({ summary: 'Get maintenance schedule summary' })
  getScheduleSummary() { return this.service.getScheduleSummary(); }
}
