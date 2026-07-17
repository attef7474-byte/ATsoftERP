import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { MaintenanceDashboardService } from './maintenance-dashboard.service';
import { JwtAuthGuard } from '../../../../modules/auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../../modules/auth/guards/permissions.guard';
import { Permissions } from '../../../../modules/auth/decorators/permissions.decorator';

@ApiTags('Maintenance Dashboard')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller({ path: 'maintenance/dashboard', version: '1' })
export class MaintenanceDashboardController {
  constructor(private service: MaintenanceDashboardService) {}

  @Get('summary')
  @Permissions('maintenance.dashboard.view')
  @ApiOperation({ summary: 'Get maintenance dashboard summary' })
  getSummary() { return this.service.getSummary(); }

  @Get('open-requests')
  @Permissions('maintenance.dashboard.openRequests.view')
  @ApiOperation({ summary: 'Get open maintenance requests' })
  getOpenRequests(@Query() query: { page?: string; limit?: string; priority?: string; machineId?: string; assignedToId?: string }) {
    return this.service.getOpenRequests({
      page: query.page ? parseInt(query.page, 10) : undefined,
      limit: query.limit ? parseInt(query.limit, 10) : undefined,
      priority: query.priority,
      machineId: query.machineId,
      assignedToId: query.assignedToId,
    });
  }

  @Get('critical')
  @Permissions('maintenance.dashboard.critical.view')
  @ApiOperation({ summary: 'Get critical maintenance requests' })
  getCritical(@Query() query: { page?: string; limit?: string }) {
    return this.service.getCritical({
      page: query.page ? parseInt(query.page, 10) : undefined,
      limit: query.limit ? parseInt(query.limit, 10) : undefined,
    });
  }

  @Get('overdue')
  @Permissions('maintenance.dashboard.overdue.view')
  @ApiOperation({ summary: 'Get overdue maintenance items' })
  getOverdue(@Query() query: { page?: string; limit?: string }) {
    return this.service.getOverdue({
      page: query.page ? parseInt(query.page, 10) : undefined,
      limit: query.limit ? parseInt(query.limit, 10) : undefined,
    });
  }

  @Get('machines-under-maintenance')
  @Permissions('maintenance.dashboard.machinesUnderMaintenance.view')
  @ApiOperation({ summary: 'Get machines currently under maintenance' })
  getMachinesUnderMaintenance(@Query() query: { page?: string; limit?: string }) {
    return this.service.getMachinesUnderMaintenance({
      page: query.page ? parseInt(query.page, 10) : undefined,
      limit: query.limit ? parseInt(query.limit, 10) : undefined,
    });
  }

  @Get('current-downtime')
  @Permissions('maintenance.dashboard.currentDowntime.view')
  @ApiOperation({ summary: 'Get current downtime logs' })
  getCurrentDowntime(@Query() query: { page?: string; limit?: string }) {
    return this.service.getCurrentDowntime({
      page: query.page ? parseInt(query.page, 10) : undefined,
      limit: query.limit ? parseInt(query.limit, 10) : undefined,
    });
  }

  @Get('upcoming-preventive')
  @Permissions('maintenance.dashboard.upcomingPreventive.view')
  @ApiOperation({ summary: 'Get upcoming preventive maintenance' })
  getUpcomingPreventive(@Query() query: { page?: string; limit?: string }) {
    return this.service.getUpcomingPreventive({
      page: query.page ? parseInt(query.page, 10) : undefined,
      limit: query.limit ? parseInt(query.limit, 10) : undefined,
    });
  }

  @Get('cost-kpis')
  @Permissions('maintenance.dashboard.costKpis.view')
  @ApiOperation({ summary: 'Get maintenance cost KPIs' })
  getCostKpis(@Query() query: { year?: string; month?: string }) {
    return this.service.getCostKpis({
      year: query.year ? parseInt(query.year, 10) : undefined,
      month: query.month ? parseInt(query.month, 10) : undefined,
    });
  }
}
