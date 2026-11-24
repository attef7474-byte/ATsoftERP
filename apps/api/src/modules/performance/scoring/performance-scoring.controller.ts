import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../auth/guards/permissions.guard';
import { Permissions } from '../../auth/decorators/permissions.decorator';
import { CurrentActiveContext } from '../../../common/operational-context/current-active-context.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { ActiveOperationalContext } from '../../../common/operational-context/operational-context.types';
import { PerformanceScoringService } from './performance-scoring.service';
import {
  CreatePerformanceScoringRuleDto,
  CreatePerformanceTargetDto,
  CreatePerformanceWeightDto,
  SimulatePerformanceDto,
  UpdatePerformanceScoringRuleDto,
  UpdatePerformanceTargetDto,
  UpdatePerformanceWeightDto,
} from './dto/performance-scoring.dto';

@ApiTags('performance-scoring')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller({ path: 'performance', version: '1' })
export class PerformanceScoringController {
  constructor(private readonly service: PerformanceScoringService) {}

  @Get('targets')
  @Permissions('performance-target:read')
  @ApiOperation({ summary: 'List performance KPI targets' })
  listTargets(@Query() q: any, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.listTargets(q, ctx);
  }

  @Post('targets')
  @Permissions('performance-target:create')
  @ApiOperation({ summary: 'Create performance KPI target' })
  createTarget(
    @Body() dto: CreatePerformanceTargetDto,
    @CurrentActiveContext() ctx: ActiveOperationalContext,
    @CurrentUser('id') userId: string,
  ) {
    return this.service.createTarget(dto, ctx, userId);
  }

  @Patch('targets/:id')
  @Permissions('performance-target:update')
  @ApiOperation({ summary: 'Update draft performance KPI target' })
  updateTarget(
    @Param('id') id: string,
    @Body() dto: UpdatePerformanceTargetDto,
    @CurrentActiveContext() ctx: ActiveOperationalContext,
    @CurrentUser('id') userId: string,
  ) {
    return this.service.updateTarget(id, dto, ctx, userId);
  }

  @Post('targets/:id/activate')
  @Permissions('performance-target:update')
  @ApiOperation({ summary: 'Activate performance KPI target' })
  activateTarget(
    @Param('id') id: string,
    @CurrentActiveContext() ctx: ActiveOperationalContext,
    @CurrentUser('id') userId: string,
  ) {
    return this.service.activateTarget(id, ctx, userId);
  }

  @Post('targets/:id/deactivate')
  @Permissions('performance-target:deactivate')
  @ApiOperation({ summary: 'Deactivate performance KPI target' })
  deactivateTarget(
    @Param('id') id: string,
    @CurrentActiveContext() ctx: ActiveOperationalContext,
    @CurrentUser('id') userId: string,
  ) {
    return this.service.deactivateTarget(id, ctx, userId);
  }

  @Get('weights')
  @Permissions('performance-weight:read')
  @ApiOperation({ summary: 'List performance profile KPI weights' })
  listWeights(@Query() q: any, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.listWeights(q, ctx);
  }

  @Post('weights')
  @Permissions('performance-weight:create')
  @ApiOperation({ summary: 'Create performance profile KPI weight' })
  createWeight(
    @Body() dto: CreatePerformanceWeightDto,
    @CurrentActiveContext() ctx: ActiveOperationalContext,
    @CurrentUser('id') userId: string,
  ) {
    return this.service.createWeight(dto, ctx, userId);
  }

  @Patch('weights/:id')
  @Permissions('performance-weight:update')
  @ApiOperation({ summary: 'Update draft performance profile KPI weight' })
  updateWeight(
    @Param('id') id: string,
    @Body() dto: UpdatePerformanceWeightDto,
    @CurrentActiveContext() ctx: ActiveOperationalContext,
    @CurrentUser('id') userId: string,
  ) {
    return this.service.updateWeight(id, dto, ctx, userId);
  }

  @Post('weights/:id/activate')
  @Permissions('performance-weight:update')
  @ApiOperation({ summary: 'Activate performance profile KPI weight' })
  activateWeight(
    @Param('id') id: string,
    @CurrentActiveContext() ctx: ActiveOperationalContext,
    @CurrentUser('id') userId: string,
  ) {
    return this.service.activateWeight(id, ctx, userId);
  }

  @Post('weights/:id/deactivate')
  @Permissions('performance-weight:deactivate')
  @ApiOperation({ summary: 'Deactivate performance profile KPI weight' })
  deactivateWeight(
    @Param('id') id: string,
    @CurrentActiveContext() ctx: ActiveOperationalContext,
    @CurrentUser('id') userId: string,
  ) {
    return this.service.deactivateWeight(id, ctx, userId);
  }

  @Get('scoring-rules')
  @Permissions('performance-scoring-rule:read')
  @ApiOperation({ summary: 'List performance KPI scoring rules' })
  listRules(@Query() q: any, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.listRules(q, ctx);
  }

  @Post('scoring-rules')
  @Permissions('performance-scoring-rule:create')
  @ApiOperation({ summary: 'Create performance KPI scoring rule' })
  createRule(
    @Body() dto: CreatePerformanceScoringRuleDto,
    @CurrentActiveContext() ctx: ActiveOperationalContext,
    @CurrentUser('id') userId: string,
  ) {
    return this.service.createRule(dto, ctx, userId);
  }

  @Patch('scoring-rules/:id')
  @Permissions('performance-scoring-rule:update')
  @ApiOperation({ summary: 'Update draft performance KPI scoring rule' })
  updateRule(
    @Param('id') id: string,
    @Body() dto: UpdatePerformanceScoringRuleDto,
    @CurrentActiveContext() ctx: ActiveOperationalContext,
    @CurrentUser('id') userId: string,
  ) {
    return this.service.updateRule(id, dto, ctx, userId);
  }

  @Post('scoring-rules/:id/activate')
  @Permissions('performance-scoring-rule:update')
  @ApiOperation({ summary: 'Activate performance KPI scoring rule' })
  activateRule(
    @Param('id') id: string,
    @CurrentActiveContext() ctx: ActiveOperationalContext,
    @CurrentUser('id') userId: string,
  ) {
    return this.service.activateRule(id, ctx, userId);
  }

  @Post('scoring-rules/:id/deactivate')
  @Permissions('performance-scoring-rule:deactivate')
  @ApiOperation({ summary: 'Deactivate performance KPI scoring rule' })
  deactivateRule(
    @Param('id') id: string,
    @CurrentActiveContext() ctx: ActiveOperationalContext,
    @CurrentUser('id') userId: string,
  ) {
    return this.service.deactivateRule(id, ctx, userId);
  }

  @Get('profiles/:id/readiness')
  @Permissions('performance-weight:read')
  @ApiOperation({ summary: 'Get performance profile scoring readiness' })
  readiness(
    @Param('id') id: string,
    @Query('at') at: string,
    @CurrentActiveContext() ctx: ActiveOperationalContext,
  ) {
    return this.service.profileReadiness(id, ctx, at);
  }

  @Get('configuration-coverage')
  @Permissions('performance-config-coverage:read')
  @ApiOperation({ summary: 'Get performance scoring configuration coverage' })
  coverage(@Query('at') at: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.configurationCoverage(ctx, at);
  }

  @Post('simulate')
  @Permissions('performance-simulation:read')
  @ApiOperation({ summary: 'Simulate employee performance score (preview only)' })
  simulate(
    @Body() dto: SimulatePerformanceDto,
    @CurrentActiveContext() ctx: ActiveOperationalContext,
    @CurrentUser('id') userId: string,
  ) {
    return this.service.simulate(dto, ctx, userId);
  }
}
