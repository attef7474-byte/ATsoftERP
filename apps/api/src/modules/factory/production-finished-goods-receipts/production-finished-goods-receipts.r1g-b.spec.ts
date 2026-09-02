import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { InventoryMovementsService } from '../inventory-movements/inventory-movements.service';
import { InventoryValuationEngineService } from '../inventory-valuation/inventory-valuation-engine.service';

const ctx: any = { companyId: 'c1', branchId: 'b1' };

type PostedReceiptInput = {
  id: string;
  quantity: number;
  totalCost: number;
  unitCost?: number;
  reversalOf?: string;
  valued?: boolean;
  warehouseId?: string;
  productId?: string;
};

type HarnessOptions = {
  active?: boolean;
  physical?: number;
  inventoryValue?: number;
  average?: number;
  receiptQty?: number;
  receiptLines?: number[];
  snapshotQty?: number;
  snapshotValue?: number;
  snapshotCurrency?: string;
  snapshotProductId?: string;
  snapshotCostBasis?: string;
  snapshotClosed?: boolean;
  snapshotMissing?: boolean;
  runClosed?: boolean;
  companyId?: string;
  productId?: string;
  sourceType?: string;
  movementSourceType?: string;
  movementType?: string;
  movementSourceId?: string | null;
  prefilledCost?: boolean;
  postedReceipts?: PostedReceiptInput[];
};

function postedReceipt(input: PostedReceiptInput) {
  const productId = input.productId ?? 'fg1';
  const warehouseId = input.warehouseId ?? 'wh1';
  const reversal = !!input.reversalOf;
  const unitCost = input.unitCost ?? input.totalCost / input.quantity;
  return {
    id: input.id,
    companyId: 'c1',
    branchId: 'b1',
    productionOrderId: 'po1',
    productionRunId: 'run1',
    receiptWarehouseId: warehouseId,
    status: 'POSTED',
    sourceType: reversal ? 'REVERSE' : 'MANUAL',
    lines: [{
      id: `${input.id}-rl1`, lineNumber: 1, productId, quantity: new Prisma.Decimal(input.quantity),
      quantityBase: new Prisma.Decimal(input.quantity), warehouseLocationId: null, batchNumber: null,
      serialNumber: null, expiryDate: null, unit: 'PCS',
    }],
    movement: {
      id: `${input.id}-mov`, status: 'POSTED', warehouseId,
      movementType: reversal ? 'PRODUCTION_FG_RECEIPT_REVERSAL' : 'PRODUCTION_FG_RECEIPT',
      sourceType: 'PRODUCTION_FINISHED_GOODS_RECEIPT',
      sourceId: input.reversalOf ?? null,
      lines: [{
        id: `${input.id}-ml1`, productId, quantity: input.quantity,
        quantityBase: new Prisma.Decimal(input.quantity), warehouseLocationId: null, batchNumber: null,
        serialNumber: null, expiryDate: null, unit: 'PCS', direction: reversal ? 'OUT' : 'IN',
        unitCost: input.valued === false ? null : new Prisma.Decimal(unitCost),
        totalCost: input.valued === false ? null : new Prisma.Decimal(input.totalCost),
        currencyCode: input.valued === false ? null : 'USD',
        valuationMethod: input.valued === false ? null : 'WEIGHTED_AVERAGE',
      }],
    },
  };
}

function makeHarness(options: HarnessOptions = {}) {
  const productId = options.productId ?? 'fg1';
  const receiptLineQuantities = options.receiptLines ?? [options.receiptQty ?? 100];
  const direction = options.sourceType === 'REVERSE' ? 'OUT' : 'IN';
  const movementLines = receiptLineQuantities.map((quantity, index) => ({
    id: `ml${index + 1}`, productId, quantity, quantityBase: new Prisma.Decimal(quantity),
    warehouseLocationId: null, batchNumber: null, serialNumber: null, expiryDate: null,
    unit: 'PCS', direction,
    unitCost: options.prefilledCost ? new Prisma.Decimal(99) : null,
    totalCost: options.prefilledCost ? new Prisma.Decimal(99 * quantity) : null,
    currencyCode: options.prefilledCost ? 'USD' : null,
    valuationMethod: options.prefilledCost ? 'WEIGHTED_AVERAGE' : null,
  }));
  const receiptLines = receiptLineQuantities.map((quantity, index) => ({
    id: `rl${index + 1}`, lineNumber: index + 1, productId,
    quantity: new Prisma.Decimal(quantity), quantityBase: new Prisma.Decimal(quantity),
    warehouseLocationId: null, batchNumber: null, serialNumber: null, expiryDate: null, unit: 'PCS',
  }));
  const state = {
    movementStatus: 'DRAFT',
    physical: new Prisma.Decimal(options.physical ?? 0),
    valuation: options.inventoryValue === undefined && (options.physical ?? 0) === 0 ? null as any : {
      id: 'vb1', inventoryValue: new Prisma.Decimal(options.inventoryValue ?? 0),
      averageUnitCost: new Prisma.Decimal(options.average ?? 0), lastHistoricalUnitCost: new Prisma.Decimal(options.average ?? 0),
    },
    physicalUpdates: [] as any[],
    monetaryUpdates: [] as any[],
    quartetUpdates: [] as any[],
  };
  const movement = {
    id: 'mov1', companyId: options.companyId ?? 'c1', branchId: 'b1', warehouseId: 'wh1',
    movementType: options.movementType ?? (direction === 'IN' ? 'PRODUCTION_FG_RECEIPT' : 'PRODUCTION_FG_RECEIPT_REVERSAL'),
    sourceType: options.movementSourceType ?? 'PRODUCTION_FINISHED_GOODS_RECEIPT',
    sourceId: options.movementSourceId === undefined ? (direction === 'OUT' ? 'original' : null) : options.movementSourceId,
    reversesMovementId: null, status: state.movementStatus, deletedAt: null, lines: movementLines,
  };
  const receipt = {
    id: 'receipt1', companyId: options.companyId ?? 'c1', branchId: 'b1',
    productionOrderId: 'po1', productionRunId: 'run1', receiptWarehouseId: 'wh1',
    status: 'DRAFT', movementId: 'mov1', sourceType: options.sourceType ?? 'MANUAL', lines: receiptLines,
  };
  const snapshot = {
    id: 'snapshot1', companyId: 'c1', branchId: 'b1', productionRunId: 'run1',
    finalProductId: options.snapshotProductId ?? 'fg1',
    finalGoodQuantity: new Prisma.Decimal(options.snapshotQty ?? 100),
    netMaterialValue: new Prisma.Decimal(options.snapshotValue ?? 900),
    currencyCode: options.snapshotCurrency ?? 'USD',
    costBasis: options.snapshotCostBasis ?? 'NET_ACTUAL_MATERIAL_VALUE_ONLY',
    closedAt: options.snapshotClosed === false ? null : new Date(),
  };
  const priorReceipts = (options.postedReceipts ?? []).map(postedReceipt);
  const raw = jest.fn().mockResolvedValue([{ result: 0 }]);
  const tx: any = {
    $queryRaw: raw,
    inventoryValuationPolicy: { findFirst: jest.fn().mockResolvedValue(options.active === false ? null : { id: 'policy1', currencyCode: 'USD', method: 'WEIGHTED_AVERAGE' }) },
    inventoryMovement: {
      findUnique: jest.fn().mockImplementation(async () => ({ ...movement, status: state.movementStatus, lines: movementLines })),
      updateMany: jest.fn().mockImplementation(async () => {
        if (state.movementStatus !== 'DRAFT') return { count: 0 };
        state.movementStatus = 'POSTED';
        return { count: 1 };
      }),
    },
    inventoryBalance: {
      findFirst: jest.fn().mockImplementation(async () => ({ id: 'ib1', productId, quantity: state.physical.toNumber(), quantityBase: state.physical })),
      findMany: jest.fn().mockImplementation(async () => [{ quantity: state.physical.toNumber(), quantityBase: state.physical }]),
      create: jest.fn(),
      update: jest.fn().mockImplementation(async ({ data }: any) => {
        state.physical = new Prisma.Decimal(data.quantityBase);
        state.physicalUpdates.push(data);
        return { id: 'ib1' };
      }),
    },
    inventoryValuationBalance: {
      findUnique: jest.fn().mockImplementation(async () => state.valuation),
      create: jest.fn().mockImplementation(async ({ data }: any) => {
        state.valuation = { id: 'vb1', ...data };
        state.monetaryUpdates.push(data);
        return { id: 'vb1' };
      }),
      update: jest.fn().mockImplementation(async ({ data }: any) => {
        state.valuation = { ...state.valuation, ...data };
        state.monetaryUpdates.push(data);
        return { id: 'vb1' };
      }),
    },
    inventoryMovementLine: {
      update: jest.fn().mockImplementation(async ({ where, data }: any) => {
        Object.assign(movementLines.find((line) => line.id === where.id)!, data);
        state.quartetUpdates.push({ lineId: where.id, ...data });
        return {};
      }),
    },
    productionFinishedGoodsReceipt: {
      findFirst: jest.fn().mockResolvedValue(receipt),
      findMany: jest.fn().mockResolvedValue(priorReceipts),
    },
    productionRun: {
      findFirst: jest.fn().mockResolvedValue({ id: 'run1', productionOrderId: 'po1', costClosedAt: options.runClosed === false ? null : new Date() }),
    },
    productionRunCostSnapshot: {
      findFirst: jest.fn().mockResolvedValue(options.snapshotMissing ? null : snapshot),
    },
    warehouse: { findUnique: jest.fn().mockResolvedValue({ id: 'wh1', companyId: 'c1', branchId: 'b1', status: 'ACTIVE', deletedAt: null }) },
    warehouseLocation: { findUnique: jest.fn() },
    product: { findUnique: jest.fn().mockResolvedValue({ id: productId, name: 'FG', status: 'ACTIVE', deletedAt: null }) },
  };
  const audit: any = { logWithClient: jest.fn() };
  const engine = new InventoryValuationEngineService({} as any);
  const service = new InventoryMovementsService({} as any, audit, {} as any, engine);
  const post = () => service.postProductionFinishedGoodsMovementWithinTransaction(tx, 'receipt1', 'mov1', 'u1', ctx);
  const postGeneric = () => service.postMovementWithinTransaction(tx, 'mov1', 'u1', ctx);
  const transactionalPost = async () => {
    const before = {
      movementStatus: state.movementStatus,
      physical: new Prisma.Decimal(state.physical),
      valuation: state.valuation && { ...state.valuation },
      physicalUpdates: [...state.physicalUpdates], monetaryUpdates: [...state.monetaryUpdates],
      quartetUpdates: [...state.quartetUpdates], movementLines: movementLines.map((line) => ({ ...line })),
    };
    try {
      return await post();
    } catch (error) {
      state.movementStatus = before.movementStatus;
      state.physical = before.physical;
      state.valuation = before.valuation;
      state.physicalUpdates = before.physicalUpdates;
      state.monetaryUpdates = before.monetaryUpdates;
      state.quartetUpdates = before.quartetUpdates;
      movementLines.forEach((line, index) => Object.assign(line, before.movementLines[index]));
      throw error;
    }
  };
  return { state, tx, raw, snapshot, movementLines, post, postGeneric, transactionalPost };
}

describe('VAL-R1G-B finished-goods valuation', () => {
  it('values an ACTIVE closed-run receipt only from the frozen snapshot', async () => {
    const h = makeHarness();
    await h.post();
    expect(h.state.physical.toString()).toBe('100');
    expect(h.state.valuation.inventoryValue.toString()).toBe('900');
    expect(h.state.valuation.averageUnitCost.toString()).toBe('9');
  });

  it('blocks ACTIVE finished goods when the production run is not cost-closed', async () => {
    const h = makeHarness({ runClosed: false });
    await expect(h.transactionalPost()).rejects.toMatchObject({ response: { messageKey: 'inventoryValuation.productionFinishedGoodsRunNotClosed' } });
  });

  it('blocks ACTIVE finished goods when the immutable snapshot is missing', async () => {
    const h = makeHarness({ snapshotMissing: true });
    await expect(h.transactionalPost()).rejects.toMatchObject({ response: { messageKey: 'inventoryValuation.productionFinishedGoodsSnapshotInvalid' } });
  });

  it.each([
    ['snapshot is not closed', { snapshotClosed: false }],
    ['frozen final-good quantity is zero', { snapshotQty: 0 }],
    ['frozen net material value is negative', { snapshotValue: -1 }],
    ['cost basis is not the R1G-A authority', { snapshotCostBasis: 'LIVE_RECOMPUTE' }],
  ] as const)('blocks ACTIVE finished goods when %s', async (_label, invalidOptions) => {
    const h = makeHarness(invalidOptions);
    await expect(h.transactionalPost()).rejects.toMatchObject({
      response: { messageKey: 'inventoryValuation.productionFinishedGoodsSnapshotInvalid' },
    });
    expect(h.state.physicalUpdates).toHaveLength(0);
    expect(h.state.monetaryUpdates).toHaveLength(0);
  });

  it('uses exact snapshot value rather than any current material or loss computation', async () => {
    const h = makeHarness({ snapshotValue: 913.2754 });
    await h.post();
    expect(h.state.quartetUpdates[0].totalCost.toString()).toBe('913.2754');
    expect(h.tx.productionRunCostSnapshot.findFirst).toHaveBeenCalledTimes(1);
    expect((h.tx as any).productionMaterialDocument).toBeUndefined();
    expect((h.tx as any).productionLossQuantityEvent).toBeUndefined();
  });

  it('creates one physical increment and one monetary increment', async () => {
    const h = makeHarness();
    await h.post();
    expect(h.state.physicalUpdates).toHaveLength(1);
    expect(h.state.monetaryUpdates).toHaveLength(1);
  });

  it('persists the complete immutable movement monetary quartet', async () => {
    const h = makeHarness();
    await h.post();
    expect(h.state.quartetUpdates).toHaveLength(1);
    expect(h.state.quartetUpdates[0]).toMatchObject({ currencyCode: 'USD', valuationMethod: 'WEIGHTED_AVERAGE' });
    expect(h.state.quartetUpdates[0].unitCost.toString()).toBe('9');
    expect(h.state.quartetUpdates[0].totalCost.toString()).toBe('900');
  });

  it('blends into existing destination inventory without replacing its value', async () => {
    const h = makeHarness({ physical: 50, inventoryValue: 1000, average: 20 });
    await h.post();
    expect(h.state.physical.toString()).toBe('150');
    expect(h.state.valuation.inventoryValue.toString()).toBe('1900');
    expect(h.state.valuation.averageUnitCost.toString()).toBe('12.66666667');
  });

  it('allocates a non-final 40-unit partial receipt proportionally', async () => {
    const h = makeHarness({ receiptQty: 40 });
    await h.post();
    expect(h.state.quartetUpdates[0].totalCost.toString()).toBe('360');
  });

  it('allocates a middle 35-unit partial receipt after 40 units', async () => {
    const h = makeHarness({ receiptQty: 35, postedReceipts: [{ id: 'first', quantity: 40, totalCost: 360 }] });
    await h.post();
    expect(h.state.quartetUpdates[0].totalCost.toString()).toBe('315');
  });

  it('uses the exact remaining value for the final 25-unit receipt', async () => {
    const h = makeHarness({
      receiptQty: 25,
      postedReceipts: [
        { id: 'first', quantity: 40, totalCost: 360 },
        { id: 'second', quantity: 35, totalCost: 315 },
      ],
    });
    await h.post();
    expect(h.state.quartetUpdates[0].totalCost.toString()).toBe('225');
    expect(new Prisma.Decimal(360).plus(315).plus(h.state.quartetUpdates[0].totalCost).toString()).toBe('900');
  });

  it('conserves a rounded 4dp final remainder exactly', async () => {
    const h = makeHarness({
      receiptQty: 1, snapshotQty: 3, snapshotValue: 1,
      postedReceipts: [
        { id: 'first', quantity: 1, totalCost: 0.3333, unitCost: 0.3333 },
        { id: 'second', quantity: 1, totalCost: 0.3333, unitCost: 0.3333 },
      ],
    });
    await h.post();
    expect(h.state.quartetUpdates[0].totalCost.toString()).toBe('0.3334');
  });

  it('splits one receipt across movement lines while conserving its exact total', async () => {
    const h = makeHarness({ receiptLines: [40, 60] });
    await h.post();
    expect(h.state.quartetUpdates.map((line) => line.totalCost.toString())).toEqual(['360', '540']);
    expect(h.state.quartetUpdates.reduce((sum, line) => sum.plus(line.totalCost), new Prisma.Decimal(0)).toString()).toBe('900');
  });

  it('blocks a fourth receipt after frozen run quantity is fully capitalized', async () => {
    const h = makeHarness({ receiptQty: 1, postedReceipts: [{ id: 'full', quantity: 100, totalCost: 900 }] });
    await expect(h.transactionalPost()).rejects.toMatchObject({ response: { messageKey: 'inventoryValuation.productionFinishedGoodsOverReceipt' } });
  });

  it('blocks an over-receipt before physical or monetary mutation', async () => {
    const h = makeHarness({ receiptQty: 30, postedReceipts: [{ id: 'first', quantity: 80, totalCost: 720 }] });
    await expect(h.transactionalPost()).rejects.toBeInstanceOf(BadRequestException);
    expect(h.state.physicalUpdates).toHaveLength(0);
    expect(h.state.monetaryUpdates).toHaveLength(0);
  });

  it('is idempotent when the same movement is posted again', async () => {
    const h = makeHarness();
    await h.post();
    await h.post();
    expect(h.state.physicalUpdates).toHaveLength(1);
    expect(h.state.monetaryUpdates).toHaveLength(1);
    expect(h.state.quartetUpdates).toHaveLength(1);
  });

  it('blocks a receipt product different from the frozen final product', async () => {
    const h = makeHarness({ snapshotProductId: 'other' });
    await expect(h.transactionalPost()).rejects.toMatchObject({ response: { messageKey: 'inventoryValuation.productionFinishedGoodsProductMismatch' } });
  });

  it('blocks destination policy currency mismatch without FX', async () => {
    const h = makeHarness({ snapshotCurrency: 'EUR' });
    await expect(h.transactionalPost()).rejects.toMatchObject({ response: { messageKey: 'inventoryValuation.productionFinishedGoodsCurrencyMismatch' } });
  });

  it('blocks historical POSTED unvalued finished-goods evidence', async () => {
    const h = makeHarness({ receiptQty: 50, postedReceipts: [{ id: 'legacy', quantity: 50, totalCost: 0, valued: false }] });
    await expect(h.transactionalPost()).rejects.toMatchObject({ response: { messageKey: 'inventoryValuation.productionFinishedGoodsEvidenceIncomplete' } });
  });

  it('forbids a prefilled or manual finished-goods cost quartet', async () => {
    const h = makeHarness({ prefilledCost: true });
    await expect(h.transactionalPost()).rejects.toMatchObject({ response: { messageKey: 'inventoryValuation.productionFinishedGoodsManualCostForbidden' } });
  });

  it('trusted full reversal removes the original receipt value, not current average', async () => {
    const h = makeHarness({
      sourceType: 'REVERSE', movementSourceId: 'original', physical: 150,
      inventoryValue: 1900, average: 12.66666667,
      postedReceipts: [
        { id: 'original', quantity: 100, totalCost: 900, unitCost: 9 },
      ],
    });
    await h.post();
    expect(h.state.physical.toString()).toBe('50');
    expect(h.state.valuation.inventoryValue.toString()).toBe('1000');
    expect(h.state.valuation.averageUnitCost.toString()).toBe('20');
    expect(h.state.quartetUpdates[0].totalCost.toString()).toBe('900');
    expect(h.state.quartetUpdates[0].unitCost.toString()).toBe('9');
  });

  it('trusted reversal decrements physical and monetary state exactly once', async () => {
    const h = makeHarness({
      sourceType: 'REVERSE', movementSourceId: 'original', physical: 100,
      inventoryValue: 900, average: 9,
      postedReceipts: [{ id: 'original', quantity: 100, totalCost: 900 }],
    });
    await h.post();
    expect(h.state.physicalUpdates).toHaveLength(1);
    expect(h.state.monetaryUpdates).toHaveLength(1);
    expect(h.state.physical.toString()).toBe('0');
    expect(h.state.valuation.inventoryValue.toString()).toBe('0');
  });

  it('blocks a second full reversal of the same receipt', async () => {
    const h = makeHarness({
      sourceType: 'REVERSE', movementSourceId: 'original', physical: 100, inventoryValue: 900, average: 9,
      postedReceipts: [
        { id: 'original', quantity: 100, totalCost: 900 },
        { id: 'first-reversal', quantity: 100, totalCost: 900, reversalOf: 'original' },
      ],
    });
    await expect(h.transactionalPost()).rejects.toMatchObject({ response: { messageKey: 'inventoryValuation.productionFinishedGoodsOverReversal' } });
  });

  it('a trusted reversal releases run quantity and value capacity for re-receipt', async () => {
    const h = makeHarness({
      receiptQty: 40,
      postedReceipts: [
        { id: 'original', quantity: 100, totalCost: 900 },
        { id: 'full-reversal', quantity: 100, totalCost: 900, reversalOf: 'original' },
      ],
    });
    await h.post();
    expect(h.state.quartetUpdates[0].totalCost.toString()).toBe('360');
  });

  it('blocks reversal when physical finished goods are insufficient', async () => {
    const h = makeHarness({
      sourceType: 'REVERSE', movementSourceId: 'original', physical: 20, inventoryValue: 180, average: 9,
      postedReceipts: [{ id: 'original', quantity: 100, totalCost: 900 }],
    });
    await expect(h.transactionalPost()).rejects.toBeInstanceOf(BadRequestException);
    expect(h.state.physical.toString()).toBe('20');
    expect(h.state.valuation.inventoryValue.toString()).toBe('180');
  });

  it('rolls back earlier physical and monetary line work when a later line fails', async () => {
    const h = makeHarness({ receiptLines: [40, 60] });
    h.tx.inventoryMovementLine.update.mockImplementationOnce(async ({ where, data }: any) => {
      Object.assign(h.movementLines.find((line) => line.id === where.id)!, data);
      h.state.quartetUpdates.push({ lineId: where.id, ...data });
      return {};
    }).mockRejectedValueOnce(new Error('forced late failure'));
    await expect(h.transactionalPost()).rejects.toThrow('forced late failure');
    expect(h.state.movementStatus).toBe('DRAFT');
    expect(h.state.physical.toString()).toBe('0');
    expect(h.state.valuation).toBeNull();
    expect(h.state.physicalUpdates).toHaveLength(0);
    expect(h.state.monetaryUpdates).toHaveLength(0);
  });

  it('blocks generic inventory movement posting from bypassing FG authority', async () => {
    const h = makeHarness();
    await expect(h.postGeneric()).rejects.toMatchObject({ response: { messageKey: 'inventoryValuation.unsupportedActiveFlow' } });
  });

  it('preserves inactive-policy legacy physical-only behavior', async () => {
    const h = makeHarness({ active: false });
    await h.post();
    expect(h.state.physical.toString()).toBe('100');
    expect(h.state.monetaryUpdates).toHaveLength(0);
    expect(h.state.quartetUpdates).toHaveLength(0);
  });

  it('blocks cross-tenant receipt and movement authority', async () => {
    const h = makeHarness({ companyId: 'c2' });
    await expect(h.transactionalPost()).rejects.toThrow();
    expect(h.state.physicalUpdates).toHaveLength(0);
  });

  it('never mutates the immutable R1G-A snapshot', async () => {
    const h = makeHarness({ receiptQty: 40 });
    const before = JSON.stringify(h.snapshot);
    await h.post();
    expect(JSON.stringify(h.snapshot)).toBe(before);
    expect(h.tx.productionRunCostSnapshot.update).toBeUndefined();
  });
});
