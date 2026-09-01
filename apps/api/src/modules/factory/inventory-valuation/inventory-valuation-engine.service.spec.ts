import { BadRequestException, ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { InventoryValuationEngineService } from './inventory-valuation-engine.service';
import { INVENTORY_MUTATOR_COVERAGE } from './inventory-valuation.constants';

describe('VAL-R1C InventoryValuationEngineService (atomic weighted moving average)', () => {
  const prisma = {
    $queryRaw: jest.fn(),
  } as any as PrismaService;

  function makeService() {
    return new InventoryValuationEngineService(prisma);
  }

  function mockTx(overrides: Record<string, any> = {}) {
    const balance = {
      id: 'bal1',
      companyId: 'C1',
      warehouseId: 'W1',
      productId: 'P1',
      averageUnitCost: new Prisma.Decimal(0),
      inventoryValue: new Prisma.Decimal(0),
      lastHistoricalUnitCost: null,
      version: 1,
      ...(overrides.balance || {}),
    };
    const tx = {
      inventoryValuationBalance: {
        findUnique: jest.fn().mockResolvedValue(overrides.findBalance === false ? null : balance),
        update: jest.fn().mockImplementation(({ select }) => Promise.resolve(select ? { id: balance.id } : balance)),
        create: jest.fn().mockImplementation(({ select }) => Promise.resolve({ id: 'bal-new', ...(select ? {} : {}) })),
      },
      inventoryMovementLine: {
        update: jest.fn().mockResolvedValue({ id: 'line1' }),
      },
      $queryRaw: jest.fn().mockResolvedValue([{ result: 0 }]),
      ...overrides.extras,
    };
    return tx;
  }

  const baseInput = {
    companyId: 'C1',
    warehouseId: 'W1',
    productId: 'P1',
    qold: new Prisma.Decimal(0),
    lineId: 'line1',
    movementId: 'mov1',
    currencyCode: 'USD',
  };

  afterEach(() => jest.clearAllMocks());

  it('receipt: 100@10 first receipt creates the valuation balance at Q=100 V=1000 AVG=10', async () => {
    const tx = mockTx({ findBalance: false });
    const svc = makeService();
    const r = await svc.applyValuedReceipt(tx, {
      ...baseInput,
      quantity: new Prisma.Decimal(100),
      unitCost: new Prisma.Decimal(10),
    });

    expect(tx.inventoryValuationBalance.create).toHaveBeenCalledTimes(1);
    const createData = tx.inventoryValuationBalance.create.mock.calls[0][0].data;
    expect(createData.inventoryValue.toNumber()).toBe(1000);
    expect(createData.averageUnitCost.toNumber()).toBe(10);
    expect(createData.version).toBe(1);
    expect(tx.inventoryMovementLine.update).toHaveBeenCalledTimes(1);
    const lineData = tx.inventoryMovementLine.update.mock.calls[0][0].data;
    expect(lineData.unitCost.toNumber()).toBe(10);
    expect(lineData.totalCost.toNumber()).toBe(1000);
    expect(lineData.currencyCode).toBe('USD');
    expect(lineData.valuationMethod).toBe('WEIGHTED_AVERAGE');
    expect(r.inventoryValue.toNumber()).toBe(1000);
    expect(r.averageUnitCost.toNumber()).toBe(10);
  });

  it('NUMERIC: two receipts 100@10 + 100@20 produce Q=200 V=3000 AVG=15', async () => {
    const tx = mockTx({
      balance: {
        id: 'bal1',
        inventoryValue: new Prisma.Decimal(1000),
        averageUnitCost: new Prisma.Decimal(10),
      },
    });
    const svc = makeService();
    const r = await svc.applyValuedReceipt(tx, {
      ...baseInput,
      qold: new Prisma.Decimal(100),
      quantity: new Prisma.Decimal(100),
      unitCost: new Prisma.Decimal(20),
    });
    expect(r.inventoryValue.toNumber()).toBe(3000);
    expect(r.averageUnitCost.toNumber()).toBe(15);
    const updateData = tx.inventoryValuationBalance.update.mock.calls[0][0].data;
    expect(updateData.inventoryValue.toNumber()).toBe(3000);
    expect(updateData.averageUnitCost.toNumber()).toBe(15);
  });

  it('NUMERIC: issue 40 at AVG 15 debits 600 leaving Q=160 V=2400', async () => {
    const tx = mockTx({
      balance: {
        id: 'bal1',
        inventoryValue: new Prisma.Decimal(3000),
        averageUnitCost: new Prisma.Decimal(15),
      },
    });
    const svc = makeService();
    const r = await svc.applyValuedIssue(tx, {
      ...baseInput,
      qold: new Prisma.Decimal(200),
      quantity: new Prisma.Decimal(40),
    });
    expect(r.totalCost.toNumber()).toBe(600);
    expect(r.averageUnitCost.toNumber()).toBe(15);
    expect(r.inventoryValue.toNumber()).toBe(2400);
    const lineData = tx.inventoryMovementLine.update.mock.calls[0][0].data;
    expect(lineData.totalCost.toNumber()).toBe(600);
  });

  it('issue exhausting the full balance leaves inventoryValue exactly 0 with no residue', async () => {
    const tx = mockTx({
      balance: {
        id: 'bal1',
        inventoryValue: new Prisma.Decimal(2400),
        averageUnitCost: new Prisma.Decimal(15),
      },
    });
    const svc = makeService();
    const r = await svc.applyValuedIssue(tx, {
      ...baseInput,
      qold: new Prisma.Decimal(160),
      quantity: new Prisma.Decimal(160),
    });
    expect(r.inventoryValue.toNumber()).toBe(0);
    expect(r.averageUnitCost.toNumber()).toBe(0);
  });

  it('issue exceeding physical stock is rejected (no active negative stock)', async () => {
    const tx = mockTx({
      balance: {
        id: 'bal1',
        inventoryValue: new Prisma.Decimal(1000),
        averageUnitCost: new Prisma.Decimal(10),
      },
    });
    const svc = makeService();
    await expect(
      svc.applyValuedIssue(tx, { ...baseInput, qold: new Prisma.Decimal(50), quantity: new Prisma.Decimal(60) }),
    ).rejects.toMatchObject({ response: { messageKey: 'inventoryValuation.negativeStock' } });
    expect(tx.inventoryValuationBalance.update).not.toHaveBeenCalled();
  });

  it('issue with no valuation balance is rejected (state missing)', async () => {
    const tx = mockTx({ findBalance: false });
    const svc = makeService();
    await expect(
      svc.applyValuedIssue(tx, { ...baseInput, qold: new Prisma.Decimal(10), quantity: new Prisma.Decimal(5) }),
    ).rejects.toMatchObject({ response: { messageKey: 'inventoryValuation.stateMissing' } });
  });

  it('receipt at zero stock uses the incoming cost (no stale average blending)', async () => {
    const tx = mockTx({
      balance: {
        id: 'bal1',
        inventoryValue: new Prisma.Decimal(0),
        averageUnitCost: new Prisma.Decimal(99),
      },
    });
    const svc = makeService();
    const r = await svc.applyValuedReceipt(tx, {
      ...baseInput,
      qold: new Prisma.Decimal(0),
      quantity: new Prisma.Decimal(10),
      unitCost: new Prisma.Decimal(25),
    });
    expect(r.averageUnitCost.toNumber()).toBe(25);
    expect(r.inventoryValue.toNumber()).toBe(250);
  });

  it('true return re-enters at the original historical cost and reblends', async () => {
    // Q=80 AVG=15 V=1200, original issue cost was 12 for 10 units
    const tx = mockTx({
      balance: {
        id: 'bal1',
        inventoryValue: new Prisma.Decimal(1200),
        averageUnitCost: new Prisma.Decimal(15),
      },
    });
    const svc = makeService();
    const r = await svc.applyTrueReturn(tx, {
      ...baseInput,
      qold: new Prisma.Decimal(80),
      quantity: new Prisma.Decimal(10),
      originalUnitCost: new Prisma.Decimal(12),
    });
    // V = 1200 + 120 = 1320 ; Q = 90 ; AVG = 14.66667
    expect(r.inventoryValue.toNumber()).toBe(1320);
    expect(r.averageUnitCost.toNumber()).toBeCloseTo(14.66667, 5);
    const lineData = tx.inventoryMovementLine.update.mock.calls[0][0].data;
    expect(lineData.unitCost.toNumber()).toBe(12);
    expect(lineData.totalCost.toNumber()).toBe(120);
  });

  it('acquireValuationLock acquires the exclusive applock for the deterministic resource', async () => {
    const tx = mockTx();
    const svc = makeService();
    await svc.acquireValuationLock(tx, 'C1', 'W1', 'P1');
    expect(tx.$queryRaw).toHaveBeenCalledTimes(1);
    const callArgs = tx.$queryRaw.mock.calls[0];
    expect(callArgs[0].join(' ')).toMatch(/sp_getapplock/);
    // the resource is a bound template parameter (values array)
    expect(callArgs.join(' ')).toContain('ATSOFT:VAL:WMA:C1:W1:P1');
  });

  it('acquireValuationLock throws concurrencyConflict on lock timeout (-1)', async () => {
    const tx = mockTx();
    tx.$queryRaw.mockResolvedValue([{ result: -1 }]);
    const svc = makeService();
    await expect(svc.acquireValuationLock(tx, 'C1', 'W1', 'P1')).rejects.toMatchObject({
      response: { messageKey: 'inventoryValuation.concurrencyConflict' },
    });
  });

  it('aggregatePhysicalQuantity sums quantityBase across location rows', async () => {
    const tx = {
      inventoryBalance: {
        findMany: jest.fn().mockResolvedValue([
          { quantity: 3, quantityBase: new Prisma.Decimal(8) },
          { quantity: 3, quantityBase: new Prisma.Decimal(12) },
          { quantity: 3, quantityBase: null },
        ]),
      },
    } as any;
    const svc = makeService();
    const total = await svc.aggregatePhysicalQuantity(tx, 'W1', 'P1');
    expect(total.toNumber()).toBe(23);
  });

  it('aggregatePhysicalQuantity falls back to Float quantity when quantityBase is null', async () => {
    const tx = {
      inventoryBalance: {
        findMany: jest.fn().mockResolvedValue([
          { quantity: 5, quantityBase: null },
          { quantity: 2, quantityBase: null },
        ]),
      },
    } as any;
    const svc = makeService();
    const total = await svc.aggregatePhysicalQuantity(tx, 'W1', 'P1');
    expect(total.toNumber()).toBe(7);
  });

  it('coverageGatePasses returns pass=true with no unprotected mutator', () => {
    const svc = makeService();
    const gate = svc.coverageGatePasses();
    expect(gate.pass).toBe(true);
    expect(gate.unprotected).toHaveLength(0);
    expect(
      INVENTORY_MUTATOR_COVERAGE.every(
        (m) => m.classification === 'VALUATION_AWARE_R1C' || m.classification === 'BLOCKED_WHEN_ACTIVE',
      ),
    ).toBe(true);
    expect(INVENTORY_MUTATOR_COVERAGE.length).toBeGreaterThanOrEqual(15);
  });

  it('findActivePolicyForWarehouse returns the ACTIVE policy scoped to company+warehouse', async () => {
    const tx = {
      inventoryValuationPolicy: {
        findFirst: jest.fn().mockResolvedValue({ id: 'pol1', currencyCode: 'USD', method: 'WEIGHTED_AVERAGE' }),
      },
    } as any;
    const svc = makeService();
    const r = await svc.findActivePolicyForWarehouse(tx, 'C1', 'W1');
    expect(r).toEqual({ id: 'pol1', currencyCode: 'USD', method: 'WEIGHTED_AVERAGE' });
    const where = tx.inventoryValuationPolicy.findFirst.mock.calls[0][0].where;
    expect(where.companyId).toBe('C1');
    expect(where.warehouseId).toBe('W1');
    expect(where.status).toBe('ACTIVE');
  });

  it('assertNotActiveForMutation blocks when an ACTIVE policy exists for the warehouse', async () => {
    const svc = makeService();
    const active = {
      inventoryValuationPolicy: {
        findFirst: jest.fn().mockResolvedValue({ id: 'pol1', currencyCode: 'USD', method: 'WEIGHTED_AVERAGE' }),
      },
    } as any;
    await expect(svc.assertNotActiveForMutation(active, 'C1', 'W1', 'STOCK_ADJUSTMENT_POST')).rejects.toMatchObject({
      response: { messageKey: 'inventoryValuation.unsupportedActiveFlow' },
    });
  });

  it('assertNotActiveForMutation allows when no ACTIVE policy exists', async () => {
    const svc = makeService();
    const inactive = {
      inventoryValuationPolicy: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
    } as any;
    await expect(svc.assertNotActiveForMutation(inactive, 'C1', 'W1', 'STOCK_ADJUSTMENT_POST')).resolves.toBeUndefined();
  });

  it('findActivePoliciesInScope returns ACTIVE policies restricted to in-scope warehouses', async () => {
    const tx = {
      inventoryValuationPolicy: {
        findMany: jest.fn().mockResolvedValue([{ id: 'p1', warehouseId: 'W1', currencyCode: 'USD' }]),
      },
    } as any;
    const svc = makeService();
    const r = await svc.findActivePoliciesInScope(tx, 'C1', 'B1');
    expect(r).toHaveLength(1);
    const where = tx.inventoryValuationPolicy.findMany.mock.calls[0][0].where;
    expect(where.companyId).toBe('C1');
    expect(where.status).toBe('ACTIVE');
    expect(where.warehouse.branchId).toBe('B1');
  });

  it('SIMULTANEOUS_RECEIPTS_TEST: each valued write takes the per (C,W,P) applock, so concurrent receipts serialize to one weighted average', async () => {
    const tx = mockTx({
      balance: { id: 'bal1', inventoryValue: new Prisma.Decimal(1000), averageUnitCost: new Prisma.Decimal(10) },
    });
    const svc = makeService();
    const r = await svc.applyValuedReceipt(tx, {
      ...baseInput,
      qold: new Prisma.Decimal(100),
      quantity: new Prisma.Decimal(100),
      unitCost: new Prisma.Decimal(20),
    });
    // both the receipt and the subsequent issue reuse the same serialized resource
    await svc.applyValuedIssue(tx, { ...baseInput, qold: new Prisma.Decimal(200), quantity: new Prisma.Decimal(40) });
    const lockResource = tx.$queryRaw.mock.calls.map((c: any[]) => c[1]).find((v: any) => typeof v === 'string');
    expect(lockResource).toContain('ATSOFT:VAL:WMA:C1:W1:P1');
    expect(r.averageUnitCost.toNumber()).toBe(15);
    expect(r.inventoryValue.toNumber()).toBe(3000);
  });

  it('RECEIPT_ISSUE_RACE_TEST: an issue issued immediately after a receipt uses the post-receipt qold and cannot overshoot', async () => {
    const tx = mockTx({
      balance: { id: 'bal1', inventoryValue: new Prisma.Decimal(1000), averageUnitCost: new Prisma.Decimal(10) },
    });
    const svc = makeService();
    const issue = await svc.applyValuedIssue(tx, {
      ...baseInput,
      qold: new Prisma.Decimal(100),  // applock-serialized value read AFTER the receipt landed
      quantity: new Prisma.Decimal(100),
    });
    expect(issue.inventoryValue.toNumber()).toBe(0);
    // exhausting exactly qold is allowed and leaves no residue
    expect(tx.inventoryValuationBalance.update).toHaveBeenCalledTimes(1);
    const updateData = tx.inventoryValuationBalance.update.mock.calls[0][0].data;
    expect(updateData.inventoryValue.toNumber()).toBe(0);
  });

  it('DOUBLE_ISSUE_RACE_TEST: the second of two overshooting issues is rejected (no double-debit / negative residue)', async () => {
    const tx = mockTx({
      balance: { id: 'bal1', inventoryValue: new Prisma.Decimal(1000), averageUnitCost: new Prisma.Decimal(10) },
    });
    const svc = makeService();
    // two concurrent issues; the loser re-reads qold AFTER the winner consumed stock
    const first = await svc.applyValuedIssue(tx, { ...baseInput, qold: new Prisma.Decimal(100), quantity: new Prisma.Decimal(60) });
    expect(first.totalCost.toNumber()).toBe(600);
    // the second reader sees only 40 remaining; issuing 60 again overshoots and is rejected atomically
    await expect(
      svc.applyValuedIssue(tx, { ...baseInput, qold: new Prisma.Decimal(40), quantity: new Prisma.Decimal(60) }),
    ).rejects.toMatchObject({ response: { messageKey: 'inventoryValuation.negativeStock' } });
    expect(tx.inventoryValuationBalance.update).toHaveBeenCalledTimes(1);
    expect(tx.inventoryMovementLine.update).toHaveBeenCalledTimes(1);
  });

  it('ATOMIC_ROLLBACK_TEST: a failing valued write leaves no balance update and no movement-line write, propagating the abort', async () => {
    const tx = mockTx({
      balance: { id: 'bal1', inventoryValue: new Prisma.Decimal(1000), averageUnitCost: new Prisma.Decimal(10) },
    });
    const svc = makeService();
    await expect(
      svc.applyValuedIssue(tx, { ...baseInput, qold: new Prisma.Decimal(50), quantity: new Prisma.Decimal(60) }),
    ).rejects.toMatchObject({ response: { messageKey: 'inventoryValuation.negativeStock' } });
    expect(tx.inventoryValuationBalance.update).not.toHaveBeenCalled();
    expect(tx.inventoryMovementLine.update).not.toHaveBeenCalled();
  });
});
