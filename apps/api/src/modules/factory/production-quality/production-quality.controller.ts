import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ProductionQualityService } from './production-quality.service';
import { PRODUCTION_QUALITY_PERMISSION_KEYS } from './production-quality.constants';
import {
  CreateCharacteristicDto,
  CreateQualityPlanDto,
  CreateSamplingPointDto,
  DeactivateQualityPlanDto,
  QualityPlanQueryDto,
  RejectQualityPlanDto,
  UpdateQualityPlanDto,
} from './dto/quality-plan.dto';
import {
  ApproveDispositionDto,
  CreateDispositionDto,
  CreateInspectionDto,
  InspectionQueryDto,
  RecordInspectionResultsDto,
  RejectDispositionDto,
} from './dto/inspection.dto';
import { CreateNcrDto, NcrAttachDto, NcrQueryDto, NcrTransitionDto } from './dto/ncr.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../auth/guards/permissions.guard';
import { Permissions } from '../../auth/decorators/permissions.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { CurrentActiveContext } from '../../../common/operational-context/current-active-context.decorator';
import { ActiveOperationalContext } from '../../../common/operational-context/operational-context.types';

@ApiTags('Production Quality')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller({ path: 'production', version: '1' })
export class ProductionQualityController {
  constructor(private readonly service: ProductionQualityService) {}

  // ── Quality plans ───────────────────────────────────────────────────────────

  @Post('quality-plans')
  @Permissions(PRODUCTION_QUALITY_PERMISSION_KEYS.planCreate)
  @ApiOperation({ summary: 'Create a DRAFT quality plan with a generated plan code' })
  createPlan(@Body() dto: CreateQualityPlanDto, @CurrentUser('id') userId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.createPlan(dto, userId, ctx);
  }

  @Get('quality-plans')
  @Permissions(PRODUCTION_QUALITY_PERMISSION_KEYS.planRead)
  @ApiOperation({ summary: 'List quality plans scoped to the active context' })
  findPlans(@Query() query: QualityPlanQueryDto, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.findPlans(query, ctx);
  }

  @Get('quality-plans/:id')
  @Permissions(PRODUCTION_QUALITY_PERMISSION_KEYS.planRead)
  @ApiOperation({ summary: 'Get quality plan by ID (tenant-scoped)' })
  findOnePlan(@Param('id') id: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.findOnePlan(id, ctx);
  }

  @Patch('quality-plans/:id')
  @Permissions(PRODUCTION_QUALITY_PERMISSION_KEYS.planUpdate)
  @ApiOperation({ summary: 'Update a DRAFT quality plan' })
  updatePlan(@Param('id') id: string, @Body() dto: UpdateQualityPlanDto, @CurrentUser('id') userId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.updatePlan(id, dto, userId, ctx);
  }

  @Patch('quality-plans/:id/submit')
  @Permissions(PRODUCTION_QUALITY_PERMISSION_KEYS.planSubmit)
  @ApiOperation({ summary: 'Submit a DRAFT quality plan for approval' })
  submitPlan(@Param('id') id: string, @CurrentUser('id') userId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.submitPlan(id, userId, ctx);
  }

  @Patch('quality-plans/:id/approve')
  @Permissions(PRODUCTION_QUALITY_PERMISSION_KEYS.planApprove)
  @ApiOperation({ summary: 'Approve a PENDING quality plan (requires at least one characteristic)' })
  approvePlan(@Param('id') id: string, @CurrentUser('id') userId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.approvePlan(id, userId, ctx);
  }

  @Patch('quality-plans/:id/reject')
  @Permissions(PRODUCTION_QUALITY_PERMISSION_KEYS.planReject)
  @ApiOperation({ summary: 'Reject a PENDING quality plan back to DRAFT' })
  rejectPlan(@Param('id') id: string, @Body() dto: RejectQualityPlanDto, @CurrentUser('id') userId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.rejectPlan(id, dto, userId, ctx);
  }

  @Patch('quality-plans/:id/deactivate')
  @Permissions(PRODUCTION_QUALITY_PERMISSION_KEYS.planDeactivate)
  @ApiOperation({ summary: 'Deactivate an APPROVED quality plan' })
  deactivatePlan(@Param('id') id: string, @Body() dto: DeactivateQualityPlanDto, @CurrentUser('id') userId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.deactivatePlan(id, dto, userId, ctx);
  }

  @Delete('quality-plans/:id')
  @Permissions(PRODUCTION_QUALITY_PERMISSION_KEYS.planDelete)
  @ApiOperation({ summary: 'Soft-delete a DRAFT quality plan' })
  deletePlan(@Param('id') id: string, @CurrentUser('id') userId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.deletePlan(id, userId, ctx);
  }

  // ── Characteristics (nested under a plan) ───────────────────────────────────

  @Post('quality-plans/:planId/characteristics')
  @Permissions(PRODUCTION_QUALITY_PERMISSION_KEYS.characteristicCreate)
  @ApiOperation({ summary: 'Add a characteristic to a DRAFT/PENDING quality plan' })
  createCharacteristic(@Param('planId') planId: string, @Body() dto: CreateCharacteristicDto, @CurrentUser('id') userId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.createCharacteristic(planId, dto, userId, ctx);
  }

  @Patch('quality-plans/:planId/characteristics/:id')
  @Permissions(PRODUCTION_QUALITY_PERMISSION_KEYS.characteristicUpdate)
  @ApiOperation({ summary: 'Update a characteristic of a DRAFT/PENDING quality plan' })
  updateCharacteristic(@Param('planId') planId: string, @Param('id') id: string, @Body() dto: CreateCharacteristicDto, @CurrentUser('id') userId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.updateCharacteristic(planId, id, dto, userId, ctx);
  }

  @Delete('quality-plans/:planId/characteristics/:id')
  @Permissions(PRODUCTION_QUALITY_PERMISSION_KEYS.characteristicDelete)
  @ApiOperation({ summary: 'Soft-delete a characteristic of a DRAFT/PENDING quality plan' })
  deleteCharacteristic(@Param('planId') planId: string, @Param('id') id: string, @CurrentUser('id') userId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.deleteCharacteristic(planId, id, userId, ctx);
  }

  // ── Sampling points (nested under a plan) ───────────────────────────────────

  @Post('quality-plans/:planId/sampling-points')
  @Permissions(PRODUCTION_QUALITY_PERMISSION_KEYS.samplingPointCreate)
  @ApiOperation({ summary: 'Add a sampling point to a DRAFT/PENDING quality plan' })
  createSamplingPoint(@Param('planId') planId: string, @Body() dto: CreateSamplingPointDto, @CurrentUser('id') userId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.createSamplingPoint(planId, dto, userId, ctx);
  }

  @Patch('quality-plans/:planId/sampling-points/:id')
  @Permissions(PRODUCTION_QUALITY_PERMISSION_KEYS.samplingPointUpdate)
  @ApiOperation({ summary: 'Update a sampling point of a DRAFT/PENDING quality plan' })
  updateSamplingPoint(@Param('planId') planId: string, @Param('id') id: string, @Body() dto: CreateSamplingPointDto, @CurrentUser('id') userId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.updateSamplingPoint(planId, id, dto, userId, ctx);
  }

  @Delete('quality-plans/:planId/sampling-points/:id')
  @Permissions(PRODUCTION_QUALITY_PERMISSION_KEYS.samplingPointDelete)
  @ApiOperation({ summary: 'Soft-delete a sampling point of a DRAFT/PENDING quality plan' })
  deleteSamplingPoint(@Param('planId') planId: string, @Param('id') id: string, @CurrentUser('id') userId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.deleteSamplingPoint(planId, id, userId, ctx);
  }

  // ── Inspections ─────────────────────────────────────────────────────────────

  @Post('inspections')
  @Permissions(PRODUCTION_QUALITY_PERMISSION_KEYS.inspectionCreate)
  @ApiOperation({ summary: 'Create an inspection against an APPROVED quality plan (idempotent by clientRequestId)' })
  createInspection(@Body() dto: CreateInspectionDto, @CurrentUser('id') userId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.createInspection(dto, userId, ctx);
  }

  @Get('inspections')
  @Permissions(PRODUCTION_QUALITY_PERMISSION_KEYS.inspectionRead)
  @ApiOperation({ summary: 'List inspections scoped to the active context' })
  findInspections(@Query() query: InspectionQueryDto, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.findInspections(query, ctx);
  }

  @Get('inspections/:id')
  @Permissions(PRODUCTION_QUALITY_PERMISSION_KEYS.inspectionRead)
  @ApiOperation({ summary: 'Get inspection by ID with results, dispositions and nonconformances' })
  findOneInspection(@Param('id') id: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.findOneInspection(id, ctx);
  }

  @Patch('inspections/:id/results')
  @Permissions(PRODUCTION_QUALITY_PERMISSION_KEYS.inspectionComplete)
  @ApiOperation({ summary: 'Record characteristic results for an inspection (corrections append new rows)' })
  recordResults(@Param('id') id: string, @Body() dto: RecordInspectionResultsDto, @CurrentUser('id') userId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.recordResults(id, dto, userId, ctx);
  }

  @Patch('inspections/:id/complete')
  @Permissions(PRODUCTION_QUALITY_PERMISSION_KEYS.inspectionComplete)
  @ApiOperation({ summary: 'Complete an OPEN inspection (COMPLETED when all pass, HELD otherwise)' })
  completeInspection(@Param('id') id: string, @CurrentUser('id') userId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.completeInspection(id, userId, ctx);
  }

  // ── Dispositions ────────────────────────────────────────────────────────────

  @Post('inspections/:id/dispositions')
  @Permissions(PRODUCTION_QUALITY_PERMISSION_KEYS.dispositionCreate)
  @ApiOperation({ summary: 'Request a disposition for a COMPLETED/HELD inspection' })
  createDisposition(@Param('id') id: string, @Body() dto: CreateDispositionDto, @CurrentUser('id') userId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.createDisposition(id, dto, userId, ctx);
  }

  @Patch('inspections/:id/dispositions/:dispositionId/approve')
  @Permissions(PRODUCTION_QUALITY_PERMISSION_KEYS.dispositionApprove)
  @ApiOperation({ summary: 'Approve a PENDING disposition and mark the inspection DISPOSITIONED' })
  approveDisposition(@Param('id') id: string, @Param('dispositionId') dispositionId: string, @Body() dto: ApproveDispositionDto, @CurrentUser('id') userId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.approveDisposition(id, dispositionId, dto, userId, ctx);
  }

  @Patch('inspections/:id/dispositions/:dispositionId/reject')
  @Permissions(PRODUCTION_QUALITY_PERMISSION_KEYS.dispositionReject)
  @ApiOperation({ summary: 'Reject a PENDING disposition' })
  rejectDisposition(@Param('id') id: string, @Param('dispositionId') dispositionId: string, @Body() dto: RejectDispositionDto, @CurrentUser('id') userId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.rejectDisposition(id, dispositionId, dto, userId, ctx);
  }

  // ── Nonconformances ─────────────────────────────────────────────────────────

  @Post('ncrs')
  @Permissions(PRODUCTION_QUALITY_PERMISSION_KEYS.ncrCreate)
  @ApiOperation({ summary: 'Create a nonconformance report (idempotent by clientRequestId)' })
  createNcr(@Body() dto: CreateNcrDto, @CurrentUser('id') userId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.createNcr(dto, userId, ctx);
  }

  @Get('ncrs')
  @Permissions(PRODUCTION_QUALITY_PERMISSION_KEYS.ncrRead)
  @ApiOperation({ summary: 'List nonconformance reports scoped to the active context' })
  findNcrs(@Query() query: NcrQueryDto, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.findNcrs(query, ctx);
  }

  @Get('ncrs/:id')
  @Permissions(PRODUCTION_QUALITY_PERMISSION_KEYS.ncrRead)
  @ApiOperation({ summary: 'Get nonconformance report by ID with transitions and attachments' })
  findOneNcr(@Param('id') id: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.findOneNcr(id, ctx);
  }

  @Patch('ncrs/:id/transition')
  @Permissions(PRODUCTION_QUALITY_PERMISSION_KEYS.ncrTransition)
  @ApiOperation({ summary: 'Transition an NCR status (idempotent by requestId)' })
  transitionNcr(@Param('id') id: string, @Body() dto: NcrTransitionDto, @CurrentUser('id') userId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.transitionNcr(id, dto, userId, ctx);
  }

  @Post('ncrs/:id/attachments')
  @Permissions(PRODUCTION_QUALITY_PERMISSION_KEYS.ncrAttach)
  @ApiOperation({ summary: 'Link an existing attachment to an NCR' })
  attachToNcr(@Param('id') id: string, @Body() dto: NcrAttachDto, @CurrentUser('id') userId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.attachToNcr(id, dto, userId, ctx);
  }

  @Delete('ncrs/:id/attachments/:linkId')
  @Permissions(PRODUCTION_QUALITY_PERMISSION_KEYS.ncrAttach)
  @ApiOperation({ summary: 'Unlink an attachment from an NCR' })
  detachFromNcr(@Param('id') id: string, @Param('linkId') linkId: string, @CurrentUser('id') userId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.detachFromNcr(id, linkId, userId, ctx);
  }
}
