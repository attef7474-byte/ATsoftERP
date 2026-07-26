import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { MaintenanceReliabilityService } from './maintenance-reliability.service';
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
  getMttr(@Query() query: { machineId?: string; productionLineId?: string; dateFrom?: string; dateTo?: string }) {
    return this.service.getMttr(query);
  }

  @Get('mtbf')
  @Permissions('maintenance-reliability:read')
  @ApiOperation({ summary: 'Get MTBF (Mean Time Between Failures)' })
  getMtbf(@Query() query: { machineId?: string; productionLineId?: string; dateFrom?: string; dateTo?: string }) {
    return this.service.getMtbf(query);
  }

  @Get('total-downtime')
  @Permissions('maintenance-reliability:read')
  @ApiOperation({ summary: 'Get total downtime minutes' })
  getTotalDowntime(@Query() query: { machineId?: string; productionLineId?: string; dateFrom?: string; dateTo?: string }) {
    return this.service.getTotalDowntime(query);
  }

  @Get('downtime-by-machine')
  @Permissions('maintenance-reliability:read')
  @ApiOperation({ summary: 'Get downtime grouped by machine' })
  getDowntimeByMachine(@Query() query: { dateFrom?: string; dateTo?: string; limit?: string }) {
    return this.service.getDowntimeByMachine({
      ...query,
      limit: query.limit ? parseInt(query.limit, 10) : undefined,
    });
  }

  @Get('downtime-by-line')
  @Permissions('maintenance-reliability:read')
  @ApiOperation({ summary: 'Get downtime by production line' })
  getDowntimeByProductionLine(@Query() query: { dateFrom?: string; dateTo?: string }) {
    return this.service.getDowntimeByProductionLine(query);
  }

  @Get('downtime-by-cause')
  @Permissions('maintenance-reliability:read')
  @ApiOperation({ summary: 'Get downtime by failure cause' })
  getDowntimeByCause(@Query() query: { dateFrom?: string; dateTo?: string }) {
    return this.service.getDowntimeByCause(query);
  }

  @Get('repeat-failures')
  @Permissions('maintenance-reliability:read')
  @ApiOperation({ summary: 'Get repeat failure logs' })
  getRepeatFailures(@Query() query: { dateFrom?: string; dateTo?: string; limit?: string }) {
    return this.service.getRepeatFailures({
      ...query,
      limit: query.limit ? parseInt(query.limit, 10) : undefined,
    });
  }

  @Get('emergency-response-time')
  @Permissions('maintenance-reliability:read')
  @ApiOperation({ summary: 'Get average emergency response time' })
  getEmergencyResponseTime(@Query() query: { dateFrom?: string; dateTo?: string }) {
    return this.service.getEmergencyResponseTime(query);
  }

  @Get('top-machines')
  @Permissions('maintenance-reliability:read')
  @ApiOperation({ summary: 'Get top machines by downtime' })
  getTopMachines(@Query() query: { dateFrom?: string; dateTo?: string; limit?: string }) {
    return this.service.getTopMachines({
      ...query,
      limit: query.limit ? parseInt(query.limit, 10) : undefined,
    });
  }

  @Get('top-causes')
  @Permissions('maintenance-reliability:read')
  @ApiOperation({ summary: 'Get top causes by downtime' })
  getTopCauses(@Query() query: { dateFrom?: string; dateTo?: string }) {
    return this.service.getTopCauses(query);
  }
}
