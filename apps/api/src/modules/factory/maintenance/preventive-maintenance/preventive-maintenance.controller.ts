import { Controller, Get, Post, Query, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { PreventiveMaintenanceService } from './preventive-maintenance.service';
import { JwtAuthGuard } from '../../../../modules/auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../../modules/auth/guards/permissions.guard';
import { Permissions } from '../../../../modules/auth/decorators/permissions.decorator';
import { CurrentUser } from '../../../../common/decorators/current-user.decorator';
import { CurrentActiveContext } from '../../../../common/operational-context/current-active-context.decorator';
import { ActiveOperationalContext } from '../../../../common/operational-context/operational-context.types';

@ApiTags('Preventive Maintenance')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller({ path: 'maintenance/preventive', version: '1' })
export class PreventiveMaintenanceController {
  constructor(private service: PreventiveMaintenanceService) {}

  @Get('upcoming')
  @Permissions('preventive-maintenance:upcoming')
  @ApiOperation({ summary: 'Get upcoming preventive maintenance' })
  getUpcoming(@Query() query: { page?: string; limit?: string }, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.getUpcoming({
      page: query.page ? parseInt(query.page, 10) : undefined,
      limit: query.limit ? parseInt(query.limit, 10) : undefined,
    }, ctx);
  }

  @Get('overdue')
  @Permissions('preventive-maintenance:overdue')
  @ApiOperation({ summary: 'Get overdue preventive maintenance' })
  getOverdue(@Query() query: { page?: string; limit?: string }, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.getOverdue({
      page: query.page ? parseInt(query.page, 10) : undefined,
      limit: query.limit ? parseInt(query.limit, 10) : undefined,
    }, ctx);
  }

  @Get('calendar')
  @Permissions('preventive-maintenance:calendar')
  @ApiOperation({ summary: 'Get preventive maintenance calendar' })
  getCalendar(@Query() query: { year?: string; month?: string }, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.getCalendar({
      year: query.year ? parseInt(query.year, 10) : undefined,
      month: query.month ? parseInt(query.month, 10) : undefined,
    }, ctx);
  }

  @Get('execution-history')
  @Permissions('preventive-maintenance:executionHistory')
  @ApiOperation({ summary: 'Get execution history for all preventive schedules' })
  getExecutionHistory(@Query() query: { page?: string; limit?: string; scheduleId?: string }, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.getExecutionHistory({
      page: query.page ? parseInt(query.page, 10) : undefined,
      limit: query.limit ? parseInt(query.limit, 10) : undefined,
      scheduleId: query.scheduleId,
    }, ctx);
  }

  @Post('generate-due-tasks')
  @Permissions('preventive-maintenance:generateDueTasks')
  @ApiOperation({ summary: 'Generate tasks from due preventive schedules' })
  generateDueTasks(@CurrentUser('sub') userId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.generateDueTasks(userId, ctx);
  }
}
