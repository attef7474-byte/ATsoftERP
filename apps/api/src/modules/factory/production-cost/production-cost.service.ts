import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { AuditService } from '../../audit/audit.service';
import { NumberingService } from '../../numbering/numbering.service';
import { OperationalSourceChangesService } from '../operational-source-changes/operational-source-changes.service';
import { OperationalCostCenterResolver } from '../maintenance/cost-centers/operational-cost-center-resolver.service';
import { ActiveOperationalContext } from '../../../common/operational-context/operational-context.types';
import {
  OPERATIONAL_COST_CALCULATION_AUDIT_ENTITY,
  OPERATIONAL_COST_CALCULATION_INCLUDE,
  OPERATIONAL_COST_RATE_AUDIT_ENTITY,
  OPERATIONAL_COST_RATE_INCLUDE,
  OPERATIONAL_COST_SNAPSHOT_AUDIT_ENTITY,
  OPERATIONAL_COST_SNAPSHOT_INCLUDE,
  OPERATIONAL_COST_TRANSACTION_AUDIT_ENTITY,
  OPERATIONAL_COST_TRANSACTION_INCLUDE,
  ENTRY_ROLE_PRIMARY_COST,
  ENTRY_ROLE_REVERSAL,
  isCanonicalSourceType,
} from './production-cost.constants';
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

/**
 * Authoritative operational source backing a cost transaction. Lookup is performed
 * by id first and by the document/business number as a fallback, always tenant and
 * branch scoped. MANUAL and REVERSAL are exempt: REVERSAL is an internal row type and
 * MANUAL carries a free-form source identifier.
 */
const COST_SOURCE_REGISTRY: Record<string, { model: string; numberField?: string; errorKey: string }> = {
  PRODUCTION_ORDER: { model: 'productionOrder', numberField: 'orderNumber', errorKey: 'productionCostTransaction.sourceOrderNotFound' },
  PRODUCTION_RUN: { model: 'productionRun', numberField: 'runNumber', errorKey: 'productionCostTransaction.sourceRunNotFound' },
  OUTPUT_EVENT: { model: 'productionOutputEvent', errorKey: 'productionCostTransaction.sourceOutputEventNotFound' },
  FG_RECEIPT: { model: 'productionFinishedGoodsReceipt', numberField: 'receiptNumber', errorKey: 'productionCostTransaction.sourceReceiptNotFound' },
  MATERIAL_DOCUMENT: { model: 'productionMaterialDocument', numberField: 'documentNumber', errorKey: 'productionCostTransaction.sourceMaterialDocumentNotFound' },
  QUALITY_DISPOSITION: { model: 'productionQualityDisposition', errorKey: 'productionCostTransaction.sourceQualityDispositionNotFound' },
  // Registered for completeness; the generic resolver below explicitly skips DOWNTIME
  // because DowntimeLog.companyId is nullable (Phase 1.6 additive extension) and tenant
  // must be derived from the authoritative machine via the dedicated adapter (§4/§6).
  DOWNTIME: { model: 'downtimeLog', errorKey: 'productionCostTransaction.sourceDowntimeNotFound' },
};

interface DowntimeResolution {
  log: any;
  machine: { id: string; companyId: string | null; branchId: string | null; productionLineId: string | null };
  occurredAt: Date;
}

@Injectable()
export class ProductionCostService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly sourceChanges: OperationalSourceChangesService,
    private readonly numbering: NumberingService,
    private readonly costCenterResolver: OperationalCostCenterResolver,
  ) {}

  private notFound(key: string): NotFoundException {
    return new NotFoundException({ messageKey: key, message: key });
  }

  private badRequest(key: string): BadRequestException {
    return new BadRequestException({ messageKey: key, message: key });
  }

  private conflict(key: string): ConflictException {
    return new ConflictException({ messageKey: key, message: key });
  }

  private writeAudit(
    client: any,
    userId: string,
    action: string,
    entity: string,
    entityId: string,
    ctx: ActiveOperationalContext,
    details: Record<string, any>,
  ) {
    return this.audit.logWithClient(client, {
      userId,
      action,
      entity,
      entityId,
      details: { companyId: ctx.companyId, branchId: ctx.branchId, ...details },
    });
  }

  private async assertTenantScoped(client: any, model: string, id: string, ctx: ActiveOperationalContext, errorKey: string) {
    const record = await client[model].findUnique({ where: { id } });
    if (!record) throw this.notFound(errorKey);
    if (record.companyId !== ctx.companyId) throw this.badRequest('common.tenantMismatch');
    if (record.branchId && record.branchId !== ctx.branchId) throw this.badRequest('common.branchMismatch');
    return record;
  }

  /** Product is a global catalog model. Cost transactions remain tenant-owned,
   * while the selected catalog row is validated for existence and soft deletion. */
  private async assertGlobalProduct(client: any, id: string, errorKey: string) {
    const product = await client.product.findUnique({ where: { id } });
    if (!product || product.deletedAt) throw this.notFound(errorKey);
    return product;
  }

  /** Versions and packagings derive ownership from ProductionProductDefinition;
   * they intentionally do not duplicate companyId/branchId on the child row. */
  private async assertDerivedProductReference(
    client: any,
    model: 'productionVersion' | 'productionPackaging',
    id: string,
    ctx: ActiveOperationalContext,
    errorKey: string,
    expectedDefinitionId?: string,
  ) {
    const record = await client[model].findUnique({ where: { id } });
    if (!record) throw this.notFound(errorKey);
    const definition = await client.productionProductDefinition.findFirst({
      where: {
        id: record.productionProductId,
        companyId: ctx.companyId,
        branchId: ctx.branchId,
        deletedAt: null,
      },
    });
    if (!definition || (expectedDefinitionId && definition.id !== expectedDefinitionId)) {
      throw this.notFound(errorKey);
    }
    return { record, definition };
  }

  private async resolveCostLinks(
    client: any,
    ctx: ActiveOperationalContext,
    links: { productionLineId?: string; machineId?: string; costCenterId?: string },
    errorPrefix: string,
  ) {
    const resolved: Record<string, string> = {};
    if (links.productionLineId) resolved.productionLineId = (await this.assertTenantScoped(client, 'productionLine', links.productionLineId, ctx, `${errorPrefix}.lineNotFound`)).id;
    if (links.machineId) resolved.machineId = (await this.assertTenantScoped(client, 'machine', links.machineId, ctx, `${errorPrefix}.machineNotFound`)).id;
    if (links.costCenterId) resolved.costCenterId = (await this.assertTenantScoped(client, 'costCenter', links.costCenterId, ctx, `${errorPrefix}.costCenterNotFound`)).id;
    return resolved;
  }

  /**
   * Canonical fingerprint of a post payload for idempotency. Only business-relevant
   * fields participate so a retry of the same submission is stable; derived fields
   * (amount, standardAmount, varianceAmount, product snapshots, status, timestamps)
   * are excluded. An explicitly supplied standard snapshot participates; an
   * auto-resolved one is a resolution detail and is stored via requestPayloadFingerprint.
   *
   * DOWNTIME valuation fields (eventType, quantity, unit, rate, occurredAt, cost center)
   * are server-authoritative (§2, D2B-9); the DOWNTIME payload is canonicalized on stable
   * request intent so an identical replay that omits or duplicates a server-derived field
   * never produces a false payload conflict (§13, D2B-10).
   */
  private payloadFingerprint(dto: PostCostTransactionDto): string {
    if (dto.sourceType === 'DOWNTIME') return this.downtimePayloadFingerprint(dto);
    return [
      dto.eventType,
      dto.sourceType,
      dto.sourceId,
      dto.sourceNumberSnapshot ?? '',
      dto.productionOrderId ?? '',
      dto.productionRunId ?? '',
      dto.productId ?? '',
      dto.productionVersionId ?? '',
      dto.productionPackagingId ?? '',
      dto.productionLineId ?? '',
      dto.machineId ?? '',
      dto.shiftId ?? '',
      dto.costCenterId ?? '',
      dto.standardCostSnapshotId ?? '',
      dto.outputEventId ?? '',
      dto.calculationId ?? '',
      new Prisma.Decimal(dto.quantity).toFixed(4),
      dto.unit,
      new Prisma.Decimal(dto.rate).toFixed(4),
      dto.currencyCode ?? 'USD',
      new Date(dto.occurredAt).toISOString(),
    ].join('|');
  }

  /**
   * Canonical DOWNTIME idempotency fingerprint (§13, D2B-10). For DOWNTIME the valuation
   * fields (eventType/quantity/unit/rate/occurredAt) and the cost center/snapshot are
   * server-authoritative, and the machine/order/run/shift are assertion-only context the
   * authoritative DowntimeLog already carries. The fingerprint therefore covers only the
   * stable request intent: source identity and calculation linkage. A replay that omits
   * or duplicates any server-derived or assertion-only field is never a false payload
   * conflict; a same requestId targeting a different source or calculation is.
   */
  private downtimePayloadFingerprint(dto: PostCostTransactionDto): string {
    return [dto.sourceType, dto.sourceId, dto.calculationId ?? ''].join('|');
  }

  private storedPayloadFingerprint(existing: any): string {
    if (existing.requestPayloadFingerprint) return existing.requestPayloadFingerprint;
    if (existing.sourceType === 'DOWNTIME') {
      return [existing.sourceType, existing.sourceId, existing.calculationId ?? ''].join('|');
    }
    return [
      existing.eventType,
      existing.sourceType,
      existing.sourceId,
      existing.sourceNumberSnapshot ?? '',
      existing.productionOrderId ?? '',
      existing.productionRunId ?? '',
      existing.productId ?? '',
      existing.productionVersionId ?? '',
      existing.productionPackagingId ?? '',
      existing.productionLineId ?? '',
      existing.machineId ?? '',
      existing.shiftId ?? '',
      existing.costCenterId ?? '',
      existing.standardCostSnapshotId ?? '',
      existing.outputEventId ?? '',
      existing.calculationId ?? '',
      new Prisma.Decimal(existing.quantity).toFixed(4),
      existing.unit,
      new Prisma.Decimal(existing.rate).toFixed(4),
      existing.currencyCode ?? 'USD',
      existing.occurredAt.toISOString(),
    ].join('|');
  }

  private resolveIdempotentPost(existing: any, dto: PostCostTransactionDto) {
    if (this.storedPayloadFingerprint(existing) !== this.payloadFingerprint(dto)) {
      throw this.conflict('productionCostTransaction.requestPayloadConflict');
    }
    return existing;
  }

  private reversePayloadFingerprint(id: string, reason: string, notes?: string): string {
    return [id, reason, notes ?? ''].join('|');
  }

  private storedReversePayloadFingerprint(existing: any): string {
    return [existing.reversalOfId ?? '', existing.reversalReason ?? '', existing.notes ?? ''].join('|');
  }

  private resolveIdempotentReverse(existing: any, id: string, dto: ReverseCostTransactionDto) {
    if (this.storedReversePayloadFingerprint(existing) !== this.reversePayloadFingerprint(id, dto.reason, dto.notes)) {
      throw this.conflict('productionCostTransaction.requestPayloadConflict');
    }
    return existing;
  }

  /**
   * Canonical identity of an authoritative source valuation. Set only for real
   * operational sources (never MANUAL/REVERSAL); at most one live POSTED transaction
   * may carry it per tenant.
   */
  private sourceFingerprint(sourceType: string, sourceId: string, eventType: string): string | null {
    if (sourceType === 'MANUAL' || sourceType === 'REVERSAL') return null;
    return `${sourceType}:${sourceId}:${eventType}`;
  }

  /**
   * Validates that a real operational source (by sourceType/sourceId) exists and is
   * tenant/branch scoped, unless the source is MANUAL (free-form) or REVERSAL (internal).
   */
  private async resolveOperationalSource(
    tx: any,
    dto: PostCostTransactionDto,
    ctx: ActiveOperationalContext,
  ): Promise<void> {
    const spec = COST_SOURCE_REGISTRY[dto.sourceType];
    if (!spec) return;
    // DOWNTIME uses the dedicated tenant-authoritative adapter (resolveDowntimeSource)
    // because DowntimeLog.companyId is nullable (Phase 1.6 additive extension) and the
    // tenant must derive from the authoritative machine instead.
    if (dto.sourceType === 'DOWNTIME') return;
    const record = await tx[spec.model].findUnique({ where: { id: dto.sourceId } });
    const found = record ?? (spec.numberField ? await tx[spec.model].findFirst({ where: { [spec.numberField]: dto.sourceId } }) : null);
    if (!found) throw this.notFound(spec.errorKey);
    if (found.companyId !== ctx.companyId) throw this.badRequest('common.tenantMismatch');
    if (found.branchId && found.branchId !== ctx.branchId) throw this.badRequest('common.branchMismatch');
  }

  // ── DOWNTIME source (Phase 2 Batch 2B) ──────────────────────────────────────

  /**
   * Resolves a DOWNTIME cost source to its authoritative record and tenant (§4/§6).
   * Tenant derives from the authoritative machine (DowntimeLog.companyId is nullable
   * in the Phase 1.6 additive extension); the machine must resolve inside the active
   * company — null-tenant or foreign-tenant machine yields 404. The client-supplied
   * machineId must equal the authoritative DowntimeLog.machineId. The authoritative
   * valuation timestamp is DowntimeLog.startTime.
   *
   * Completeness gate (§5): a DowntimeLog is valueable only when it has ended, is not
   * cancelled, carries an authoritative duration, and has not been superseded by a
   * correction. A correcting log is valueable only after the corrected original's live
   * POSTED valuation has been reversed (§5 correction chain).
   */
  private async resolveDowntimeSource(
    tx: any,
    dto: PostCostTransactionDto,
    ctx: ActiveOperationalContext,
  ): Promise<DowntimeResolution> {
    const log = await tx.downtimeLog.findUnique({ where: { id: dto.sourceId } });
    if (!log) throw this.notFound('productionCostTransaction.sourceDowntimeNotFound');
    if (log.sourceType !== 'PRODUCTION') throw this.badRequest('productionCostTransaction.downtimeNotProductionLoss');

    if (!log.endTime) throw this.badRequest('productionCostTransaction.sourceNotComplete');
    if (log.cancelledAt) throw this.badRequest('productionCostTransaction.sourceCancelled');
    if (log.durationMinutes == null) throw this.badRequest('productionCostTransaction.sourceMissingDuration');
    const superseded = await tx.downtimeLog.findFirst({ where: { correctsLogId: log.id }, select: { id: true } });
    if (superseded) throw this.badRequest('productionCostTransaction.sourceSuperseded');

    // Correction chain (§5): a correction fact may be valued only after the corrected
    // original's live valuation has been reversed. The original must then be valued by
    // posting the correcting log (never by mutating the existing cost transaction).
    if (log.correctsLogId) {
      const originalValued = await tx.operationalCostTransaction.findFirst({
        where: {
          companyId: ctx.companyId,
          branchId: ctx.branchId,
          sourceFingerprint: this.sourceFingerprint('DOWNTIME', log.correctsLogId, 'DOWNTIME'),
          status: 'POSTED',
          reversedAt: null,
        },
        select: { id: true },
      });
      if (originalValued) throw this.conflict('productionCostTransaction.sourceCorrectionConflict');
    }

    // Tenant/resource authority (§6): the machine must resolve inside the active company.
    const machine = await tx.machine.findFirst({
      where: { id: log.machineId, companyId: ctx.companyId, deletedAt: null },
      select: { id: true, companyId: true, branchId: true, productionLineId: true },
    });
    if (!machine || machine.companyId !== ctx.companyId) {
      throw this.notFound('productionCostTransaction.downtimeMachineNotFound');
    }
    if (machine.branchId && machine.branchId !== ctx.branchId) throw this.badRequest('common.branchMismatch');
    if (log.companyId && log.companyId !== machine.companyId) throw this.badRequest('common.tenantMismatch');
    if (log.branchId && log.branchId !== ctx.branchId) throw this.badRequest('common.branchMismatch');

    if (!dto.machineId || dto.machineId !== log.machineId) {
      throw this.badRequest('productionCostTransaction.downtimeMachineMismatch');
    }
    if (dto.productionOrderId && log.productionOrderId && dto.productionOrderId !== log.productionOrderId) {
      throw this.badRequest('productionCostTransaction.downtimeContextMismatch');
    }
    if (dto.productionRunId && log.productionRunId && dto.productionRunId !== log.productionRunId) {
      throw this.badRequest('productionCostTransaction.downtimeContextMismatch');
    }
    if (dto.shiftId && log.shiftId && dto.shiftId !== log.shiftId) {
      throw this.badRequest('productionCostTransaction.downtimeContextMismatch');
    }

    return { log, machine, occurredAt: log.startTime };
  }

  /**
   * Server-authoritative DOWNTIME valuation assertions (§12, D2B-5/D2B-9): eventType
   * must be DOWNTIME, unit MINUTE, quantity equal to the authoritative
   * DowntimeLog.durationMinutes (no minute/hour conversion, no OPEN-log passthrough),
   * and occurredAt equal to DowntimeLog.startTime. Client-supplied values are
   * assertion-only; conflicting values return productionCostTransaction.sourceValuationConflict.
   */
  private assertDowntimeValuation(
    dto: PostCostTransactionDto,
    log: any,
  ): { quantity: Prisma.Decimal; unit: string; eventType: string; occurredAt: Date } {
    if (dto.eventType !== 'DOWNTIME') throw this.badRequest('productionCostTransaction.sourceValuationConflict');
    if (dto.unit !== 'MINUTE') throw this.badRequest('productionCostTransaction.sourceValuationConflict');
    const authoritativeQuantity = new Prisma.Decimal(String(log.durationMinutes));
    const diff = new Prisma.Decimal(dto.quantity).sub(authoritativeQuantity).abs();
    if (diff.greaterThan(new Prisma.Decimal('0.001'))) {
      throw this.badRequest('productionCostTransaction.sourceValuationConflict');
    }
    const clientOccurredAt = new Date(dto.occurredAt);
    if (Math.abs(clientOccurredAt.getTime() - log.startTime.getTime()) > 1000) {
      throw this.badRequest('productionCostTransaction.sourceValuationConflict');
    }
    return { quantity: authoritativeQuantity, unit: 'MINUTE', eventType: 'DOWNTIME', occurredAt: log.startTime };
  }

  private async resolveDowntimeCostCenter(
    tx: any,
    dto: PostCostTransactionDto,
    ctx: ActiveOperationalContext,
    machine: { id: string },
    occurredAt: Date,
  ): Promise<{ costCenterId: string; costCenterCode: string | null; assignment: any }> {
    const resolution = await this.costCenterResolver.resolveWithClient(
      tx,
      { resourceType: 'MACHINE', machineId: machine.id, referenceDate: occurredAt.toISOString() },
      ctx,
    );
    if (dto.costCenterId && dto.costCenterId !== resolution.costCenterId) {
      throw this.badRequest('productionCostTransaction.costCenterMismatch');
    }
    return {
      costCenterId: resolution.costCenterId,
      costCenterCode: resolution.costCenter?.code ?? null,
      assignment: resolution.matchedAssignment ?? null,
    };
  }

  /**
   * Deterministic DOWNTIME rate resolution (§8, D2B-6): tier 1 is the machine-specific
   * ACTIVE DOWNTIME rate denominated in MINUTE for the resolved cost center effective at
   * the valuation date; tier 2 falls back to the machine's production line
   * (machine-agnostic) rate. Candidates must carry costType DOWNTIME, unit MINUTE, the
   * resolved cost center, and an effective range containing the reference date. A tier
   * with more than one equally applicable candidate is an explicit ambiguity that blocks;
   * only when tier 1 has zero applicable rates may tier 2 be evaluated; no rate at either
   * tier blocks the valuation (rateResolutionMissing). The client can never supply the rate.
   */
  private async resolveDowntimeRate(
    tx: any,
    dto: PostCostTransactionDto,
    ctx: ActiveOperationalContext,
    machine: { id: string; productionLineId: string | null },
    costCenterId: string,
    occurredAt: Date,
  ): Promise<{ rate: Prisma.Decimal; rateId: string | null; rateCode: string | null; tier: string; unit: string; currencyCode: string | null }> {
    const whereCommon: any = {
      companyId: ctx.companyId,
      branchId: ctx.branchId,
      deletedAt: null,
      status: 'ACTIVE',
      costType: 'DOWNTIME',
      unit: 'MINUTE',
      costCenterId,
      effectiveFrom: { lte: occurredAt },
      OR: [{ effectiveTo: null }, { effectiveTo: { gte: occurredAt } }],
    };
    const orderBy = [{ effectiveFrom: 'desc' }, { createdAt: 'desc' }, { id: 'asc' }] as const;

    const pick = (rates: any[]): any => {
      if (rates.length === 0) return null;
      const top = rates[0];
      const tied = rates.filter(
        (r) => r.effectiveFrom.getTime() === top.effectiveFrom.getTime() && r.createdAt.getTime() === top.createdAt.getTime(),
      );
      if (tied.length > 1) throw this.conflict('productionCostTransaction.rateAmbiguous');
      return top;
    };

    const machineRates = await tx.operationalCostRate.findMany({
      where: { ...whereCommon, machineId: machine.id },
      orderBy,
    });
    const machineRate = pick(machineRates);
    if (machineRate) {
      return { rate: machineRate.rate, rateId: machineRate.id, rateCode: machineRate.code, tier: 'MACHINE', unit: machineRate.unit, currencyCode: machineRate.currencyCode ?? null };
    }

    if (machine.productionLineId) {
      const lineRates = await tx.operationalCostRate.findMany({
        where: { ...whereCommon, productionLineId: machine.productionLineId, machineId: null },
        orderBy,
      });
      const lineRate = pick(lineRates);
      if (lineRate) {
        return { rate: lineRate.rate, rateId: lineRate.id, rateCode: lineRate.code, tier: 'LINE', unit: lineRate.unit, currencyCode: lineRate.currencyCode ?? null };
      }
    }

    throw this.notFound('productionCostTransaction.rateResolutionMissing');
  }

  /**
   * Standard-cost snapshot resolution for DOWNTIME (§9, D2B-8). The server resolves a
   * FROZEN DOWNTIME snapshot in MINUTE units aligned to the resolved machine (or its
   * line) and the resolved cost center, effective at DowntimeLog.startTime; the highest
   * revision wins and an equal-revision tie is an explicit ambiguity. No applicable
   * snapshot is allowed and leaves standardAmount null — there is no hard
   * missing-standard blocker for DOWNTIME. The client-supplied standardCostSnapshotId is
   * assertion-only and can never override the authoritative resolution: a supplied
   * snapshot that does not match the resolved one (or is supplied when none is resolved)
   * returns sourceValuationConflict. The product-definition snapshot path is never invoked.
   */
  private async resolveDowntimeStandardSnapshot(
    tx: any,
    dto: PostCostTransactionDto,
    ctx: ActiveOperationalContext,
    machine: { id: string; productionLineId: string | null },
    costCenterId: string,
    occurredAt: Date,
  ): Promise<any | null> {
    const resourceWhere = machine.productionLineId
      ? { OR: [{ machineId: machine.id }, { productionLineId: machine.productionLineId, machineId: null }] }
      : { machineId: machine.id };
    const candidates = await tx.operationalStandardCostSnapshot.findMany({
      where: {
        companyId: ctx.companyId,
        branchId: ctx.branchId,
        deletedAt: null,
        status: 'FROZEN',
        costType: 'DOWNTIME',
        unit: 'MINUTE',
        costCenterId,
        effectiveFrom: { lte: occurredAt },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: occurredAt } }],
        ...resourceWhere,
      },
      orderBy: [{ revision: 'desc' }],
    });
    let snapshot: any | null = null;
    if (candidates.length > 0) {
      const top = candidates[0];
      const tied = candidates.filter((s: any) => s.revision === top.revision);
      if (tied.length > 1) throw this.conflict('productionCostTransaction.snapshotAmbiguous');
      snapshot = top;
    }
    if (dto.standardCostSnapshotId && (!snapshot || snapshot.id !== dto.standardCostSnapshotId)) {
      throw this.badRequest('productionCostTransaction.sourceValuationConflict');
    }
    return snapshot;
  }

  /**
   * Canonical request fingerprint for DOWNTIME posts (§12.1.5). Resolved refs
   * (machine, cost center, standard snapshot, occurredAt, production refs) are stored
   * server-derived; quantity/unit/source identity come from the request.
   */
  private downtimeCanonicalFingerprint(
    dto: PostCostTransactionDto,
    resolution: {
      machine: { id: string };
      costCenterId: string | null;
      standardCostSnapshotId: string | null;
      occurredAt: Date;
      productionOrderId: string | null;
      productionRunId: string | null;
    },
  ): string {
    return [
      dto.eventType,
      'DOWNTIME',
      dto.sourceId,
      resolution.machine.id,
      resolution.costCenterId ?? '',
      resolution.standardCostSnapshotId ?? '',
      new Prisma.Decimal(dto.quantity).toFixed(4),
      dto.unit,
      resolution.occurredAt.toISOString(),
      resolution.productionOrderId ?? '',
      resolution.productionRunId ?? '',
    ].join('|');
  }

  /**
   * Validates an optional cost-calculation target: must be tenant scoped, in DRAFT
   * status, and compatible with the transaction's order/run scope.
   */
  private async resolveCalculationScope(
    tx: any,
    calculationId: string | undefined,
    refs: Record<string, any>,
    ctx: ActiveOperationalContext,
  ): Promise<string | null> {
    if (!calculationId) return null;
    const calculation = await tx.operationalCostCalculation.findFirst({
      where: { id: calculationId, companyId: ctx.companyId, branchId: ctx.branchId, deletedAt: null },
    });
    if (!calculation) throw this.notFound('productionCostCalculation.notFound');
    if (calculation.status !== 'DRAFT') throw this.badRequest('productionCostCalculation.linkOnlyDraft');
    if (calculation.scopeType === 'ORDER' && refs.productionOrderId !== calculation.scopeId) {
      throw this.badRequest('productionCostTransaction.calculationScopeMismatch');
    }
    if (calculation.scopeType === 'RUN' && refs.productionRunId !== calculation.scopeId) {
      throw this.badRequest('productionCostTransaction.calculationScopeMismatch');
    }
    return calculation.id;
  }

  // ── Cost rates ──────────────────────────────────────────────────────────────

  async createRate(dto: CreateCostRateDto, userId: string, ctx: ActiveOperationalContext) {
    return this.prisma.$transaction(async (tx) => {
      const links = await this.resolveCostLinks(tx, ctx, dto, 'productionCostRate');
      if (dto.effectiveTo && new Date(dto.effectiveTo) < new Date(dto.effectiveFrom)) {
        throw this.badRequest('productionCostRate.invalidEffectiveRange');
      }
      try {
        const rate = await tx.operationalCostRate.create({
          data: {
            companyId: ctx.companyId,
            branchId: ctx.branchId,
            code: dto.code,
            nameAr: dto.nameAr,
            nameEn: dto.nameEn,
            description: dto.description ?? null,
            costType: dto.costType,
            unit: dto.unit,
            rate: new Prisma.Decimal(dto.rate),
            currencyCode: dto.currencyCode ?? 'USD',
            effectiveFrom: new Date(dto.effectiveFrom),
            effectiveTo: dto.effectiveTo ? new Date(dto.effectiveTo) : null,
            status: 'ACTIVE',
            createdById: userId,
            updatedById: userId,
            ...links,
          },
          include: OPERATIONAL_COST_RATE_INCLUDE,
        });
        await this.writeAudit(tx, userId, 'RATE_CREATE', OPERATIONAL_COST_RATE_AUDIT_ENTITY, rate.id, ctx, {
          code: rate.code,
          costType: rate.costType,
          unit: rate.unit,
          rate: rate.rate.toString(),
        });
        return rate;
      } catch (e: any) {
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
          throw this.conflict('productionCostRate.codeExists');
        }
        throw e;
      }
    });
  }

  async findRates(query: CostRateQueryDto, ctx: ActiveOperationalContext) {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const where: any = { companyId: ctx.companyId, branchId: ctx.branchId, deletedAt: null };
    if (query.costType) where.costType = query.costType;
    if (query.status) where.status = query.status;
    if (query.costCenterId) where.costCenterId = query.costCenterId;
    if (query.search) {
      where.OR = [
        { code: { contains: query.search } },
        { nameAr: { contains: query.search } },
        { nameEn: { contains: query.search } },
      ];
    }
    const [data, total] = await Promise.all([
      (this.prisma as any).operationalCostRate.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: [{ createdAt: 'desc' }],
        include: OPERATIONAL_COST_RATE_INCLUDE,
      }),
      (this.prisma as any).operationalCostRate.count({ where }),
    ]);
    return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async findOneRate(id: string, ctx: ActiveOperationalContext) {
    const rate = await (this.prisma as any).operationalCostRate.findFirst({
      where: { id, companyId: ctx.companyId, branchId: ctx.branchId, deletedAt: null },
      include: OPERATIONAL_COST_RATE_INCLUDE,
    });
    if (!rate) throw this.notFound('productionCostRate.notFound');
    return rate;
  }

  async updateRate(id: string, dto: UpdateCostRateDto, userId: string, ctx: ActiveOperationalContext) {
    return this.prisma.$transaction(async (tx) => {
      const rate = await tx.operationalCostRate.findFirst({
        where: { id, companyId: ctx.companyId, branchId: ctx.branchId, deletedAt: null },
      });
      if (!rate) throw this.notFound('productionCostRate.notFound');
      const links = await this.resolveCostLinks(tx, ctx, dto, 'productionCostRate');
      const effectiveFrom = dto.effectiveFrom ? new Date(dto.effectiveFrom) : rate.effectiveFrom;
      const effectiveTo = dto.effectiveTo ? new Date(dto.effectiveTo) : rate.effectiveTo;
      if (effectiveTo && effectiveTo < effectiveFrom) throw this.badRequest('productionCostRate.invalidEffectiveRange');

      const updated = await tx.operationalCostRate.update({
        where: { id },
        data: {
          nameAr: dto.nameAr ?? rate.nameAr,
          nameEn: dto.nameEn ?? rate.nameEn,
          description: dto.description !== undefined ? dto.description : rate.description,
          costType: dto.costType ?? rate.costType,
          unit: dto.unit ?? rate.unit,
          rate: dto.rate !== undefined ? new Prisma.Decimal(dto.rate) : rate.rate,
          currencyCode: dto.currencyCode ?? rate.currencyCode,
          effectiveFrom,
          effectiveTo,
          status: dto.status ?? rate.status,
          updatedById: userId,
          ...links,
        },
        include: OPERATIONAL_COST_RATE_INCLUDE,
      });
      await this.writeAudit(tx, userId, 'RATE_UPDATE', OPERATIONAL_COST_RATE_AUDIT_ENTITY, id, ctx, {
        code: rate.code,
        status: updated.status,
      });
      return updated;
    });
  }

  async deleteRate(id: string, userId: string, ctx: ActiveOperationalContext) {
    return this.prisma.$transaction(async (tx) => {
      const rate = await tx.operationalCostRate.findFirst({
        where: { id, companyId: ctx.companyId, branchId: ctx.branchId, deletedAt: null },
      });
      if (!rate) throw this.notFound('productionCostRate.notFound');
      const deleted = await tx.operationalCostRate.update({
        where: { id },
        data: { deletedAt: new Date(), status: 'INACTIVE', updatedById: userId },
      });
      await this.writeAudit(tx, userId, 'RATE_DELETE', OPERATIONAL_COST_RATE_AUDIT_ENTITY, id, ctx, { code: rate.code });
      return deleted;
    });
  }

  // ── Standard-cost snapshots ─────────────────────────────────────────────────

  async createSnapshot(dto: CreateCostSnapshotDto, userId: string, ctx: ActiveOperationalContext) {
    return this.prisma.$transaction(async (tx) => {
      const definition = await tx.productionProductDefinition.findFirst({
        where: { id: dto.productionProductDefinitionId, companyId: ctx.companyId, branchId: ctx.branchId, deletedAt: null },
      });
      if (!definition) throw this.notFound('productionCostSnapshot.productDefinitionNotFound');
      const links = await this.resolveCostLinks(tx, ctx, dto, 'productionCostSnapshot');
      if (dto.effectiveTo && new Date(dto.effectiveTo) < new Date(dto.effectiveFrom)) {
        throw this.badRequest('productionCostSnapshot.invalidEffectiveRange');
      }
      const version = dto.productionVersionId
        ? await this.assertDerivedProductReference(
          tx,
          'productionVersion',
          dto.productionVersionId,
          ctx,
          'productionCostSnapshot.versionNotFound',
          definition.id,
        )
        : null;
      const packaging = dto.productionPackagingId
        ? await this.assertDerivedProductReference(
          tx,
          'productionPackaging',
          dto.productionPackagingId,
          ctx,
          'productionCostSnapshot.packagingNotFound',
          definition.id,
        )
        : null;
      if (version) links.productionVersionId = version.record.id;
      if (packaging) links.productionPackagingId = packaging.record.id;

      const max = await tx.operationalStandardCostSnapshot.aggregate({
        _max: { revision: true },
        where: { companyId: ctx.companyId, branchId: ctx.branchId, code: dto.code },
      });
      const revision = (max._max.revision ?? 0) + 1;
      const amount = new Prisma.Decimal(dto.quantity).mul(new Prisma.Decimal(dto.rate));

      try {
        const snapshot = await tx.operationalStandardCostSnapshot.create({
          data: {
            companyId: ctx.companyId,
            branchId: ctx.branchId,
            code: dto.code,
            revision,
            productionProductDefinitionId: definition.id,
            costType: dto.costType,
            unit: dto.unit,
            quantity: new Prisma.Decimal(dto.quantity),
            rate: new Prisma.Decimal(dto.rate),
            amount,
            currencyCode: dto.currencyCode ?? 'USD',
            effectiveFrom: new Date(dto.effectiveFrom),
            effectiveTo: dto.effectiveTo ? new Date(dto.effectiveTo) : null,
            status: 'DRAFT',
            notes: dto.notes ?? null,
            createdById: userId,
            ...links,
          },
          include: OPERATIONAL_COST_SNAPSHOT_INCLUDE,
        });
        await this.writeAudit(tx, userId, 'SNAPSHOT_CREATE', OPERATIONAL_COST_SNAPSHOT_AUDIT_ENTITY, snapshot.id, ctx, {
          code: snapshot.code,
          revision: snapshot.revision,
          costType: snapshot.costType,
          amount: snapshot.amount.toString(),
        });
        return snapshot;
      } catch (e: any) {
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
          throw this.conflict('productionCostSnapshot.revisionConflict');
        }
        throw e;
      }
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  async findSnapshots(query: CostSnapshotQueryDto, ctx: ActiveOperationalContext) {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const where: any = { companyId: ctx.companyId, branchId: ctx.branchId, deletedAt: null };
    if (query.costType) where.costType = query.costType;
    if (query.status) where.status = query.status;
    if (query.productionProductDefinitionId) where.productionProductDefinitionId = query.productionProductDefinitionId;
    if (query.search) {
      where.OR = [
        { code: { contains: query.search } },
        { revision: { equals: Number(query.search) } },
      ];
    }
    const [data, total] = await Promise.all([
      (this.prisma as any).operationalStandardCostSnapshot.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: [{ createdAt: 'desc' }],
        include: OPERATIONAL_COST_SNAPSHOT_INCLUDE,
      }),
      (this.prisma as any).operationalStandardCostSnapshot.count({ where }),
    ]);
    return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async findOneSnapshot(id: string, ctx: ActiveOperationalContext) {
    const snapshot = await (this.prisma as any).operationalStandardCostSnapshot.findFirst({
      where: { id, companyId: ctx.companyId, branchId: ctx.branchId, deletedAt: null },
      include: OPERATIONAL_COST_SNAPSHOT_INCLUDE,
    });
    if (!snapshot) throw this.notFound('productionCostSnapshot.notFound');
    return snapshot;
  }

  async updateSnapshot(id: string, dto: UpdateCostSnapshotDto, userId: string, ctx: ActiveOperationalContext) {
    return this.prisma.$transaction(async (tx) => {
      const snapshot = await tx.operationalStandardCostSnapshot.findFirst({
        where: { id, companyId: ctx.companyId, branchId: ctx.branchId, deletedAt: null },
      });
      if (!snapshot) throw this.notFound('productionCostSnapshot.notFound');
      if (snapshot.status !== 'DRAFT') throw this.badRequest('productionCostSnapshot.updateOnlyDraft');

      const quantity = dto.quantity !== undefined ? new Prisma.Decimal(dto.quantity) : snapshot.quantity;
      const rate = dto.rate !== undefined ? new Prisma.Decimal(dto.rate) : snapshot.rate;
      const amount = quantity.mul(rate);
      const effectiveFrom = dto.effectiveFrom ? new Date(dto.effectiveFrom) : snapshot.effectiveFrom;
      const effectiveTo = dto.effectiveTo ? new Date(dto.effectiveTo) : snapshot.effectiveTo;
      if (effectiveTo && effectiveTo < effectiveFrom) throw this.badRequest('productionCostSnapshot.invalidEffectiveRange');

      const updated = await tx.operationalStandardCostSnapshot.update({
        where: { id },
        data: {
          unit: dto.unit ?? snapshot.unit,
          quantity,
          rate,
          amount,
          currencyCode: dto.currencyCode ?? snapshot.currencyCode,
          effectiveFrom,
          effectiveTo,
          notes: dto.notes ?? snapshot.notes,
        },
        include: OPERATIONAL_COST_SNAPSHOT_INCLUDE,
      });
      await this.writeAudit(tx, userId, 'SNAPSHOT_UPDATE', OPERATIONAL_COST_SNAPSHOT_AUDIT_ENTITY, id, ctx, {
        code: snapshot.code,
        revision: snapshot.revision,
        amount: updated.amount.toString(),
      });
      return updated;
    });
  }

  async freezeSnapshot(id: string, dto: FreezeCostSnapshotDto, userId: string, ctx: ActiveOperationalContext) {
    return this.prisma.$transaction(async (tx) => {
      const snapshot = await tx.operationalStandardCostSnapshot.findFirst({
        where: { id, companyId: ctx.companyId, branchId: ctx.branchId, deletedAt: null },
      });
      if (!snapshot) throw this.notFound('productionCostSnapshot.notFound');
      if (snapshot.status !== 'DRAFT') throw this.badRequest('productionCostSnapshot.freezeOnlyDraft');
      const frozen = await tx.operationalStandardCostSnapshot.update({
        where: { id },
        data: {
          status: 'FROZEN',
          frozenById: userId,
          frozenAt: new Date(),
          notes: dto.notes ?? snapshot.notes,
        },
        include: OPERATIONAL_COST_SNAPSHOT_INCLUDE,
      });
      await this.writeAudit(tx, userId, 'SNAPSHOT_FREEZE', OPERATIONAL_COST_SNAPSHOT_AUDIT_ENTITY, id, ctx, {
        code: snapshot.code,
        revision: snapshot.revision,
      });
      return frozen;
    });
  }

  async supersedeSnapshot(id: string, dto: SupersedeCostSnapshotDto, userId: string, ctx: ActiveOperationalContext) {
    return this.prisma.$transaction(async (tx) => {
      const snapshot = await tx.operationalStandardCostSnapshot.findFirst({
        where: { id, companyId: ctx.companyId, branchId: ctx.branchId, deletedAt: null },
      });
      if (!snapshot) throw this.notFound('productionCostSnapshot.notFound');
      if (snapshot.status !== 'FROZEN') throw this.badRequest('productionCostSnapshot.supersedeOnlyFrozen');
      const superseded = await tx.operationalStandardCostSnapshot.update({
        where: { id },
        data: {
          status: 'SUPERSEDED',
          supersededById: userId,
          supersededAt: new Date(),
          notes: dto.notes ?? snapshot.notes,
        },
        include: OPERATIONAL_COST_SNAPSHOT_INCLUDE,
      });
      await this.writeAudit(tx, userId, 'SNAPSHOT_SUPERSEDE', OPERATIONAL_COST_SNAPSHOT_AUDIT_ENTITY, id, ctx, {
        code: snapshot.code,
        revision: snapshot.revision,
      });
      return superseded;
    });
  }

  async deleteSnapshot(id: string, userId: string, ctx: ActiveOperationalContext) {
    return this.prisma.$transaction(async (tx) => {
      const snapshot = await tx.operationalStandardCostSnapshot.findFirst({
        where: { id, companyId: ctx.companyId, branchId: ctx.branchId, deletedAt: null },
      });
      if (!snapshot) throw this.notFound('productionCostSnapshot.notFound');
      if (snapshot.status !== 'DRAFT') throw this.badRequest('productionCostSnapshot.deleteOnlyDraft');
      const deleted = await tx.operationalStandardCostSnapshot.update({
        where: { id },
        data: { deletedAt: new Date() },
      });
      await this.writeAudit(tx, userId, 'SNAPSHOT_DELETE', OPERATIONAL_COST_SNAPSHOT_AUDIT_ENTITY, id, ctx, {
        code: snapshot.code,
        revision: snapshot.revision,
      });
      return deleted;
    });
  }

  // ── Cost transactions ───────────────────────────────────────────────────────

  private async resolveTransactionRefs(
    tx: any,
    dto: PostCostTransactionDto,
    ctx: ActiveOperationalContext,
  ): Promise<{ refs: Record<string, any>; snapshots: Record<string, any> }> {
    const refs: Record<string, any> = {};
    const order = dto.productionOrderId
      ? await this.assertTenantScoped(tx, 'productionOrder', dto.productionOrderId, ctx, 'productionCostTransaction.orderNotFound')
      : null;
    const run = dto.productionRunId
      ? await this.assertTenantScoped(tx, 'productionRun', dto.productionRunId, ctx, 'productionCostTransaction.runNotFound')
      : null;
    const product = dto.productId
      ? await this.assertGlobalProduct(tx, dto.productId, 'productionCostTransaction.productNotFound')
      : null;
    const version = dto.productionVersionId
      ? await this.assertDerivedProductReference(tx, 'productionVersion', dto.productionVersionId, ctx, 'productionCostTransaction.versionNotFound')
      : null;
    const packaging = dto.productionPackagingId
      ? await this.assertDerivedProductReference(tx, 'productionPackaging', dto.productionPackagingId, ctx, 'productionCostTransaction.packagingNotFound')
      : null;

    if (order) refs.productionOrderId = order.id;
    if (run) refs.productionRunId = run.id;
    if (product) refs.productId = product.id;
    if (version) refs.productionVersionId = version.record.id;
    if (packaging) refs.productionPackagingId = packaging.record.id;
    if (dto.productionLineId) refs.productionLineId = (await this.assertTenantScoped(tx, 'productionLine', dto.productionLineId, ctx, 'productionCostTransaction.lineNotFound')).id;
    if (dto.machineId) refs.machineId = (await this.assertTenantScoped(tx, 'machine', dto.machineId, ctx, 'productionCostTransaction.machineNotFound')).id;
    if (dto.shiftId) refs.shiftId = (await this.assertTenantScoped(tx, 'productionShift', dto.shiftId, ctx, 'productionCostTransaction.shiftNotFound')).id;
    if (dto.costCenterId) refs.costCenterId = (await this.assertTenantScoped(tx, 'costCenter', dto.costCenterId, ctx, 'productionCostTransaction.costCenterNotFound')).id;
    if (dto.outputEventId) refs.outputEventId = (await this.assertTenantScoped(tx, 'productionOutputEvent', dto.outputEventId, ctx, 'productionCostTransaction.outputEventNotFound')).id;

    if (order && run && run.productionOrderId !== order.id) {
      throw this.badRequest('productionCostTransaction.orderContextMismatch');
    }

    const derivedDefinition = version?.definition ?? packaging?.definition ?? null;
    if (version && packaging && version.definition.id !== packaging.definition.id) {
      throw this.notFound('productionCostTransaction.packagingNotFound');
    }
    if (product && derivedDefinition?.productId && derivedDefinition.productId !== product.id) {
      throw this.notFound('productionCostTransaction.productNotFound');
    }
    if (order?.productionProductDefinitionId) {
      const orderDefinition = await tx.productionProductDefinition.findFirst({
        where: {
          id: order.productionProductDefinitionId,
          companyId: ctx.companyId,
          branchId: ctx.branchId,
          deletedAt: null,
        },
      });
      if (!orderDefinition) throw this.notFound('productionCostTransaction.orderNotFound');
      if (derivedDefinition && derivedDefinition.id !== orderDefinition.id) {
        throw this.notFound('productionCostTransaction.versionNotFound');
      }
      if (product && orderDefinition.productId && orderDefinition.productId !== product.id) {
        throw this.notFound('productionCostTransaction.productNotFound');
      }
    }

    const snapshots: Record<string, any> = {};
    if (dto.standardCostSnapshotId) {
      const snapshot = await this.assertTenantScoped(tx, 'operationalStandardCostSnapshot', dto.standardCostSnapshotId, ctx, 'productionCostTransaction.snapshotNotFound');
      if (snapshot.status !== 'FROZEN') throw this.badRequest('productionCostTransaction.snapshotNotFrozen');
      snapshots.standardCostSnapshot = snapshot;
    }
    return { refs, snapshots };
  }

  /**
   * Deterministic standard-cost resolution. Picks the FROZEN snapshot whose cost
   * type matches the transaction event type and whose product definition/product
   * matches the order, aligned to the explicit refs (version/packaging/line/machine/
   * cost center), always effective at the transaction date. The highest revision wins;
   * two equally-revisioned candidates after all filters are an ambiguity conflict.
   * When a product definition is resolvable but no snapshot exists, that is a hard
   * missing-standard blocker (a rate was expected for this product/event).
   */
  private async resolveStandardSnapshot(
    tx: any,
    dto: PostCostTransactionDto,
    ctx: ActiveOperationalContext,
    refs: Record<string, any>,
    occurredAt: Date,
  ) {
    let order: any = null;
    if (refs.productionOrderId) {
      order = await tx.productionOrder.findUnique({
        where: { id: refs.productionOrderId },
        select: { productionProductDefinitionId: true },
      });
    }
    const defId: string | null = order?.productionProductDefinitionId ?? null;

    const where: any = {
      companyId: ctx.companyId,
      branchId: ctx.branchId,
      deletedAt: null,
      status: 'FROZEN',
      effectiveFrom: { lte: occurredAt },
      OR: [{ effectiveTo: null }, { effectiveTo: { gte: occurredAt } }],
    };
    if (refs.productionVersionId) where.productionVersionId = refs.productionVersionId;
    if (refs.productionPackagingId) where.productionPackagingId = refs.productionPackagingId;
    if (refs.productionLineId) where.productionLineId = refs.productionLineId;
    if (refs.machineId) where.machineId = refs.machineId;
    if (refs.costCenterId) where.costCenterId = refs.costCenterId;
    if (defId) where.productionProductDefinitionId = defId;

    let productDefinitionIds: Set<string> | null = null;
    if (!defId && refs.productId) {
      const definitions = await tx.productionProductDefinition.findMany({
        where: { productId: refs.productId, companyId: ctx.companyId, branchId: ctx.branchId, deletedAt: null },
        select: { id: true },
      });
      if (definitions.length > 0) {
        productDefinitionIds = new Set(definitions.map((d: any) => d.id));
      }
    }

    if (
      !defId &&
      !productDefinitionIds &&
      !refs.productionVersionId &&
      !refs.productionPackagingId &&
      !refs.productionLineId &&
      !refs.machineId &&
      !refs.costCenterId
    ) {
      return null;
    }

    const candidates = await tx.operationalStandardCostSnapshot.findMany({
      where,
      orderBy: [{ revision: 'desc' }],
    });
    let scoped = candidates.filter((s: any) => s.costType === dto.eventType);
    if (productDefinitionIds) {
      scoped = scoped.filter((s: any) => s.productionProductDefinitionId && productDefinitionIds.has(s.productionProductDefinitionId));
    }

    if (scoped.length === 0) {
      if (defId || productDefinitionIds) {
        throw this.badRequest('productionCostTransaction.snapshotResolutionMissing');
      }
      return null;
    }

    const sorted = [...scoped].sort((a, b) => b.revision - a.revision);
    const top = sorted[0];
    const tied = sorted.filter((s: any) => s.revision === top.revision);
    if (tied.length > 1) {
      throw this.conflict('productionCostTransaction.snapshotAmbiguous');
    }
    return top;
  }

  async postTransaction(dto: PostCostTransactionDto, userId: string, ctx: ActiveOperationalContext) {
    const existing = await (this.prisma as any).operationalCostTransaction.findFirst({
      where: { companyId: ctx.companyId, branchId: ctx.branchId, clientRequestId: dto.clientRequestId },
    });
    if (existing) return this.resolveIdempotentPost(existing, dto);

    try {
      return await this.prisma.$transaction(
        async (tx) => {
          const raced = await tx.operationalCostTransaction.findFirst({
            where: { companyId: ctx.companyId, branchId: ctx.branchId, clientRequestId: dto.clientRequestId },
          });
          if (raced) return this.resolveIdempotentPost(raced, dto);

          // DOWNTIME is a dedicated server-authoritative adapter: tenant derives from the
          // machine, occurredAt/rate are resolved server-side, and the source is a
          // production-loss downtime log (never a generic tenant-scoped source).
          if (dto.sourceType === 'DOWNTIME') {
            return this.postDowntimeTransaction(tx, dto, userId, ctx);
          }

          const { refs, snapshots } = await this.resolveTransactionRefs(tx, dto, ctx);
          await this.resolveOperationalSource(tx, dto, ctx);
          const occurredAt = new Date(dto.occurredAt);
          let standardSnapshot = snapshots.standardCostSnapshot ?? null;
          if (!standardSnapshot) {
            standardSnapshot = await this.resolveStandardSnapshot(tx, dto, ctx, refs, occurredAt);
          }

          const fingerprint = this.sourceFingerprint(dto.sourceType, dto.sourceId, dto.eventType);
          if (fingerprint) {
            const alreadyValued = await tx.operationalCostTransaction.findFirst({
              where: { companyId: ctx.companyId, branchId: ctx.branchId, sourceFingerprint: fingerprint, status: 'POSTED', reversedAt: null },
            });
            if (alreadyValued) throw this.conflict('productionCostTransaction.sourceAlreadyValued');
          }

          const calculationId = await this.resolveCalculationScope(tx, dto.calculationId, refs, ctx);

          const quantity = new Prisma.Decimal(dto.quantity);
          const rate = new Prisma.Decimal(dto.rate);
          const amount = quantity.mul(rate);
          let standardAmount: Prisma.Decimal | null = null;
          let varianceAmount: Prisma.Decimal | null = null;
          if (standardSnapshot) {
            standardAmount = quantity.mul(standardSnapshot.rate);
            varianceAmount = amount.sub(standardAmount);
          }

          let productCodeSnapshot: string | null = dto.productCodeSnapshot ?? null;
          let productNameSnapshot: string | null = dto.productNameSnapshot ?? null;
          if (refs.productId && !productCodeSnapshot) {
            const product = await tx.product.findUnique({ where: { id: refs.productId }, select: { code: true, name: true } });
            productCodeSnapshot = product?.code ?? null;
            productNameSnapshot = product?.name ?? null;
          }

          const transaction = await tx.operationalCostTransaction.create({
            data: {
              companyId: ctx.companyId,
              branchId: ctx.branchId,
              eventType: dto.eventType,
              sourceType: dto.sourceType,
              sourceId: dto.sourceId,
              sourceLineId: dto.sourceLineId ?? null,
              costNature: dto.costNature ?? 'MANUAL_ASSERTED_ACTUAL',
              costPurpose: dto.costPurpose ?? 'OTHER',
              entryRole: ENTRY_ROLE_PRIMARY_COST,
              sourceNumberSnapshot: dto.sourceNumberSnapshot ?? null,
              sourceFingerprint: fingerprint,
              requestPayloadFingerprint: this.payloadFingerprint(dto),
              clientRequestId: dto.clientRequestId,
              productCodeSnapshot,
              productNameSnapshot,
              quantity,
              unit: dto.unit,
              rate,
              amount,
              currencyCode: dto.currencyCode ?? 'USD',
              standardAmount,
              varianceAmount,
              occurredAt,
              status: 'POSTED',
              notes: dto.notes ?? null,
              createdById: userId,
              ...refs,
              ...(calculationId ? { calculationId } : {}),
              ...(standardSnapshot ? { standardCostSnapshotId: standardSnapshot.id } : {}),
            },
            include: OPERATIONAL_COST_TRANSACTION_INCLUDE,
          });
          await this.writeAudit(tx, userId, 'TRANSACTION_POST', OPERATIONAL_COST_TRANSACTION_AUDIT_ENTITY, transaction.id, ctx, {
            eventType: transaction.eventType,
            sourceType: transaction.sourceType,
            sourceId: transaction.sourceId,
            sourceFingerprint: transaction.sourceFingerprint ?? null,
            amount: transaction.amount.toString(),
            varianceAmount: transaction.varianceAmount ? transaction.varianceAmount.toString() : null,
            calculationId: transaction.calculationId ?? null,
          });
          return transaction;
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (e: any) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        const target: any = e.meta?.target;
        const isSourceDedupe = Array.isArray(target) && target.includes('sourceFingerprint');
        throw isSourceDedupe ? this.conflict('productionCostTransaction.sourceAlreadyValued') : this.conflict('productionCostTransaction.duplicateRequest');
      }
      throw e;
    }
  }

  /**
   * Server-authoritative DOWNTIME valuation (Phase 2 Batch 2B). Runs inside the same
   * serializable transaction as postTransaction. Resolution order (§10):
   *  1. Source: closed, non-cancelled, duration-bearing, non-superseded production-loss
   *     DowntimeLog; tenant derives from the authoritative machine; correction gate.
   *  2. Valuation: eventType DOWNTIME, unit MINUTE, quantity = DowntimeLog.durationMinutes,
   *     occurredAt = startTime; client values are assertion-only.
   *  3. Cost center: tx-aware resolver output is authoritative; a conflicting client
   *     costCenterId is rejected (costCenterMismatch).
   *  4. Rate: ACTIVE DOWNTIME MINUTE rate for the resolved cost center, machine tier
   *     first then line tier; never client input; a conflicting client rate is rejected.
   *  5. Standard snapshot: server-resolved FROZEN DOWNTIME snapshot aligned to the
   *     machine/line and cost center; none allowed (standardAmount null), ambiguity blocks,
   *     client snapshot cannot override.
   * The rate resolution trace and canonical fingerprint are recorded in the audit event
   * and an OperationalSourceChange watermark is emitted after the transaction is created.
   */
  private async postDowntimeTransaction(
    tx: any,
    dto: PostCostTransactionDto,
    userId: string,
    ctx: ActiveOperationalContext,
  ) {
    const { log, machine, occurredAt } = await this.resolveDowntimeSource(tx, dto, ctx);
    const valuation = this.assertDowntimeValuation(dto, log);

    const { costCenterId, costCenterCode } = await this.resolveDowntimeCostCenter(tx, dto, ctx, machine, occurredAt);
    const { rate, rateId, rateCode, tier, currencyCode: rateCurrency } = await this.resolveDowntimeRate(tx, dto, ctx, machine, costCenterId, occurredAt);

    // rate is server-authoritative; a conflicting client rate is assertion-only.
    const clientRate = new Prisma.Decimal(dto.rate);
    if (clientRate.sub(rate).abs().greaterThan(new Prisma.Decimal('0.0001'))) {
      throw this.badRequest('productionCostTransaction.sourceValuationConflict');
    }

    const standardSnapshot = await this.resolveDowntimeStandardSnapshot(tx, dto, ctx, machine, costCenterId, occurredAt);

    // COST-R1B currency authority (constraint 5): downtime currency MUST come from the
    // proven server-side rate currency and MUST equal Company.operationalCurrencyCode.
    // No fallback to USD/SAR/SystemSetting — a mismatch or an unset company currency BLOCKs.
    const companyCurrency = await this.resolveOperationalCurrency(tx, ctx.companyId);
    if (!companyCurrency) {
      throw this.badRequest('productionCostTransaction.operationalCurrencyRequired');
    }
    if (!rateCurrency || rateCurrency !== companyCurrency) {
      throw this.badRequest('productionCostTransaction.downtimeCurrencyMismatch');
    }

    const productionOrderId = dto.productionOrderId ?? log.productionOrderId ?? null;
    const productionRunId = dto.productionRunId ?? log.productionRunId ?? null;

    const fingerprint = this.sourceFingerprint('DOWNTIME', dto.sourceId, 'DOWNTIME');
    if (fingerprint) {
      const alreadyValued = await tx.operationalCostTransaction.findFirst({
        where: { companyId: ctx.companyId, branchId: ctx.branchId, sourceFingerprint: fingerprint, status: 'POSTED', reversedAt: null },
      });
      if (alreadyValued) throw this.conflict('productionCostTransaction.sourceAlreadyValued');
    }

    const calculationId = await this.resolveCalculationScope(tx, dto.calculationId, { productionOrderId, productionRunId }, ctx);

    const amount = valuation.quantity.mul(rate);
    let standardAmount: Prisma.Decimal | null = null;
    let varianceAmount: Prisma.Decimal | null = null;
    if (standardSnapshot) {
      standardAmount = valuation.quantity.mul(standardSnapshot.rate);
      varianceAmount = amount.sub(standardAmount);
    }

    const canonicalFingerprint = this.downtimeCanonicalFingerprint(dto, {
      machine,
      costCenterId,
      standardCostSnapshotId: standardSnapshot?.id ?? null,
      occurredAt,
      productionOrderId,
      productionRunId,
    });

    const transaction = await tx.operationalCostTransaction.create({
      data: {
        companyId: ctx.companyId,
        branchId: ctx.branchId,
        eventType: valuation.eventType,
        sourceType: 'DOWNTIME',
        sourceId: dto.sourceId,
        sourceLineId: null,
        costNature: 'RATE_DERIVED',
        costPurpose: dto.costPurpose ?? 'OTHER',
        entryRole: ENTRY_ROLE_PRIMARY_COST,
        sourceNumberSnapshot: null,
        sourceFingerprint: fingerprint,
        requestPayloadFingerprint: this.payloadFingerprint(dto),
        clientRequestId: dto.clientRequestId,
        productionOrderId,
        productionRunId,
        productionLineId: machine.productionLineId ?? null,
        machineId: machine.id,
        shiftId: dto.shiftId ?? log.shiftId ?? null,
        costCenterId,
        standardCostSnapshotId: standardSnapshot?.id ?? null,
        quantity: valuation.quantity,
        unit: valuation.unit,
        rate,
        amount,
        currencyCode: companyCurrency,
        standardAmount,
        varianceAmount,
        occurredAt,
        status: 'POSTED',
        notes: dto.notes ?? null,
        createdById: userId,
        ...(calculationId ? { calculationId } : {}),
      },
      include: OPERATIONAL_COST_TRANSACTION_INCLUDE,
    });

    const scopeType = productionRunId ? 'RUN' : productionOrderId ? 'ORDER' : 'BRANCH';
    const scopeId = productionRunId ?? productionOrderId ?? ctx.branchId;
    await this.sourceChanges.recordChange(
      tx,
      ctx,
      {
        scopeType: scopeType as any,
        scopeId,
        entityType: 'OPERATIONAL_COST_TRANSACTION',
        entityId: transaction.id,
        changeType: 'SOURCE_UPDATE',
        reason: `DOWNTIME cost valuation ${transaction.id}`,
      },
      userId,
    );

    await this.writeAudit(tx, userId, 'TRANSACTION_POST', OPERATIONAL_COST_TRANSACTION_AUDIT_ENTITY, transaction.id, ctx, {
      eventType: 'DOWNTIME',
      sourceType: 'DOWNTIME',
      sourceId: dto.sourceId,
      sourceFingerprint: fingerprint,
      downtimeLogId: log.id,
      downtimeStartTime: occurredAt.toISOString(),
      downtimeEndTime: log.endTime ? log.endTime.toISOString() : null,
      downtimeDurationMinutes: log.durationMinutes != null ? String(log.durationMinutes) : null,
      machineId: machine.id,
      costCenterId,
      costCenterCode,
      rateId,
      rateCode,
      rateTier: tier,
      rate: rate.toString(),
      standardCostSnapshotId: standardSnapshot?.id ?? null,
      canonicalFingerprint,
      amount: amount.toString(),
      varianceAmount: varianceAmount ? varianceAmount.toString() : null,
      calculationId: calculationId ?? null,
    });
    return transaction;
  }

  async findTransactions(query: CostTransactionQueryDto, ctx: ActiveOperationalContext) {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const where: any = { companyId: ctx.companyId, branchId: ctx.branchId };
    if (query.eventType) where.eventType = query.eventType;
    if (query.sourceType) where.sourceType = query.sourceType;
    if (query.status) where.status = query.status;
    if (query.productionRunId) where.productionRunId = query.productionRunId;
    if (query.productionOrderId) where.productionOrderId = query.productionOrderId;
    if (query.costCenterId) where.costCenterId = query.costCenterId;
    if (query.dateFrom || query.dateTo) {
      where.occurredAt = {};
      if (query.dateFrom) where.occurredAt.gte = new Date(query.dateFrom);
      if (query.dateTo) where.occurredAt.lte = new Date(query.dateTo);
    }
    const [data, total] = await Promise.all([
      (this.prisma as any).operationalCostTransaction.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: [{ occurredAt: 'desc' }],
        include: OPERATIONAL_COST_TRANSACTION_INCLUDE,
      }),
      (this.prisma as any).operationalCostTransaction.count({ where }),
    ]);
    return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async findOneTransaction(id: string, ctx: ActiveOperationalContext) {
    const transaction = await (this.prisma as any).operationalCostTransaction.findFirst({
      where: { id, companyId: ctx.companyId, branchId: ctx.branchId },
      include: OPERATIONAL_COST_TRANSACTION_INCLUDE,
    });
    if (!transaction) throw this.notFound('productionCostTransaction.notFound');
    return transaction;
  }

  async reverseTransaction(id: string, dto: ReverseCostTransactionDto, userId: string, ctx: ActiveOperationalContext) {
    const existing = await (this.prisma as any).operationalCostTransaction.findFirst({
      where: { companyId: ctx.companyId, branchId: ctx.branchId, clientRequestId: dto.clientRequestId },
    });
    if (existing) return this.resolveIdempotentReverse(existing, id, dto);

    try {
      return await this.prisma.$transaction(
        async (tx) => {
          const raced = await tx.operationalCostTransaction.findFirst({
            where: { companyId: ctx.companyId, branchId: ctx.branchId, clientRequestId: dto.clientRequestId },
          });
          if (raced) return this.resolveIdempotentReverse(raced, id, dto);

          const original = await tx.operationalCostTransaction.findFirst({
            where: { id, companyId: ctx.companyId, branchId: ctx.branchId },
          });
          if (!original) throw this.notFound('productionCostTransaction.notFound');
          if (original.status !== 'POSTED' || original.reversalOfId) {
            throw this.badRequest('productionCostTransaction.reversableOnlyPosted');
          }
          if (original.reversedAt) throw this.badRequest('productionCostTransaction.alreadyReversed');

          // Canonical rows reverse through the single canonical writer so source
          // identity and every attribution snapshot are copied from the immutable
          // original ledger event. Legacy rows retain the established legacy path
          // below for backward compatibility.
          if (original.entryRole === ENTRY_ROLE_PRIMARY_COST) {
            const canonical = await this.reverseLedgerEntry(tx, original, {
              reason: dto.reason,
              notes: dto.notes ?? null,
              clientRequestId: dto.clientRequestId,
              createdById: userId,
              ctx,
            });
            return { original: canonical.updatedOriginal, reversal: canonical.transaction };
          }

          const reversal = await tx.operationalCostTransaction.create({
            data: {
              companyId: ctx.companyId,
              branchId: ctx.branchId,
              eventType: original.eventType,
              sourceType: 'REVERSAL',
              sourceId: original.id,
              sourceLineId: original.sourceLineId ?? null,
              costNature: original.costNature ?? null,
              costPurpose: original.costPurpose ?? null,
              entryRole: ENTRY_ROLE_REVERSAL,
              sourceNumberSnapshot: original.sourceNumberSnapshot,
              sourceFingerprint: null,
              requestPayloadFingerprint: this.reversePayloadFingerprint(id, dto.reason, dto.notes),
              clientRequestId: dto.clientRequestId,
              productionOrderId: original.productionOrderId,
              productionRunId: original.productionRunId,
              productId: original.productId,
              productCodeSnapshot: original.productCodeSnapshot,
              productNameSnapshot: original.productNameSnapshot,
              productionVersionId: original.productionVersionId,
              productionPackagingId: original.productionPackagingId,
              productionLineId: original.productionLineId,
              machineId: original.machineId,
              shiftId: original.shiftId,
              costCenterId: original.costCenterId,
              standardCostSnapshotId: original.standardCostSnapshotId,
              outputEventId: original.outputEventId,
              calculationId: original.calculationId,
              quantity: original.quantity.negated(),
              unit: original.unit,
              rate: original.rate,
              amount: original.amount.negated(),
              currencyCode: original.currencyCode,
              // The standard benchmark stays positive (CHECK standard_amount_ck forbids
              // negatives); only the variance is negated so the pair nets to zero.
              standardAmount: original.standardAmount ?? null,
              varianceAmount: original.varianceAmount ? original.varianceAmount.negated() : null,
              occurredAt: new Date(),
              status: 'REVERSED',
              reversalOfId: original.id,
              reversalReason: dto.reason,
              notes: dto.notes ?? original.notes,
              createdById: userId,
            },
            include: OPERATIONAL_COST_TRANSACTION_INCLUDE,
          });

          const updatedOriginal = await tx.operationalCostTransaction.update({
            where: { id: original.id },
            data: { reversedById: userId, reversedAt: new Date() },
          });

          const scopeType = original.productionRunId ? 'RUN' : original.productionOrderId ? 'ORDER' : 'BRANCH';
          const scopeId = original.productionRunId ?? original.productionOrderId ?? ctx.branchId;
          await this.sourceChanges.recordChange(
            tx,
            ctx,
            {
              scopeType: scopeType as any,
              scopeId,
              entityType: 'OPERATIONAL_COST_TRANSACTION',
              entityId: original.id,
              changeType: 'REVERSAL',
              reason: `Cost transaction reversal ${reversal.id}`,
            },
            userId,
          );

          await this.writeAudit(tx, userId, 'TRANSACTION_REVERSE', OPERATIONAL_COST_TRANSACTION_AUDIT_ENTITY, original.id, ctx, {
            reversalId: reversal.id,
            clientRequestId: dto.clientRequestId,
            reversedAmount: reversal.amount.toString(),
            reason: dto.reason,
          });
          return { original: updatedOriginal, reversal };
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (e: any) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw this.conflict('productionCostTransaction.duplicateRequest');
      }
      throw e;
    }
  }

  // ── COST-R1B Canonical Unified Cost Ledger ─────────────────────────────────

  /**
   * Resolves the authoritative operational currency of a company. COST-R1B removes the
   * legacy USD default: a POSTED canonical PRIMARY_COST entry requires a non-null company
   * `operationalCurrencyCode` (the OPERATIONAL_CURRENCY_AUTHORITY). No fallback to USD,
   * SAR or a SystemSetting. Returns null for a company with no operational currency.
   */
  private async resolveOperationalCurrency(tx: any, companyId: string): Promise<string | null> {
    const company = await tx.company.findUnique({
      where: { id: companyId },
      select: { id: true, operationalCurrencyCode: true },
    });
    if (!company) throw this.notFound('company.notFound');
    return company.operationalCurrencyCode ?? null;
  }

  /**
   * Canonical ledger idempotency check. A replayed clientRequestId returns the existing
   * row only when the stored canonical fingerprint matches the supplied one; otherwise a
   * payload conflict is raised. This mirrors the legacy resolveIdempotentPost/resolve
   * pattern but is the single code path for all canonical (COST-R1B) postings.
   */
  private async resolveCanonicalIdempotentPost(
    tx: any,
    companyId: string,
    branchId: string,
    clientRequestId: string,
    incomingFingerprint: string,
  ): Promise<any | null> {
    if (!clientRequestId) return null;
    const existing = await tx.operationalCostTransaction.findFirst({
      where: { companyId, branchId, clientRequestId },
    });
    if (!existing) return null;
    const stored = existing.requestPayloadFingerprint;
    if (stored && stored !== incomingFingerprint) {
      throw this.conflict('productionCostTransaction.requestPayloadConflict');
    }
    // Legacy row without a stored fingerprint cannot be safely proven identical -> replay conflict.
    if (!stored) {
      throw this.conflict('productionCostTransaction.requestPayloadConflict');
    }
    return existing;
  }

  /**
   * Enforces that a canonical source type is one of the controlled set
   * (INVENTORY_MOVEMENT_LINE | DOWNTIME_EVENT | MANUAL). The legacy REVERSAL convention
   * is represented by entryRole=REVERSAL + reversalOfId and must never be submitted as a
   * primary source type through the canonical writer.
   */
  private assertCanonicalSourceType(
    sourceType: string,
    entryRole: string,
    opts: { allowLegacySourceTypes: boolean },
  ) {
    if (entryRole === ENTRY_ROLE_REVERSAL) {
      // Reversals carry the original's source identity; sourceType here is descriptive.
      return;
    }
    if (isCanonicalSourceType(sourceType)) return;
    if (opts.allowLegacySourceTypes) {
      // Hardened legacy generic post: source is a real, tenant-scoped operational source
      // resolved through the legacy registry. Rejected otherwise below by the source set.
      if (sourceType in COST_SOURCE_REGISTRY || sourceType === 'DOWNTIME' || sourceType === 'REVERSAL') return;
    }
    throw this.badRequest('productionCostTransaction.unsupportedCanonicalSource');
  }

  /**
   * THE single canonical writer for the Unified Cost Ledger (COST-R1B).
   *
   * Creates a ledger entry with a controlled source type, costNature, costPurpose and
   * entryRole. It is transaction-aware (takes the active `tx`) and:
   *   - enforces canonical idempotency (clientRequestId + payload fingerprint),
   *   - enforces source-level uniqueness (one live PRIMARY_COST per source fingerprint),
   *   - enforces the operational currency authority (no USD/SAR/SystemSetting fallback),
   *   - records postedAt (defaults to occurredAt) and fromLineId,
   *   - blocks double reversal and reversing-a-reversal,
   *   - computes reversal amount from ORIGINAL_LEDGER_EVENT only,
   *   - writes the transaction audit event.
   *
   * `allowLegacySourceTypes` is TRUE only for the hardened legacy generic post path so
   * existing source types keep working while still carrying canonical dimensions.
   */
  async postLedgerEntryWithinTransaction(
    tx: any,
    opts: {
      eventType: string;
      sourceType: string;
      sourceId: string;
      sourceLineId?: string | null;
      costNature?: string;
      costPurpose?: string;
      entryRole?: string;
      amount: Prisma.Decimal | string | number;
      quantity: Prisma.Decimal | string | number;
      unit: string;
      rate?: Prisma.Decimal | string | number;
      currencyCode?: string | null;
      occurredAt: Date;
      postedAt?: Date | null;
      status?: 'POSTED' | 'REVERSED';
      clientRequestId?: string;
      requestPayloadFingerprint?: string;
      sourceFingerprint?: string | null;
      sourceNumberSnapshot?: string | null;
      notes?: string | null;
      reversalOfOriginal?: any | null;
      reversalReason?: string | null;
      standardAmount?: Prisma.Decimal | string | number | null;
      varianceAmount?: Prisma.Decimal | string | number | null;
      calculationId?: string | null;
      refs?: Record<string, any>;
      createdById: string;
      ctx: ActiveOperationalContext;
      allowLegacySourceTypes?: boolean;
      sourceChanges?: boolean;
    },
  ) {
    const ctx = opts.ctx;
    const entryRole = opts.entryRole ?? ENTRY_ROLE_PRIMARY_COST;

    // 1. Canonical idempotency.
    const incomingFingerprint =
      opts.requestPayloadFingerprint ?? `${opts.eventType}|${opts.sourceType}|${opts.sourceId}`;
    const replay = await this.resolveCanonicalIdempotentPost(
      tx,
      ctx.companyId,
      ctx.branchId,
      opts.clientRequestId ?? '',
      incomingFingerprint,
    );
    if (replay) return replay;

    // 2. Reversal guardrails (operate on the original ledger event, never the reversal).
    const reversing = entryRole === ENTRY_ROLE_REVERSAL;
    if (reversing) {
      if (!opts.reversalOfOriginal) throw this.badRequest('productionCostTransaction.reversalRequiresOriginal');
      if (opts.reversalOfOriginal.reversalOfId) throw this.badRequest('productionCostTransaction.cannotReverseReversal');
      if (opts.reversalOfOriginal.reversedAt) throw this.badRequest('productionCostTransaction.alreadyReversed');
    }

    // 3. Controlled source type.
    this.assertCanonicalSourceType(opts.sourceType, entryRole, {
      allowLegacySourceTypes: opts.allowLegacySourceTypes ?? false,
    });

    // 4. Source-level uniqueness for PRIMARY_COST entries backed by a real source.
    if (opts.sourceFingerprint && !reversing) {
      const dup = await tx.operationalCostTransaction.findFirst({
        where: {
          companyId: ctx.companyId,
          branchId: ctx.branchId,
          sourceFingerprint: opts.sourceFingerprint,
          status: 'POSTED',
          reversedAt: null,
        },
      });
      if (dup) throw this.conflict('productionCostTransaction.sourceAlreadyValued');
    }

    // 5. Operate in quantities at Decimal precision.
    const quantity = opts.quantity instanceof Prisma.Decimal ? opts.quantity : new Prisma.Decimal(opts.quantity);
    const amount = opts.amount instanceof Prisma.Decimal ? opts.amount : new Prisma.Decimal(opts.amount);
    const rate = opts.rate != null ? (opts.rate instanceof Prisma.Decimal ? opts.rate : new Prisma.Decimal(opts.rate)) : null;

    // 6. Currency enforcement (OPERATIONAL_CURRENCY_AUTHORITY). No fallback.
    let currencyCode: string;
    let standardAmount: Prisma.Decimal | null = null;
    let varianceAmount: Prisma.Decimal | null = null;
    if (!reversing) {
      const inventoryCurrency = opts.refs?._currencyCodeFromInventory ?? null;
      const companyCurrency = await this.resolveOperationalCurrency(tx, ctx.companyId);
      if (!companyCurrency) {
        throw this.badRequest('productionCostTransaction.operationalCurrencyRequired');
      }
      if (inventoryCurrency && inventoryCurrency !== companyCurrency) {
        throw this.badRequest('productionCostTransaction.materialCurrencyMismatch');
      }
      if (opts.currencyCode && opts.currencyCode !== companyCurrency && opts.costNature === 'RATE_DERIVED') {
        throw this.badRequest('productionCostTransaction.downtimeCurrencyMismatch');
      }
      currencyCode = inventoryCurrency ?? opts.currencyCode ?? companyCurrency;
      if (opts.standardAmount != null) {
        standardAmount = opts.standardAmount instanceof Prisma.Decimal ? opts.standardAmount : new Prisma.Decimal(opts.standardAmount);
        varianceAmount = amount.sub(standardAmount);
      }
    } else {
      // Reversal inherits the original's currency and signs the original's amount.
      currencyCode = opts.reversalOfOriginal.currencyCode;
    }

    // 7. Compose tenant refs (order/run/product/line/machine/shift/costCenter/department/workOrder/request).
    const refs: Record<string, any> = { ...(opts.refs ?? {}) };
    delete refs._currencyCodeFromInventory;
    delete refs._companyCurrency;
    delete refs._maintenanceMaterial;

    const postedAt = opts.postedAt ?? new Date();
    const status = opts.status ?? 'POSTED';

    // 8. Create the ledger entry.
    const transaction = await tx.operationalCostTransaction.create({
      data: {
        companyId: ctx.companyId,
        branchId: ctx.branchId,
        eventType: opts.eventType,
        sourceType: opts.sourceType,
        sourceId: opts.sourceId,
        sourceLineId: opts.sourceLineId ?? null,
        costNature: opts.costNature ?? null,
        costPurpose: opts.costPurpose ?? null,
        entryRole,
        sourceNumberSnapshot: opts.sourceNumberSnapshot ?? null,
        sourceFingerprint: opts.sourceFingerprint ?? null,
        requestPayloadFingerprint: incomingFingerprint,
        clientRequestId: opts.clientRequestId ?? '',
        calculationId: opts.calculationId ?? null,
        quantity,
        unit: opts.unit,
        rate: rate ?? new Prisma.Decimal(0),
        amount,
        currencyCode,
        standardAmount,
        varianceAmount,
        occurredAt: opts.occurredAt,
        postedAt,
        status,
        reversalOfId: reversing ? opts.reversalOfOriginal.id : null,
        reversalReason: opts.reversalReason ?? null,
        notes: opts.notes ?? null,
        createdById: opts.createdById,
        ...refs,
      },
      include: OPERATIONAL_COST_TRANSACTION_INCLUDE,
    });

    // 9. For reversals, mark the original as reversed atomically.
    let updatedOriginal: any = null;
    if (reversing) {
      updatedOriginal = await tx.operationalCostTransaction.update({
        where: { id: opts.reversalOfOriginal.id },
        data: { reversedById: opts.createdById, reversedAt: new Date() },
      });
    }

    // 10. Source-change watermark for real sources (mirrors legacy downtime/reversal behavior).
    if (opts.sourceChanges !== false) {
      const scopeType = refs.productionRunId ? 'RUN' : refs.productionOrderId ? 'ORDER' : 'BRANCH';
      const scopeId = refs.productionRunId ?? refs.productionOrderId ?? ctx.branchId;
      await this.sourceChanges.recordChange(
        tx,
        ctx,
        {
          scopeType: scopeType as any,
          scopeId,
          entityType: 'OPERATIONAL_COST_TRANSACTION',
          entityId: transaction.id,
          changeType: reversing ? 'REVERSAL' : 'SOURCE_UPDATE',
          reason: `${reversing ? 'Cost transaction reversal' : 'Unified ledger cost entry'} ${transaction.id}`,
        },
        opts.createdById,
      );
    }

    // 11. Audit.
    await this.writeAudit(
      tx,
      opts.createdById,
      reversing ? 'TRANSACTION_REVERSE' : 'TRANSACTION_POST',
      OPERATIONAL_COST_TRANSACTION_AUDIT_ENTITY,
      reversing ? opts.reversalOfOriginal.id : transaction.id,
      ctx,
      {
        eventType: opts.eventType,
        sourceType: opts.sourceType,
        sourceId: opts.sourceId,
        sourceLineId: opts.sourceLineId ?? null,
        costNature: opts.costNature ?? null,
        costPurpose: opts.costPurpose ?? null,
        entryRole,
        sourceFingerprint: opts.sourceFingerprint ?? null,
        amount: transaction.amount.toString(),
        currencyCode: transaction.currencyCode,
        varianceAmount: transaction.varianceAmount ? transaction.varianceAmount.toString() : null,
        calculationId: transaction.calculationId ?? null,
        ...(reversing
          ? { reversalId: transaction.id, reversedAmount: amount.toString(), reason: opts.reversalReason ?? null }
          : {}),
      },
    );

    return { transaction, updatedOriginal, replay: false };
  }

  /**
   * Canonical reversal entry computed strictly from the ORIGINAL_LEDGER_EVENT amount
   * (amount is negated, standard stays positive, variance negated) and written through the
   * single canonical writer. Blocks double reversal and reversing-a-reversal.
   */
  async reverseLedgerEntry(
    tx: any,
    original: any,
    opts: { reason: string; notes?: string | null; clientRequestId: string; createdById: string; ctx: ActiveOperationalContext },
  ) {
    return this.postLedgerEntryWithinTransaction(tx, {
      eventType: original.eventType,
      sourceType: original.sourceType,
      sourceId: original.sourceId,
      sourceLineId: original.sourceLineId ?? null,
      costNature: original.costNature ?? null,
      costPurpose: original.costPurpose ?? null,
      entryRole: ENTRY_ROLE_REVERSAL,
      amount: original.amount.negated(),
      quantity: original.quantity.negated(),
      unit: original.unit,
      rate: original.rate,
      standardAmount: original.standardAmount ?? null,
      varianceAmount: original.varianceAmount ? original.varianceAmount.negated() : null,
      occurredAt: new Date(),
      status: 'REVERSED',
      clientRequestId: opts.clientRequestId,
      requestPayloadFingerprint: [original.id, opts.reason, opts.notes ?? ''].join('|'),
      sourceFingerprint: null,
      sourceNumberSnapshot: original.sourceNumberSnapshot,
      calculationId: original.calculationId,
      refs: {
        productionOrderId: original.productionOrderId ?? undefined,
        productionRunId: original.productionRunId ?? undefined,
        productId: original.productId ?? undefined,
        productCodeSnapshot: original.productCodeSnapshot ?? undefined,
        productNameSnapshot: original.productNameSnapshot ?? undefined,
        productionVersionId: original.productionVersionId ?? undefined,
        productionPackagingId: original.productionPackagingId ?? undefined,
        productionLineId: original.productionLineId ?? undefined,
        machineId: original.machineId ?? undefined,
        shiftId: original.shiftId ?? undefined,
        costCenterId: original.costCenterId ?? undefined,
        departmentId: original.departmentId ?? undefined,
        maintenanceWorkOrderId: original.maintenanceWorkOrderId ?? undefined,
        maintenanceRequestId: original.maintenanceRequestId ?? undefined,
        standardCostSnapshotId: original.standardCostSnapshotId ?? undefined,
        outputEventId: original.outputEventId ?? undefined,
      },
      reversalOfOriginal: original,
      reversalReason: opts.reason,
      notes: opts.notes ?? original.notes,
      createdById: opts.createdById,
      ctx: opts.ctx,
      sourceChanges: true,
    });
  }

  /**
   * Canonical Unified Cost Ledger read (COST-R1B). Tenant branch scoped; returns only
   * canonical ledger entries (entryRole IS NOT NULL). Filters by costNature,
   * costPurpose, entryRole, and the maintenance/department/cost-center refs.
   */
  async findLedgerEntries(query: LedgerQueryDto, ctx: ActiveOperationalContext) {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const where: any = { companyId: ctx.companyId, branchId: ctx.branchId, entryRole: { not: null } };
    if (query.costNature) where.costNature = query.costNature;
    if (query.costPurpose) where.costPurpose = query.costPurpose;
    if (query.entryRole) where.entryRole = query.entryRole;
    if (query.departmentId) where.departmentId = query.departmentId;
    if (query.maintenanceWorkOrderId) where.maintenanceWorkOrderId = query.maintenanceWorkOrderId;
    if (query.maintenanceRequestId) where.maintenanceRequestId = query.maintenanceRequestId;
    if (query.costCenterId) where.costCenterId = query.costCenterId;
    if (query.productionRunId) where.productionRunId = query.productionRunId;
    if (query.productionOrderId) where.productionOrderId = query.productionOrderId;
    if (query.machineId) where.machineId = query.machineId;
    if (query.dateFrom || query.dateTo) {
      where.occurredAt = {};
      if (query.dateFrom) where.occurredAt.gte = new Date(query.dateFrom);
      if (query.dateTo) where.occurredAt.lte = new Date(query.dateTo);
    }
    const [data, total] = await Promise.all([
      (this.prisma as any).operationalCostTransaction.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: [{ occurredAt: 'desc' }],
        include: OPERATIONAL_COST_TRANSACTION_INCLUDE,
      }),
      (this.prisma as any).operationalCostTransaction.count({ where }),
    ]);
    return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  /**
   * Canonical Unified Cost Ledger net totals (COST-R1B). Only canonical PRIMARY_COST and
   * REVERSAL entries contribute; a REVERSAL stores its negated amount, so net = sum of the
   * stored amounts of the matched canonical rows. Grouped by costPurpose. Aggregated on the
   * server with Decimal precision (never in the browser).
   */
  async getLedgerTotals(query: LedgerTotalsQueryDto, ctx: ActiveOperationalContext) {
    const where: any = { companyId: ctx.companyId, branchId: ctx.branchId, entryRole: { not: null } };
    if (query.costPurpose) where.costPurpose = query.costPurpose;
    if (query.costCenterId) where.costCenterId = query.costCenterId;
    if (query.departmentId) where.departmentId = query.departmentId;
    if (query.maintenanceWorkOrderId) where.maintenanceWorkOrderId = query.maintenanceWorkOrderId;
    if (query.maintenanceRequestId) where.maintenanceRequestId = query.maintenanceRequestId;
    if (query.dateFrom || query.dateTo) {
      where.occurredAt = {};
      if (query.dateFrom) where.occurredAt.gte = new Date(query.dateFrom);
      if (query.dateTo) where.occurredAt.lte = new Date(query.dateTo);
    }
    const rows = await (this.prisma as any).operationalCostTransaction.findMany({
      where,
      select: {
        id: true,
        amount: true,
        currencyCode: true,
        costPurpose: true,
        entryRole: true,
        status: true,
      },
    });

    const byPurpose = new Map<string, Prisma.Decimal>();
    for (const row of rows) {
      const purpose = row.costPurpose ?? 'OTHER';
      const current = byPurpose.get(purpose) ?? new Prisma.Decimal(0);
      byPurpose.set(purpose, current.add(new Prisma.Decimal(row.amount.toString())));
    }

    let netTotal = new Prisma.Decimal(0);
    const totals = [...byPurpose.entries()]
      .map(([purpose, amount]) => {
        netTotal = netTotal.add(amount);
        return { purpose, amount: amount.toString(), currencyCode: rows[0]?.currencyCode ?? null };
      })
      .sort((a, b) => a.purpose.localeCompare(b.purpose));

    return {
      totals,
      netTotal: netTotal.toString(),
      currencyCode: rows[0]?.currencyCode ?? null,
      entryCount: rows.length,
    };
  }

  // ── Cost calculations (lifecycle) ────────────────────────────────────────────

  private async resolveCalculationScopeRef(
    tx: any,
    dto: CreateCostCalculationDto,
    ctx: ActiveOperationalContext,
  ): Promise<{ productionOrderId?: string; productionRunId?: string }> {
    if (dto.scopeType === 'BRANCH') {
      if (dto.scopeId !== ctx.branchId) throw this.badRequest('productionCostCalculation.branchScopeMismatch');
      return {};
    }
    if (dto.scopeType === 'ORDER') {
      const order = await tx.productionOrder.findFirst({
        where: { id: dto.scopeId, companyId: ctx.companyId, branchId: ctx.branchId, deletedAt: null },
      });
      if (!order) throw this.notFound('productionCostCalculation.orderNotFound');
      return { productionOrderId: order.id };
    }
    const run = await tx.productionRun.findFirst({
      where: { id: dto.scopeId, companyId: ctx.companyId, branchId: ctx.branchId, deletedAt: null },
    });
    if (!run) throw this.notFound('productionCostCalculation.runNotFound');
    return { productionRunId: run.id };
  }

  async createCalculation(dto: CreateCostCalculationDto, userId: string, ctx: ActiveOperationalContext) {
    return this.prisma.$transaction(async (tx) => {
      const periodFrom = new Date(dto.periodFrom);
      const periodTo = new Date(dto.periodTo);
      if (periodTo < periodFrom) throw this.badRequest('productionCostCalculation.invalidPeriod');
      const scopeRefs = await this.resolveCalculationScopeRef(tx, dto, ctx);
      const code = await this.numbering.generateNumberAtomicWithClient('PRODUCTION_COST_CALCULATION', tx);
      const calculation = await tx.operationalCostCalculation.create({
        data: {
          companyId: ctx.companyId,
          branchId: ctx.branchId,
          code,
          revision: 1,
          scopeType: dto.scopeType,
          scopeId: dto.scopeId,
          periodFrom,
          periodTo,
          status: 'DRAFT',
          currencyCode: dto.currencyCode ?? 'USD',
          reason: dto.reason ?? null,
          notes: dto.notes ?? null,
          createdById: userId,
          ...scopeRefs,
        },
        include: OPERATIONAL_COST_CALCULATION_INCLUDE,
      });
      await this.writeAudit(tx, userId, 'CALCULATION_CREATE', OPERATIONAL_COST_CALCULATION_AUDIT_ENTITY, calculation.id, ctx, {
        code: calculation.code,
        revision: calculation.revision,
        scopeType: calculation.scopeType,
        scopeId: calculation.scopeId,
        periodFrom: calculation.periodFrom.toISOString(),
        periodTo: calculation.periodTo.toISOString(),
      });
      return calculation;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  async findCalculations(query: CostCalculationQueryDto, ctx: ActiveOperationalContext) {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const where: any = { companyId: ctx.companyId, branchId: ctx.branchId, deletedAt: null };
    if (query.status) where.status = query.status;
    if (query.scopeType) where.scopeType = query.scopeType;
    if (query.productionOrderId) where.productionOrderId = query.productionOrderId;
    if (query.productionRunId) where.productionRunId = query.productionRunId;
    if (query.periodFrom || query.periodTo) {
      where.periodFrom = {};
      if (query.periodFrom) where.periodFrom.gte = new Date(query.periodFrom);
      if (query.periodTo) where.periodFrom.lte = new Date(query.periodTo);
    }
    const [data, total] = await Promise.all([
      (this.prisma as any).operationalCostCalculation.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: [{ createdAt: 'desc' }],
        include: OPERATIONAL_COST_CALCULATION_INCLUDE,
      }),
      (this.prisma as any).operationalCostCalculation.count({ where }),
    ]);
    return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async findOneCalculation(id: string, ctx: ActiveOperationalContext) {
    const calculation = await (this.prisma as any).operationalCostCalculation.findFirst({
      where: { id, companyId: ctx.companyId, branchId: ctx.branchId, deletedAt: null },
      include: OPERATIONAL_COST_CALCULATION_INCLUDE,
    });
    if (!calculation) throw this.notFound('productionCostCalculation.notFound');
    return calculation;
  }

  async attachTransactionToCalculation(id: string, dto: AttachTransactionToCalculationDto, userId: string, ctx: ActiveOperationalContext) {
    return this.prisma.$transaction(async (tx) => {
      const calculation = await tx.operationalCostCalculation.findFirst({
        where: { id, companyId: ctx.companyId, branchId: ctx.branchId, deletedAt: null },
      });
      if (!calculation) throw this.notFound('productionCostCalculation.notFound');
      if (calculation.status !== 'DRAFT') throw this.badRequest('productionCostCalculation.linkOnlyDraft');

      const transaction = await tx.operationalCostTransaction.findFirst({
        where: { id: dto.transactionId, companyId: ctx.companyId, branchId: ctx.branchId },
      });
      if (!transaction) throw this.notFound('productionCostTransaction.notFound');
      if (transaction.status !== 'POSTED') throw this.badRequest('productionCostCalculation.transactionNotPosted');
      if (transaction.calculationId) throw this.badRequest('productionCostCalculation.transactionAlreadyLinked');
      if (calculation.scopeType === 'ORDER' && transaction.productionOrderId !== calculation.scopeId) {
        throw this.badRequest('productionCostTransaction.calculationScopeMismatch');
      }
      if (calculation.scopeType === 'RUN' && transaction.productionRunId !== calculation.scopeId) {
        throw this.badRequest('productionCostTransaction.calculationScopeMismatch');
      }

      const updated = await tx.operationalCostTransaction.update({
        where: { id: transaction.id },
        data: { calculationId: calculation.id },
        include: OPERATIONAL_COST_TRANSACTION_INCLUDE,
      });
      await this.writeAudit(tx, userId, 'CALCULATION_LINK', OPERATIONAL_COST_CALCULATION_AUDIT_ENTITY, calculation.id, ctx, {
        transactionId: transaction.id,
        amount: transaction.amount.toString(),
      });
      return updated;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  async reviewCalculation(id: string, dto: ReviewCostCalculationDto, userId: string, ctx: ActiveOperationalContext) {
    return this.prisma.$transaction(async (tx) => {
      const calculation = await tx.operationalCostCalculation.findFirst({
        where: { id, companyId: ctx.companyId, branchId: ctx.branchId, deletedAt: null },
      });
      if (!calculation) throw this.notFound('productionCostCalculation.notFound');
      if (calculation.status !== 'DRAFT') throw this.badRequest('productionCostCalculation.reviewOnlyDraft');
      const updated = await tx.operationalCostCalculation.update({
        where: { id },
        data: { status: 'REVIEW', reviewedById: userId, reviewedAt: new Date(), notes: dto.reason ?? calculation.notes },
        include: OPERATIONAL_COST_CALCULATION_INCLUDE,
      });
      await this.writeAudit(tx, userId, 'CALCULATION_REVIEW', OPERATIONAL_COST_CALCULATION_AUDIT_ENTITY, id, ctx, {
        code: calculation.code,
        revision: calculation.revision,
      });
      return updated;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  async finalizeCalculation(id: string, dto: FinalizeCostCalculationDto, userId: string, ctx: ActiveOperationalContext) {
    return this.prisma.$transaction(async (tx) => {
      const calculation = await tx.operationalCostCalculation.findFirst({
        where: { id, companyId: ctx.companyId, branchId: ctx.branchId, deletedAt: null },
      });
      if (!calculation) throw this.notFound('productionCostCalculation.notFound');
      if (calculation.status !== 'REVIEW') throw this.badRequest('productionCostCalculation.finalizeOnlyReview');
      const linkedTransactions = await tx.operationalCostTransaction.count({
        where: { calculationId: id, companyId: ctx.companyId, branchId: ctx.branchId },
      });
      const updated = await tx.operationalCostCalculation.update({
        where: { id },
        data: { status: 'FINALIZED', finalizedById: userId, finalizedAt: new Date(), notes: dto.reason ?? calculation.notes },
        include: OPERATIONAL_COST_CALCULATION_INCLUDE,
      });
      await this.writeAudit(tx, userId, 'CALCULATION_FINALIZE', OPERATIONAL_COST_CALCULATION_AUDIT_ENTITY, id, ctx, {
        code: calculation.code,
        revision: calculation.revision,
        linkedTransactions,
      });
      return updated;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  /**
   * Reopen/recalculate a FINALIZED calculation: creates a new DRAFT revision of the
   * same code/scope with revision+1, preserving the finalized revision immutably.
   */
  async reopenCalculation(id: string, dto: ReopenCostCalculationDto, userId: string, ctx: ActiveOperationalContext) {
    return this.prisma.$transaction(async (tx) => {
      const previous = await tx.operationalCostCalculation.findFirst({
        where: { id, companyId: ctx.companyId, branchId: ctx.branchId, deletedAt: null },
      });
      if (!previous) throw this.notFound('productionCostCalculation.notFound');
      if (previous.status !== 'FINALIZED') throw this.badRequest('productionCostCalculation.reopenOnlyFinalized');

      const periodFrom = dto.periodFrom ? new Date(dto.periodFrom) : previous.periodFrom;
      const periodTo = dto.periodTo ? new Date(dto.periodTo) : previous.periodTo;
      if (periodTo < periodFrom) throw this.badRequest('productionCostCalculation.invalidPeriod');

      const reopened = await tx.operationalCostCalculation.create({
        data: {
          companyId: ctx.companyId,
          branchId: ctx.branchId,
          code: previous.code,
          revision: previous.revision + 1,
          scopeType: previous.scopeType,
          scopeId: previous.scopeId,
          productionOrderId: previous.productionOrderId,
          productionRunId: previous.productionRunId,
          periodFrom,
          periodTo,
          status: 'DRAFT',
          currencyCode: previous.currencyCode,
          supersedesId: previous.id,
          reason: dto.reason ?? `Reopened from ${previous.code} rev ${previous.revision}`,
          notes: dto.notes ?? previous.notes,
          createdById: userId,
        },
        include: OPERATIONAL_COST_CALCULATION_INCLUDE,
      });
      await this.writeAudit(tx, userId, 'CALCULATION_REOPEN', OPERATIONAL_COST_CALCULATION_AUDIT_ENTITY, reopened.id, ctx, {
        supersedesId: previous.id,
        code: reopened.code,
        revision: reopened.revision,
      });
      return reopened;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }
}
