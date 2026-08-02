import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { MaintenanceDashboardService } from './maintenance-dashboard.service';
import { CurrentActiveContext } from '../../../../common/operational-context/current-active-context.decorator';
import { ActiveOperationalContext } from '../../../../common/operational-context/operational-context.types';
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
  getSummary(@CurrentActiveContext() ctx: ActiveOperationalContext) { return this.service.getSummary(ctx); }

  @Get('open-requests')
  @Permissions('maintenance.dashboard.openRequests.view')
  @ApiOperation({ summary: 'Get open maintenance requests' })
  getOpenRequests(@Query() query: { page?: string; limit?: string; priority?: string; machineId?: string; assignedToId?: string }, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.getOpenRequests({
      page: query.page ? parseInt(query.page, 10) : undefined,
      limit: query.limit ? parseInt(query.limit, 10) : undefined,
      priority: query.priority,
      machineId: query.machineId,
      assignedToId: query.assignedToId,
    }, ctx);
  }

  @Get('critical')
  @Permissions('maintenance.dashboard.critical.view')
  @ApiOperation({ summary: 'Get critical maintenance requests' })
  getCritical(@Query() query: { page?: string; limit?: string }, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.getCritical({
      page: query.page ? parseInt(query.page, 10) : undefined,
      limit: query.limit ? parseInt(query.limit, 10) : undefined,
    }, ctx);
  }

  @Get('overdue')
  @Permissions('maintenance.dashboard.overdue.view')
  @ApiOperation({ summary: 'Get overdue maintenance items' })
  getOverdue(@Query() query: { page?: string; limit?: string }, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.getOverdue({
      page: query.page ? parseInt(query.page, 10) : undefined,
      limit: query.limit ? parseInt(query.limit, 10) : undefined,
    }, ctx);
  }

  @Get('machines-under-maintenance')
  @Permissions('maintenance.dashboard.machinesUnderMaintenance.view')
  @ApiOperation({ summary: 'Get machines currently under maintenance' })
  getMachinesUnderMaintenance(@Query() query: { page?: string; limit?: string }, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.getMachinesUnderMaintenance({
      page: query.page ? parseInt(query.page, 10) : undefined,
      limit: query.limit ? parseInt(query.limit, 10) : undefined,
    }, ctx);
  }

  @Get('current-downtime')
  @Permissions('maintenance.dashboard.currentDowntime.view')
  @ApiOperation({ summary: 'Get current downtime logs' })
  getCurrentDowntime(@Query() query: { page?: string; limit?: string }, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.getCurrentDowntime({
      page: query.page ? parseInt(query.page, 10) : undefined,
      limit: query.limit ? parseInt(query.limit, 10) : undefined,
    }, ctx);
  }

  @Get('upcoming-preventive')
  @Permissions('maintenance.dashboard.upcomingPreventive.view')
  @ApiOperation({ summary: 'Get upcoming preventive maintenance' })
  getUpcomingPreventive(@Query() query: { page?: string; limit?: string }, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.getUpcomingPreventive({
      page: query.page ? parseInt(query.page, 10) : undefined,
      limit: query.limit ? parseInt(query.limit, 10) : undefined,
    }, ctx);
  }

  @Get('cost-kpis')
  @Permissions('maintenance.dashboard.costKpis.view')
  @ApiOperation({ summary: 'Get maintenance cost KPIs' })
  getCostKpis(@Query() query: { year?: string; month?: string }, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.getCostKpis({
      year: query.year ? parseInt(query.year, 10) : undefined,
      month: query.month ? parseInt(query.month, 10) : undefined,
    }, ctx);
  }

  @Get('accountability-kpis')
  @Permissions('maintenance.dashboard.accountabilityKpis.view')
  @ApiOperation({ summary: 'Get maintenance accountability KPIs' })
  getAccountabilityKpis(@CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.getAccountabilityKpis(ctx);
  }

  @Get('recent-generated-preventive')
  @Permissions('maintenance.dashboard.recentGeneratedPreventive.view')
  @ApiOperation({ summary: 'Get recent generated preventive maintenance requests' })
  getRecentGeneratedPreventive(@CurrentActiveContext() ctx: ActiveOperationalContext, @Query('limit') limit?: string) {
    return this.service.getRecentGeneratedPreventive(limit ? parseInt(limit, 10) : 5, ctx);
  }

  @Get('recent-emergency')
  @Permissions('maintenance.dashboard.recentEmergency.view')
  @ApiOperation({ summary: 'Get recent emergency maintenance requests' })
  getRecentEmergencyRequests(@CurrentActiveContext() ctx: ActiveOperationalContext, @Query('limit') limit?: string) {
    return this.service.getRecentEmergencyRequests(limit ? parseInt(limit, 10) : 5, ctx);
  }

  @Get('sla-overdue')
  @Permissions('maintenance.dashboard.slaOverdue.view')
  @ApiOperation({ summary: 'Get SLA overdue requests' })
  getSlaOverdue(@Query() query: { page?: string; limit?: string }, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.getSlaOverdue({
      page: query.page ? parseInt(query.page, 10) : undefined,
      limit: query.limit ? parseInt(query.limit, 10) : undefined,
    }, ctx);
  }

  @Get('sla-escalated')
  @Permissions('maintenance.dashboard.slaEscalated.view')
  @ApiOperation({ summary: 'Get SLA escalated requests' })
  getSlaEscalated(@Query() query: { page?: string; limit?: string }, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.getSlaEscalated({
      page: query.page ? parseInt(query.page, 10) : undefined,
      limit: query.limit ? parseInt(query.limit, 10) : undefined,
    }, ctx);
  }
}