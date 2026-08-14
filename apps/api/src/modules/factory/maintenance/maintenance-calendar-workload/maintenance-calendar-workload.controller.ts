import { Controller, Get, Post, Patch, Param, Query, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { MaintenanceCalendarWorkloadService } from './maintenance-calendar-workload.service';
import { JwtAuthGuard } from '../../../../modules/auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../../modules/auth/guards/permissions.guard';
import { Permissions } from '../../../../modules/auth/decorators/permissions.decorator';
import { CurrentActiveContext } from '../../../../common/operational-context/current-active-context.decorator';
import { ActiveOperationalContext } from '../../../../common/operational-context/operational-context.types';

@ApiTags('Maintenance Calendar & Workload')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller({ path: 'maintenance/calendar-workload', version: '1' })
export class MaintenanceCalendarWorkloadController {
  constructor(private service: MaintenanceCalendarWorkloadService) {}

  @Get('events')
  @Permissions('maintenance-calendar:read')
  @ApiOperation({ summary: 'Get calendar events within date range' })
  getCalendarEvents(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Query('personnelId') personnelId?: string,
    @Query('machineId') machineId?: string,
    @Query('productionLineId') productionLineId?: string,
    @Query('type') type?: string,
    @Query('status') status?: string,
    @Query('priority') priority?: string,
    @Query('slaStatus') slaStatus?: string,
    @CurrentActiveContext() ctx?: ActiveOperationalContext,
  ) {
    return this.service.getCalendarEvents({ startDate, endDate, personnelId, machineId, productionLineId, type, status, priority, slaStatus }, ctx!);
  }

  @Get('filters')
  @Permissions('maintenance-calendar:read')
  @ApiOperation({ summary: 'Get calendar filter options' })
  getCalendarFilters(@CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.getCalendarFilters(ctx);
  }

  @Get('workload/summary')
  @Permissions('maintenance-workload:read')
  @ApiOperation({ summary: 'Get workload summary' })
  getWorkloadSummary(@Query('date') date?: string, @CurrentActiveContext() ctx?: ActiveOperationalContext) {
    return this.service.getWorkloadSummary(date, ctx!);
  }

  @Get('workload/personnel')
  @Permissions('maintenance-workload:read')
  @ApiOperation({ summary: 'Get workload by personnel' })
  getWorkloadByPersonnel(@Query('date') date?: string, @CurrentActiveContext() ctx?: ActiveOperationalContext) {
    return this.service.getWorkloadByPersonnel(date, ctx!);
  }

  @Get('workload/machine')
  @Permissions('maintenance-workload:read')
  @ApiOperation({ summary: 'Get workload by machine' })
  getWorkloadByMachine(@Query('date') date?: string, @CurrentActiveContext() ctx?: ActiveOperationalContext) {
    return this.service.getWorkloadByMachine(date, ctx!);
  }

  @Get('workload/production-line')
  @Permissions('maintenance-workload:read')
  @ApiOperation({ summary: 'Get workload by production line' })
  getWorkloadByProductionLine(@Query('date') date?: string, @CurrentActiveContext() ctx?: ActiveOperationalContext) {
    return this.service.getWorkloadByProductionLine(date, ctx!);
  }

  @Get('workload/by-date')
  @Permissions('maintenance-workload:read')
  @ApiOperation({ summary: 'Get workload breakdown by day' })
  getWorkloadByDate(@Query('startDate') startDate: string, @Query('endDate') endDate: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.getWorkloadByDate(startDate, endDate, ctx);
  }

  @Get('workload/overloaded')
  @Permissions('maintenance-workload:read')
  @ApiOperation({ summary: 'Get overloaded personnel' })
  getOverloaded(@Query('date') date?: string, @CurrentActiveContext() ctx?: ActiveOperationalContext) {
    return this.service.getOverloadedPersonnel(date, ctx!);
  }

  @Get('conflicts')
  @Permissions('maintenance-workload:read')
  @ApiOperation({ summary: 'Get scheduling conflicts' })
  getConflicts(@Query('startDate') startDate?: string, @Query('endDate') endDate?: string, @CurrentActiveContext() ctx?: ActiveOperationalContext) {
    return this.service.getConflicts(startDate, endDate, ctx!);
  }

  @Get('unassigned')
  @Permissions('maintenance-planning:read')
  @ApiOperation({ summary: 'Get unassigned work' })
  getUnassigned(@Query('page') page?: string, @Query('limit') limit?: string, @CurrentActiveContext() ctx?: ActiveOperationalContext) {
    return this.service.getUnassignedWork(page ? parseInt(page, 10) : 1, limit ? parseInt(limit, 10) : 10, ctx!);
  }

  @Get('overdue')
  @Permissions('maintenance-planning:read')
  @ApiOperation({ summary: 'Get overdue planned work' })
  getOverduePlanned(@Query('page') page?: string, @Query('limit') limit?: string, @CurrentActiveContext() ctx?: ActiveOperationalContext) {
    return this.service.getOverduePlannedWork(page ? parseInt(page, 10) : 1, limit ? parseInt(limit, 10) : 10, ctx!);
  }

  @Get('sla-due')
  @Permissions('maintenance-planning:read')
  @ApiOperation({ summary: 'Get SLA due work' })
  getSlaDue(@Query('page') page?: string, @Query('limit') limit?: string, @CurrentActiveContext() ctx?: ActiveOperationalContext) {
    return this.service.getSlaDueWork(page ? parseInt(page, 10) : 1, limit ? parseInt(limit, 10) : 10, ctx!);
  }

  @Patch('requests/:id/planning')
  @Permissions('maintenance-planning:update')
  @ApiOperation({ summary: 'Update planned dates and estimated duration' })
  updatePlanning(@Param('id') id: string, @Body() body: { plannedStartAt?: string; plannedEndAt?: string; estimatedDurationMinutes?: number }, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.updatePlanning(id, body, ctx);
  }

  @Patch('requests/:id/reschedule')
  @Permissions('maintenance-planning:reschedule')
  @ApiOperation({ summary: 'Reschedule a maintenance request' })
  reschedule(@Param('id') id: string, @Body() body: { plannedStartAt: string; plannedEndAt: string; reason?: string }, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.reschedule(id, body, ctx);
  }

  @Post('requests/:id/assign')
  @Permissions('maintenance-planning:assign')
  @ApiOperation({ summary: 'Assign personnel to planned work' })
  assignPlannedWork(@Param('id') id: string, @Body('personnelId') personnelId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.assignPlannedWork(id, personnelId, ctx);
  }

  @Get('capacity')
  @Permissions('maintenance-workload:read')
  @ApiOperation({ summary: 'Get capacity configuration info' })
  getCapacityInfo(@CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.getCapacityInfo(ctx);
  }
}
