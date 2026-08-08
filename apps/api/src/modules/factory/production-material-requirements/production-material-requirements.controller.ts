import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { ProductionMaterialRequirementsService } from './production-material-requirements.service';
import {
  PRODUCTION_MATERIAL_CONSUMPTION_PERMISSION_KEYS,
  PRODUCTION_MATERIAL_REQUIREMENT_PERMISSION_KEYS,
  PRODUCTION_TRACEABILITY_PERMISSION_KEYS,
} from './production-material-requirements.constants';
import {
  CancelMaterialRequirementDto,
  ConsumptionQueryDto,
  CorrectMaterialConsumptionDto,
  PrepareMaterialRequirementDto,
  RecordMaterialConsumptionDto,
  UpdateMaterialRequirementDto,
} from './dto/production-material-requirement.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../auth/guards/permissions.guard';
import { Permissions } from '../../auth/decorators/permissions.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { CurrentActiveContext } from '../../../common/operational-context/current-active-context.decorator';
import { ActiveOperationalContext } from '../../../common/operational-context/operational-context.types';

@ApiTags('Production Material Requirements')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller({ path: 'production', version: '1' })
export class ProductionMaterialRequirementsController {
  constructor(private readonly service: ProductionMaterialRequirementsService) {}

  @Post('orders/:orderId/material-requirements')
  @Permissions(PRODUCTION_MATERIAL_REQUIREMENT_PERMISSION_KEYS.prepare)
  @ApiOperation({ summary: 'Prepare (or replace) the DRAFT material requirement snapshot for an order' })
  prepare(@Param('orderId') orderId: string, @Body() dto: PrepareMaterialRequirementDto, @CurrentUser('id') userId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.prepare(orderId, dto, userId, ctx);
  }

  @Patch('material-requirements/:id')
  @Permissions(PRODUCTION_MATERIAL_REQUIREMENT_PERMISSION_KEYS.prepare)
  @ApiOperation({ summary: 'Update a DRAFT material requirement snapshot' })
  update(@Param('id') id: string, @Body() dto: UpdateMaterialRequirementDto, @CurrentUser('id') userId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.update(id, dto, userId, ctx);
  }

  @Patch('material-requirements/:id/freeze')
  @Permissions(PRODUCTION_MATERIAL_REQUIREMENT_PERMISSION_KEYS.freeze)
  @ApiOperation({ summary: 'Freeze the DRAFT snapshot; once frozen it is immutable and becomes the authoritative minimum production-owned material model' })
  freeze(@Param('id') id: string, @CurrentUser('id') userId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.freeze(id, userId, ctx);
  }

  @Patch('material-requirements/:id/cancel')
  @Permissions(PRODUCTION_MATERIAL_REQUIREMENT_PERMISSION_KEYS.cancel)
  @ApiOperation({ summary: 'Cancel a DRAFT or FROZEN snapshot (frozen only when no posting has started)' })
  cancel(@Param('id') id: string, @Body() dto: CancelMaterialRequirementDto, @CurrentUser('id') userId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.cancel(id, dto, userId, ctx);
  }

  @Get('orders/:orderId/material-requirements')
  @Permissions(PRODUCTION_MATERIAL_REQUIREMENT_PERMISSION_KEYS.read)
  @ApiOperation({ summary: 'Get the latest material requirement snapshot for an order' })
  getByOrder(@Param('orderId') orderId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.getByOrder(orderId, ctx);
  }

  @Get('orders/:orderId/material-readiness')
  @Permissions(PRODUCTION_MATERIAL_REQUIREMENT_PERMISSION_KEYS.read)
  @ApiOperation({ summary: 'Material readiness for an order (missing FROZEN snapshot is the only hard blocker)' })
  getOrderReadiness(@Param('orderId') orderId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.getOrderReadiness(orderId, ctx);
  }

  @Get('orders/:orderId/material-consumption')
  @Permissions(PRODUCTION_MATERIAL_CONSUMPTION_PERMISSION_KEYS.read)
  @ApiOperation({ summary: 'Consumption summary for an order (explicit authoritative, else derived net issue)' })
  getOrderConsumptionSummary(@Param('orderId') orderId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.getOrderConsumptionSummary(orderId, ctx);
  }

  @Get('orders/:orderId/consumption-history')
  @Permissions(PRODUCTION_MATERIAL_CONSUMPTION_PERMISSION_KEYS.history)
  @ApiOperation({ summary: 'Paginated explicit consumption history for an order' })
  getConsumptionHistory(@Param('orderId') orderId: string, @Query() query: ConsumptionQueryDto, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.getConsumptionHistory(orderId, query, ctx);
  }

  @Get('orders/:orderId/traceability')
  @Permissions(PRODUCTION_TRACEABILITY_PERMISSION_KEYS.read)
  @ApiOperation({ summary: 'Material traceability for an order: snapshot, posted documents, loss links, consumption' })
  getOrderTraceability(@Param('orderId') orderId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.getOrderTraceability(orderId, ctx);
  }

  @Get('runs/:runId/materials-summary')
  @Permissions(PRODUCTION_MATERIAL_REQUIREMENT_PERMISSION_KEYS.read)
  @ApiOperation({ summary: 'Issued/returned materials per requirement line for a run' })
  getRunMaterialsSummary(@Param('runId') runId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.getRunMaterialsSummary(runId, ctx);
  }

  @Get('runs/:runId/material-consumption')
  @Permissions(PRODUCTION_MATERIAL_CONSUMPTION_PERMISSION_KEYS.read)
  @ApiOperation({ summary: 'Run-scoped consumption summary' })
  getRunConsumptionSummary(@Param('runId') runId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.getRunConsumptionSummary(runId, ctx);
  }

  @Post('material-consumptions')
  @Permissions(PRODUCTION_MATERIAL_CONSUMPTION_PERMISSION_KEYS.record)
  @ApiOperation({ summary: 'Record an explicit consumption fact (source + actor + requestId; never a second inventory decrement)' })
  recordConsumption(@Body() dto: RecordMaterialConsumptionDto, @CurrentUser('id') userId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.recordConsumption(dto, userId, ctx);
  }

  @Patch('material-consumptions/:id/correct')
  @Permissions(PRODUCTION_MATERIAL_CONSUMPTION_PERMISSION_KEYS.correct)
  @ApiOperation({ summary: 'Correct an explicit consumption fact with a reason (audited correction record)' })
  correctConsumption(@Param('id') id: string, @Body() dto: CorrectMaterialConsumptionDto, @CurrentUser('id') userId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.correctConsumption(id, dto, userId, ctx);
  }
}
