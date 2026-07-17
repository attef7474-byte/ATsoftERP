import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { MaintenanceTasksService } from './maintenance-tasks.service';
import { CreateMaintenanceTaskDto } from './dto/create-maintenance-task.dto';
import { UpdateMaintenanceTaskDto } from './dto/update-maintenance-task.dto';
import { JwtAuthGuard } from '../../../../modules/auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../../modules/auth/guards/permissions.guard';
import { Permissions } from '../../../../modules/auth/decorators/permissions.decorator';
import { CurrentUser } from '../../../../common/decorators/current-user.decorator';

@ApiTags('Maintenance Tasks')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller({ path: 'maintenance/tasks', version: '1' })
export class MaintenanceTasksController {
  constructor(private service: MaintenanceTasksService) {}

  @Post()
  @Permissions('maintenance-task:create')
  @ApiOperation({ summary: 'Create maintenance task' })
  create(@Body() dto: CreateMaintenanceTaskDto, @CurrentUser('id') userId: string) {
    return this.service.create(dto, userId);
  }

  @Get()
  @Permissions('maintenance-task:read')
  @ApiOperation({ summary: 'List maintenance tasks' })
  findAll(@Query() query: {
    page?: string; limit?: string; search?: string;
    requestId?: string; assignedToId?: string; status?: string;
  }) {
    return this.service.findAll({
      page: query.page ? parseInt(query.page, 10) : undefined,
      limit: query.limit ? parseInt(query.limit, 10) : undefined,
      search: query.search,
      requestId: query.requestId,
      assignedToId: query.assignedToId,
      status: query.status,
    });
  }

  @Get('my-tasks')
  @Permissions('maintenance-task:myTasks.view')
  @ApiOperation({ summary: 'Get my assigned tasks' })
  myTasks(@CurrentUser('id') userId: string, @Query() query: { page?: string; limit?: string; status?: string }) {
    return this.service.myTasks(userId, {
      page: query.page ? parseInt(query.page, 10) : undefined,
      limit: query.limit ? parseInt(query.limit, 10) : undefined,
      status: query.status,
    });
  }

  @Get('by-request/:requestId')
  @Permissions('maintenance-task:read')
  @ApiOperation({ summary: 'Get tasks by request ID' })
  byRequest(@Param('requestId') requestId: string, @Query() query: { page?: string; limit?: string }) {
    return this.service.byRequest(requestId, {
      page: query.page ? parseInt(query.page, 10) : undefined,
      limit: query.limit ? parseInt(query.limit, 10) : undefined,
    });
  }

  @Get('overdue')
  @Permissions('maintenance-task:overdue.view')
  @ApiOperation({ summary: 'Get overdue tasks' })
  overdue(@Query() query: { page?: string; limit?: string }) {
    return this.service.overdue({
      page: query.page ? parseInt(query.page, 10) : undefined,
      limit: query.limit ? parseInt(query.limit, 10) : undefined,
    });
  }

  @Patch(':id/assign')
  @Permissions('maintenance-task:assign')
  @ApiOperation({ summary: 'Assign maintenance task' })
  assign(@Param('id') id: string, @Body('assignedToId') assignedToId: string, @CurrentUser('id') userId: string) {
    return this.service.assignTask(id, assignedToId, userId);
  }

  @Get(':id')
  @Permissions('maintenance-task:read')
  @ApiOperation({ summary: 'Get maintenance task by ID' })
  findOne(@Param('id') id: string) { return this.service.findOne(id); }

  @Patch(':id')
  @Permissions('maintenance-task:update')
  @ApiOperation({ summary: 'Update maintenance task' })
  update(@Param('id') id: string, @Body() dto: UpdateMaintenanceTaskDto, @CurrentUser('id') userId: string) {
    return this.service.update(id, dto, userId);
  }

  @Patch(':id/start')
  @Permissions('maintenance-task:start')
  @ApiOperation({ summary: 'Start maintenance task' })
  start(@Param('id') id: string, @CurrentUser('id') userId: string) { return this.service.start(id, userId); }

  @Patch(':id/complete')
  @Permissions('maintenance-task:complete')
  @ApiOperation({ summary: 'Complete maintenance task' })
  complete(@Param('id') id: string, @CurrentUser('id') userId: string) { return this.service.complete(id, userId); }

  @Patch(':id/cancel')
  @Permissions('maintenance-task:cancel')
  @ApiOperation({ summary: 'Cancel maintenance task' })
  cancel(@Param('id') id: string, @CurrentUser('id') userId: string) { return this.service.cancel(id, userId); }

  @Delete(':id')
  @Permissions('maintenance-task:delete')
  @ApiOperation({ summary: 'Delete maintenance task' })
  remove(@Param('id') id: string, @CurrentUser('id') userId: string) { return this.service.remove(id, userId); }
}
