import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { ActiveOperationalContext } from '../../../common/operational-context/operational-context.types';
import {
  COST_NATURE_VALUES,
  COST_R2B_LABOR_MIGRATION,
  ENTRY_ROLE_PRIMARY_COST,
  ENTRY_ROLE_REVERSAL,
  LABOR_EVENT_TYPE,
  MAINTENANCE_LABOR_SOURCE_TYPE,
} from './production-cost.constants';
import { OperationalCostReconciliationQueryDto } from './dto/cost-reconciliation.dto';

type LedgerRow = {
  id: string;
  companyId: string;
  branchId: string;
  eventType: string;
  sourceType: string;
  sourceId: string;
  sourceLineId: string | null;
  costNature: string | null;
  costPurpose: string | null;
  entryRole: string | null;
  sourceFingerprint: string | null;
  clientRequestId: string;
  costCenterId: string | null;
  departmentId: string | null;
  maintenanceWorkOrderId: string | null;
  maintenanceRequestId: string | null;
  quantity: Prisma.Decimal;
  unit: string;
  rate: Prisma.Decimal;
  amount: Prisma.Decimal;
  currencyCode: string;
  occurredAt: Date;
  postedAt: Date | null;
  status: string;
  reversalOfId: string | null;
  reversedAt: Date | null;
  createdById: string;
};

type MaterialSourceRow = {
  id: string;
  totalCost: Prisma.Decimal | null;
  currencyCode: string | null;
  direction: string;
  movement: {
    companyId: string;
    branchId: string | null;
    movementType: string;
    status: string;
    postedAt: Date | null;
    createdAt: Date;
    cancelledAt: Date | null;
    reversesMovementId: string | null;
  } | null;
};

type DowntimeSourceRow = {
  id: string;
  durationMinutes: number | null;
  sourceType: string;
  endTime: Date | null;
  cancelledAt: Date | null;
  correctsLogId: string | null;
  machine: { companyId: string; branchId: string };
};

type MaintenanceLaborSourceRow = {
  id: string;
  amount: Prisma.Decimal;
  incurredAt: Date;
  workOrder: {
    id: string;
    companyId: string;
    branchId: string;
    status: string;
    completedAt: Date | null;
  };
};

type SourceChangeRow = {
  entityType: string;
  entityId: string;
};

const MATERIAL_SOURCE_TYPE = 'INVENTORY_MOVEMENT_LINE';
const DOWNTIME_SOURCE_TYPE = 'DOWNTIME';
const MATERIAL_EVENT_TYPE = 'MATERIAL';
const DOWNTIME_EVENT_TYPE = 'DOWNTIME';

/**
 * COST-R1C: System-wide READ-ONLY reconciliation audit of the Canonical Unified Cost
 * Ledger. This service DETECTS structural, arithmetic, currency, attribution and source
 * reconciliation defects across OperationalCostTransaction rows for the active tenant.
 *
 * It NEVER mutates: no create/update/delete/transaction write is ever invoked. Any ledger
 * defect discovered is reported, never repaired. The report carries `readOnly: true` and a
 * decision of ALL_CLEAN vs ISSUES_DETECTED.
 */
function fingerprintOf(sourceType: string, sourceId: string, eventType: string): string {
  return `${sourceType}:${sourceId}:${eventType}`;
}

@Injectable()
export class OperationalCostReconciliationService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Runs the full reconciliation audit for the active company/branch.
   * Returns a deterministic, read-only report.
   */
  async reconcile(query: OperationalCostReconciliationQueryDto, ctx: ActiveOperationalContext) {
    const where: any = { companyId: ctx.companyId, branchId: ctx.branchId };
    if (query.costNature) where.costNature = query.costNature;
    if (query.costPurpose) where.costPurpose = query.costPurpose;
    if (query.entryRole) where.entryRole = query.entryRole;
    if (query.sourceType) where.sourceType = query.sourceType;
    if (query.dateFrom || query.dateTo) {
      where.occurredAt = {};
      if (query.dateFrom) where.occurredAt.gte = new Date(query.dateFrom);
      if (query.dateTo) where.occurredAt.lte = new Date(query.dateTo);
    }

    const [
      rows,
      company,
      materialSourceRows,
      downtimeSourceRows,
      maintenanceLaborSourceRows,
      materialLineCount,
      downtimeEligibleCount,
      fgReceipts,
      costSnapshots,
      maintenanceSummaries,
      sourceChangeCount,
      sourceChangeRows,
      coverageBoundary,
      laborCoverageBoundary,
    ] = await Promise.all([
      (this.prisma as any).operationalCostTransaction.findMany({ where }),
      this.companyOperationalCurrency(ctx.companyId),
      (this.prisma as any).inventoryMovementLine.findMany({
        where: {
          movement: {
            companyId: ctx.companyId,
            OR: [{ branchId: ctx.branchId }, { branchId: null }],
          },
        },
        select: {
          id: true,
          totalCost: true,
          currencyCode: true,
          direction: true,
          movement: {
            select: {
              companyId: true,
              branchId: true,
              movementType: true,
              status: true,
              postedAt: true,
              createdAt: true,
              cancelledAt: true,
              reversesMovementId: true,
            },
          },
        },
      }),
      (this.prisma as any).downtimeLog.findMany({
        where: {
          machine: { companyId: ctx.companyId, branchId: ctx.branchId },
          sourceType: 'PRODUCTION',
          endTime: { not: null },
          cancelledAt: null,
          durationMinutes: { not: null },
        },
        select: {
          id: true,
          durationMinutes: true,
          sourceType: true,
          endTime: true,
          cancelledAt: true,
          correctsLogId: true,
          machine: { select: { companyId: true, branchId: true } },
        },
      }),
      (this.prisma as any).maintenanceWorkOrderCostEntry.findMany({
        where: {
          type: 'LABOR',
          amount: { gt: 0 },
          workOrder: {
            companyId: ctx.companyId,
            branchId: ctx.branchId,
            status: 'COMPLETED',
            deletedAt: null,
          },
        },
        select: {
          id: true,
          amount: true,
          incurredAt: true,
          workOrder: { select: { id: true, companyId: true, branchId: true, status: true, completedAt: true } },
        },
      }),
      (this.prisma as any).inventoryMovementLine.count({
        where: {
          movement: {
            companyId: ctx.companyId,
            OR: [{ branchId: ctx.branchId }, { branchId: null }],
          },
        },
      }),
      (this.prisma as any).downtimeLog.count({
        where: {
          machine: { companyId: ctx.companyId, branchId: ctx.branchId },
          sourceType: 'PRODUCTION',
          endTime: { not: null },
          cancelledAt: null,
          durationMinutes: { not: null },
        },
      }),
      this.countExcludedSource('productionFinishedGoodsReceipt', ctx),
      this.countExcludedSource('operationalStandardCostSnapshot', ctx),
      // Maintenance cost aggregation has no direct companyId; it is scoped via its
      // workOrder relation. These entries are authoritative summaries (no ledger
      // expense each in their own right) and are excluded, never double counted.
      (this.prisma as any).maintenanceWorkOrderCostEntry.count({
        where: { type: { not: 'LABOR' }, workOrder: { companyId: ctx.companyId, branchId: ctx.branchId } },
      }),
      (this.prisma as any).operationalSourceChange.count({
        where: { companyId: ctx.companyId, branchId: ctx.branchId },
      }),
      (this.prisma as any).operationalSourceChange.findMany({
        where: { companyId: ctx.companyId, branchId: ctx.branchId },
        select: { entityType: true, entityId: true },
      }),
      this.resolveLedgerCoverageBoundary(),
      this.resolveCoverageBoundary(COST_R2B_LABOR_MIGRATION),
    ]);

    const ledger = this.analyzeLedgerRows(rows as LedgerRow[]);
    const currency = this.analyzeCurrency(rows as LedgerRow[], company);
    const boundaryState =
      coverageBoundary.inferable && coverageBoundary.boundary
        ? coverageBoundary.boundary
        : null;
    const sources = this.analyzeSources(rows as LedgerRow[], {
      materialLineCount,
      downtimeEligibleCount,
      materialSources: materialSourceRows as MaterialSourceRow[],
      downtimeSources: downtimeSourceRows as DowntimeSourceRow[],
      maintenanceLaborSources: maintenanceLaborSourceRows as MaintenanceLaborSourceRow[],
      operationalCurrencyCode: company,
      sourceChanges: sourceChangeRows as SourceChangeRow[],
      coverageBoundary: boundaryState,
      coverageBoundaryInferable: coverageBoundary.inferable,
      laborCoverageBoundary: laborCoverageBoundary.boundary,
      laborCoverageBoundaryInferable: laborCoverageBoundary.inferable,
    });
    const exclusions = {
      finishedGoodsReceiptCount: fgReceipts,
      standardCostSnapshotCount: costSnapshots,
      maintenanceSummaryCount: maintenanceSummaries,
      sourceChangeCount,
      // These records are aggregation/master objects, never a ledger expense each in their own right.
      ledgerExpenseClassification: 'NONE' as const,
    };

    const defects = {
      invalidCanonicalRowCount: ledger.invalidRows,
      orphanReversal: ledger.structuralDefects.orphanReversal,
      reversalWithoutLink: ledger.structuralDefects.reversalWithoutLink,
      primaryWithReversalOf: ledger.structuralDefects.primaryWithReversalOf,
      duplicateReversalOfSameOriginal: ledger.structuralDefects.duplicateReversalOfSameOriginal,
      reversesReversal: ledger.structuralDefects.reversesReversal,
      liveDuplicateSourceFingerprint: ledger.structuralDefects.liveDuplicateSourceFingerprint,
      duplicateClientRequestId: ledger.structuralDefects.duplicateClientRequestId,
      valueMismatchReversal: ledger.structuralDefects.valueMismatchReversal,
      currencyMismatch: currency.mismatchCount,
      sourceIdempotencyViolation: sources.idempotencyViolations,
      doubleCountViolation: sources.doubleCountViolations,
      negativeInventorySource: sources.negativeSourceCount,
      crossTenantLedgerDefect: sources.crossTenantLedgerDefect,
      postedAttributionMutationPath: sources.postedAttributionMutationPath,
      doubleCountRiskUnknown: sources.doubleCountRiskUnknown,
      productionMaterialCurrentMissingLedger: sources.productionMaterialCurrentMissingLedger,
      productionMaterialCurrentDuplicateLedger: sources.productionMaterialCurrentDuplicateLedger,
      productionMaterialCurrentValueMismatch: sources.productionMaterialCurrentValueMismatch,
      productionMaterialCurrentCurrencyMismatch: sources.productionMaterialCurrentCurrencyMismatch,
      maintenanceMaterialCurrentMissingLedger: sources.maintenanceMaterialCurrentMissingLedger,
      maintenanceMaterialCurrentDuplicateLedger: sources.maintenanceMaterialCurrentDuplicateLedger,
      maintenanceMaterialCurrentValueMismatch: sources.maintenanceMaterialCurrentValueMismatch,
      productionReturnMissingReversal: sources.productionReturnMissingReversal,
      productionReturnExtraPrimary: sources.productionReturnExtraPrimary,
      productionReturnValueMismatch: sources.productionReturnValueMismatch,
      downtimeSourceMissing: sources.downtimeSourceMissing,
      downtimeAmountMismatch: sources.downtimeAmountMismatch,
      downtimeCurrencyMismatch: sources.downtimeCurrencyMismatch,
      maintenanceLaborCurrentMissingLedger: sources.maintenanceLaborCurrentMissingLedger,
      maintenanceLaborCurrentDuplicateLedger: sources.maintenanceLaborCurrentDuplicateLedger,
      maintenanceLaborCurrentValueMismatch: sources.maintenanceLaborCurrentValueMismatch,
      maintenanceLaborCurrentCurrencyMismatch: sources.maintenanceLaborCurrentCurrencyMismatch,
      maintenanceLaborOrphanReversal: sources.maintenanceLaborOrphanReversal,
      maintenanceLaborDoubleReversal: sources.maintenanceLaborDoubleReversal,
    };
    const totalDefects = Object.values(defects).reduce((a, b) => a + (b ?? 0), 0);
    const allCoverageBoundariesInferable = coverageBoundary.inferable && laborCoverageBoundary.inferable;

    return {
      meta: {
        generatedAt: new Date().toISOString(),
        companyId: ctx.companyId,
        branchId: ctx.branchId,
        operationalCurrencyCode: company,
        readOnly: true,
        coverageBoundaryInferable: coverageBoundary.inferable,
        coverageBoundaryAuthority: coverageBoundary.inferable
          ? 'runtime:_prisma_migrations'
          : 'NOT_INFERABLE',
        costR1bLedgerCoverageBoundary: coverageBoundary.boundary
          ? coverageBoundary.boundary.toISOString()
          : null,
        historicalLedgerBackfillCount: 0,
        costR2bLaborCoverageBoundary: laborCoverageBoundary.boundary
          ? laborCoverageBoundary.boundary.toISOString()
          : null,
        laborCoverageBoundaryInferable: laborCoverageBoundary.inferable,
        scope: query,
      },
      summary: {
        ledgersRowCount: ledger.totalRows,
        canonicalPrimaryCount: ledger.canonicalPrimary,
        canonicalReversalCount: ledger.canonicalReversal,
        legacyNonCanonicalCount: ledger.legacyNonCanonical,
        invalidRowCount: ledger.invalidRows,
        netMonetaryValue: ledger.netValue,
        reversalNetOffset: ledger.reversalNet,
        doubleCountGuard: sources.doubleCountViolations,
      },
      counts: {
        INVALID_LEDGER_ROW_COUNT: ledger.invalidRows,
        DUPLICATE_CANONICAL_SOURCE_COUNT: ledger.structuralDefects.liveDuplicateSourceFingerprint,
        ORPHAN_REVERSAL_COUNT: ledger.structuralDefects.orphanReversal,
        DOUBLE_REVERSAL_COUNT: ledger.structuralDefects.duplicateReversalOfSameOriginal,
        REVERSAL_VALUE_MISMATCH_COUNT: ledger.structuralDefects.valueMismatchReversal,
        PRODUCTION_MATERIAL_SOURCE_COUNT: sources.productionMaterialSourceCount,
        PRODUCTION_MATERIAL_LEDGER_COUNT: sources.productionMaterialLedgerCount,
        PRODUCTION_MATERIAL_MISSING_LEDGER_COUNT: sources.productionMaterialMissingLedger,
        PRODUCTION_MATERIAL_LEGACY_PRE_LEDGER_SOURCE_COUNT: sources.productionMaterialLegacyPreLedgerSourceCount,
        PRODUCTION_MATERIAL_CURRENT_SOURCE_COUNT: sources.productionMaterialCurrentSourceCount,
        PRODUCTION_MATERIAL_CURRENT_MISSING_LEDGER_COUNT: sources.productionMaterialCurrentMissingLedger,
        PRODUCTION_MATERIAL_CURRENT_DUPLICATE_LEDGER_COUNT: sources.productionMaterialCurrentDuplicateLedger,
        PRODUCTION_MATERIAL_CURRENT_VALUE_MISMATCH_COUNT: sources.productionMaterialCurrentValueMismatch,
        PRODUCTION_MATERIAL_DUPLICATE_LEDGER_COUNT: sources.productionMaterialDuplicateLedger,
        PRODUCTION_MATERIAL_VALUE_MISMATCH_COUNT: sources.productionMaterialValueMismatch,
        PRODUCTION_MATERIAL_CURRENCY_MISMATCH_COUNT: sources.productionMaterialCurrencyMismatch,
        PRODUCTION_RETURN_MISSING_REVERSAL_COUNT: sources.productionReturnMissingReversal,
        PRODUCTION_RETURN_EXTRA_PRIMARY_COUNT: sources.productionReturnExtraPrimary,
        PRODUCTION_RETURN_VALUE_MISMATCH_COUNT: sources.productionReturnValueMismatch,
        MAINTENANCE_MATERIAL_SOURCE_COUNT: sources.maintenanceMaterialSourceCount,
        MAINTENANCE_MATERIAL_LEDGER_COUNT: sources.maintenanceMaterialLedgerCount,
        MAINTENANCE_MATERIAL_MISSING_LEDGER_COUNT: sources.maintenanceMaterialMissingLedger,
        MAINTENANCE_MATERIAL_LEGACY_PRE_LEDGER_SOURCE_COUNT: sources.maintenanceMaterialLegacyPreLedgerSourceCount,
        MAINTENANCE_MATERIAL_CURRENT_SOURCE_COUNT: sources.maintenanceMaterialCurrentSourceCount,
        MAINTENANCE_MATERIAL_CURRENT_MISSING_LEDGER_COUNT: sources.maintenanceMaterialCurrentMissingLedger,
        MAINTENANCE_MATERIAL_CURRENT_DUPLICATE_LEDGER_COUNT: sources.maintenanceMaterialCurrentDuplicateLedger,
        MAINTENANCE_MATERIAL_CURRENT_VALUE_MISMATCH_COUNT: sources.maintenanceMaterialCurrentValueMismatch,
        MAINTENANCE_MATERIAL_DUPLICATE_LEDGER_COUNT: sources.maintenanceMaterialDuplicateLedger,
        MAINTENANCE_MATERIAL_VALUE_MISMATCH_COUNT: sources.maintenanceMaterialValueMismatch,
        MAINTENANCE_LABOR_SOURCE_COUNT: sources.maintenanceLaborSourceCount,
        MAINTENANCE_LABOR_LEGACY_PRE_LEDGER_SOURCE_COUNT: sources.maintenanceLaborLegacyPreLedgerSourceCount,
        MAINTENANCE_LABOR_CURRENT_SOURCE_COUNT: sources.maintenanceLaborCurrentSourceCount,
        MAINTENANCE_LABOR_LEDGER_COUNT: sources.maintenanceLaborLedgerCount,
        MAINTENANCE_LABOR_CURRENT_MISSING_LEDGER_COUNT: sources.maintenanceLaborCurrentMissingLedger,
        MAINTENANCE_LABOR_DUPLICATE_LEDGER_COUNT: sources.maintenanceLaborDuplicateLedger,
        MAINTENANCE_LABOR_VALUE_MISMATCH_COUNT: sources.maintenanceLaborValueMismatch,
        MAINTENANCE_LABOR_CURRENCY_MISMATCH_COUNT: sources.maintenanceLaborCurrencyMismatch,
        MAINTENANCE_LABOR_ORPHAN_REVERSAL_COUNT: sources.maintenanceLaborOrphanReversal,
        MAINTENANCE_LABOR_DOUBLE_REVERSAL_COUNT: sources.maintenanceLaborDoubleReversal,
        CURRENT_MAINTENANCE_LABOR_LEDGER_ERROR_COUNT: sources.currentMaintenanceLaborLedgerErrorCount,
        HISTORICAL_LABOR_BACKFILL_COUNT: 0,
        CURRENT_CANONICAL_LEDGER_ERROR_COUNT: totalDefects,
        DOWNTIME_LEDGER_COUNT: sources.downtimeLedgerPrimary,
        DOWNTIME_SOURCE_MISSING_COUNT: sources.downtimeSourceMissing,
        DOWNTIME_AMOUNT_MISMATCH_COUNT: sources.downtimeAmountMismatch,
        DOWNTIME_CURRENCY_MISMATCH_COUNT: sources.downtimeCurrencyMismatch,
        CANONICAL_CURRENCY_MISMATCH_COUNT: currency.mismatchCount,
        CROSS_TENANT_LEDGER_DEFECT_COUNT: sources.crossTenantLedgerDefect,
        POSTED_ATTRIBUTION_MUTATION_PATH_COUNT: sources.postedAttributionMutationPath,
        DOUBLE_COUNTED_COST_EVENT_COUNT: sources.doubleCountViolations,
        DOUBLE_COUNT_RISK_UNKNOWN_COUNT: sources.doubleCountRiskUnknown,
      },
      classification: ledger.classification,
      structuralDefects: defects,
      currencyIntegrity: {
        operationalCurrencyCode: company,
        rowsWithoutCurrency: currency.rowsWithoutCurrency,
        mismatchCount: currency.mismatchCount,
        mismatchedRows: currency.mismatchedRows,
      },
      sourceReconciliation: {
        material: {
          inventoryMovementLineCount: materialLineCount,
          ledgerPrimaryCount: sources.materialLedgerPrimary,
          productionSourceCount: sources.productionMaterialSourceCount,
          productionLedgerCount: sources.productionMaterialLedgerCount,
          productionMissingLedger: sources.productionMaterialMissingLedger,
          productionLegacyPreLedgerSourceCount: sources.productionMaterialLegacyPreLedgerSourceCount,
          productionCurrentSourceCount: sources.productionMaterialCurrentSourceCount,
          productionCurrentMissingLedger: sources.productionMaterialCurrentMissingLedger,
          productionCurrentDuplicateLedger: sources.productionMaterialCurrentDuplicateLedger,
          productionCurrentValueMismatch: sources.productionMaterialCurrentValueMismatch,
          productionDuplicateLedger: sources.productionMaterialDuplicateLedger,
          productionValueMismatch: sources.productionMaterialValueMismatch,
          productionCurrencyMismatch: sources.productionMaterialCurrencyMismatch,
          maintenanceSourceCount: sources.maintenanceMaterialSourceCount,
          maintenanceLedgerCount: sources.maintenanceMaterialLedgerCount,
          maintenanceMissingLedger: sources.maintenanceMaterialMissingLedger,
          maintenanceLegacyPreLedgerSourceCount: sources.maintenanceMaterialLegacyPreLedgerSourceCount,
          maintenanceCurrentSourceCount: sources.maintenanceMaterialCurrentSourceCount,
          maintenanceCurrentMissingLedger: sources.maintenanceMaterialCurrentMissingLedger,
          maintenanceCurrentDuplicateLedger: sources.maintenanceMaterialCurrentDuplicateLedger,
          maintenanceCurrentValueMismatch: sources.maintenanceMaterialCurrentValueMismatch,
          maintenanceDuplicateLedger: sources.maintenanceMaterialDuplicateLedger,
          maintenanceValueMismatch: sources.maintenanceMaterialValueMismatch,
          returnMissingReversal: sources.productionReturnMissingReversal,
          returnExtraPrimary: sources.productionReturnExtraPrimary,
          returnValueMismatch: sources.productionReturnValueMismatch,
        },
        downtime: {
          eligibleCount: downtimeEligibleCount,
          ledgerPrimaryCount: sources.downtimeLedgerPrimary,
          sourceMissing: sources.downtimeSourceMissing,
          amountMismatch: sources.downtimeAmountMismatch,
          currencyMismatch: sources.downtimeCurrencyMismatch,
        },
        maintenanceLabor: {
          sourceCount: sources.maintenanceLaborSourceCount,
          legacyPreLedgerSourceCount: sources.maintenanceLaborLegacyPreLedgerSourceCount,
          currentSourceCount: sources.maintenanceLaborCurrentSourceCount,
          ledgerCount: sources.maintenanceLaborLedgerCount,
          currentMissingLedger: sources.maintenanceLaborCurrentMissingLedger,
          duplicateLedger: sources.maintenanceLaborDuplicateLedger,
          valueMismatch: sources.maintenanceLaborValueMismatch,
          currencyMismatch: sources.maintenanceLaborCurrencyMismatch,
          orphanReversal: sources.maintenanceLaborOrphanReversal,
          doubleReversal: sources.maintenanceLaborDoubleReversal,
          historicalBackfillCount: 0,
        },
        idempotencyViolations: sources.idempotencyViolations,
        negativeSourceCount: sources.negativeSourceCount,
        crossTenantLedgerDefect: sources.crossTenantLedgerDefect,
        postedAttributionMutationPath: sources.postedAttributionMutationPath,
        doubleCountRiskUnknown: sources.doubleCountRiskUnknown,
      },
      exclusions,
      decision: {
        status: !allCoverageBoundariesInferable
          ? 'NOT_READY'
          : totalDefects === 0
            ? 'ALL_CLEAN'
            : 'ISSUES_DETECTED',
        totalDefectCount: totalDefects,
        coverageBoundaryInferable: allCoverageBoundariesInferable,
        readyToCloseCostR1C: allCoverageBoundariesInferable && totalDefects === 0,
        note: !allCoverageBoundariesInferable
          ? 'A canonical coverage boundary could not be inferred from runtime migration records. Sources cannot be proven legacy; reconciliation is NOT ready. No repair was performed.'
          : totalDefects === 0
            ? 'No current canonical ledger defects detected. Legacy pre-ledger sources are excluded from the error count; ledger reconciles to its authoritative sources.'
            : 'Current canonical ledger defects detected. Reconciliation reports only; no repair was performed.',
      },
    };
  }

  private async companyOperationalCurrency(companyId: string): Promise<string | null> {
    const company = await (this.prisma as any).company.findUnique({
      where: { id: companyId },
      select: { operationalCurrencyCode: true },
    });
    return company?.operationalCurrencyCode ?? null;
  }

  private async countExcludedSource(model: string, ctx: ActiveOperationalContext): Promise<number> {
    const client = this.prisma as any;
    if (!client[model]) return 0;
    return client[model].count({ where: { companyId: ctx.companyId } });
  }

  /**
   * Resolves the COST-R1B canonical ledger coverage boundary from the runtime
   * migration record. The boundary is the exact `finished_at` of the R1B
   * canonical-ledger foundation migration in `_prisma_migrations`, read at runtime
   * (never a hard-coded timestamp, never a deployment guess). A source is
   * LEGACY_PRE_LEDGER_SOURCE when posted strictly before this boundary, otherwise
   * CURRENT_CANONICAL_ELIGIBLE_SOURCE. If the exact migration record is missing,
   * failed/rolled back, or has a null `finished_at`, the boundary is NOT inferable
   * and no source may be silently classified as legacy.
   */
  private async resolveLedgerCoverageBoundary(): Promise<{
    inferable: boolean;
    boundary: Date | null;
  }> {
    const R1B_MIGRATION = '20260903000000_cost_r1b_canonical_ledger_foundation';
    return this.resolveCoverageBoundary(R1B_MIGRATION);
  }

  private async resolveCoverageBoundary(migrationName: string): Promise<{
    inferable: boolean;
    boundary: Date | null;
  }> {
    try {
      const raw: unknown = await (this.prisma as any).$queryRaw(
        Prisma.sql`SELECT finished_at, rolled_back_at, applied_steps_count
                   FROM _prisma_migrations
                   WHERE migration_name = ${migrationName}`,
      );
      const row = (Array.isArray(raw) ? raw[0] : raw) as
        | { finished_at: Date | string | null; rolled_back_at: Date | string | null }
        | undefined;
      if (!row) return { inferable: false, boundary: null };
      if (row.rolled_back_at) return { inferable: false, boundary: null };
      if (row.finished_at == null) return { inferable: false, boundary: null };
      const finished = new Date(row.finished_at);
      if (Number.isNaN(finished.getTime())) return { inferable: false, boundary: null };
      return { inferable: true, boundary: finished };
    } catch {
      return { inferable: false, boundary: null };
    }
  }

  private analyzeLedgerRows(rows: LedgerRow[]) {
    const classification: Record<string, number> = {};
    let canonicalPrimary = 0;
    let canonicalReversal = 0;
    let legacyNonCanonical = 0;
    let invalidRows = 0;
    let netValue = new Prisma.Decimal(0);
    let reversalNet = new Prisma.Decimal(0);

    const structuralDefects = {
      orphanReversal: 0,
      reversalWithoutLink: 0,
      primaryWithReversalOf: 0,
      duplicateReversalOfSameOriginal: 0,
      reversesReversal: 0,
      liveDuplicateSourceFingerprint: 0,
      duplicateClientRequestId: 0,
      valueMismatchReversal: 0,
    };

    const byId = new Map<string, LedgerRow>();
    for (const r of rows) byId.set(r.id, r);

    const reversalGroups = new Map<string, number>();
    const sourceFpCount = new Map<string, number>();
    const clientReqCount = new Map<string, number>();

    for (const r of rows) {
      const role = r.entryRole;
      const nature = r.costNature;
      const isCanonicalRole = role === ENTRY_ROLE_PRIMARY_COST || role === ENTRY_ROLE_REVERSAL;
      const isValidCanonicalRow = isCanonicalRole
        && nature != null
        && (COST_NATURE_VALUES as readonly string[]).includes(nature as any);

      // Classification buckets
      const key = `entryRole:${role ?? 'LEGACY_NULL'};costNature:${nature ?? (isCanonicalRole ? 'MISSING' : 'LEGACY')}`;
      classification[key] = (classification[key] ?? 0) + 1;
      if (role === ENTRY_ROLE_PRIMARY_COST && isValidCanonicalRow) canonicalPrimary++;
      else if (role === ENTRY_ROLE_REVERSAL && isValidCanonicalRow) canonicalReversal++;
      else if (role === null) legacyNonCanonical++;
      else invalidRows++;

      // Arithmetic: only canonical-role rows (PRIMARY_COST / REVERSAL) contribute to the
      // net ledger position, mirroring the unified ledger totals. Legacy and invalid rows
      // are reported as counts but never summed into net value (they would double-count).
      const amount = r.amount;
      if (isCanonicalRole) {
        netValue = netValue.add(amount);
        if (role === ENTRY_ROLE_REVERSAL) reversalNet = reversalNet.add(amount);
      }

      // Structural defect detection
      if (role === ENTRY_ROLE_REVERSAL) {
        if (r.reversalOfId == null) structuralDefects.reversalWithoutLink++;
        else {
          const original = byId.get(r.reversalOfId);
          if (!original) structuralDefects.orphanReversal++;
          else if (original.entryRole === ENTRY_ROLE_REVERSAL) structuralDefects.reversesReversal++;
          else if (original.entryRole === ENTRY_ROLE_PRIMARY_COST) {
            // value-mismatch: reversal should exactly negate the original
            const absMismatch = amount.add(original.amount).abs().gt(new Prisma.Decimal('0.0001'));
            if (absMismatch) structuralDefects.valueMismatchReversal++;
          }
        }
        reversalGroups.set(r.reversalOfId ?? `no-link:${r.id}`, (reversalGroups.get(r.reversalOfId ?? `no-link:${r.id}`) ?? 0) + 1);
      } else if (role === ENTRY_ROLE_PRIMARY_COST) {
        if (r.reversalOfId != null) structuralDefects.primaryWithReversalOf++;
      }

      // Double-count guard: a live POSTED, not-reversed PRIMARY_COST is the authoritative
      // valuation of a source. More than one live PRIMARY_COST carrying the same source
      // fingerprint is a double count (mirrors the filtered unique index contract).
      if (role === ENTRY_ROLE_PRIMARY_COST && r.sourceFingerprint && r.status === 'POSTED' && !r.reversedAt) {
        sourceFpCount.set(r.sourceFingerprint, (sourceFpCount.get(r.sourceFingerprint) ?? 0) + 1);
      }
      clientReqCount.set(`${r.companyId}:${r.branchId}:${r.clientRequestId}`, (clientReqCount.get(`${r.companyId}:${r.branchId}:${r.clientRequestId}`) ?? 0) + 1);
    }

    for (const v of reversalGroups.values()) if (v > 1) structuralDefects.duplicateReversalOfSameOriginal += v - 1;
    for (const v of sourceFpCount.values()) if (v > 1) structuralDefects.liveDuplicateSourceFingerprint += v - 1;
    for (const v of clientReqCount.values()) if (v > 1) structuralDefects.duplicateClientRequestId += v - 1;

    return {
      totalRows: rows.length,
      canonicalPrimary,
      canonicalReversal,
      legacyNonCanonical,
      invalidRows,
      netValue: netValue.toString(),
      reversalNet: reversalNet.toString(),
      classification,
      structuralDefects,
    };
  }

  private analyzeCurrency(rows: LedgerRow[], operationalCurrencyCode: string | null) {
    let rowsWithoutCurrency = 0;
    const mismatchedRows: string[] = [];
    let mismatchCount = 0;
    for (const r of rows) {
      if (!r.currencyCode) rowsWithoutCurrency++;
      if (r.entryRole === ENTRY_ROLE_PRIMARY_COST && operationalCurrencyCode && r.currencyCode !== operationalCurrencyCode) {
        mismatchCount++;
        mismatchedRows.push(r.id);
      }
    }
    return { rowsWithoutCurrency, mismatchCount, mismatchedRows };
  }

  private analyzeSources(
    rows: LedgerRow[],
    opts: {
      materialLineCount: number;
      downtimeEligibleCount: number;
      materialSources: MaterialSourceRow[];
      downtimeSources: DowntimeSourceRow[];
      maintenanceLaborSources: MaintenanceLaborSourceRow[];
      operationalCurrencyCode: string | null;
      sourceChanges: SourceChangeRow[];
      coverageBoundary: Date | null;
      coverageBoundaryInferable: boolean;
      laborCoverageBoundary: Date | null;
      laborCoverageBoundaryInferable: boolean;
    },
  ) {
    let materialLedgerPrimary = 0;
    let downtimeLedgerPrimary = 0;
    let idempotencyViolations = 0;
    let doubleCountViolations = 0;
    let negativeSourceCount = 0;
    let crossTenantLedgerDefect = 0;
    let postedAttributionMutationPath = 0;
    let doubleCountRiskUnknown = 0;

    const sourceCount = new Map<string, number>();
    const livePrimaries: LedgerRow[] = [];
    for (const r of rows) {
      if (r.entryRole !== ENTRY_ROLE_PRIMARY_COST) continue;
      if (r.status === 'POSTED') livePrimaries.push(r);
      if (r.sourceType === MATERIAL_SOURCE_TYPE) materialLedgerPrimary++;
      if (r.sourceType === DOWNTIME_SOURCE_TYPE || r.sourceType === 'DOWNTIME_EVENT') downtimeLedgerPrimary++;
      if (r.sourceFingerprint) {
        sourceCount.set(r.sourceFingerprint, (sourceCount.get(r.sourceFingerprint) ?? 0) + 1);
      }
      if (r.amount.lt(0)) negativeSourceCount++;
    }
    for (const v of sourceCount.values()) {
      if (v > 1) {
        idempotencyViolations += v;
        doubleCountViolations += v;
      }
    }

    // ── Cross-tenant ledger defect ────────────────────────────────────────────────
    // Every ledger PRIMARY_COST that references a real operational source must point
    // to an authoritative source owned by the SAME tenant (company/branch). If a
    // ledger row's source does not resolve to the active tenant, it is a cross-tenant
    // defect. Because all rows here were already tenant-scoped by companyId/branchId,
    // we additionally verify the resolved source owner matches the row, so a row that
    // claims tenant A but points at a source owned by tenant B is caught.
    const materialSourceByFingerprint = new Map<string, MaterialSourceRow>();
    for (const s of opts.materialSources) {
      materialSourceByFingerprint.set(fingerprintOf(MATERIAL_SOURCE_TYPE, s.id, MATERIAL_EVENT_TYPE), s);
    }
    const downtimeSourceByFingerprint = new Map<string, DowntimeSourceRow>();
    for (const s of opts.downtimeSources) {
      downtimeSourceByFingerprint.set(fingerprintOf(DOWNTIME_SOURCE_TYPE, s.id, DOWNTIME_EVENT_TYPE), s);
    }
    const laborSourceByFingerprint = new Map<string, MaintenanceLaborSourceRow>();
    for (const s of opts.maintenanceLaborSources) {
      laborSourceByFingerprint.set(fingerprintOf(MAINTENANCE_LABOR_SOURCE_TYPE, s.id, LABOR_EVENT_TYPE), s);
    }

    // ── Attribution mutation path ─────────────────────────────────────────────────
    // A ledger row whose authoritative source was subsequently corrected/re-validated
    // (recorded in OperationalSourceChange) is on a posted-attribution mutation path.
    const mutatedEntities = new Set<string>();
    for (const c of opts.sourceChanges) mutatedEntities.add(`${c.entityType}:${c.entityId}`);

    // ── Production / maintenance / return material reconciliation ────────────────
    // A source is a LEGACY_PRE_LEDGER_SOURCE when it was posted strictly before the
    // COST-R1B canonical ledger coverage boundary (read at runtime from
    // `_prisma_migrations`). Legacy sources existed before the canonical ledger did
    // and are informational only — they must NOT surface as current-eligible ledger
    // defects. When the boundary is not inferable, no source may be proven legacy,
    // so every source is conservatively treated as CURRENT_CANONICAL_ELIGIBLE_SOURCE.
    const classifyPreLedger = (posted: Date | null): boolean => {
      if (!opts.coverageBoundaryInferable) return false;
      if (posted == null) return false;
      return posted < opts.coverageBoundary!;
    };
    let productionMaterialSourceCount = 0;
    let productionMaterialLedgerCount = 0;
    let productionMaterialMissingLedger = 0;
    let productionMaterialLegacyPreLedgerSourceCount = 0;
    let productionMaterialCurrentSourceCount = 0;
    let productionMaterialCurrentMissingLedger = 0;
    let productionMaterialCurrentDuplicateLedger = 0;
    let productionMaterialCurrentValueMismatch = 0;
    let productionMaterialCurrentCurrencyMismatch = 0;
    let productionMaterialDuplicateLedger = 0;
    let productionMaterialValueMismatch = 0;
    let productionMaterialCurrencyMismatch = 0;
    let maintenanceMaterialSourceCount = 0;
    let maintenanceMaterialLedgerCount = 0;
    let maintenanceMaterialMissingLedger = 0;
    let maintenanceMaterialLegacyPreLedgerSourceCount = 0;
    let maintenanceMaterialCurrentSourceCount = 0;
    let maintenanceMaterialCurrentMissingLedger = 0;
    let maintenanceMaterialCurrentDuplicateLedger = 0;
    let maintenanceMaterialCurrentValueMismatch = 0;
    let maintenanceMaterialDuplicateLedger = 0;
    let maintenanceMaterialValueMismatch = 0;
    let productionReturnMissingReversal = 0;
    let productionReturnExtraPrimary = 0;
    let productionReturnValueMismatch = 0;

    // Ledger material primaries grouped by fingerprint (live POSTED only).
    const matPrimariesByFp = new Map<string, LedgerRow[]>();
    const materialLedgerPrimaryRows = livePrimaries.filter((r) => r.sourceType === MATERIAL_SOURCE_TYPE);
    for (const r of materialLedgerPrimaryRows) {
      const fp = r.sourceFingerprint;
      if (!fp) {
        doubleCountRiskUnknown++;
        continue;
      }
      const group = matPrimariesByFp.get(fp) ?? [];
      group.push(r);
      matPrimariesByFp.set(fp, group);
    }

    for (const line of opts.materialSources) {
      if (!line.movement) continue;
      if (line.movement.status !== 'POSTED') continue;
      if (line.movement.cancelledAt) continue;
      if (line.totalCost == null) continue;
      const isReturn = line.direction === 'IN' || Boolean(line.movement.reversesMovementId);
      if (isReturn) continue;

      const fp = fingerprintOf(MATERIAL_SOURCE_TYPE, line.id, MATERIAL_EVENT_TYPE);
      const primaries = matPrimariesByFp.get(fp) ?? [];
      const ledgerPurpose = primaries[0]?.costPurpose ?? null;
      const isProduction = ledgerPurpose === 'PRODUCTION' || (line.movement.movementType ?? '').toUpperCase().includes('PRODUCTION');
      const isMaintenance = !isProduction && (ledgerPurpose === 'MAINTENANCE' || /MAINTENANCE|MAINTENANCE/gi.test(line.movement.movementType ?? ''));
      const postedMoment = line.movement.postedAt ?? line.movement.createdAt ?? null;
      const isLegacyPreLedger = classifyPreLedger(postedMoment);

      if (isProduction) {
        productionMaterialSourceCount++;
        if (isLegacyPreLedger) productionMaterialLegacyPreLedgerSourceCount++;
        else productionMaterialCurrentSourceCount++;
        if (primaries.length === 0) {
          productionMaterialMissingLedger++;
          if (!isLegacyPreLedger) productionMaterialCurrentMissingLedger++;
        }
        if (primaries.length > 1) {
          const dup = primaries.length - 1;
          productionMaterialDuplicateLedger += dup;
          if (!isLegacyPreLedger) productionMaterialCurrentDuplicateLedger += dup;
        }
        if (primaries.length === 1) {
          productionMaterialLedgerCount++;
          const primary = primaries[0];
          const isMismatch = !primary.amount.eq(line.totalCost!);
          if (isMismatch) {
            productionMaterialValueMismatch++;
            if (!isLegacyPreLedger) productionMaterialCurrentValueMismatch++;
          }
          const sourceCurrency = line.currencyCode ?? opts.operationalCurrencyCode ?? primary.currencyCode;
          if (sourceCurrency && primary.currencyCode !== sourceCurrency) {
            productionMaterialCurrencyMismatch++;
            if (!isLegacyPreLedger) productionMaterialCurrentCurrencyMismatch++;
          }
        }
      } else if (isMaintenance) {
        maintenanceMaterialSourceCount++;
        if (isLegacyPreLedger) maintenanceMaterialLegacyPreLedgerSourceCount++;
        else maintenanceMaterialCurrentSourceCount++;
        if (primaries.length === 0) {
          maintenanceMaterialMissingLedger++;
          if (!isLegacyPreLedger) maintenanceMaterialCurrentMissingLedger++;
        }
        if (primaries.length > 1) {
          const dup = primaries.length - 1;
          maintenanceMaterialDuplicateLedger += dup;
          if (!isLegacyPreLedger) maintenanceMaterialCurrentDuplicateLedger += dup;
        }
        if (primaries.length === 1) {
          maintenanceMaterialLedgerCount++;
          const primary = primaries[0];
          if (!primary.amount.eq(line.totalCost!)) {
            maintenanceMaterialValueMismatch++;
            if (!isLegacyPreLedger) maintenanceMaterialCurrentValueMismatch++;
          }
        }
      }
    }

    // Production material RETURN reconciliation: the original issue PRIMARY_COST must
    // be reversed by a linked REVERSAL. A return with no reversal is a missing
    // reversal; a return that leaves an extra live primary is an extra primary.
    const primaryById = new Map<string, LedgerRow>();
    for (const r of rows) if (r.entryRole === ENTRY_ROLE_PRIMARY_COST) primaryById.set(r.id, r);
    const reversalByPrimary = new Map<string, LedgerRow[]>();
    for (const r of rows) {
      if (r.entryRole === ENTRY_ROLE_REVERSAL && r.reversalOfId) {
        const group = reversalByPrimary.get(r.reversalOfId) ?? [];
        group.push(r);
        reversalByPrimary.set(r.reversalOfId, group);
      }
    }
    for (const line of opts.materialSources) {
      if (!line.movement || line.movement.status !== 'POSTED') continue;
      if (line.movement.cancelledAt) continue;
      const isReturn = line.direction === 'IN' || Boolean(line.movement.reversesMovementId);
      if (!isReturn) continue;
      // A return references the original issue line; reconcile that its original
      // PRIMARY_COST was actually reversed by a linked REVERSAL.
      const returnLedger = materialLedgerPrimaryRows.find((r) => r.sourceLineId === line.id || r.sourceId === line.id);
      const originalPrimary = returnLedger && primaryById.get(returnLedger.id);
      if (originalPrimary) {
        const reversals = reversalByPrimary.get(originalPrimary.id) ?? [];
        if (reversals.length === 0) {
          productionReturnMissingReversal++;
        }
        if (returnLedger.status === 'POSTED' && !returnLedger.reversedAt) productionReturnExtraPrimary++;
        for (const rev of reversals) {
          // A return reversal must exactly offset the original PRIMARY_COST amount.
          if (!rev.amount.add(originalPrimary.amount).abs().lte(new Prisma.Decimal('0.0001'))) {
            productionReturnValueMismatch++;
          }
        }
      } else if (returnLedger) {
        productionReturnMissingReversal++;
      }
    }

    // ── Downtime reconciliation ───────────────────────────────────────────────────
    let downtimeSourceMissing = 0;
    let downtimeAmountMismatch = 0;
    let downtimeCurrencyMismatch = 0;
    const downtimePrimariesByFp = new Map<string, LedgerRow[]>();
    for (const r of livePrimaries) {
      if (r.sourceType !== DOWNTIME_SOURCE_TYPE) continue;
      if (!r.sourceFingerprint) continue;
      const group = downtimePrimariesByFp.get(r.sourceFingerprint) ?? [];
      group.push(r);
      downtimePrimariesByFp.set(r.sourceFingerprint, group);
    }
    for (const log of opts.downtimeSources) {
      const fp = fingerprintOf(DOWNTIME_SOURCE_TYPE, log.id, DOWNTIME_EVENT_TYPE);
      const primaries = downtimePrimariesByFp.get(fp) ?? [];
      if (primaries.length === 0) {
        downtimeSourceMissing++;
        continue;
      }
      if (primaries.length > 1) doubleCountViolations += primaries.length - 1;
      const primary = primaries[0];
      const expectedAmount = log.durationMinutes != null && primary.rate
        ? primary.rate.mul(new Prisma.Decimal(String(log.durationMinutes)))
        : null;
      if (expectedAmount != null && !primary.amount.eq(expectedAmount)) downtimeAmountMismatch++;
      if (opts.operationalCurrencyCode && primary.currencyCode !== opts.operationalCurrencyCode) downtimeCurrencyMismatch++;
    }

    // ── Manual asserted maintenance labor reconciliation ─────────────────────────
    // The source amount is authoritative. Work-order actualCost and maintenance
    // request summaries are deliberately absent from this projection.
    const classifyPreLaborLedger = (completedAt: Date | null): boolean => {
      if (!opts.laborCoverageBoundaryInferable || !opts.laborCoverageBoundary || !completedAt) return false;
      return completedAt < opts.laborCoverageBoundary;
    };
    let maintenanceLaborSourceCount = 0;
    let maintenanceLaborLegacyPreLedgerSourceCount = 0;
    let maintenanceLaborCurrentSourceCount = 0;
    let maintenanceLaborLedgerCount = 0;
    let maintenanceLaborCurrentMissingLedger = 0;
    let maintenanceLaborDuplicateLedger = 0;
    let maintenanceLaborCurrentDuplicateLedger = 0;
    let maintenanceLaborValueMismatch = 0;
    let maintenanceLaborCurrentValueMismatch = 0;
    let maintenanceLaborCurrencyMismatch = 0;
    let maintenanceLaborCurrentCurrencyMismatch = 0;
    let maintenanceLaborOrphanReversal = 0;
    let maintenanceLaborDoubleReversal = 0;

    const laborPrimariesByFp = new Map<string, LedgerRow[]>();
    for (const r of rows) {
      if (r.entryRole !== ENTRY_ROLE_PRIMARY_COST || r.sourceType !== MAINTENANCE_LABOR_SOURCE_TYPE) continue;
      if (!r.sourceFingerprint) {
        doubleCountRiskUnknown++;
        continue;
      }
      const group = laborPrimariesByFp.get(r.sourceFingerprint) ?? [];
      group.push(r);
      laborPrimariesByFp.set(r.sourceFingerprint, group);
    }

    for (const source of opts.maintenanceLaborSources) {
      maintenanceLaborSourceCount++;
      const historical = classifyPreLaborLedger(source.workOrder.completedAt);
      if (historical) maintenanceLaborLegacyPreLedgerSourceCount++;
      else maintenanceLaborCurrentSourceCount++;
      const fp = fingerprintOf(MAINTENANCE_LABOR_SOURCE_TYPE, source.id, LABOR_EVENT_TYPE);
      const primaries = laborPrimariesByFp.get(fp) ?? [];
      if (primaries.length === 0) {
        if (!historical) maintenanceLaborCurrentMissingLedger++;
        continue;
      }
      maintenanceLaborLedgerCount += primaries.length;
      if (primaries.length > 1) {
        const duplicates = primaries.length - 1;
        maintenanceLaborDuplicateLedger += duplicates;
        if (!historical) maintenanceLaborCurrentDuplicateLedger += duplicates;
      }
      for (const primary of primaries) {
        if (!primary.amount.eq(source.amount)) {
          maintenanceLaborValueMismatch++;
          if (!historical) maintenanceLaborCurrentValueMismatch++;
        }
        if (opts.operationalCurrencyCode && primary.currencyCode !== opts.operationalCurrencyCode) {
          maintenanceLaborCurrencyMismatch++;
          if (!historical) maintenanceLaborCurrentCurrencyMismatch++;
        }
      }
    }

    const laborOriginalIds = new Set(
      rows
        .filter((r) => r.entryRole === ENTRY_ROLE_PRIMARY_COST && r.sourceType === MAINTENANCE_LABOR_SOURCE_TYPE)
        .map((r) => r.id),
    );
    const laborReversalGroups = new Map<string, number>();
    for (const r of rows) {
      if (r.entryRole !== ENTRY_ROLE_REVERSAL || r.sourceType !== MAINTENANCE_LABOR_SOURCE_TYPE) continue;
      if (!r.reversalOfId || !laborOriginalIds.has(r.reversalOfId)) maintenanceLaborOrphanReversal++;
      if (r.reversalOfId) {
        laborReversalGroups.set(r.reversalOfId, (laborReversalGroups.get(r.reversalOfId) ?? 0) + 1);
      }
    }
    for (const count of laborReversalGroups.values()) {
      if (count > 1) maintenanceLaborDoubleReversal += count - 1;
    }
    const currentMaintenanceLaborLedgerErrorCount =
      maintenanceLaborCurrentMissingLedger
      + maintenanceLaborCurrentDuplicateLedger
      + maintenanceLaborCurrentValueMismatch
      + maintenanceLaborCurrentCurrencyMismatch
      + maintenanceLaborOrphanReversal
      + maintenanceLaborDoubleReversal;

    // ── Cross-tenant resolution for material/downtime/labor primaries ─────────────
    for (const fp of sourceCount.keys()) {
      const isMaterial = materialSourceByFingerprint.has(fp);
      const isDowntime = downtimeSourceByFingerprint.has(fp);
      const isLabor = laborSourceByFingerprint.has(fp);
      if (!isMaterial && !isDowntime && !isLabor) {
        // A live fingerprint that maps to no known authoritative source of the active
        // tenant is either a cross-tenant reference or an unresolvable source.
        doubleCountRiskUnknown++;
      }
    }
    for (const r of materialLedgerPrimaryRows) {
      if (!r.sourceFingerprint) continue;
      const src = materialSourceByFingerprint.get(r.sourceFingerprint);
      if (!src) {
        crossTenantLedgerDefect++;
        continue;
      }
      if (src.movement && src.movement.companyId !== r.companyId) crossTenantLedgerDefect++;
      const key = `${MATERIAL_SOURCE_TYPE}:${r.sourceId}`;
      if (mutatedEntities.has(key)) postedAttributionMutationPath++;
    }
    for (const r of livePrimaries) {
      if (r.sourceType === DOWNTIME_SOURCE_TYPE && r.sourceFingerprint) {
        const src = downtimeSourceByFingerprint.get(r.sourceFingerprint);
        if (!src) {
          crossTenantLedgerDefect++;
        } else if (src.machine.companyId !== r.companyId) {
          crossTenantLedgerDefect++;
        }
        const key = `${DOWNTIME_SOURCE_TYPE}:${r.sourceId}`;
        if (mutatedEntities.has(key)) postedAttributionMutationPath++;
      }
      if (r.sourceType === MAINTENANCE_LABOR_SOURCE_TYPE && r.sourceFingerprint) {
        const src = laborSourceByFingerprint.get(r.sourceFingerprint);
        if (!src || src.workOrder.companyId !== r.companyId || src.workOrder.branchId !== r.branchId) {
          crossTenantLedgerDefect++;
        }
        const key = `${MAINTENANCE_LABOR_SOURCE_TYPE}:${r.sourceId}`;
        if (mutatedEntities.has(key)) postedAttributionMutationPath++;
      }
    }

    return {
      materialLedgerPrimary,
      downtimeLedgerPrimary,
      idempotencyViolations,
      doubleCountViolations,
      negativeSourceCount,
      crossTenantLedgerDefect,
      postedAttributionMutationPath,
      doubleCountRiskUnknown,
      productionMaterialSourceCount,
      productionMaterialLedgerCount,
      productionMaterialMissingLedger,
      productionMaterialLegacyPreLedgerSourceCount,
      productionMaterialCurrentSourceCount,
      productionMaterialCurrentMissingLedger,
      productionMaterialCurrentDuplicateLedger,
      productionMaterialCurrentValueMismatch,
      productionMaterialCurrentCurrencyMismatch,
      productionMaterialDuplicateLedger,
      productionMaterialValueMismatch,
      productionMaterialCurrencyMismatch,
      maintenanceMaterialSourceCount,
      maintenanceMaterialLedgerCount,
      maintenanceMaterialMissingLedger,
      maintenanceMaterialLegacyPreLedgerSourceCount,
      maintenanceMaterialCurrentSourceCount,
      maintenanceMaterialCurrentMissingLedger,
      maintenanceMaterialCurrentDuplicateLedger,
      maintenanceMaterialCurrentValueMismatch,
      maintenanceMaterialDuplicateLedger,
      maintenanceMaterialValueMismatch,
      productionReturnMissingReversal,
      productionReturnExtraPrimary,
      productionReturnValueMismatch,
      downtimeSourceMissing,
      downtimeAmountMismatch,
      downtimeCurrencyMismatch,
      maintenanceLaborSourceCount,
      maintenanceLaborLegacyPreLedgerSourceCount,
      maintenanceLaborCurrentSourceCount,
      maintenanceLaborLedgerCount,
      maintenanceLaborCurrentMissingLedger,
      maintenanceLaborDuplicateLedger,
      maintenanceLaborCurrentDuplicateLedger,
      maintenanceLaborValueMismatch,
      maintenanceLaborCurrentValueMismatch,
      maintenanceLaborCurrencyMismatch,
      maintenanceLaborCurrentCurrencyMismatch,
      maintenanceLaborOrphanReversal,
      maintenanceLaborDoubleReversal,
      currentMaintenanceLaborLedgerErrorCount,
    };
  }
}
