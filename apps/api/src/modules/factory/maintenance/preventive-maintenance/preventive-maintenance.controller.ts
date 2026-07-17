import { Controller, Get, Post, Query, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { PreventiveMaintenanceService } from './preventive-maintenance.service';
import { JwtAuthGuard } from '../../../../modules/auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../../modules/auth/guards/permissions.guard';
import { Permissions } from '../../../../modules/auth/decorators/permissions.decorator';
import { CurrentUser } from '../../../../common/decorators/current-user.decorator';

@ApiTags('Preventive Maintenance')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller({ path: 'maintenance/preventive', version: '1' })
export class PreventiveMaintenanceController {
  constructor(private service: PreventiveMaintenanceService) {}

  @Get('upcoming')
  @Permissions('maintenance.preventive.upcoming.view')
  @ApiOperation({ summary: 'Get upcoming preventive maintenance' })
  getUpcoming(@Query() query: { page?: string; limit?: string }) {
    return this.service.getUpcoming({
      page: query.page ? parseInt(query.page, 10) : undefined,
      limit: query.limit ? parseInt(query.limit, 10) : undefined,
    });
  }

  @Get('overdue')
  @Permissions('maintenance.preventive.overdue.view')
  @ApiOperation({ summary: 'Get overdue preventive maintenance' })
  getOverdue(@Query() query: { page?: string; limit?: string }) {
    return this.service.getOverdue({
      page: query.page ? parseInt(query.page, 10) : undefined,
      limit: query.limit ? parseInt(query.limit, 10) : undefined,
    });
  }

  @Get('calendar')
  @Permissions('maintenance.preventive.calendar.view')
  @ApiOperation({ summary: 'Get preventive maintenance calendar' })
  getCalendar(@Query() query: { year?: string; month?: string }) {
    return this.service.getCalendar({
      year: query.year ? parseInt(query.year, 10) : undefined,
      month: query.month ? parseInt(query.month, 10) : undefined,
    });
  }

  @Get('execution-history')
  @Permissions('maintenance.preventive.executionHistory.view')
  @ApiOperation({ summary: 'Get execution history for all preventive schedules' })
  getExecutionHistory(@Query() query: { page?: string; limit?: string; scheduleId?: string }) {
    return this.service.getExecutionHistory({
      page: query.page ? parseInt(query.page, 10) : undefined,
      limit: query.limit ? parseInt(query.limit, 10) : undefined,
      scheduleId: query.scheduleId,
    });
  }

  @Post('generate-due-tasks')
  @Permissions('maintenance.preventive.generateDueTasks')
  @ApiOperation({ summary: 'Generate tasks from due preventive schedules' })
  generateDueTasks(@CurrentUser('sub') userId: string) {
    return this.service.generateDueTasks(userId);
  }
}
