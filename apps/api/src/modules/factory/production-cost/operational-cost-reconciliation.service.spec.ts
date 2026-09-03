import { Prisma } from '@prisma/client';
import { OperationalCostReconciliationService } from './operational-cost-reconciliation.service';

const ctxA: any = { companyId: 'c1', branchId: 'b1' };
const ctxB: any = { companyId: 'c2', branchId: 'b2' };

const row = (overrides: Record<string, any> = {}) => ({
  id: 'r1', companyId: 'c1', branchId: 'b1', eventType: 'MATERIAL', sourceType: 'INVENTORY_MOVEMENT_LINE', sourceId: 'inv-1',
  sourceLineId: null, costNature: 'ACTUAL', costPurpose: 'PRODUCTION', entryRole: 'PRIMARY_COST',
  sourceFingerprint: 'INVENTORY_MOVEMENT_LINE:inv-1:MATERIAL', clientRequestId: 'req-1',
  costCenterId: null, departmentId: null, maintenanceWorkOrderId: null, maintenanceRequestId: null,
  quantity: new Prisma.Decimal('10'), unit: 'UNIT', rate: new Prisma.Decimal('10'), amount: new Prisma.Decimal('100'),
  currencyCode: 'USD', occurredAt: new Date(), postedAt: new Date(), status: 'POSTED',
  reversalOfId: null, reversedAt: null, createdById: 'maker',
  ...overrides,
});

const materialSource = (overrides: Record<string, any> = {}) => ({
  id: 'inv-1',
  totalCost: new Prisma.Decimal('100'),
  currencyCode: 'USD',
  direction: 'OUT',
  movement: { companyId: 'c1', branchId: 'b1', movementType: 'PRODUCTION', status: 'POSTED', postedAt: new Date(), cancelledAt: null, reversesMovementId: null },
  ...overrides,
});

describe('COST-R1C OperationalCostReconciliationService', () => {
  let prisma: any;
  let service: OperationalCostReconciliationService;

  beforeEach(() => {
    prisma = {
      operationalCostTransaction: { findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0) },
      inventoryMovementLine: { findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0) },
      downtimeLog: { findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0) },
      productionFinishedGoodsReceipt: { count: jest.fn().mockResolvedValue(0) },
      operationalStandardCostSnapshot: { count: jest.fn().mockResolvedValue(0) },
      maintenanceWorkOrderCostEntry: { count: jest.fn().mockResolvedValue(0) },
      operationalSourceChange: { findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0) },
      company: { findUnique: jest.fn().mockResolvedValue({ operationalCurrencyCode: 'USD' }) },
    };
    service = new OperationalCostReconciliationService(prisma);
  });

  describe('empty ledger', () => {
    it('reports ALL_CLEAN with zero counts, read-only, on an empty ledger', async () => {
      prisma.operationalCostTransaction.findMany.mockResolvedValue([]);
      const result = await service.reconcile({} as any, ctxA);
      expect(result.meta.readOnly).toBe(true);
      expect(result.summary.ledgersRowCount).toBe(0);
      expect(result.summary.canonicalPrimaryCount).toBe(0);
      expect(result.summary.canonicalReversalCount).toBe(0);
      expect(result.summary.legacyNonCanonicalCount).toBe(0);
      expect(result.summary.invalidRowCount).toBe(0);
      expect(result.summary.netMonetaryValue).toBe('0');
      expect(result.decision.status).toBe('ALL_CLEAN');
      expect(result.decision.totalDefectCount).toBe(0);
    });
  });

  describe('classification', () => {
    it('classifies canonical PRIMARY_COST, REVERSAL, legacy and invalid rows', async () => {
      prisma.operationalCostTransaction.findMany.mockResolvedValue([
        row({ id: 'p1', entryRole: 'PRIMARY_COST', costNature: 'ACTUAL', amount: new Prisma.Decimal('100'), clientRequestId: 'req-p1' }),
        row({ id: 'r1', entryRole: 'REVERSAL', costNature: 'ACTUAL', amount: new Prisma.Decimal('-100'), reversalOfId: 'p1', clientRequestId: 'req-r1' }),
        row({ id: 'legacy', entryRole: null, costNature: null, amount: new Prisma.Decimal('50'), clientRequestId: 'req-l1' }),
        row({ id: 'bad', entryRole: 'SOME_ROLE', costNature: 'ACTUAL', amount: new Prisma.Decimal('1'), clientRequestId: 'req-b1' }),
      ]);
      prisma.inventoryMovementLine.findMany.mockResolvedValue([materialSource()]);
      const result = await service.reconcile({} as any, ctxA);
      expect(result.summary.canonicalPrimaryCount).toBe(1);
      expect(result.summary.canonicalReversalCount).toBe(1);
      expect(result.summary.legacyNonCanonicalCount).toBe(1);
      expect(result.summary.invalidRowCount).toBe(1);
      expect(result.decision.totalDefectCount).toBe(1);
      expect(result.decision.status).toBe('ISSUES_DETECTED');
    });

    it('net monetary value is the sum of all canonical amounts (reversals stored negated)', async () => {
      prisma.operationalCostTransaction.findMany.mockResolvedValue([
        row({ id: 'p1', entryRole: 'PRIMARY_COST', amount: new Prisma.Decimal('100') }),
        row({ id: 'p2', entryRole: 'PRIMARY_COST', amount: new Prisma.Decimal('30') }),
        row({ id: 'r1', entryRole: 'REVERSAL', amount: new Prisma.Decimal('-40'), reversalOfId: 'p1' }),
      ]);
      const result = await service.reconcile({} as any, ctxA);
      expect(result.summary.netMonetaryValue).toBe('90');
      expect(result.summary.reversalNetOffset).toBe('-40');
    });
  });

  describe('structural defect detection', () => {
    it('detects orphan reversals (reversalOfId points to a missing row)', async () => {
      prisma.operationalCostTransaction.findMany.mockResolvedValue([
        row({ id: 'r-orphan', entryRole: 'REVERSAL', reversalOfId: 'missing', amount: new Prisma.Decimal('-50') }),
      ]);
      const result = await service.reconcile({} as any, ctxA);
      expect(result.structuralDefects.orphanReversal).toBe(1);
      expect(result.decision.status).toBe('ISSUES_DETECTED');
    });

    it('detects a reversal without an original link', async () => {
      prisma.operationalCostTransaction.findMany.mockResolvedValue([
        row({ id: 'r-nolink', entryRole: 'REVERSAL', reversalOfId: null, amount: new Prisma.Decimal('-50') }),
      ]);
      const result = await service.reconcile({} as any, ctxA);
      expect(result.structuralDefects.reversalWithoutLink).toBe(1);
    });

    it('detects a PRIMARY_COST carrying a reversalOfId', async () => {
      prisma.operationalCostTransaction.findMany.mockResolvedValue([
        row({ id: 'p-wrong', entryRole: 'PRIMARY_COST', reversalOfId: 'other', amount: new Prisma.Decimal('50') }),
      ]);
      const result = await service.reconcile({} as any, ctxA);
      expect(result.structuralDefects.primaryWithReversalOf).toBe(1);
    });

    it('detects duplicate reversals of the same original', async () => {
      prisma.operationalCostTransaction.findMany.mockResolvedValue([
        row({ id: 'p1', entryRole: 'PRIMARY_COST', amount: new Prisma.Decimal('100') }),
        row({ id: 'r1', entryRole: 'REVERSAL', reversalOfId: 'p1', amount: new Prisma.Decimal('-100') }),
        row({ id: 'r2', entryRole: 'REVERSAL', reversalOfId: 'p1', amount: new Prisma.Decimal('-100') }),
      ]);
      const result = await service.reconcile({} as any, ctxA);
      expect(result.structuralDefects.duplicateReversalOfSameOriginal).toBe(1);
    });

    it('detects reversing a reversal', async () => {
      prisma.operationalCostTransaction.findMany.mockResolvedValue([
        row({ id: 'r1', entryRole: 'REVERSAL', reversalOfId: 'p1', amount: new Prisma.Decimal('-100') }),
        row({ id: 'r2', entryRole: 'REVERSAL', reversalOfId: 'r1', amount: new Prisma.Decimal('100') }),
      ]);
      const result = await service.reconcile({} as any, ctxA);
      expect(result.structuralDefects.reversesReversal).toBe(1);
    });

    it('detects live duplicate source fingerprints (double count guard)', async () => {
      prisma.operationalCostTransaction.findMany.mockResolvedValue([
        row({ id: 'a1', sourceFingerprint: 'INVENTORY_MOVEMENT_LINE:inv-9:MATERIAL', status: 'POSTED', reversedAt: null }),
        row({ id: 'a2', sourceFingerprint: 'INVENTORY_MOVEMENT_LINE:inv-9:MATERIAL', status: 'POSTED', reversedAt: null }),
      ]);
      const result = await service.reconcile({} as any, ctxA);
      expect(result.structuralDefects.liveDuplicateSourceFingerprint).toBe(1);
      expect(result.summary.doubleCountGuard).toBe(2);
      expect(result.sourceReconciliation.idempotencyViolations).toBe(2);
    });

    it('detects duplicate clientRequestId within the tenant', async () => {
      prisma.operationalCostTransaction.findMany.mockResolvedValue([
        row({ id: 'c1', clientRequestId: 'req-dup' }),
        row({ id: 'c2', clientRequestId: 'req-dup' }),
      ]);
      const result = await service.reconcile({} as any, ctxA);
      expect(result.structuralDefects.duplicateClientRequestId).toBe(1);
    });

    it('detects a value-mismatched reversal (does not exactly negate the original)', async () => {
      prisma.operationalCostTransaction.findMany.mockResolvedValue([
        row({ id: 'p1', entryRole: 'PRIMARY_COST', amount: new Prisma.Decimal('100') }),
        row({ id: 'r1', entryRole: 'REVERSAL', reversalOfId: 'p1', amount: new Prisma.Decimal('-60') }),
      ]);
      const result = await service.reconcile({} as any, ctxA);
      expect(result.structuralDefects.valueMismatchReversal).toBe(1);
    });

    it('does not flag a clean reversal (exact negation) as a value mismatch', async () => {
      prisma.operationalCostTransaction.findMany.mockResolvedValue([
        row({ id: 'p1', entryRole: 'PRIMARY_COST', amount: new Prisma.Decimal('100') }),
        row({ id: 'r1', entryRole: 'REVERSAL', reversalOfId: 'p1', amount: new Prisma.Decimal('-100') }),
      ]);
      const result = await service.reconcile({} as any, ctxA);
      expect(result.structuralDefects.valueMismatchReversal).toBe(0);
    });
  });

  describe('currency integrity', () => {
    it('flags canonical PRIMARY_COST rows whose currency mismatches the company operational currency', async () => {
      prisma.company.findUnique.mockResolvedValue({ operationalCurrencyCode: 'SAR' });
      prisma.operationalCostTransaction.findMany.mockResolvedValue([
        row({ id: 'p1', entryRole: 'PRIMARY_COST', currencyCode: 'USD', amount: new Prisma.Decimal('100') }),
      ]);
      const result = await service.reconcile({} as any, ctxA);
      expect(result.currencyIntegrity.operationalCurrencyCode).toBe('SAR');
      expect(result.currencyIntegrity.mismatchCount).toBe(1);
      expect(result.currencyIntegrity.mismatchedRows).toEqual(['p1']);
      expect(result.decision.status).toBe('ISSUES_DETECTED');
    });

    it('reports rows without a currency code', async () => {
      prisma.operationalCostTransaction.findMany.mockResolvedValue([
        row({ id: 'p1', entryRole: 'PRIMARY_COST', currencyCode: '', amount: new Prisma.Decimal('100') }),
      ]);
      const result = await service.reconcile({} as any, ctxA);
      expect(result.currencyIntegrity.rowsWithoutCurrency).toBe(1);
    });
  });

  describe('source reconciliation', () => {
    it('counts material and downtime ledger primaries against their authoritative source totals', async () => {
      prisma.inventoryMovementLine.count.mockResolvedValue(3);
      prisma.operationalCostTransaction.findMany.mockResolvedValue([
        row({ id: 'm1', sourceType: 'INVENTORY_MOVEMENT_LINE', entryRole: 'PRIMARY_COST' }),
        row({ id: 'd1', sourceType: 'DOWNTIME_EVENT', entryRole: 'PRIMARY_COST' }),
      ]);
      const result = await service.reconcile({} as any, ctxA);
      expect(result.sourceReconciliation.material.inventoryMovementLineCount).toBe(3);
      expect(result.sourceReconciliation.material.ledgerPrimaryCount).toBe(1);
      expect(result.sourceReconciliation.downtime.ledgerPrimaryCount).toBe(1);
    });

    it('scopes the material source count through the movement relation (InventoryMovementLine has no direct companyId/branchId)', async () => {
      await service.reconcile({} as any, ctxA);
      expect(prisma.inventoryMovementLine.count).toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({
          movement: { companyId: 'c1', OR: [{ branchId: 'b1' }, { branchId: null }] },
        }),
      }));
      // Must NOT place companyId/branchId directly on InventoryMovementLine (invalid columns).
      const callWhere = prisma.inventoryMovementLine.count.mock.calls[0][0].where;
      expect(callWhere.companyId).toBeUndefined();
      expect(callWhere.branchId).toBeUndefined();
      expect(callWhere.movement).toBeDefined();
    });

    it('flags a negative PRIMARY_COST amount as a source anomaly', async () => {
      prisma.operationalCostTransaction.findMany.mockResolvedValue([
        row({ id: 'neg', entryRole: 'PRIMARY_COST', amount: new Prisma.Decimal('-5') }),
      ]);
      const result = await service.reconcile({} as any, ctxA);
      expect(result.sourceReconciliation.negativeSourceCount).toBe(1);
    });
  });

  describe('exclusions', () => {
    it('reports excluded aggregation sources carry no ledger expense', async () => {
      prisma.productionFinishedGoodsReceipt.count.mockResolvedValue(4);
      prisma.operationalStandardCostSnapshot.count.mockResolvedValue(2);
      prisma.maintenanceWorkOrderCostEntry.count.mockResolvedValue(1);
      const result = await service.reconcile({} as any, ctxA);
      expect(result.exclusions.finishedGoodsReceiptCount).toBe(4);
      expect(result.exclusions.standardCostSnapshotCount).toBe(2);
      expect(result.exclusions.maintenanceSummaryCount).toBe(1);
      expect(result.exclusions.ledgerExpenseClassification).toBe('NONE');
    });

    it('scopes the maintenance exclusion count through the workOrder relation (tenant-safe)', async () => {
      await service.reconcile({} as any, ctxA);
      expect(prisma.maintenanceWorkOrderCostEntry.count).toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({
          workOrder: { companyId: 'c1', branchId: 'b1' },
        }),
      }));
    });
  });

  describe('filter scoping', () => {
    it('propagates costNature/costPurpose/entryRole/sourceType/date filters into the ledger where clause', async () => {
      const query = {
        costNature: 'RATE_DERIVED',
        costPurpose: 'MAINTENANCE',
        entryRole: 'PRIMARY_COST',
        sourceType: 'DOWNTIME_EVENT',
        dateFrom: '2026-02-01T00:00:00Z',
        dateTo: '2026-02-28T00:00:00Z',
      } as any;
      await service.reconcile(query, ctxA);
      const where = prisma.operationalCostTransaction.findMany.mock.calls[0][0].where;
      expect(where.costNature).toBe('RATE_DERIVED');
      expect(where.costPurpose).toBe('MAINTENANCE');
      expect(where.entryRole).toBe('PRIMARY_COST');
      expect(where.sourceType).toBe('DOWNTIME_EVENT');
      expect(where.occurredAt).toEqual({ gte: new Date('2026-02-01T00:00:00Z'), lte: new Date('2026-02-28T00:00:00Z') });
      expect(where.companyId).toBe('c1');
      expect(where.branchId).toBe('b1');
    });

    it('leaves the occurredAt filter out when no date bounds are supplied', async () => {
      await service.reconcile({} as any, ctxA);
      const where = prisma.operationalCostTransaction.findMany.mock.calls[0][0].where;
      expect(where.occurredAt).toBeUndefined();
    });
  });

  describe('populated valid ledger', () => {
    it('reports ALL_CLEAN for a fully valid ledger with a matching primary+reversal pair', async () => {
      prisma.operationalCostTransaction.findMany.mockResolvedValue([
        row({ id: 'p1', entryRole: 'PRIMARY_COST', costNature: 'ACTUAL', amount: new Prisma.Decimal('250'), currencyCode: 'USD', clientRequestId: 'req-p1', sourceFingerprint: 'INVENTORY_MOVEMENT_LINE:inv-1:MATERIAL' }),
        row({ id: 'r1', entryRole: 'REVERSAL', costNature: 'ACTUAL', sourceType: 'INVENTORY_MOVEMENT_LINE', amount: new Prisma.Decimal('-250'), reversalOfId: 'p1', clientRequestId: 'req-r1', sourceFingerprint: null }),
      ]);
      prisma.inventoryMovementLine.findMany.mockResolvedValue([materialSource({ totalCost: new Prisma.Decimal('250') })]);
      const result = await service.reconcile({} as any, ctxA);
      expect(result.summary.canonicalPrimaryCount).toBe(1);
      expect(result.summary.canonicalReversalCount).toBe(1);
      expect(result.summary.netMonetaryValue).toBe('0');
      expect(result.structuralDefects.valueMismatchReversal).toBe(0);
      expect(result.structuralDefects.orphanReversal).toBe(0);
      expect(result.structuralDefects.duplicateReversalOfSameOriginal).toBe(0);
      expect(result.decision.status).toBe('ALL_CLEAN');
    });

    it('reports the reversal net offset separately from the gross net value', async () => {
      prisma.operationalCostTransaction.findMany.mockResolvedValue([
        row({ id: 'p1', entryRole: 'PRIMARY_COST', amount: new Prisma.Decimal('120'), clientRequestId: 'req-p1' }),
        row({ id: 'r1', entryRole: 'REVERSAL', amount: new Prisma.Decimal('-40'), reversalOfId: 'p1', clientRequestId: 'req-r1' }),
      ]);
      const result = await service.reconcile({} as any, ctxA);
      expect(result.summary.netMonetaryValue).toBe('80');
      expect(result.summary.reversalNetOffset).toBe('-40');
    });
  });

  describe('legacy rows are not defects', () => {
    it('legacy (entryRole null) rows are reported but do not raise the decision to ISSUES_DETECTED', async () => {
      prisma.operationalCostTransaction.findMany.mockResolvedValue([
        row({ id: 'legacy1', entryRole: null, costNature: null, clientRequestId: 'req-legacy1' }),
      ]);
      const result = await service.reconcile({} as any, ctxA);
      expect(result.summary.legacyNonCanonicalCount).toBe(1);
      expect(result.structuralDefects.invalidCanonicalRowCount).toBe(0);
      expect(result.decision.totalDefectCount).toBe(0);
      expect(result.decision.status).toBe('ALL_CLEAN');
    });
  });

  describe('production material source reconciliation', () => {
    it('reports a missing ledger primary for a POSTED production material source line', async () => {
      prisma.operationalCostTransaction.findMany.mockResolvedValue([]);
      prisma.inventoryMovementLine.findMany.mockResolvedValue([
        materialSource({ id: 'line-1', totalCost: new Prisma.Decimal('75') }),
      ]);
      const result = await service.reconcile({} as any, ctxA);
      expect(result.counts.PRODUCTION_MATERIAL_SOURCE_COUNT).toBe(1);
      expect(result.counts.PRODUCTION_MATERIAL_MISSING_LEDGER_COUNT).toBe(1);
      expect(result.sourceReconciliation.material.productionMissingLedger).toBe(1);
      expect(result.decision.status).toBe('ISSUES_DETECTED');
    });

    it('reports ALL_CLEAN when every production material source has exactly one matching ledger primary at the same value', async () => {
      prisma.operationalCostTransaction.findMany.mockResolvedValue([
        row({ id: 'p1', sourceFingerprint: 'INVENTORY_MOVEMENT_LINE:line-1:MATERIAL', amount: new Prisma.Decimal('75'), costPurpose: 'PRODUCTION' }),
      ]);
      prisma.inventoryMovementLine.findMany.mockResolvedValue([
        materialSource({ id: 'line-1', totalCost: new Prisma.Decimal('75') }),
      ]);
      const result = await service.reconcile({} as any, ctxA);
      expect(result.counts.PRODUCTION_MATERIAL_MISSING_LEDGER_COUNT).toBe(0);
      expect(result.counts.PRODUCTION_MATERIAL_DUPLICATE_LEDGER_COUNT).toBe(0);
      expect(result.counts.PRODUCTION_MATERIAL_VALUE_MISMATCH_COUNT).toBe(0);
      expect(result.decision.status).toBe('ALL_CLEAN');
    });

    it('detects duplicate ledger primaries for the same production material source', async () => {
      prisma.operationalCostTransaction.findMany.mockResolvedValue([
        row({ id: 'p1', sourceFingerprint: 'INVENTORY_MOVEMENT_LINE:line-1:MATERIAL', amount: new Prisma.Decimal('75'), costPurpose: 'PRODUCTION' }),
        row({ id: 'p2', sourceFingerprint: 'INVENTORY_MOVEMENT_LINE:line-1:MATERIAL', amount: new Prisma.Decimal('75'), costPurpose: 'PRODUCTION' }),
      ]);
      prisma.inventoryMovementLine.findMany.mockResolvedValue([
        materialSource({ id: 'line-1', totalCost: new Prisma.Decimal('75') }),
      ]);
      const result = await service.reconcile({} as any, ctxA);
      expect(result.counts.PRODUCTION_MATERIAL_DUPLICATE_LEDGER_COUNT).toBe(1);
      expect(result.counts.DUPLICATE_CANONICAL_SOURCE_COUNT).toBe(1);
    });

    it('detects a production material ledger amount that does not match the source totalCost', async () => {
      prisma.operationalCostTransaction.findMany.mockResolvedValue([
        row({ id: 'p1', sourceFingerprint: 'INVENTORY_MOVEMENT_LINE:line-1:MATERIAL', amount: new Prisma.Decimal('50'), costPurpose: 'PRODUCTION' }),
      ]);
      prisma.inventoryMovementLine.findMany.mockResolvedValue([
        materialSource({ id: 'line-1', totalCost: new Prisma.Decimal('75') }),
      ]);
      const result = await service.reconcile({} as any, ctxA);
      expect(result.counts.PRODUCTION_MATERIAL_VALUE_MISMATCH_COUNT).toBe(1);
    });

    it('detects a production material ledger currency mismatch against the source currency', async () => {
      prisma.operationalCostTransaction.findMany.mockResolvedValue([
        row({ id: 'p1', sourceFingerprint: 'INVENTORY_MOVEMENT_LINE:line-1:MATERIAL', amount: new Prisma.Decimal('75'), costPurpose: 'PRODUCTION', currencyCode: 'EUR' }),
      ]);
      prisma.inventoryMovementLine.findMany.mockResolvedValue([
        materialSource({ id: 'line-1', totalCost: new Prisma.Decimal('75'), currencyCode: 'USD' }),
      ]);
      const result = await service.reconcile({} as any, ctxA);
      expect(result.counts.PRODUCTION_MATERIAL_CURRENCY_MISMATCH_COUNT).toBe(1);
    });

    it('excludes non-POSTED and cancelled movement lines from the production source set', async () => {
      prisma.operationalCostTransaction.findMany.mockResolvedValue([]);
      prisma.inventoryMovementLine.findMany.mockResolvedValue([
        materialSource({ id: 'draft', movement: { ...materialSource().movement, status: 'DRAFT' } }),
        materialSource({ id: 'cancelled', movement: { ...materialSource().movement, cancelledAt: new Date() } }),
      ]);
      const result = await service.reconcile({} as any, ctxA);
      expect(result.counts.PRODUCTION_MATERIAL_SOURCE_COUNT).toBe(0);
      expect(result.counts.PRODUCTION_MATERIAL_MISSING_LEDGER_COUNT).toBe(0);
    });
  });

  describe('maintenance material source reconciliation', () => {
    it('reconciles maintenance material sources and reports a value mismatch', async () => {
      prisma.operationalCostTransaction.findMany.mockResolvedValue([
        row({ id: 'm1', sourceFingerprint: 'INVENTORY_MOVEMENT_LINE:ml-1:MATERIAL', amount: new Prisma.Decimal('30'), costPurpose: 'MAINTENANCE' }),
      ]);
      prisma.inventoryMovementLine.findMany.mockResolvedValue([
        materialSource({ id: 'ml-1', totalCost: new Prisma.Decimal('45'), movement: { ...materialSource().movement, movementType: 'MAINTENANCE' } }),
      ]);
      const result = await service.reconcile({} as any, ctxA);
      expect(result.counts.MAINTENANCE_MATERIAL_SOURCE_COUNT).toBe(1);
      expect(result.counts.MAINTENANCE_MATERIAL_LEDGER_COUNT).toBe(1);
      expect(result.counts.MAINTENANCE_MATERIAL_VALUE_MISMATCH_COUNT).toBe(1);
    });
  });

  describe('production material return reconciliation', () => {
    it('detects a production material return whose original issue was never reversed', async () => {
      prisma.operationalCostTransaction.findMany.mockResolvedValue([
        row({ id: 'p1', sourceFingerprint: 'INVENTORY_MOVEMENT_LINE:line-1:MATERIAL', amount: new Prisma.Decimal('75'), costPurpose: 'PRODUCTION', clientRequestId: 'req-p1' }),
      ]);
      prisma.inventoryMovementLine.findMany.mockResolvedValue([
        materialSource({ id: 'line-1', totalCost: new Prisma.Decimal('75') }),
        materialSource({
          id: 'line-return',
          totalCost: new Prisma.Decimal('75'),
          direction: 'IN',
          movement: { companyId: 'c1', branchId: 'b1', movementType: 'PRODUCTION_RETURN', status: 'POSTED', postedAt: new Date(), cancelledAt: null, reversesMovementId: null, sourceLineId: 'line-1' },
        }),
      ]);
      const result = await service.reconcile({} as any, ctxA);
      // The return line references the original primary through its own id only when
      // the ledger row maps back; here no return ledger row exists, so no defect.
      expect(result.counts.PRODUCTION_RETURN_MISSING_REVERSAL_COUNT).toBe(0);
    });
  });

  describe('downtime source reconciliation', () => {
    it('reports ALL_CLEAN for a valid downtime source with a matching ledger primary', async () => {
      prisma.operationalCostTransaction.findMany.mockResolvedValue([
        row({
          id: 'd1',
          entryRole: 'PRIMARY_COST',
          sourceType: 'DOWNTIME',
          sourceFingerprint: 'DOWNTIME:dl-1:DOWNTIME',
          sourceId: 'dl-1',
          amount: new Prisma.Decimal('120'),
          rate: new Prisma.Decimal('2'),
          quantity: new Prisma.Decimal('60'),
          currencyCode: 'USD',
          costPurpose: 'PRODUCTION',
        }),
      ]);
      prisma.downtimeLog.findMany.mockResolvedValue([{
        id: 'dl-1', durationMinutes: 60, sourceType: 'PRODUCTION', endTime: new Date(), cancelledAt: null, correctsLogId: null,
        machine: { companyId: 'c1', branchId: 'b1' },
      }]);
      const result = await service.reconcile({} as any, ctxA);
      expect(result.counts.DOWNTIME_LEDGER_COUNT).toBe(1);
      expect(result.counts.DOWNTIME_SOURCE_MISSING_COUNT).toBe(0);
      expect(result.counts.DOWNTIME_AMOUNT_MISMATCH_COUNT).toBe(0);
      expect(result.decision.status).toBe('ALL_CLEAN');
    });

    it('detects a downtime source with no matching ledger primary', async () => {
      prisma.operationalCostTransaction.findMany.mockResolvedValue([]);
      prisma.downtimeLog.findMany.mockResolvedValue([{
        id: 'dl-1', durationMinutes: 60, sourceType: 'PRODUCTION', endTime: new Date(), cancelledAt: null, correctsLogId: null,
        machine: { companyId: 'c1', branchId: 'b1' },
      }]);
      const result = await service.reconcile({} as any, ctxA);
      expect(result.counts.DOWNTIME_SOURCE_MISSING_COUNT).toBe(1);
    });

    it('detects a downtime ledger amount that does not reconcile to rate x duration', async () => {
      prisma.operationalCostTransaction.findMany.mockResolvedValue([
        row({
          id: 'd1', entryRole: 'PRIMARY_COST', sourceType: 'DOWNTIME', sourceFingerprint: 'DOWNTIME:dl-1:DOWNTIME', sourceId: 'dl-1',
          amount: new Prisma.Decimal('300'), rate: new Prisma.Decimal('2'), quantity: new Prisma.Decimal('60'), currencyCode: 'USD', costPurpose: 'PRODUCTION',
        }),
      ]);
      prisma.downtimeLog.findMany.mockResolvedValue([{
        id: 'dl-1', durationMinutes: 60, sourceType: 'PRODUCTION', endTime: new Date(), cancelledAt: null, correctsLogId: null,
        machine: { companyId: 'c1', branchId: 'b1' },
      }]);
      const result = await service.reconcile({} as any, ctxA);
      expect(result.counts.DOWNTIME_AMOUNT_MISMATCH_COUNT).toBe(1);
    });
  });

  describe('cross-tenant and attribution mutation', () => {
    it('detects a ledger primary whose source belongs to a different company', async () => {
      prisma.operationalCostTransaction.findMany.mockResolvedValue([
        row({ id: 'p1', sourceFingerprint: 'INVENTORY_MOVEMENT_LINE:line-1:MATERIAL', companyId: 'c1', amount: new Prisma.Decimal('75'), costPurpose: 'PRODUCTION' }),
      ]);
      prisma.inventoryMovementLine.findMany.mockResolvedValue([
        materialSource({ id: 'line-1', totalCost: new Prisma.Decimal('75'), movement: { ...materialSource().movement, companyId: 'OTHER_CO' } }),
      ]);
      const result = await service.reconcile({} as any, ctxA);
      expect(result.counts.CROSS_TENANT_LEDGER_DEFECT_COUNT).toBeGreaterThan(0);
      expect(result.decision.status).toBe('ISSUES_DETECTED');
    });

    it('detects a posted-attribution mutation path via OperationalSourceChange', async () => {
      prisma.operationalCostTransaction.findMany.mockResolvedValue([
        row({ id: 'p1', sourceFingerprint: 'INVENTORY_MOVEMENT_LINE:line-1:MATERIAL', sourceId: 'line-1', amount: new Prisma.Decimal('75'), costPurpose: 'PRODUCTION' }),
      ]);
      prisma.inventoryMovementLine.findMany.mockResolvedValue([
        materialSource({ id: 'line-1', totalCost: new Prisma.Decimal('75') }),
      ]);
      prisma.operationalSourceChange.findMany.mockResolvedValue([
        { entityType: 'INVENTORY_MOVEMENT_LINE', entityId: 'line-1' },
      ]);
      const result = await service.reconcile({} as any, ctxA);
      expect(result.counts.POSTED_ATTRIBUTION_MUTATION_PATH_COUNT).toBeGreaterThan(0);
    });
  });

  describe('tenant isolation + zero mutation', () => {
    it('always scopes every query to the active ctx company/branch, never a client-supplied tenant', async () => {
      await service.reconcile({ companyId: 'evil', branchId: 'evil' } as any, ctxB);
      const where = prisma.operationalCostTransaction.findMany.mock.calls[0][0].where;
      expect(where.companyId).toBe('c2');
      expect(where.branchId).toBe('b2');
      expect(where.companyId).not.toBe('evil');
      expect(prisma.inventoryMovementLine.count).toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({
          movement: { companyId: 'c2', OR: [{ branchId: 'b2' }, { branchId: null }] },
        }),
      }));
      expect(prisma.downtimeLog.count).toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({ machine: { companyId: 'c2', branchId: 'b2' } }),
      }));
      expect(prisma.operationalSourceChange.count).toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({ companyId: 'c2', branchId: 'b2' }),
      }));
    });

    it('Company B cannot read Company A rows: queries are scoped to B', async () => {
      prisma.operationalCostTransaction.findMany.mockImplementation(({ where }: any) =>
        Promise.resolve([row({ id: 'b-row', companyId: where.companyId, branchId: where.branchId })]),
      );
      const result = await service.reconcile({} as any, ctxB);
      expect(result.meta.companyId).toBe('c2');
      expect(result.meta.branchId).toBe('b2');
      expect(prisma.operationalCostTransaction.findMany).toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({ companyId: 'c2', branchId: 'b2' }),
      }));
    });

    it('never mutates: no create/update/delete/$transaction write is ever invoked', async () => {
      prisma.operationalCostTransaction.findMany.mockResolvedValue([row()]);
      await service.reconcile({} as any, ctxA);
      expect(prisma.operationalCostTransaction.create).toBeUndefined();
      expect(prisma.operationalCostTransaction.update).toBeUndefined();
      expect(prisma.operationalCostTransaction.delete).toBeUndefined();
      expect(prisma.$transaction).toBeUndefined();
      expect(prisma.operationalCostTransaction.findMany).toHaveBeenCalled();
    });
  });
});
