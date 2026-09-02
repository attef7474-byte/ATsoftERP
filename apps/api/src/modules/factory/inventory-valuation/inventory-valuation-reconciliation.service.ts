import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { ActiveOperationalContext } from '../../../common/operational-context/operational-context.types';
import { INVENTORY_MUTATOR_COVERAGE } from './inventory-valuation.constants';
import { InventoryValuationReconciliationQueryDto } from './dto/reconciliation-query.dto';

export type ReconciliationSeverity = 'INFO' | 'WARNING' | 'ERROR';

export interface ValuationReconciliationIssue {
  issueType: string;
  severity: ReconciliationSeverity;
  scopeKey: string;
  warehouseId: string | null;
  warehouseCode: string | null;
  warehouseName: string | null;
  productId: string | null;
  productCode: string | null;
  productName: string | null;
  message: string;
}

export interface ValuationReconciliationData {
  companyId: string;
  branchId: string | null;
  policies: any[];
  physicalBalances: any[];
  valuationBalances: any[];
  initializations: any[];
  movements: any[];
  transfers: any[];
  finishedGoodsReceipts: any[];
  runSnapshots: any[];
}

const ZERO = new Prisma.Decimal(0);

function decimal(value: Prisma.Decimal.Value | null | undefined): Prisma.Decimal {
  return value == null ? ZERO : new Prisma.Decimal(value);
}

function upper(value: string | null | undefined): string {
  return value?.trim().toUpperCase() ?? '';
}

function scopeKey(warehouseId: string | null | undefined, productId: string | null | undefined): string {
  return `${warehouseId ?? '-'}:${productId ?? '-'}`;
}

function quartetState(line: any): 'EMPTY' | 'COMPLETE' | 'PARTIAL' {
  const values = [line.unitCost, line.totalCost, line.currencyCode, line.valuationMethod];
  const present = values.filter((value) => value !== null && value !== undefined).length;
  return present === 0 ? 'EMPTY' : present === values.length ? 'COMPLETE' : 'PARTIAL';
}

function lineQty(line: any): Prisma.Decimal {
  return decimal(line.quantityBase ?? line.quantity);
}

function lineFingerprint(line: any): string {
  const expiry = line.expiryDate ? new Date(line.expiryDate).toISOString() : '';
  return [
    line.productId,
    line.warehouseLocationId ?? '',
    line.batchNumber ?? '',
    line.serialNumber ?? '',
    expiry,
    line.unit ?? '',
    lineQty(line).toDecimalPlaces(4).toFixed(4),
  ].join('|');
}

function movementDate(movement: any): Date {
  return new Date(movement.postedAt ?? movement.createdAt);
}

function isMaintenanceMovement(movement: any): boolean {
  return movement.movementType?.startsWith('MAINTENANCE_') ||
    ['MAINTENANCE_PART_LINE', 'MAINTENANCE_WORK_ORDER'].includes(movement.sourceType);
}

function isProductionMaterialMovement(movement: any): boolean {
  return movement.sourceType === 'PRODUCTION_MATERIAL_DOCUMENT' ||
    movement.movementType?.startsWith('PRODUCTION_MATERIAL_');
}

function issueContext(data: ValuationReconciliationData, warehouseId: string | null, productId: string | null) {
  const policy = data.policies.find((candidate) => candidate.warehouseId === warehouseId);
  const physical = data.physicalBalances.find((candidate) => candidate.warehouseId === warehouseId && candidate.productId === productId);
  const monetary = data.valuationBalances.find((candidate) => candidate.warehouseId === warehouseId && candidate.productId === productId);
  const product = physical?.product ?? monetary?.product ?? null;
  const warehouse = policy?.warehouse ?? physical?.warehouse ?? monetary?.warehouse ?? null;
  return {
    warehouseCode: warehouse?.code ?? null,
    warehouseName: warehouse?.name ?? null,
    productCode: product?.code ?? null,
    productName: product?.name ?? null,
  };
}

export function evaluateValuationReconciliation(data: ValuationReconciliationData) {
  const issues: ValuationReconciliationIssue[] = [];
  const addIssue = (
    issueType: string,
    severity: ReconciliationSeverity,
    warehouseId: string | null,
    productId: string | null,
    message: string,
  ) => {
    const context = issueContext(data, warehouseId, productId);
    issues.push({
      issueType,
      severity,
      scopeKey: scopeKey(warehouseId, productId),
      warehouseId,
      warehouseCode: context.warehouseCode,
      warehouseName: context.warehouseName,
      productId,
      productCode: context.productCode,
      productName: context.productName,
      message,
    });
  };

  for (const policy of data.policies) {
    if (policy.companyId !== data.companyId || policy.warehouse?.companyId !== policy.companyId ||
        (policy.warehouse?.branchId && policy.warehouse.branchId !== data.branchId)) {
      addIssue('CROSS_TENANT_VALUATION_POLICY', 'ERROR', policy.warehouseId, null,
        'ACTIVE valuation policy ownership contradicts its warehouse or active tenant scope.');
    }
  }
  const tenantPolicies = data.policies.filter((policy) =>
    policy.companyId === data.companyId && policy.warehouse?.companyId === data.companyId &&
    (!policy.warehouse?.branchId || policy.warehouse.branchId === data.branchId));
  const policiesByWarehouse = new Map(tenantPolicies.map((policy) => [policy.warehouseId, policy]));
  const activeWarehouseIds = new Set(tenantPolicies.map((policy) => policy.warehouseId));
  const physicalByScope = new Map<string, any[]>();
  for (const row of data.physicalBalances) {
    const key = scopeKey(row.warehouseId, row.productId);
    physicalByScope.set(key, [...(physicalByScope.get(key) ?? []), row]);
  }
  const valuationsByScope = new Map<string, any[]>();
  for (const row of data.valuationBalances) {
    const key = scopeKey(row.warehouseId, row.productId);
    valuationsByScope.set(key, [...(valuationsByScope.get(key) ?? []), row]);
  }
  const initializationKeys = new Set(
    data.initializations.map((row) => scopeKey(row.warehouseId, row.productId)),
  );

  const candidateScopeKeys = new Set<string>();
  for (const key of physicalByScope.keys()) {
    const warehouseId = key.split(':')[0];
    if (activeWarehouseIds.has(warehouseId)) candidateScopeKeys.add(key);
  }
  for (const key of valuationsByScope.keys()) {
    const warehouseId = key.split(':')[0];
    if (activeWarehouseIds.has(warehouseId)) candidateScopeKeys.add(key);
  }

  for (const [key, rows] of valuationsByScope) {
    const sample = rows[0];
    const policy = policiesByWarehouse.get(sample.warehouseId);
    const tenantMismatch = sample.companyId !== data.companyId ||
      sample.warehouse?.companyId !== sample.companyId ||
      (sample.warehouse?.branchId && sample.warehouse.branchId !== data.branchId);
    if (tenantMismatch) {
      addIssue('CROSS_TENANT_VALUATION_SCOPE', 'ERROR', sample.warehouseId, sample.productId,
        'Valuation balance company or branch ownership contradicts its warehouse scope.');
    }
    if (!policy) {
      addIssue('ORPHAN_VALUATION_BALANCE', 'ERROR', sample.warehouseId, sample.productId,
        'Valuation balance has no ACTIVE valuation policy in the authorized scope.');
    }
    if (rows.length > 1) {
      addIssue('DUPLICATE_VALUATION_BALANCE', 'ERROR', sample.warehouseId, sample.productId,
        'More than one valuation balance exists for company, warehouse, and product.');
    }
  }

  for (const initialization of data.initializations) {
    const policy = policiesByWarehouse.get(initialization.warehouseId);
    const tenantMismatch = initialization.companyId !== data.companyId ||
      initialization.policyId !== policy?.id ||
      initialization.warehouse?.companyId !== initialization.companyId ||
      (initialization.warehouse?.branchId && initialization.warehouse.branchId !== data.branchId);
    if (tenantMismatch) {
      addIssue('CROSS_TENANT_VALUATION_INITIALIZATION', 'ERROR', initialization.warehouseId, initialization.productId,
        'Initialization evidence contradicts policy, company, or warehouse ownership.');
    }
    if (policy && upper(initialization.currencyCode) !== upper(policy.currencyCode)) {
      addIssue('ACTIVE_CURRENCY_MISMATCH', 'ERROR', initialization.warehouseId, initialization.productId,
        'Initialization currency differs from the ACTIVE valuation policy currency.');
    }
  }

  const scopeRows: any[] = [];
  for (const key of [...candidateScopeKeys].sort()) {
    const [warehouseId, productId] = key.split(':');
    const physicalRows = physicalByScope.get(key) ?? [];
    const valuationRows = valuationsByScope.get(key) ?? [];
    const valuation = valuationRows[0] ?? null;
    const policy = policiesByWarehouse.get(warehouseId);
    const physicalQuantity = physicalRows.reduce(
      (sum, row) => sum.plus(decimal(row.quantityBase)),
      ZERO,
    );
    const compatibilityQuantity = physicalRows.reduce(
      (sum, row) => sum.plus(decimal(row.quantity)),
      ZERO,
    );

    if (!physicalQuantity.eq(compatibilityQuantity) || physicalRows.some((row) => row.quantityBase == null)) {
      addIssue('PHYSICAL_QUANTITY_IDENTITY_DIVERGENCE', 'ERROR', warehouseId, productId,
        'Aggregated quantity differs from authoritative quantityBase under the current 1:1 UOM contract.');
    }
    if (physicalQuantity.isNegative()) {
      addIssue('NEGATIVE_PHYSICAL_STOCK', 'ERROR', warehouseId, productId,
        'Authoritative aggregated physical quantity is negative.');
    }
    if (physicalQuantity.gt(0) && !valuation) {
      addIssue('ACTIVE_PHYSICAL_WITHOUT_MONETARY_STATE', 'ERROR', warehouseId, productId,
        'Positive physical stock in an ACTIVE warehouse has no valuation balance.');
    }
    if (valuation) {
      const value = decimal(valuation.inventoryValue);
      const average = decimal(valuation.averageUnitCost);
      if (value.isNegative()) {
        addIssue('NEGATIVE_INVENTORY_VALUE', 'ERROR', warehouseId, productId,
          'Authoritative running inventory value is negative.');
      }
      if (average.isNegative()) {
        addIssue('NEGATIVE_AVERAGE_UNIT_COST', 'ERROR', warehouseId, productId,
          'Derived average unit cost is negative.');
      }
      if (physicalQuantity.isZero() && (!value.isZero() || !average.isZero())) {
        addIssue('ZERO_DEPLETION_MONETARY_RESIDUE', 'ERROR', warehouseId, productId,
          'Zero physical quantity retains non-zero inventory value or average unit cost.');
      }
      if (physicalQuantity.gt(0)) {
        const expectedAverage = value.dividedBy(physicalQuantity).toDecimalPlaces(8);
        if (!average.eq(expectedAverage)) {
          addIssue('AVERAGE_UNIT_COST_MISMATCH', 'ERROR', warehouseId, productId,
            'Average unit cost does not equal inventoryValue divided by physical quantity at 8 decimal places.');
        }
      }
    }

    const hasPreActivationPhysical = physicalRows.some((row) =>
      policy?.activatedAt && new Date(row.createdAt) < new Date(policy.activatedAt));
    if (physicalQuantity.gt(0) && hasPreActivationPhysical && !initializationKeys.has(key)) {
      addIssue('MISSING_REQUIRED_INITIALIZATION', 'ERROR', warehouseId, productId,
        'Physical stock predates activation but immutable initialization evidence is missing.');
    }

    scopeRows.push({
      scopeKey: key,
      warehouseId,
      productId,
      physicalQuantity: physicalQuantity.toFixed(4),
      inventoryValue: valuation ? decimal(valuation.inventoryValue).toFixed(4) : null,
      averageUnitCost: valuation ? decimal(valuation.averageUnitCost).toFixed(8) : null,
      currencyCode: policy?.currencyCode ?? null,
    });
  }

  const movementsById = new Map(data.movements.map((movement) => [movement.id, movement]));
  const maintenanceSourceCounts = new Map<string, number>();
  const productionMaterialSourceCounts = new Map<string, number>();
  for (const movement of data.movements) {
    const policy = policiesByWarehouse.get(movement.warehouseId);
    if (!policy || movement.status !== 'POSTED') continue;
    const isCurrent = !policy.activatedAt || movementDate(movement) >= new Date(policy.activatedAt);
    if (isCurrent && movement.sourceId && isMaintenanceMovement(movement)) {
      const key = `${movement.sourceType}:${movement.sourceId}`;
      maintenanceSourceCounts.set(key, (maintenanceSourceCounts.get(key) ?? 0) + 1);
    }
    if (isCurrent && movement.sourceId && isProductionMaterialMovement(movement)) {
      const key = `${movement.sourceType}:${movement.sourceId}`;
      productionMaterialSourceCounts.set(key, (productionMaterialSourceCounts.get(key) ?? 0) + 1);
    }
    if (movement.companyId !== data.companyId || movement.warehouse?.companyId !== movement.companyId ||
        (movement.branchId && movement.branchId !== data.branchId)) {
      for (const line of movement.lines ?? []) {
        addIssue('CROSS_TENANT_VALUATION_MOVEMENT', 'ERROR', movement.warehouseId, line.productId,
          'Valued movement ownership contradicts the active company, branch, or warehouse.');
      }
    }
    for (const line of movement.lines ?? []) {
      const state = quartetState(line);
      if (state === 'EMPTY') {
        addIssue(
          isCurrent ? 'CURRENT_ACTIVE_UNVALUED_MOVEMENT' : 'LEGACY_PRE_ACTIVE_UNVALUED_MOVEMENT',
          isCurrent ? 'ERROR' : 'INFO',
          movement.warehouseId,
          line.productId,
          isCurrent
            ? 'Posted movement after valuation activation has no monetary quartet.'
            : 'Quantity-only movement predates valuation activation and is retained as historical information.',
        );
      } else if (state === 'PARTIAL') {
        addIssue(
          isCurrent ? 'CURRENT_ACTIVE_INCOMPLETE_QUARTET' : 'LEGACY_PRE_ACTIVE_INCOMPLETE_QUARTET',
          isCurrent ? 'ERROR' : 'WARNING',
          movement.warehouseId,
          line.productId,
          'Movement monetary quartet is partially populated.',
        );
      } else {
        if (upper(line.currencyCode) !== upper(policy.currencyCode)) {
          addIssue('ACTIVE_CURRENCY_MISMATCH', 'ERROR', movement.warehouseId, line.productId,
            'Movement currency differs from the ACTIVE valuation policy currency.');
        }
        if (line.valuationMethod !== policy.method) {
          addIssue('ACTIVE_VALUATION_METHOD_MISMATCH', 'ERROR', movement.warehouseId, line.productId,
            'Movement valuation method differs from the ACTIVE valuation policy method.');
        }
      }
      if (isCurrent && state !== 'COMPLETE' && isMaintenanceMovement(movement)) {
        addIssue('MAINTENANCE_TWIN_SYNC_DEFECT', 'ERROR', movement.warehouseId, line.productId,
          'Maintenance physical movement does not carry its atomic monetary twin.');
      }
      if (isCurrent && state !== 'COMPLETE' && isProductionMaterialMovement(movement)) {
        addIssue('PRODUCTION_MATERIAL_TWIN_SYNC_DEFECT', 'ERROR', movement.warehouseId, line.productId,
          'Production material physical movement does not carry its atomic monetary twin.');
      }
    }
  }

  for (const [source, count] of maintenanceSourceCounts) {
    if (count > 1) {
      addIssue('MAINTENANCE_TWIN_SYNC_DEFECT', 'ERROR', null, null,
        `Maintenance source ${source} has ${count} posted inventory movements instead of one atomic twin.`);
    }
  }
  for (const [source, count] of productionMaterialSourceCounts) {
    if (count > 1) {
      addIssue('PRODUCTION_MATERIAL_TWIN_SYNC_DEFECT', 'ERROR', null, null,
        `Production material source ${source} has ${count} posted inventory movements instead of one atomic twin.`);
    }
  }

  for (const transfer of data.transfers) {
    const sourcePolicy = policiesByWarehouse.get(transfer.sourceWarehouseId);
    const destinationPolicy = policiesByWarehouse.get(transfer.destinationWarehouseId);
    if (!sourcePolicy && !destinationPolicy) continue;
    if (transfer.companyId !== data.companyId || (transfer.branchId && transfer.branchId !== data.branchId)) {
      addIssue('CROSS_TENANT_VALUATION_TRANSFER', 'ERROR', transfer.sourceWarehouseId, null,
        'Posted transfer ownership contradicts the active tenant context.');
    }
    const productIds = new Set<string>((transfer.lines ?? []).map((line: any) => line.productId));
    for (const productId of productIds) {
      const transferLines = (transfer.lines ?? []).filter((line: any) => line.productId === productId);
      const expected = transferLines
        .map((line: any) => line.transferTotalValue == null ? null : decimal(line.transferTotalValue).toFixed(4))
        .sort();
      const outMovement = movementsById.get(transferLines[0]?.transferOutMovementId);
      const inMovement = movementsById.get(transferLines[0]?.transferInMovementId);
      const outValues = (outMovement?.lines ?? [])
        .filter((line: any) => line.productId === productId && quartetState(line) === 'COMPLETE')
        .map((line: any) => decimal(line.totalCost).toFixed(4))
        .sort();
      const inValues = (inMovement?.lines ?? [])
        .filter((line: any) => line.productId === productId && quartetState(line) === 'COMPLETE')
        .map((line: any) => decimal(line.totalCost).toFixed(4))
        .sort();
      const conserved = expected.every((value: string | null) => value !== null) &&
        JSON.stringify(expected) === JSON.stringify(outValues) &&
        JSON.stringify(expected) === JSON.stringify(inValues);
      if (!conserved) {
        addIssue('TRANSFER_VALUE_GAIN_LOSS', 'ERROR', transfer.sourceWarehouseId, productId,
          'Source and destination transfer monetary evidence does not conserve the authoritative transfer value.');
      }
    }
  }

  const receiptsById = new Map(data.finishedGoodsReceipts.map((receipt) => [receipt.id, receipt]));
  const snapshotsByRun = new Map(data.runSnapshots.map((snapshot) => [snapshot.productionRunId, snapshot]));
  const receiptsByRun = new Map<string, any[]>();
  for (const receipt of data.finishedGoodsReceipts) {
    receiptsByRun.set(receipt.productionRunId, [...(receiptsByRun.get(receipt.productionRunId) ?? []), receipt]);
    if (receipt.companyId !== data.companyId || (receipt.branchId && receipt.branchId !== data.branchId) ||
        receipt.movement?.companyId !== receipt.companyId || receipt.movement?.warehouseId !== receipt.receiptWarehouseId) {
      addIssue('CROSS_TENANT_VALUATION_FINISHED_GOODS', 'ERROR', receipt.receiptWarehouseId, receipt.lines?.[0]?.productId ?? null,
        'Finished-goods receipt or its movement contradicts the tenant and warehouse scope.');
    }
    if (receipt.sourceType !== 'REVERSE' && !snapshotsByRun.has(receipt.productionRunId)) {
      addIssue('PRODUCTION_RUN_SNAPSHOT_MISSING', 'ERROR', receipt.receiptWarehouseId, receipt.lines?.[0]?.productId ?? null,
        'Posted finished-goods receipt has no immutable production-run cost snapshot.');
    }
    if (receipt.sourceType !== 'REVERSE') continue;
    const original = receiptsById.get(receipt.movement?.sourceId);
    let valid = !!original && original.sourceType !== 'REVERSE' && original.productionRunId === receipt.productionRunId;
    if (valid) {
      const originalByFingerprint = new Map<string, any[]>();
      for (const line of original!.movement?.lines ?? []) {
        const key = lineFingerprint(line);
        originalByFingerprint.set(key, [...(originalByFingerprint.get(key) ?? []), line]);
      }
      for (const line of receipt.movement?.lines ?? []) {
        const candidates = originalByFingerprint.get(lineFingerprint(line)) ?? [];
        const sourceLine = candidates.shift();
        originalByFingerprint.set(lineFingerprint(line), candidates);
        if (!sourceLine || quartetState(sourceLine) !== 'COMPLETE' || quartetState(line) !== 'COMPLETE' ||
            !decimal(sourceLine.unitCost).eq(decimal(line.unitCost)) || !decimal(sourceLine.totalCost).eq(decimal(line.totalCost))) {
          valid = false;
        }
      }
      if ([...originalByFingerprint.values()].some((lines) => lines.length !== 0)) valid = false;
      const reversalCount = data.finishedGoodsReceipts.filter((candidate) =>
        candidate.sourceType === 'REVERSE' && candidate.movement?.sourceId === original!.id).length;
      if (reversalCount > 1) valid = false;
    }
    if (!valid) {
      addIssue('FG_REVERSAL_INTEGRITY_DEFECT', 'ERROR', receipt.receiptWarehouseId, receipt.lines?.[0]?.productId ?? null,
        'Finished-goods reversal is orphaned, duplicated, or differs from original receipt evidence.');
    }
  }

  for (const snapshot of data.runSnapshots) {
    const receipts = receiptsByRun.get(snapshot.productionRunId) ?? [];
    let netQty = ZERO;
    let netValue = ZERO;
    for (const receipt of receipts) {
      const sign = receipt.sourceType === 'REVERSE' ? -1 : 1;
      for (const line of receipt.movement?.lines ?? []) {
        netQty = netQty.plus(lineQty(line).mul(sign));
        netValue = netValue.plus(decimal(line.totalCost).mul(sign));
      }
    }
    const frozenQty = decimal(snapshot.finalGoodQuantity);
    const frozenValue = decimal(snapshot.netMaterialValue);
    if (netQty.gt(frozenQty) || netValue.gt(frozenValue)) {
      addIssue('PRODUCTION_OVER_CAPITALIZED_RUN', 'ERROR', snapshot.productionRun?.receiptWarehouseId ?? null, snapshot.finalProductId,
        'Net finished-goods capitalization exceeds the immutable production-run snapshot.');
    }
    if (netQty.eq(frozenQty) && !netValue.eq(frozenValue)) {
      addIssue('PRODUCTION_COMPLETED_VALUE_MISMATCH', 'ERROR', snapshot.productionRun?.receiptWarehouseId ?? null, snapshot.finalProductId,
        'Completed finished-goods quantity does not carry the exact frozen run value.');
    }
  }

  const issuesByScope = new Map<string, ValuationReconciliationIssue[]>();
  for (const issue of issues) {
    issuesByScope.set(issue.scopeKey, [...(issuesByScope.get(issue.scopeKey) ?? []), issue]);
  }
  const scopes = scopeRows.map((row) => {
    const scopedIssues = issuesByScope.get(row.scopeKey) ?? [];
    const status = scopedIssues.some((issue) => issue.severity === 'ERROR')
      ? 'ERROR'
      : scopedIssues.some((issue) => issue.severity === 'WARNING')
        ? 'WARNING'
        : 'HEALTHY';
    return { ...row, status, issues: scopedIssues };
  });

  const issueCount = (type: string) => issues.filter((issue) => issue.issueType === type).length;
  const typeStarts = (prefix: string) => issues.filter((issue) => issue.issueType.startsWith(prefix)).length;
  const crossTenantCount = issues.filter((issue) => issue.issueType.startsWith('CROSS_TENANT_')).length;
  const unprotected = INVENTORY_MUTATOR_COVERAGE.filter((entry) =>
    !entry.classification.startsWith('VALUATION_AWARE_') && entry.classification !== 'BLOCKED_WHEN_ACTIVE');

  return {
    scopes,
    issues,
    summary: {
      scopesChecked: scopes.length,
      healthyScopes: scopes.filter((scope) => scope.status === 'HEALTHY').length,
      warningScopes: scopes.filter((scope) => scope.status === 'WARNING').length,
      defectScopes: scopes.filter((scope) => scope.status === 'ERROR').length,
      infoCount: issues.filter((issue) => issue.severity === 'INFO').length,
      warningCount: issues.filter((issue) => issue.severity === 'WARNING').length,
      currentActiveErrorCount: issues.filter((issue) => issue.severity === 'ERROR').length,
      currentActiveUnvaluedCount: issueCount('CURRENT_ACTIVE_UNVALUED_MOVEMENT') + issueCount('CURRENT_ACTIVE_INCOMPLETE_QUARTET'),
      legacyPreActiveUnvaluedCount: typeStarts('LEGACY_PRE_ACTIVE_'),
      activeCurrencyMismatchCount: issueCount('ACTIVE_CURRENCY_MISMATCH'),
      zeroDepletionMonetaryResidueCount: issueCount('ZERO_DEPLETION_MONETARY_RESIDUE'),
      transferValueGainLossCount: issueCount('TRANSFER_VALUE_GAIN_LOSS'),
      maintenanceTwinSyncDefectCount: issueCount('MAINTENANCE_TWIN_SYNC_DEFECT'),
      productionMaterialTwinSyncDefectCount: issueCount('PRODUCTION_MATERIAL_TWIN_SYNC_DEFECT'),
      productionOverCapitalizedRunCount: issueCount('PRODUCTION_OVER_CAPITALIZED_RUN'),
      productionCompletedValueMismatchCount: issueCount('PRODUCTION_COMPLETED_VALUE_MISMATCH'),
      fgReversalIntegrityDefectCount: issueCount('FG_REVERSAL_INTEGRITY_DEFECT'),
      crossTenantValuationDefectCount: crossTenantCount,
      physicalWithoutMonetaryActivePaths: 0,
      monetaryWithoutPhysicalActivePaths: 0,
      unprotectedActiveMutatorCount: unprotected.length,
    },
  };
}

@Injectable()
export class InventoryValuationReconciliationService {
  constructor(private readonly prisma: PrismaService) {}

  async reconcile(query: InventoryValuationReconciliationQueryDto, ctx: ActiveOperationalContext) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 50;
    const warehouseScope: any = {
      companyId: ctx.companyId,
      deletedAt: null,
      ...(ctx.branchId ? { OR: [{ branchId: ctx.branchId }, { branchId: null }] } : {}),
    };
    if (query.warehouseId) warehouseScope.id = query.warehouseId;

    const warehouses = await this.prisma.warehouse.findMany({
      where: warehouseScope,
      select: { id: true, companyId: true, branchId: true, code: true, name: true },
    });
    const authorizedWarehouseIds = warehouses.map((warehouse) => warehouse.id);
    if (authorizedWarehouseIds.length === 0) return this.emptyResult(page, limit);

    const policies = await this.prisma.inventoryValuationPolicy.findMany({
      where: {
        warehouseId: { in: authorizedWarehouseIds },
        status: 'ACTIVE',
        deletedAt: null,
      },
      include: { warehouse: { select: { id: true, companyId: true, branchId: true, code: true, name: true } } },
      orderBy: { warehouseId: 'asc' },
    });
    const activeWarehouseIds = policies
      .filter((policy) => policy.companyId === ctx.companyId && policy.warehouse.companyId === ctx.companyId)
      .map((policy) => policy.warehouseId);
    if (activeWarehouseIds.length === 0) {
      const evaluated = evaluateValuationReconciliation({
        companyId: ctx.companyId, branchId: ctx.branchId, policies, physicalBalances: [], valuationBalances: [],
        initializations: [], movements: [], transfers: [], finishedGoodsReceipts: [], runSnapshots: [],
      });
      const empty = this.emptyResult(page, limit);
      return { ...empty, issues: evaluated.issues, summary: evaluated.summary };
    }

    const productWhere = query.productId ? { productId: query.productId } : {};
    const [physicalBalances, valuationBalances, initializations, movements, transfers, finishedGoodsReceipts, runSnapshots] =
      await Promise.all([
        this.prisma.inventoryBalance.findMany({
          where: { warehouseId: { in: activeWarehouseIds }, ...productWhere },
          include: {
            warehouse: { select: { id: true, companyId: true, branchId: true, code: true, name: true } },
            product: { select: { id: true, code: true, name: true } },
          },
          orderBy: [{ warehouseId: 'asc' }, { productId: 'asc' }, { createdAt: 'asc' }],
        }),
        this.prisma.inventoryValuationBalance.findMany({
          where: {
            OR: [
              { companyId: ctx.companyId, warehouseId: { in: activeWarehouseIds } },
              { companyId: { not: ctx.companyId }, warehouseId: { in: activeWarehouseIds } },
            ],
            ...productWhere,
          },
          include: {
            warehouse: { select: { id: true, companyId: true, branchId: true, code: true, name: true } },
            product: { select: { id: true, code: true, name: true } },
          },
          orderBy: [{ warehouseId: 'asc' }, { productId: 'asc' }],
        }),
        this.prisma.inventoryValuationInitialization.findMany({
          where: {
            OR: [
              { companyId: ctx.companyId, warehouseId: { in: activeWarehouseIds } },
              { companyId: { not: ctx.companyId }, warehouseId: { in: activeWarehouseIds } },
            ],
            ...productWhere,
          },
          include: {
            warehouse: { select: { id: true, companyId: true, branchId: true, code: true, name: true } },
            product: { select: { id: true, code: true, name: true } },
          },
        }),
        this.prisma.inventoryMovement.findMany({
          where: {
            warehouseId: { in: activeWarehouseIds },
            status: 'POSTED',
            deletedAt: null,
            ...(query.productId ? { lines: { some: { productId: query.productId } } } : {}),
          },
          include: {
            warehouse: { select: { id: true, companyId: true, branchId: true, code: true, name: true } },
            lines: { where: productWhere, include: { product: { select: { id: true, code: true, name: true } } } },
          },
          orderBy: [{ postedAt: 'asc' }, { id: 'asc' }],
        }),
        this.prisma.inventoryStockTransfer.findMany({
          where: {
            companyId: ctx.companyId,
            ...(ctx.branchId ? { OR: [{ branchId: ctx.branchId }, { branchId: null }] } : {}),
            status: 'POSTED',
            deletedAt: null,
            AND: [{ OR: [{ sourceWarehouseId: { in: activeWarehouseIds } }, { destinationWarehouseId: { in: activeWarehouseIds } }] }],
            ...(query.productId ? { lines: { some: { productId: query.productId } } } : {}),
          },
          include: { lines: { where: productWhere } },
        }),
        this.prisma.productionFinishedGoodsReceipt.findMany({
          where: {
            companyId: ctx.companyId,
            branchId: ctx.branchId,
            receiptWarehouseId: { in: activeWarehouseIds },
            status: 'POSTED',
            ...(query.productId ? { lines: { some: { productId: query.productId } } } : {}),
          },
          include: {
            lines: { where: productWhere },
            movement: { include: { lines: { where: productWhere } } },
          },
          orderBy: [{ postedAt: 'asc' }, { id: 'asc' }],
        }),
        this.prisma.productionRunCostSnapshot.findMany({
          where: {
            companyId: ctx.companyId,
            branchId: ctx.branchId,
            ...(query.productId ? { finalProductId: query.productId } : {}),
            productionRun: { receiptWarehouseId: { in: activeWarehouseIds }, deletedAt: null },
          },
          include: { productionRun: { select: { id: true, receiptWarehouseId: true, status: true, costClosedAt: true } } },
        }),
      ]);

    const evaluated = evaluateValuationReconciliation({
      companyId: ctx.companyId,
      branchId: ctx.branchId,
      policies,
      physicalBalances,
      valuationBalances,
      initializations,
      movements,
      transfers,
      finishedGoodsReceipts,
      runSnapshots,
    });
    const total = evaluated.scopes.length;
    const start = (page - 1) * limit;
    return {
      data: evaluated.scopes.slice(start, start + limit),
      issues: evaluated.issues,
      summary: evaluated.summary,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
      contract: {
        physicalQuantityAuthority: 'AGGREGATED_INVENTORY_BALANCE_QUANTITY_BASE',
        monetaryStateAuthority: 'InventoryValuationBalance',
        runningValueAuthority: 'inventoryValue',
        averageUnitCostScale: 8,
        readOnly: true,
      },
    };
  }

  private emptyResult(page: number, limit: number) {
    return {
      data: [],
      issues: [],
      summary: {
        scopesChecked: 0,
        healthyScopes: 0,
        warningScopes: 0,
        defectScopes: 0,
        infoCount: 0,
        warningCount: 0,
        currentActiveErrorCount: 0,
        currentActiveUnvaluedCount: 0,
        legacyPreActiveUnvaluedCount: 0,
        activeCurrencyMismatchCount: 0,
        zeroDepletionMonetaryResidueCount: 0,
        transferValueGainLossCount: 0,
        maintenanceTwinSyncDefectCount: 0,
        productionMaterialTwinSyncDefectCount: 0,
        productionOverCapitalizedRunCount: 0,
        productionCompletedValueMismatchCount: 0,
        fgReversalIntegrityDefectCount: 0,
        crossTenantValuationDefectCount: 0,
        physicalWithoutMonetaryActivePaths: 0,
        monetaryWithoutPhysicalActivePaths: 0,
        unprotectedActiveMutatorCount: 0,
      },
      meta: { page, limit, total: 0, totalPages: 0 },
      contract: {
        physicalQuantityAuthority: 'AGGREGATED_INVENTORY_BALANCE_QUANTITY_BASE',
        monetaryStateAuthority: 'InventoryValuationBalance',
        runningValueAuthority: 'inventoryValue',
        averageUnitCostScale: 8,
        readOnly: true,
      },
    };
  }
}
