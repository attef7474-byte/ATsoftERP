import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { DowntimeLogsService } from './downtime-logs.service';
import { CreateDowntimeLogDto } from './dto/create-downtime-log.dto';
import { UpdateDowntimeLogDto } from './dto/update-downtime-log.dto';
import { JwtAuthGuard } from '../../../../modules/auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../../modules/auth/guards/permissions.guard';
import { Permissions } from '../../../../modules/auth/decorators/permissions.decorator';
import { CurrentUser } from '../../../../common/decorators/current-user.decorator';
import { CurrentActiveContext } from '../../../../common/operational-context/current-active-context.decorator';
import { ActiveOperationalContext } from '../../../../common/operational-context/operational-context.types';

@ApiTags('Downtime Logs')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller({ path: 'maintenance/downtime-logs', version: '1' })
export class DowntimeLogsController {
  constructor(private service: DowntimeLogsService) {}

  @Post()
  @Permissions('downtime-log:create')
  @ApiOperation({ summary: 'Create downtime log' })
  create(@Body() dto: CreateDowntimeLogDto, @CurrentUser('sub') userId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.create(dto, userId, ctx);
  }

  @Get()
  @Permissions('downtime-log:read')
  @ApiOperation({ summary: 'List downtime logs' })
  findAll(@Query() query: {
    page?: string; limit?: string; search?: string;
    machineId?: string; requestId?: string;
    dateFrom?: string; dateTo?: string;
    failureCategory?: string; rcaStatus?: string;
  }, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.findAll({
      page: query.page ? parseInt(query.page, 10) : undefined,
      limit: query.limit ? parseInt(query.limit, 10) : undefined,
      search: query.search,
      machineId: query.machineId,
      requestId: query.requestId,
      dateFrom: query.dateFrom,
      dateTo: query.dateTo,
      failureCategory: query.failureCategory,
      rcaStatus: query.rcaStatus,
    }, ctx);
  }

  @Post('start')
  @Permissions('downtime-log:start')
  @ApiOperation({ summary: 'Start a new downtime log' })
  start(@Body('machineId') machineId: string, @Body('reason') reason: string, @CurrentUser('sub') userId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.startDowntime(machineId, reason, userId, ctx);
  }

  @Get('current')
  @Permissions('downtime-log:current.view')
  @ApiOperation({ summary: 'Get current active downtime logs' })
  getCurrent(@Query() query: { page?: string; limit?: string }, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.getCurrent({
      page: query.page ? parseInt(query.page, 10) : undefined,
      limit: query.limit ? parseInt(query.limit, 10) : undefined,
    }, ctx);
  }

  @Get('analysis')
  @Permissions('downtime-log:analysis.view')
  @ApiOperation({ summary: 'Get downtime analysis' })
  getAnalysis(@Query() query: { dateFrom?: string; dateTo?: string; machineId?: string }, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.getAnalysis(query, ctx);
  }

  @Get('by-machine/:machineId')
  @Permissions('downtime-log:byMachine.view')
  @ApiOperation({ summary: 'Get downtime logs by machine' })
  getByMachine(@Param('machineId') machineId: string, @Query() query: { page?: string; limit?: string }, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.getByMachine(machineId, {
      page: query.page ? parseInt(query.page, 10) : undefined,
      limit: query.limit ? parseInt(query.limit, 10) : undefined,
    }, ctx);
  }

  @Get(':id/summary')
  @Permissions('downtime-log:read')
  @ApiOperation({ summary: 'Get downtime log summary' })
  getLogSummary(@Param('id') id: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.getLogSummary(id, ctx);
  }

  @Patch(':id/end')
  @Permissions('downtime-log:end')
  @ApiOperation({ summary: 'End an active downtime log' })
  end(@Param('id') id: string, @CurrentUser('sub') userId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.endDowntime(id, userId, ctx);
  }

  @Patch(':id/classify')
  @Permissions('downtime-log:classify')
  @ApiOperation({ summary: 'Classify/categorize downtime cause' })
  classify(@Param('id') id: string, @Body('reason') reason: string, @Body('category') category: string, @CurrentUser('sub') userId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.classify(id, reason, category, userId, ctx);
  }

  // ── RCA Endpoints ──

  @Patch(':id/failure-cause')
  @Permissions('downtime-log:update')
  @ApiOperation({ summary: 'Set failure cause and category' })
  setFailureCause(@Param('id') id: string, @Body('failureCause') failureCause: string, @Body('failureCategory') failureCategory: string, @CurrentUser('sub') userId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.setFailureCause(id, failureCause, failureCategory, userId, ctx);
  }

  @Patch(':id/rca')
  @Permissions('downtime-log:update')
  @ApiOperation({ summary: 'Set root cause, corrective action, and preventive action' })
  setRca(@Param('id') id: string, @Body() dto: { rootCause?: string; correctiveAction?: string; preventiveAction?: string }, @CurrentUser('sub') userId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.setRca(id, dto, userId, ctx);
  }

  @Patch(':id/rca/complete')
  @Permissions('downtime-log:update')
  @ApiOperation({ summary: 'Complete RCA' })
  completeRca(@Param('id') id: string, @CurrentUser('sub') userId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.completeRca(id, userId, ctx);
  }

  @Get(':id/rca')
  @Permissions('downtime-log:read')
  @ApiOperation({ summary: 'Get RCA details' })
  getRca(@Param('id') id: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.getRca(id, ctx);
  }

  @Get(':id')
  @Permissions('downtime-log:read')
  @ApiOperation({ summary: 'Get downtime log by ID' })
  findOne(@Param('id') id: string, @CurrentActiveContext() ctx: ActiveOperationalContext) { return this.service.findOne(id, ctx); }

  @Patch(':id')
  @Permissions('downtime-log:update')
  @ApiOperation({ summary: 'Update downtime log' })
  update(@Param('id') id: string, @Body() dto: UpdateDowntimeLogDto, @CurrentUser('sub') userId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.update(id, dto, userId, ctx);
  }

  @Patch(':id/close')
  @Permissions('downtime-log:close')
  @ApiOperation({ summary: 'Close downtime log' })
  close(@Param('id') id: string, @CurrentUser('sub') userId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.close(id, userId, ctx);
  }

  @Patch(':id/cancel')
  @Permissions('downtime-log:cancel')
  @ApiOperation({ summary: 'Cancel downtime log' })
  cancel(@Param('id') id: string, @CurrentUser('sub') userId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.cancel(id, userId, ctx);
  }

  @Delete(':id')
  @Permissions('downtime-log:delete')
  @ApiOperation({ summary: 'Delete downtime log' })
  remove(@Param('id') id: string, @CurrentUser('sub') userId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.remove(id, userId, ctx);
  }
}
