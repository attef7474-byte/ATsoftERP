import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { MaintenanceReliabilityService } from './maintenance-reliability.service';
import { CurrentActiveContext } from '../../../../common/operational-context/current-active-context.decorator';
import { ActiveOperationalContext } from '../../../../common/operational-context/operational-context.types';
import { JwtAuthGuard } from '../../../../modules/auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../../modules/auth/guards/permissions.guard';
import { Permissions } from '../../../../modules/auth/decorators/permissions.decorator';

@ApiTags('Maintenance Reliability')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller({ path: 'maintenance/reliability', version: '1' })
export class MaintenanceReliabilityController {
  constructor(private service: MaintenanceReliabilityService) {}

  @Get('mttr')
  @Permissions('maintenance-reliability:read')
  @ApiOperation({ summary: 'Get MTTR (Mean Time To Repair)' })
  getMttr(@Query() query: { machineId?: string; productionLineId?: string; dateFrom?: string; dateTo?: string }, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.getMttr(query, ctx);
  }

  @Get('mtbf')
  @Permissions('maintenance-reliability:read')
  @ApiOperation({ summary: 'Get MTBF (Mean Time Between Failures)' })
  getMtbf(@Query() query: { machineId?: string; productionLineId?: string; dateFrom?: string; dateTo?: string }, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.getMtbf(query, ctx);
  }

  @Get('total-downtime')
  @Permissions('maintenance-reliability:read')
  @ApiOperation({ summary: 'Get total downtime minutes' })
  getTotalDowntime(@Query() query: { machineId?: string; productionLineId?: string; dateFrom?: string; dateTo?: string }, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.getTotalDowntime(query, ctx);
  }

  @Get('downtime-by-machine')
  @Permissions('maintenance-reliability:read')
  @ApiOperation({ summary: 'Get downtime grouped by machine' })
  getDowntimeByMachine(@Query() query: { dateFrom?: string; dateTo?: string; limit?: string }, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.getDowntimeByMachine({
      ...query,
      limit: query.limit ? parseInt(query.limit, 10) : undefined,
    }, ctx);
  }

  @Get('downtime-by-line')
  @Permissions('maintenance-reliability:read')
  @ApiOperation({ summary: 'Get downtime by production line' })
  getDowntimeByProductionLine(@Query() query: { dateFrom?: string; dateTo?: string }, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.getDowntimeByProductionLine(query, ctx);
  }

  @Get('downtime-by-cause')
  @Permissions('maintenance-reliability:read')
  @ApiOperation({ summary: 'Get downtime by failure cause' })
  getDowntimeByCause(@Query() query: { dateFrom?: string; dateTo?: string }, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.getDowntimeByCause(query, ctx);
  }

  @Get('repeat-failures')
  @Permissions('maintenance-reliability:read')
  @ApiOperation({ summary: 'Get repeat failure logs' })
  getRepeatFailures(@Query() query: { dateFrom?: string; dateTo?: string; limit?: string }, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.getRepeatFailures({
      ...query,
      limit: query.limit ? parseInt(query.limit, 10) : undefined,
    }, ctx);
  }

  @Get('emergency-response-time')
  @Permissions('maintenance-reliability:read')
  @ApiOperation({ summary: 'Get average emergency response time' })
  getEmergencyResponseTime(@Query() query: { dateFrom?: string; dateTo?: string }, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.getEmergencyResponseTime(query, ctx);
  }

  @Get('top-machines')
  @Permissions('maintenance-reliability:read')
  @ApiOperation({ summary: 'Get top machines by downtime' })
  getTopMachines(@Query() query: { dateFrom?: string; dateTo?: string; limit?: string }, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.getTopMachines({
      ...query,
      limit: query.limit ? parseInt(query.limit, 10) : undefined,
    }, ctx);
  }

  @Get('top-causes')
  @Permissions('maintenance-reliability:read')
  @ApiOperation({ summary: 'Get top causes by downtime' })
  getTopCauses(@Query() query: { dateFrom?: string; dateTo?: string }, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.getTopCauses(query, ctx);
  }

  // ─────────────── AF-AG: New Reliability KPIs ───────────────

  @Get('repeat-failure-rate')
  @Permissions('maintenance-reliability:read')
  @ApiOperation({ summary: 'Get repeat failure rate percentage' })
  getRepeatFailureRate(@Query() query: { dateFrom?: string; dateTo?: string; machineId?: string; productionLineId?: string; operationTypeId?: string; costCenterId?: string }, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.getRepeatFailureRate(query, ctx);
  }

  @Get('availability')
  @Permissions('maintenance-reliability:read')
  @ApiOperation({ summary: 'Get approximate system availability' })
  getAvailability(@Query() query: { dateFrom?: string; dateTo?: string; machineId?: string; productionLineId?: string; operationTypeId?: string; costCenterId?: string }, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.getAvailability(query, ctx);
  }

  @Get('sla-times')
  @Permissions('maintenance-reliability:read')
  @ApiOperation({ summary: 'Get average SLA response and repair times' })
  getSlaTimes(@Query() query: { dateFrom?: string; dateTo?: string; machineId?: string; productionLineId?: string; operationTypeId?: string; costCenterId?: string }, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.getSlaTimes(query, ctx);
  }
}