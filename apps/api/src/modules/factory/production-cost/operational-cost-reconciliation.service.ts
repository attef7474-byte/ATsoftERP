import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { ActiveOperationalContext } from '../../../common/operational-context/operational-context.types';
import {
  COST_NATURE_VALUES,
  ENTRY_ROLE_PRIMARY_COST,
  ENTRY_ROLE_REVERSAL,
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
      materialLineCount,
      downtimeEligibleCount,
      fgReceipts,
      costSnapshots,
      maintenanceSummaries,
      sourceChangeCount,
      sourceChangeRows,
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
        where: { workOrder: { companyId: ctx.companyId, branchId: ctx.branchId } },
      }),
      (this.prisma as any).operationalSourceChange.count({
        where: { companyId: ctx.companyId, branchId: ctx.branchId },
      }),
      (this.prisma as any).operationalSourceChange.findMany({
        where: { companyId: ctx.companyId, branchId: ctx.branchId },
        select: { entityType: true, entityId: true },
      }),
    ]);

    const ledger = this.analyzeLedgerRows(rows as LedgerRow[]);
    const currency = this.analyzeCurrency(rows as LedgerRow[], company);
    const sources = this.analyzeSources(rows as LedgerRow[], {
      materialLineCount,
      downtimeEligibleCount,
      materialSources: materialSourceRows as MaterialSourceRow[],
      downtimeSources: downtimeSourceRows as DowntimeSourceRow[],
      operationalCurrencyCode: company,
      sourceChanges: sourceChangeRows as SourceChangeRow[],
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
      productionMaterialMissingLedger: sources.productionMaterialMissingLedger,
      productionMaterialDuplicateLedger: sources.productionMaterialDuplicateLedger,
      productionMaterialValueMismatch: sources.productionMaterialValueMismatch,
      productionMaterialCurrencyMismatch: sources.productionMaterialCurrencyMismatch,
      maintenanceMaterialMissingLedger: sources.maintenanceMaterialMissingLedger,
      maintenanceMaterialDuplicateLedger: sources.maintenanceMaterialDuplicateLedger,
      maintenanceMaterialValueMismatch: sources.maintenanceMaterialValueMismatch,
      productionReturnMissingReversal: sources.productionReturnMissingReversal,
      productionReturnExtraPrimary: sources.productionReturnExtraPrimary,
      productionReturnValueMismatch: sources.productionReturnValueMismatch,
      downtimeSourceMissing: sources.downtimeSourceMissing,
      downtimeAmountMismatch: sources.downtimeAmountMismatch,
      downtimeCurrencyMismatch: sources.downtimeCurrencyMismatch,
    };
    const totalDefects = Object.values(defects).reduce((a, b) => a + (b ?? 0), 0);

    return {
      meta: {
        generatedAt: new Date().toISOString(),
        companyId: ctx.companyId,
        branchId: ctx.branchId,
        operationalCurrencyCode: company,
        readOnly: true,
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
        PRODUCTION_MATERIAL_DUPLICATE_LEDGER_COUNT: sources.productionMaterialDuplicateLedger,
        PRODUCTION_MATERIAL_VALUE_MISMATCH_COUNT: sources.productionMaterialValueMismatch,
        PRODUCTION_MATERIAL_CURRENCY_MISMATCH_COUNT: sources.productionMaterialCurrencyMismatch,
        PRODUCTION_RETURN_MISSING_REVERSAL_COUNT: sources.productionReturnMissingReversal,
        PRODUCTION_RETURN_EXTRA_PRIMARY_COUNT: sources.productionReturnExtraPrimary,
        PRODUCTION_RETURN_VALUE_MISMATCH_COUNT: sources.productionReturnValueMismatch,
        MAINTENANCE_MATERIAL_SOURCE_COUNT: sources.maintenanceMaterialSourceCount,
        MAINTENANCE_MATERIAL_LEDGER_COUNT: sources.maintenanceMaterialLedgerCount,
        MAINTENANCE_MATERIAL_MISSING_LEDGER_COUNT: sources.maintenanceMaterialMissingLedger,
        MAINTENANCE_MATERIAL_DUPLICATE_LEDGER_COUNT: sources.maintenanceMaterialDuplicateLedger,
        MAINTENANCE_MATERIAL_VALUE_MISMATCH_COUNT: sources.maintenanceMaterialValueMismatch,
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
          productionDuplicateLedger: sources.productionMaterialDuplicateLedger,
          productionValueMismatch: sources.productionMaterialValueMismatch,
          productionCurrencyMismatch: sources.productionMaterialCurrencyMismatch,
          maintenanceSourceCount: sources.maintenanceMaterialSourceCount,
          maintenanceLedgerCount: sources.maintenanceMaterialLedgerCount,
          maintenanceMissingLedger: sources.maintenanceMaterialMissingLedger,
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
        idempotencyViolations: sources.idempotencyViolations,
        negativeSourceCount: sources.negativeSourceCount,
        crossTenantLedgerDefect: sources.crossTenantLedgerDefect,
        postedAttributionMutationPath: sources.postedAttributionMutationPath,
        doubleCountRiskUnknown: sources.doubleCountRiskUnknown,
      },
      exclusions,
      decision: {
        status: totalDefects === 0 ? 'ALL_CLEAN' : 'ISSUES_DETECTED',
        totalDefectCount: totalDefects,
        note: totalDefects === 0
          ? 'No ledger defects detected. Ledger is internally consistent and reconciles to its authoritative sources.'
          : 'Ledger defects detected. Reconciliation reports only; no repair was performed.',
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
      operationalCurrencyCode: string | null;
      sourceChanges: SourceChangeRow[];
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

    // ── Attribution mutation path ─────────────────────────────────────────────────
    // A ledger row whose authoritative source was subsequently corrected/re-validated
    // (recorded in OperationalSourceChange) is on a posted-attribution mutation path.
    const mutatedEntities = new Set<string>();
    for (const c of opts.sourceChanges) mutatedEntities.add(`${c.entityType}:${c.entityId}`);

    // ── Production / maintenance / return material reconciliation ────────────────
    let productionMaterialSourceCount = 0;
    let productionMaterialLedgerCount = 0;
    let productionMaterialMissingLedger = 0;
    let productionMaterialDuplicateLedger = 0;
    let productionMaterialValueMismatch = 0;
    let productionMaterialCurrencyMismatch = 0;
    let maintenanceMaterialSourceCount = 0;
    let maintenanceMaterialLedgerCount = 0;
    let maintenanceMaterialMissingLedger = 0;
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

      if (isProduction) {
        productionMaterialSourceCount++;
        if (primaries.length === 0) productionMaterialMissingLedger++;
        if (primaries.length > 1) productionMaterialDuplicateLedger += primaries.length - 1;
        if (primaries.length === 1) {
          productionMaterialLedgerCount++;
          const primary = primaries[0];
          const isMismatch = !primary.amount.eq(line.totalCost!);
          if (isMismatch) productionMaterialValueMismatch++;
          const sourceCurrency = line.currencyCode ?? opts.operationalCurrencyCode ?? primary.currencyCode;
          if (sourceCurrency && primary.currencyCode !== sourceCurrency) productionMaterialCurrencyMismatch++;
        }
      } else if (isMaintenance) {
        maintenanceMaterialSourceCount++;
        if (primaries.length === 0) maintenanceMaterialMissingLedger++;
        if (primaries.length > 1) maintenanceMaterialDuplicateLedger += primaries.length - 1;
        if (primaries.length === 1) {
          maintenanceMaterialLedgerCount++;
          const primary = primaries[0];
          if (!primary.amount.eq(line.totalCost!)) maintenanceMaterialValueMismatch++;
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

    // ── Cross-tenant resolution for material/downtime primaries ───────────────────
    for (const fp of sourceCount.keys()) {
      const isMaterial = materialSourceByFingerprint.has(fp);
      const isDowntime = downtimeSourceByFingerprint.has(fp);
      if (!isMaterial && !isDowntime) {
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
      productionMaterialDuplicateLedger,
      productionMaterialValueMismatch,
      productionMaterialCurrencyMismatch,
      maintenanceMaterialSourceCount,
      maintenanceMaterialLedgerCount,
      maintenanceMaterialMissingLedger,
      maintenanceMaterialDuplicateLedger,
      maintenanceMaterialValueMismatch,
      productionReturnMissingReversal,
      productionReturnExtraPrimary,
      productionReturnValueMismatch,
      downtimeSourceMissing,
      downtimeAmountMismatch,
      downtimeCurrencyMismatch,
    };
  }
}
