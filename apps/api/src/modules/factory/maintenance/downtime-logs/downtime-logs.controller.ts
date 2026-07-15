import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { DowntimeLogsService } from './downtime-logs.service';
import { CreateDowntimeLogDto } from './dto/create-downtime-log.dto';
import { UpdateDowntimeLogDto } from './dto/update-downtime-log.dto';
import { JwtAuthGuard } from '../../../../modules/auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../../modules/auth/guards/permissions.guard';
import { Permissions } from '../../../../modules/auth/decorators/permissions.decorator';
import { CurrentUser } from '../../../../common/decorators/current-user.decorator';

@ApiTags('Downtime Logs')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller({ path: 'maintenance/downtime-logs', version: '1' })
export class DowntimeLogsController {
  constructor(private service: DowntimeLogsService) {}

  @Post()
  @Permissions('downtime-log:create')
  @ApiOperation({ summary: 'Create downtime log' })
  create(@Body() dto: CreateDowntimeLogDto, @CurrentUser('sub') userId: string) {
    return this.service.create(dto, userId);
  }

  @Get()
  @Permissions('downtime-log:read')
  @ApiOperation({ summary: 'List downtime logs' })
  findAll(@Query() query: {
    page?: string; limit?: string; search?: string;
    machineId?: string; requestId?: string;
    dateFrom?: string; dateTo?: string;
  }) {
    return this.service.findAll({
      page: query.page ? parseInt(query.page, 10) : undefined,
      limit: query.limit ? parseInt(query.limit, 10) : undefined,
      search: query.search,
      machineId: query.machineId,
      requestId: query.requestId,
      dateFrom: query.dateFrom,
      dateTo: query.dateTo,
    });
  }

  @Get(':id')
  @Permissions('downtime-log:read')
  @ApiOperation({ summary: 'Get downtime log by ID' })
  findOne(@Param('id') id: string) { return this.service.findOne(id); }

  @Patch(':id')
  @Permissions('downtime-log:update')
  @ApiOperation({ summary: 'Update downtime log' })
  update(@Param('id') id: string, @Body() dto: UpdateDowntimeLogDto, @CurrentUser('sub') userId: string) {
    return this.service.update(id, dto, userId);
  }

  @Patch(':id/close')
  @Permissions('downtime-log:close')
  @ApiOperation({ summary: 'Close downtime log' })
  close(@Param('id') id: string, @CurrentUser('sub') userId: string) {
    return this.service.close(id, userId);
  }

  @Patch(':id/cancel')
  @Permissions('downtime-log:cancel')
  @ApiOperation({ summary: 'Cancel downtime log' })
  cancel(@Param('id') id: string, @CurrentUser('sub') userId: string) {
    return this.service.cancel(id, userId);
  }

  @Delete(':id')
  @Permissions('downtime-log:delete')
  @ApiOperation({ summary: 'Delete downtime log' })
  remove(@Param('id') id: string, @CurrentUser('sub') userId: string) {
    return this.service.remove(id, userId);
  }
}
