import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { Permissions } from '../../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { CurrentActiveContext } from '../../../common/operational-context/current-active-context.decorator';
import { ActiveOperationalContext } from '../../../common/operational-context/operational-context.types';
import { ProductionRunsService } from './production-runs.service';
import { ProductionLossQuantityEventsService } from '../production-loss-quantity-events/production-loss-quantity-events.service';
import { CreateProductionRunDto } from './dto/create-production-run.dto';
import { RunActionDto, RunPauseActionDto, RunReasonActionDto } from './dto/run-action.dto';
import { RecordOutputDto } from './dto/record-output.dto';
import { CloseForValuationDto } from './dto/close-for-valuation.dto';
import { RunQueryDto } from './dto/run-query.dto';

@ApiTags('production-runs')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('production/runs')
export class ProductionRunsController {
  constructor(
    private readonly service: ProductionRunsService,
    private readonly lossesService: ProductionLossQuantityEventsService,
  ) {}

  @Post()
  @Permissions('production-run:start')
  @ApiOperation({ summary: 'Start an idempotent run for a released production order' })
  start(@Body() dto: CreateProductionRunDto, @CurrentUser('id') userId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.start(dto, userId, ctx);
  }

  @Get()
  @Permissions('production-run:read')
  findAll(@Query() query: RunQueryDto, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.findAll(query, ctx);
  }

  @Get(':id/live')
  @Permissions('production-run:read')
  live(@Param('id') id: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.live(id, ctx);
  }

  @Get(':id/history')
  @Permissions('production-run:read')
  history(@Param('id') id: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.history(id, ctx);
  }

  @Get(':id/events')
  @Permissions('production-run:read')
  ledger(@Param('id') id: string, @Query() query: Record<string, string | undefined>, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.ledger(id, { page: query.page ? Number(query.page) : undefined, limit: query.limit ? Number(query.limit) : undefined }, ctx);
  }

  @Get(':id/losses')
  @Permissions('production-loss:read')
  losses(@Param('id') id: string, @Query() query: Record<string, string | undefined>, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.lossesService.getRunLosses(id, { page: query.page ? Number(query.page) : undefined, limit: query.limit ? Number(query.limit) : undefined }, ctx);
  }

  @Get(':id')
  @Permissions('production-run:read')
  findOne(@Param('id') id: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.findOne(id, ctx);
  }

  @Post(':id/pause')
  @Permissions('production-run:pause')
  pause(@Param('id') id: string, @Body() dto: RunPauseActionDto, @CurrentUser('id') userId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.pause(id, dto, userId, ctx);
  }

  @Post(':id/resume')
  @Permissions('production-run:resume')
  resume(@Param('id') id: string, @Body() dto: RunActionDto, @CurrentUser('id') userId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.resume(id, dto, userId, ctx);
  }

  @Post(':id/complete')
  @Permissions('production-run:complete')
  complete(@Param('id') id: string, @Body() dto: RunActionDto, @CurrentUser('id') userId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.complete(id, dto, userId, ctx);
  }

  @Post(':id/abort')
  @Permissions('production-run:abort')
  abort(@Param('id') id: string, @Body() dto: RunReasonActionDto, @CurrentUser('id') userId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.abort(id, dto, userId, ctx);
  }

  @Post(':id/output-events')
  @Permissions('production-output:record')
  recordOutput(@Param('id') id: string, @Body() dto: RecordOutputDto, @CurrentUser('id') userId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.recordOutput(id, dto, userId, ctx);
  }

  @Post(':id/close-for-valuation')
  @Permissions('production-run:close-for-valuation')
  closeForValuation(@Param('id') id: string, @Body() dto: CloseForValuationDto, @CurrentUser('id') userId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.closeForValuation(id, dto, userId, ctx);
  }
}