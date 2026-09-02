import { Prisma } from '@prisma/client';
import { InventoryValuationController } from './inventory-valuation.controller';
import {
  evaluateValuationReconciliation,
  ValuationReconciliationData,
  InventoryValuationReconciliationService,
} from './inventory-valuation-reconciliation.service';
import { INVENTORY_VALUATION_PERMISSION_KEYS } from './inventory-valuation.constants';

const activatedAt = new Date('2026-09-01T00:00:00.000Z');

function policy(overrides: any = {}) {
  return {
    id: 'POL-1', companyId: 'C1', warehouseId: 'W1', method: 'WEIGHTED_AVERAGE',
    currencyCode: 'USD', status: 'ACTIVE', activatedAt,
    warehouse: { id: 'W1', companyId: 'C1', branchId: 'B1', code: 'WH-1', name: 'Warehouse 1' },
    ...overrides,
  };
}

function physical(quantityBase: string | null, quantity?: number, overrides: any = {}) {
  return {
    id: 'PB-1', warehouseId: 'W1', productId: 'P1', quantityBase,
    quantity: quantity ?? Number(quantityBase ?? 0), createdAt: new Date('2026-09-02T00:00:00.000Z'),
    warehouse: { id: 'W1', companyId: 'C1', branchId: 'B1', code: 'WH-1', name: 'Warehouse 1' },
    product: { id: 'P1', code: 'P-1', name: 'Product 1' }, ...overrides,
  };
}

function valuation(value: string, average: string, overrides: any = {}) {
  return {
    id: 'VB-1', companyId: 'C1', warehouseId: 'W1', productId: 'P1',
    inventoryValue: new Prisma.Decimal(value), averageUnitCost: new Prisma.Decimal(average),
    warehouse: { id: 'W1', companyId: 'C1', branchId: 'B1', code: 'WH-1', name: 'Warehouse 1' },
    product: { id: 'P1', code: 'P-1', name: 'Product 1' }, ...overrides,
  };
}

function valuedLine(overrides: any = {}) {
  return {
    id: 'ML-1', productId: 'P1', quantity: 10, quantityBase: new Prisma.Decimal(10), direction: 'OUT',
    unitCost: new Prisma.Decimal(10), totalCost: new Prisma.Decimal(100), currencyCode: 'USD',
    valuationMethod: 'WEIGHTED_AVERAGE', warehouseLocationId: null, batchNumber: null,
    serialNumber: null, expiryDate: null, unit: 'EA', ...overrides,
  };
}

function movement(lines: any[], overrides: any = {}) {
  return {
    id: 'M1', companyId: 'C1', branchId: 'B1', warehouseId: 'W1', status: 'POSTED',
    movementType: 'ISSUE', sourceType: null, sourceId: null, postedAt: new Date('2026-09-02T00:00:00.000Z'),
    createdAt: new Date('2026-09-02T00:00:00.000Z'), lines,
    warehouse: { id: 'W1', companyId: 'C1', branchId: 'B1', code: 'WH-1', name: 'Warehouse 1' },
    ...overrides,
  };
}

function data(overrides: Partial<ValuationReconciliationData> = {}): ValuationReconciliationData {
  return {
    companyId: 'C1', branchId: 'B1', policies: [policy()], physicalBalances: [], valuationBalances: [],
    initializations: [], movements: [], transfers: [], finishedGoodsReceipts: [], runSnapshots: [],
    ...overrides,
  };
}

function types(result: ReturnType<typeof evaluateValuationReconciliation>) {
  return result.issues.map((issue) => issue.issueType);
}

describe('VAL-R1H valuation reconciliation', () => {
  it('1 healthy empty ACTIVE policy scope has no error', () => {
    const result = evaluateValuationReconciliation(data());
    expect(result.summary.currentActiveErrorCount).toBe(0);
    expect(result.summary.scopesChecked).toBe(0);
  });

  it('2 healthy positive physical and monetary state passes', () => {
    const result = evaluateValuationReconciliation(data({
      physicalBalances: [physical('100')], valuationBalances: [valuation('1000', '10')],
    }));
    expect(result.summary.currentActiveErrorCount).toBe(0);
    expect(result.summary.healthyScopes).toBe(1);
  });

  it('3 aggregates multiple InventoryBalance rows by quantityBase', () => {
    const result = evaluateValuationReconciliation(data({
      physicalBalances: [physical('40', 40), physical('60', 60, { id: 'PB-2' })],
      valuationBalances: [valuation('1000', '10')],
    }));
    expect(result.scopes[0].physicalQuantity).toBe('100.0000');
    expect(result.summary.currentActiveErrorCount).toBe(0);
  });

  it('4 detects quantity and quantityBase identity divergence', () => {
    const result = evaluateValuationReconciliation(data({
      physicalBalances: [physical('9', 10)], valuationBalances: [valuation('90', '10')],
    }));
    expect(types(result)).toContain('PHYSICAL_QUANTITY_IDENTITY_DIVERGENCE');
  });

  it('5 accepts zero quantity with exact zero value and average', () => {
    const result = evaluateValuationReconciliation(data({
      physicalBalances: [physical('0')], valuationBalances: [valuation('0', '0')],
    }));
    expect(result.summary.zeroDepletionMonetaryResidueCount).toBe(0);
  });

  it('6 detects zero quantity with monetary residue', () => {
    const result = evaluateValuationReconciliation(data({
      physicalBalances: [physical('0')], valuationBalances: [valuation('0.0001', '0')],
    }));
    expect(result.summary.zeroDepletionMonetaryResidueCount).toBe(1);
  });

  it('7 detects negative authoritative physical stock', () => {
    const result = evaluateValuationReconciliation(data({
      physicalBalances: [physical('-1')], valuationBalances: [valuation('0', '0')],
    }));
    expect(types(result)).toContain('NEGATIVE_PHYSICAL_STOCK');
  });

  it('8 detects negative running inventory value', () => {
    const result = evaluateValuationReconciliation(data({
      physicalBalances: [physical('1')], valuationBalances: [valuation('-1', '0')],
    }));
    expect(types(result)).toContain('NEGATIVE_INVENTORY_VALUE');
  });

  it('9 detects a negative average unit cost', () => {
    const result = evaluateValuationReconciliation(data({
      physicalBalances: [physical('1')], valuationBalances: [valuation('1', '-1')],
    }));
    expect(types(result)).toContain('NEGATIVE_AVERAGE_UNIT_COST');
  });

  it('10 applies canonical 8-decimal average rounding', () => {
    const result = evaluateValuationReconciliation(data({
      physicalBalances: [physical('3')], valuationBalances: [valuation('1', '0.33333333')],
    }));
    expect(types(result)).not.toContain('AVERAGE_UNIT_COST_MISMATCH');
  });

  it('11 detects average inconsistency without replacing running value authority', () => {
    const result = evaluateValuationReconciliation(data({
      physicalBalances: [physical('3')], valuationBalances: [valuation('1', '0.33333334')],
    }));
    expect(types(result)).toContain('AVERAGE_UNIT_COST_MISMATCH');
  });

  it('12 classifies all-null pre-activation movement evidence as INFO', () => {
    const result = evaluateValuationReconciliation(data({ movements: [movement([valuedLine({
      unitCost: null, totalCost: null, currencyCode: null, valuationMethod: null,
    })], { postedAt: new Date('2026-08-31T00:00:00.000Z') })] }));
    expect(types(result)).toContain('LEGACY_PRE_ACTIVE_UNVALUED_MOVEMENT');
    expect(result.issues.find((issue) => issue.issueType === 'LEGACY_PRE_ACTIVE_UNVALUED_MOVEMENT')?.severity).toBe('INFO');
  });

  it('13 classifies all-null post-activation movement evidence as ERROR', () => {
    const result = evaluateValuationReconciliation(data({ movements: [movement([valuedLine({
      unitCost: null, totalCost: null, currencyCode: null, valuationMethod: null,
    })])] }));
    expect(result.summary.currentActiveUnvaluedCount).toBe(1);
  });

  it('14 detects a partially populated monetary quartet', () => {
    const result = evaluateValuationReconciliation(data({ movements: [movement([valuedLine({
      totalCost: null,
    })])] }));
    expect(types(result)).toContain('CURRENT_ACTIVE_INCOMPLETE_QUARTET');
  });

  it('15 detects movement currency mismatch against ACTIVE policy', () => {
    const result = evaluateValuationReconciliation(data({ movements: [movement([valuedLine({ currencyCode: 'EUR' })])] }));
    expect(result.summary.activeCurrencyMismatchCount).toBe(1);
  });

  it('16 detects initialization currency mismatch', () => {
    const result = evaluateValuationReconciliation(data({ initializations: [{
      id: 'I1', companyId: 'C1', warehouseId: 'W1', productId: 'P1', policyId: 'POL-1', currencyCode: 'EUR',
      warehouse: { companyId: 'C1', branchId: 'B1' },
    }] }));
    expect(result.summary.activeCurrencyMismatchCount).toBe(1);
  });

  it('17 detects positive active physical stock without valuation balance', () => {
    const result = evaluateValuationReconciliation(data({ physicalBalances: [physical('10')] }));
    expect(types(result)).toContain('ACTIVE_PHYSICAL_WITHOUT_MONETARY_STATE');
  });

  it('18 detects a valuation balance without an ACTIVE policy', () => {
    const result = evaluateValuationReconciliation(data({ policies: [], valuationBalances: [valuation('10', '10')] }));
    expect(types(result)).toContain('ORPHAN_VALUATION_BALANCE');
  });

  it('19 detects duplicate balances even though the database unique guard prevents them', () => {
    const result = evaluateValuationReconciliation(data({
      physicalBalances: [physical('1')],
      valuationBalances: [valuation('10', '10'), valuation('10', '10', { id: 'VB-2' })],
    }));
    expect(types(result)).toContain('DUPLICATE_VALUATION_BALANCE');
  });

  it('20 proves transfer value conservation from the one authoritative transfer value', () => {
    const out = movement([valuedLine()], { id: 'M-OUT', warehouseId: 'W1', movementType: 'STOCK_TRANSFER_OUT', sourceType: 'STOCK_TRANSFER' });
    const inbound = movement([valuedLine({ direction: 'IN' })], { id: 'M-IN', warehouseId: 'W2', movementType: 'STOCK_TRANSFER_IN', sourceType: 'STOCK_TRANSFER' });
    const result = evaluateValuationReconciliation(data({
      policies: [policy(), policy({ id: 'POL-2', warehouseId: 'W2', warehouse: { companyId: 'C1', branchId: 'B1', code: 'WH-2', name: 'Warehouse 2' } })],
      movements: [out, inbound], transfers: [{
        id: 'T1', companyId: 'C1', branchId: 'B1', sourceWarehouseId: 'W1', destinationWarehouseId: 'W2',
        lines: [{ productId: 'P1', transferOutMovementId: 'M-OUT', transferInMovementId: 'M-IN', transferTotalValue: new Prisma.Decimal(100) }],
      }],
    }));
    expect(result.summary.transferValueGainLossCount).toBe(0);
  });

  it('21 detects transfer gain or loss', () => {
    const out = movement([valuedLine()], { id: 'M-OUT', movementType: 'STOCK_TRANSFER_OUT', sourceType: 'STOCK_TRANSFER' });
    const inbound = movement([valuedLine({ direction: 'IN', totalCost: new Prisma.Decimal(99) })], { id: 'M-IN', warehouseId: 'W2', movementType: 'STOCK_TRANSFER_IN', sourceType: 'STOCK_TRANSFER' });
    const result = evaluateValuationReconciliation(data({
      policies: [policy(), policy({ id: 'POL-2', warehouseId: 'W2' })], movements: [out, inbound],
      transfers: [{ companyId: 'C1', branchId: 'B1', sourceWarehouseId: 'W1', destinationWarehouseId: 'W2',
        lines: [{ productId: 'P1', transferOutMovementId: 'M-OUT', transferInMovementId: 'M-IN', transferTotalValue: 100 }] }],
    }));
    expect(result.summary.transferValueGainLossCount).toBe(1);
  });

  it('22 detects maintenance physical movement without monetary twin', () => {
    const result = evaluateValuationReconciliation(data({ movements: [movement([valuedLine({
      unitCost: null, totalCost: null, currencyCode: null, valuationMethod: null,
    })], { movementType: 'MAINTENANCE_ISSUE', sourceType: 'MAINTENANCE_PART_LINE' })] }));
    expect(result.summary.maintenanceTwinSyncDefectCount).toBe(1);
  });

  it('23 detects production-material physical movement without monetary twin', () => {
    const result = evaluateValuationReconciliation(data({ movements: [movement([valuedLine({
      unitCost: null, totalCost: null, currencyCode: null, valuationMethod: null,
    })], { movementType: 'PRODUCTION_MATERIAL_ISSUE', sourceType: 'PRODUCTION_MATERIAL_DOCUMENT' })] }));
    expect(result.summary.productionMaterialTwinSyncDefectCount).toBe(1);
  });

  it('24 proves exact completed production FG value conservation', () => {
    const receipt = {
      id: 'FG1', companyId: 'C1', branchId: 'B1', productionRunId: 'R1', receiptWarehouseId: 'W1', sourceType: 'MANUAL',
      lines: [{ productId: 'P1' }], movement: movement([valuedLine({ direction: 'IN' })], { companyId: 'C1', warehouseId: 'W1' }),
    };
    const result = evaluateValuationReconciliation(data({ finishedGoodsReceipts: [receipt], runSnapshots: [{
      productionRunId: 'R1', finalProductId: 'P1', finalGoodQuantity: 10, netMaterialValue: 100,
      productionRun: { receiptWarehouseId: 'W1' },
    }] }));
    expect(result.summary.productionCompletedValueMismatchCount).toBe(0);
    expect(result.summary.productionOverCapitalizedRunCount).toBe(0);
  });

  it('25 detects production value over-capitalization', () => {
    const receipt = { id: 'FG1', companyId: 'C1', branchId: 'B1', productionRunId: 'R1', receiptWarehouseId: 'W1', sourceType: 'MANUAL',
      lines: [{ productId: 'P1' }], movement: movement([valuedLine({ direction: 'IN', totalCost: new Prisma.Decimal(101) })]) };
    const result = evaluateValuationReconciliation(data({ finishedGoodsReceipts: [receipt], runSnapshots: [{
      productionRunId: 'R1', finalProductId: 'P1', finalGoodQuantity: 10, netMaterialValue: 100, productionRun: { receiptWarehouseId: 'W1' },
    }] }));
    expect(result.summary.productionOverCapitalizedRunCount).toBe(1);
  });

  it('26 detects production quantity over-capitalization', () => {
    const receipt = { id: 'FG1', companyId: 'C1', branchId: 'B1', productionRunId: 'R1', receiptWarehouseId: 'W1', sourceType: 'MANUAL',
      lines: [{ productId: 'P1' }], movement: movement([valuedLine({ direction: 'IN', quantity: 11, quantityBase: 11 })]) };
    const result = evaluateValuationReconciliation(data({ finishedGoodsReceipts: [receipt], runSnapshots: [{
      productionRunId: 'R1', finalProductId: 'P1', finalGoodQuantity: 10, netMaterialValue: 100, productionRun: { receiptWarehouseId: 'W1' },
    }] }));
    expect(result.summary.productionOverCapitalizedRunCount).toBe(1);
  });

  it('27 accepts trusted FG reversal carrying original monetary evidence', () => {
    const originalLine = valuedLine({ direction: 'IN' });
    const original = { id: 'FG1', companyId: 'C1', branchId: 'B1', productionRunId: 'R1', receiptWarehouseId: 'W1', sourceType: 'MANUAL',
      lines: [{ productId: 'P1' }], movement: movement([originalLine], { id: 'M-FG1' }) };
    const reversal = { id: 'FG2', companyId: 'C1', branchId: 'B1', productionRunId: 'R1', receiptWarehouseId: 'W1', sourceType: 'REVERSE',
      lines: [{ productId: 'P1' }], movement: movement([valuedLine({ id: 'ML-2', direction: 'OUT' })], { id: 'M-FG2', sourceId: 'FG1' }) };
    const result = evaluateValuationReconciliation(data({ finishedGoodsReceipts: [original, reversal] }));
    expect(result.summary.fgReversalIntegrityDefectCount).toBe(0);
  });

  it('28 detects orphan or repriced FG reversal', () => {
    const reversal = { id: 'FG2', companyId: 'C1', branchId: 'B1', productionRunId: 'R1', receiptWarehouseId: 'W1', sourceType: 'REVERSE',
      lines: [{ productId: 'P1' }], movement: movement([valuedLine({ direction: 'OUT' })], { sourceId: 'MISSING' }) };
    const result = evaluateValuationReconciliation(data({ finishedGoodsReceipts: [reversal] }));
    expect(result.summary.fgReversalIntegrityDefectCount).toBe(1);
  });

  it('29 detects cross-tenant valuation ownership contradiction', () => {
    const result = evaluateValuationReconciliation(data({
      valuationBalances: [valuation('10', '10', { companyId: 'C2' })],
    }));
    expect(result.summary.crossTenantValuationDefectCount).toBe(1);
  });

  it('30 confirms no unprotected ACTIVE mutator classification remains', () => {
    const result = evaluateValuationReconciliation(data());
    expect(result.summary.unprotectedActiveMutatorCount).toBe(0);
    expect(result.summary.physicalWithoutMonetaryActivePaths).toBe(0);
    expect(result.summary.monetaryWithoutPhysicalActivePaths).toBe(0);
  });

  it('31 service is read-only, tenant scoped, filtered, and paginated', async () => {
    const reads = {
      warehouse: { findMany: jest.fn().mockResolvedValue([{ id: 'W1', companyId: 'C1', branchId: 'B1', code: 'WH-1', name: 'Warehouse 1' }]) },
      inventoryValuationPolicy: { findMany: jest.fn().mockResolvedValue([policy()]) },
      inventoryBalance: { findMany: jest.fn().mockResolvedValue([physical('1')]), update: jest.fn(), create: jest.fn() },
      inventoryValuationBalance: { findMany: jest.fn().mockResolvedValue([valuation('10', '10')]), update: jest.fn(), create: jest.fn() },
      inventoryValuationInitialization: { findMany: jest.fn().mockResolvedValue([]), create: jest.fn(), update: jest.fn() },
      inventoryMovement: { findMany: jest.fn().mockResolvedValue([]), update: jest.fn(), create: jest.fn() },
      inventoryStockTransfer: { findMany: jest.fn().mockResolvedValue([]), update: jest.fn() },
      productionFinishedGoodsReceipt: { findMany: jest.fn().mockResolvedValue([]), update: jest.fn() },
      productionRunCostSnapshot: { findMany: jest.fn().mockResolvedValue([]), update: jest.fn(), create: jest.fn() },
    };
    const service = new InventoryValuationReconciliationService(reads as any);
    const result = await service.reconcile({ warehouseId: 'W1', productId: 'P1', page: 1, limit: 1 }, {
      companyId: 'C1', branchId: 'B1',
    } as any);
    expect(reads.warehouse.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ companyId: 'C1', id: 'W1' }),
    }));
    expect(result.meta).toEqual({ page: 1, limit: 1, total: 1, totalPages: 1 });
    expect(result.contract.readOnly).toBe(true);
    for (const model of Object.values(reads) as any[]) {
      if (model.create) expect(model.create).not.toHaveBeenCalled();
      if (model.update) expect(model.update).not.toHaveBeenCalled();
    }
  });

  it('32 endpoint reuses inventory-valuation:read permission', () => {
    const metadata = Reflect.getMetadata('permissions', InventoryValuationController.prototype.reconcile);
    expect(metadata).toEqual([INVENTORY_VALUATION_PERMISSION_KEYS.read]);
  });

  it('33 detects missing initialization evidence where physical stock predates activation', () => {
    const result = evaluateValuationReconciliation(data({
      physicalBalances: [physical('5', 5, { createdAt: new Date('2026-08-31T00:00:00.000Z') })],
      valuationBalances: [valuation('50', '10')],
    }));
    expect(types(result)).toContain('MISSING_REQUIRED_INITIALIZATION');
  });
});
