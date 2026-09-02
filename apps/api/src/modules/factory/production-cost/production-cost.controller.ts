import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ProductionCostService } from './production-cost.service';
import { PRODUCTION_COST_PERMISSION_KEYS } from './production-cost.constants';
import { CostRateQueryDto, CreateCostRateDto, UpdateCostRateDto } from './dto/cost-rate.dto';
import {
  CostSnapshotQueryDto,
  CreateCostSnapshotDto,
  FreezeCostSnapshotDto,
  SupersedeCostSnapshotDto,
  UpdateCostSnapshotDto,
} from './dto/cost-snapshot.dto';
import {
  CostTransactionQueryDto,
  LedgerQueryDto,
  LedgerTotalsQueryDto,
  PostCostTransactionDto,
  ReverseCostTransactionDto,
} from './dto/cost-transaction.dto';
import {
  AttachTransactionToCalculationDto,
  CostCalculationQueryDto,
  CreateCostCalculationDto,
  FinalizeCostCalculationDto,
  ReopenCostCalculationDto,
  ReviewCostCalculationDto,
} from './dto/cost-calculation.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../auth/guards/permissions.guard';
import { Permissions } from '../../auth/decorators/permissions.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { CurrentActiveContext } from '../../../common/operational-context/current-active-context.decorator';
import { ActiveOperationalContext } from '../../../common/operational-context/operational-context.types';

@ApiTags('Production Cost')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller({ path: 'production', version: '1' })
export class ProductionCostController {
  constructor(private readonly service: ProductionCostService) {}

  // ── Cost rates ──────────────────────────────────────────────────────────────

  @Post('cost-rates')
  @Permissions(PRODUCTION_COST_PERMISSION_KEYS.rateCreate)
  @ApiOperation({ summary: 'Create an ACTIVE cost rate (code unique per company/branch)' })
  createRate(@Body() dto: CreateCostRateDto, @CurrentUser('id') userId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.createRate(dto, userId, ctx);
  }

  @Get('cost-rates')
  @Permissions(PRODUCTION_COST_PERMISSION_KEYS.rateRead)
  @ApiOperation({ summary: 'List cost rates scoped to the active context' })
  findRates(@Query() query: CostRateQueryDto, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.findRates(query, ctx);
  }

  @Get('cost-rates/:id')
  @Permissions(PRODUCTION_COST_PERMISSION_KEYS.rateRead)
  @ApiOperation({ summary: 'Get cost rate by ID (tenant-scoped)' })
  findOneRate(@Param('id') id: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.findOneRate(id, ctx);
  }

  @Patch('cost-rates/:id')
  @Permissions(PRODUCTION_COST_PERMISSION_KEYS.rateUpdate)
  @ApiOperation({ summary: 'Update a cost rate (code is immutable)' })
  updateRate(@Param('id') id: string, @Body() dto: UpdateCostRateDto, @CurrentUser('id') userId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.updateRate(id, dto, userId, ctx);
  }

  @Delete('cost-rates/:id')
  @Permissions(PRODUCTION_COST_PERMISSION_KEYS.rateDelete)
  @ApiOperation({ summary: 'Soft-delete a cost rate (sets INACTIVE)' })
  deleteRate(@Param('id') id: string, @CurrentUser('id') userId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.deleteRate(id, userId, ctx);
  }

  // ── Standard-cost snapshots ─────────────────────────────────────────────────

  @Post('cost-snapshots')
  @Permissions(PRODUCTION_COST_PERMISSION_KEYS.snapshotCreate)
  @ApiOperation({ summary: 'Create a DRAFT standard-cost snapshot (auto next revision, amount = quantity x rate)' })
  createSnapshot(@Body() dto: CreateCostSnapshotDto, @CurrentUser('id') userId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.createSnapshot(dto, userId, ctx);
  }

  @Get('cost-snapshots')
  @Permissions(PRODUCTION_COST_PERMISSION_KEYS.snapshotRead)
  @ApiOperation({ summary: 'List standard-cost snapshots scoped to the active context' })
  findSnapshots(@Query() query: CostSnapshotQueryDto, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.findSnapshots(query, ctx);
  }

  @Get('cost-snapshots/:id')
  @Permissions(PRODUCTION_COST_PERMISSION_KEYS.snapshotRead)
  @ApiOperation({ summary: 'Get standard-cost snapshot by ID (tenant-scoped)' })
  findOneSnapshot(@Param('id') id: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.findOneSnapshot(id, ctx);
  }

  @Patch('cost-snapshots/:id')
  @Permissions(PRODUCTION_COST_PERMISSION_KEYS.snapshotUpdate)
  @ApiOperation({ summary: 'Update a DRAFT standard-cost snapshot (recomputes amount)' })
  updateSnapshot(@Param('id') id: string, @Body() dto: UpdateCostSnapshotDto, @CurrentUser('id') userId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.updateSnapshot(id, dto, userId, ctx);
  }

  @Patch('cost-snapshots/:id/freeze')
  @Permissions(PRODUCTION_COST_PERMISSION_KEYS.snapshotFreeze)
  @ApiOperation({ summary: 'Freeze a DRAFT snapshot (FROZEN, immutable thereafter)' })
  freezeSnapshot(@Param('id') id: string, @Body() dto: FreezeCostSnapshotDto, @CurrentUser('id') userId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.freezeSnapshot(id, dto, userId, ctx);
  }

  @Patch('cost-snapshots/:id/supersede')
  @Permissions(PRODUCTION_COST_PERMISSION_KEYS.snapshotSupersede)
  @ApiOperation({ summary: 'Supersede a FROZEN snapshot (SUPERSEDED)' })
  supersedeSnapshot(@Param('id') id: string, @Body() dto: SupersedeCostSnapshotDto, @CurrentUser('id') userId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.supersedeSnapshot(id, dto, userId, ctx);
  }

  @Delete('cost-snapshots/:id')
  @Permissions(PRODUCTION_COST_PERMISSION_KEYS.snapshotCreate)
  @ApiOperation({ summary: 'Soft-delete a DRAFT standard-cost snapshot' })
  deleteSnapshot(@Param('id') id: string, @CurrentUser('id') userId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.deleteSnapshot(id, userId, ctx);
  }

  // ── Cost transactions ───────────────────────────────────────────────────────

  @Post('cost-transactions')
  @Permissions(PRODUCTION_COST_PERMISSION_KEYS.transactionPost)
  @ApiOperation({ summary: 'Post an immutable cost transaction (idempotent by clientRequestId; standard/variance auto-derived)' })
  postTransaction(@Body() dto: PostCostTransactionDto, @CurrentUser('id') userId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.postTransaction(dto, userId, ctx);
  }

  @Get('cost-transactions')
  @Permissions(PRODUCTION_COST_PERMISSION_KEYS.transactionRead)
  @ApiOperation({ summary: 'List cost transactions scoped to the active context' })
  findTransactions(@Query() query: CostTransactionQueryDto, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.findTransactions(query, ctx);
  }

  @Get('cost-transactions/:id')
  @Permissions(PRODUCTION_COST_PERMISSION_KEYS.transactionRead)
  @ApiOperation({ summary: 'Get cost transaction by ID (tenant-scoped)' })
  findOneTransaction(@Param('id') id: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.findOneTransaction(id, ctx);
  }

  @Post('cost-transactions/:id/reverse')
  @Permissions(PRODUCTION_COST_PERMISSION_KEYS.transactionReverse)
  @ApiOperation({ summary: 'Reverse a POSTED transaction (creates a REVERSED row; original stays immutable)' })
  reverseTransaction(@Param('id') id: string, @Body() dto: ReverseCostTransactionDto, @CurrentUser('id') userId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.reverseTransaction(id, dto, userId, ctx);
  }

  // ── COST-R1B Canonical Unified Cost Ledger ─────────────────────────────────

  @Get('ledger')
  @Permissions(PRODUCTION_COST_PERMISSION_KEYS.transactionRead)
  @ApiOperation({ summary: 'Canonical Unified Cost Ledger entries scoped to the active context (COST-R1B)' })
  findLedger(@Query() query: LedgerQueryDto, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.findLedgerEntries(query, ctx);
  }

  @Get('ledger/totals')
  @Permissions(PRODUCTION_COST_PERMISSION_KEYS.transactionRead)
  @ApiOperation({ summary: 'Canonical Unified Cost Ledger net totals grouped by purpose (COST-R1B)' })
  getLedgerTotals(@Query() query: LedgerTotalsQueryDto, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.getLedgerTotals(query, ctx);
  }

  // ── Cost calculations (draft → review → finalize → reopen) ──────────────────

  @Post('cost-calculations')
  @Permissions(PRODUCTION_COST_PERMISSION_KEYS.calculationCreate)
  @ApiOperation({ summary: 'Create a DRAFT cost calculation for an order/run/branch period' })
  createCalculation(@Body() dto: CreateCostCalculationDto, @CurrentUser('id') userId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.createCalculation(dto, userId, ctx);
  }

  @Get('cost-calculations')
  @Permissions(PRODUCTION_COST_PERMISSION_KEYS.calculationRead)
  @ApiOperation({ summary: 'List cost calculations scoped to the active context' })
  findCalculations(@Query() query: CostCalculationQueryDto, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.findCalculations(query, ctx);
  }

  @Get('cost-calculations/:id')
  @Permissions(PRODUCTION_COST_PERMISSION_KEYS.calculationRead)
  @ApiOperation({ summary: 'Get cost calculation by ID (tenant-scoped, includes linked transactions)' })
  findOneCalculation(@Param('id') id: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.findOneCalculation(id, ctx);
  }

  @Patch('cost-calculations/:id/transactions')
  @Permissions(PRODUCTION_COST_PERMISSION_KEYS.calculationLink)
  @ApiOperation({ summary: 'Attach a POSTED transaction to a DRAFT calculation' })
  attachTransaction(@Param('id') id: string, @Body() dto: AttachTransactionToCalculationDto, @CurrentUser('id') userId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.attachTransactionToCalculation(id, dto, userId, ctx);
  }

  @Patch('cost-calculations/:id/review')
  @Permissions(PRODUCTION_COST_PERMISSION_KEYS.calculationReview)
  @ApiOperation({ summary: 'Move a DRAFT calculation to REVIEW' })
  reviewCalculation(@Param('id') id: string, @Body() dto: ReviewCostCalculationDto, @CurrentUser('id') userId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.reviewCalculation(id, dto, userId, ctx);
  }

  @Patch('cost-calculations/:id/finalize')
  @Permissions(PRODUCTION_COST_PERMISSION_KEYS.calculationFinalize)
  @ApiOperation({ summary: 'Finalize a REVIEW calculation (immutable thereafter)' })
  finalizeCalculation(@Param('id') id: string, @Body() dto: FinalizeCostCalculationDto, @CurrentUser('id') userId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.finalizeCalculation(id, dto, userId, ctx);
  }

  @Patch('cost-calculations/:id/reopen')
  @Permissions(PRODUCTION_COST_PERMISSION_KEYS.calculationReopen)
  @ApiOperation({ summary: 'Reopen a FINALIZED calculation as a new DRAFT revision (finalized revision preserved)' })
  reopenCalculation(@Param('id') id: string, @Body() dto: ReopenCostCalculationDto, @CurrentUser('id') userId: string, @CurrentActiveContext() ctx: ActiveOperationalContext) {
    return this.service.reopenCalculation(id, dto, userId, ctx);
  }
}
