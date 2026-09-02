import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { InventoryMovementsService } from '../inventory-movements/inventory-movements.service';
import { InventoryValuationEngineService } from '../inventory-valuation/inventory-valuation-engine.service';

const ctx: any = { companyId: 'c1', branchId: 'b1' };

type HarnessOptions = {
  active?: boolean;
  documentType?: 'ISSUE' | 'CONSUMPTION' | 'RETURN' | 'SUBSTITUTION';
  movementType?: string;
  sourceType?: string;
  products?: Array<{ id: string; quantity: number; value: number; average: number; consume: number }>;
  original?: {
    quantity: number;
    unitCost: number;
    totalCost: number;
    currencyCode?: string | null;
    valuationMethod?: string | null;
  };
  originalIssueLineId?: string | null;
  priorReturns?: Array<{ quantity: number; totalCost: number }>;
  companyId?: string;
};

function makeHarness(options: HarnessOptions = {}) {
  const documentType = options.documentType ?? 'CONSUMPTION';
  const direction = documentType === 'RETURN' ? 'IN' : 'OUT';
  const movementType = options.movementType ?? ({
    ISSUE: 'PRODUCTION_ISSUE',
    CONSUMPTION: 'PRODUCTION_CONSUMPTION',
    RETURN: 'PRODUCTION_RETURN',
    SUBSTITUTION: 'PRODUCTION_SUBSTITUTION',
  } as const)[documentType];
  const products = options.products ?? [{ id: 'p1', quantity: 100, value: 1000, average: 10, consume: 20 }];

  const physical = new Map(products.map((p) => [p.id, new Prisma.Decimal(p.quantity)]));
  const valuation = new Map(products.map((p) => [p.id, {
    id: `vb-${p.id}`,
    inventoryValue: new Prisma.Decimal(p.value),
    averageUnitCost: new Prisma.Decimal(p.average),
    lastHistoricalUnitCost: new Prisma.Decimal(p.average),
  }]));
  const movementLines = products.map((p, index) => ({
    id: `ml${index + 1}`,
    productId: p.id,
    warehouseLocationId: null,
    quantity: p.consume,
    quantityBase: new Prisma.Decimal(p.consume),
    batchNumber: null,
    serialNumber: null,
    expiryDate: null,
    direction,
    unitCost: null,
    totalCost: null,
    currencyCode: null,
    valuationMethod: null,
  }));
  const docLines = products.map((p, index) => ({
    id: `dl${index + 1}`,
    lineNumber: index + 1,
    productId: p.id,
    warehouseLocationId: null,
    quantity: new Prisma.Decimal(p.consume),
    batchNumber: null,
    serialNumber: null,
    expiryDate: null,
    originalIssueLineId: documentType === 'RETURN' ? (options.originalIssueLineId === undefined ? 'oil1' : options.originalIssueLineId) : null,
    costPurpose: 'PRODUCTION',
    productionLineId: 'line-snapshot',
    departmentId: 'dept-snapshot',
    costCenterId: 'cc-snapshot',
    machineId: 'machine-snapshot',
  }));
  const state = {
    movementStatus: 'DRAFT',
    physical,
    valuation,
    quartetUpdates: [] as any[],
    physicalUpdates: [] as any[],
    monetaryUpdates: [] as any[],
  };
  const movement = {
    id: 'mov1',
    companyId: options.companyId ?? 'c1',
    branchId: 'b1',
    warehouseId: 'wh1',
    movementType,
    sourceType: options.sourceType ?? 'PRODUCTION_MATERIAL_DOCUMENT',
    reversesMovementId: null,
    status: state.movementStatus,
    deletedAt: null,
    lines: movementLines,
  };
  const doc = {
    id: 'doc1',
    companyId: options.companyId ?? 'c1',
    branchId: 'b1',
    productionOrderId: 'po1',
    issueWarehouseId: 'wh1',
    movementId: 'mov1',
    status: 'DRAFT',
    documentType,
    lines: docLines,
  };

  const originalInput = options.original ?? { quantity: 10, unitCost: 12, totalCost: 120 };
  const originalMovementLine = {
    id: 'oml1', productId: 'p1', warehouseLocationId: null,
    quantity: originalInput.quantity, quantityBase: new Prisma.Decimal(originalInput.quantity),
    batchNumber: null, serialNumber: null, expiryDate: null, direction: 'OUT',
    unitCost: originalInput.unitCost, totalCost: originalInput.totalCost,
    currencyCode: originalInput.currencyCode === undefined ? 'USD' : originalInput.currencyCode,
    valuationMethod: originalInput.valuationMethod === undefined ? 'WEIGHTED_AVERAGE' : originalInput.valuationMethod,
  };
  const originalLine = {
    id: 'oil1', companyId: 'c1', branchId: 'b1', productId: 'p1',
    warehouseLocationId: null, quantity: new Prisma.Decimal(originalInput.quantity),
    batchNumber: null, serialNumber: null, expiryDate: null,
    document: {
      id: 'original-doc', status: 'POSTED', documentType: 'CONSUMPTION',
      productionOrderId: 'po1', issueWarehouseId: 'wh1',
      movement: { id: 'original-mov', status: 'POSTED', lines: [originalMovementLine] },
    },
  };
  const priorReturnLines = (options.priorReturns ?? []).map((prior, index) => ({
    id: `prior-${index}`,
    productId: 'p1', warehouseLocationId: null, quantity: new Prisma.Decimal(prior.quantity),
    batchNumber: null, serialNumber: null, expiryDate: null,
    document: {
      movement: {
        lines: [{
          id: `prior-ml-${index}`, productId: 'p1', warehouseLocationId: null,
          quantity: prior.quantity, quantityBase: new Prisma.Decimal(prior.quantity),
          batchNumber: null, serialNumber: null, expiryDate: null, direction: 'IN',
          totalCost: new Prisma.Decimal(prior.totalCost),
        }],
      },
    },
  }));

  const raw = jest.fn().mockResolvedValue([{ result: 0 }]);
  const operationalCostCreate = jest.fn();
  const tx: any = {
    $queryRaw: raw,
    inventoryValuationPolicy: {
      findFirst: jest.fn().mockResolvedValue(options.active === false ? null : { id: 'policy1', currencyCode: 'USD', method: 'WEIGHTED_AVERAGE' }),
    },
    inventoryMovement: {
      findUnique: jest.fn().mockImplementation(async () => ({ ...movement, status: state.movementStatus, lines: movementLines })),
      updateMany: jest.fn().mockImplementation(async () => {
        if (state.movementStatus !== 'DRAFT') return { count: 0 };
        state.movementStatus = 'POSTED';
        return { count: 1 };
      }),
    },
    inventoryBalance: {
      findFirst: jest.fn().mockImplementation(async ({ where }: any) => {
        const q = state.physical.get(where.productId);
        return q === undefined ? null : { id: `ib-${where.productId}`, productId: where.productId, quantity: q.toNumber(), quantityBase: q };
      }),
      findMany: jest.fn().mockImplementation(async ({ where }: any) => {
        const q = state.physical.get(where.productId);
        return q === undefined ? [] : [{ quantity: q.toNumber(), quantityBase: q }];
      }),
      create: jest.fn().mockImplementation(async ({ data }: any) => {
        const q = new Prisma.Decimal(data.quantityBase ?? data.quantity ?? 0);
        state.physical.set(data.productId, q);
        return { id: `ib-${data.productId}`, ...data };
      }),
      update: jest.fn().mockImplementation(async ({ where, data }: any) => {
        const productId = where.id.replace('ib-', '');
        const q = new Prisma.Decimal(data.quantityBase);
        state.physical.set(productId, q);
        state.physicalUpdates.push({ productId, quantity: data.quantity, quantityBase: q });
        return { id: where.id };
      }),
    },
    inventoryValuationBalance: {
      findUnique: jest.fn().mockImplementation(async ({ where }: any) => state.valuation.get(where.companyId_warehouseId_productId.productId) ?? null),
      update: jest.fn().mockImplementation(async ({ where, data }: any) => {
        const entry = [...state.valuation.entries()].find(([, value]) => value.id === where.id);
        if (!entry) throw new Error('valuation balance missing');
        const [productId, value] = entry;
        value.inventoryValue = new Prisma.Decimal(data.inventoryValue);
        value.averageUnitCost = new Prisma.Decimal(data.averageUnitCost);
        value.lastHistoricalUnitCost = new Prisma.Decimal(data.lastHistoricalUnitCost);
        state.monetaryUpdates.push({ productId, ...data });
        return { id: where.id };
      }),
      create: jest.fn().mockImplementation(async ({ data }: any) => {
        state.valuation.set(data.productId, { id: `vb-${data.productId}`, ...data });
        state.monetaryUpdates.push(data);
        return { id: `vb-${data.productId}` };
      }),
    },
    inventoryMovementLine: {
      update: jest.fn().mockImplementation(async ({ where, data }: any) => {
        const line = movementLines.find((candidate) => candidate.id === where.id)!;
        Object.assign(line, data);
        state.quartetUpdates.push({ lineId: where.id, ...data });
        return line;
      }),
    },
    productionMaterialDocument: {
      findFirst: jest.fn().mockResolvedValue(doc),
    },
    productionMaterialDocumentLine: {
      findFirst: jest.fn().mockResolvedValue(originalLine),
      findMany: jest.fn().mockResolvedValue(priorReturnLines),
    },
    warehouse: { findUnique: jest.fn().mockResolvedValue({ id: 'wh1', companyId: 'c1', branchId: 'b1', status: 'ACTIVE', deletedAt: null }) },
    warehouseLocation: { findUnique: jest.fn() },
    product: { findUnique: jest.fn().mockImplementation(async ({ where }: any) => ({ id: where.id, name: where.id, deletedAt: null })) },
    operationalCostTransaction: { create: operationalCostCreate, findFirst: jest.fn().mockResolvedValue(null) },
  };
  const audit: any = { logWithClient: jest.fn() };
  const prisma: any = {};
  const engine = new InventoryValuationEngineService(prisma);
  const productionCost: any = {
    postLedgerEntryWithinTransaction: jest.fn().mockResolvedValue({}),
    reverseLedgerEntry: jest.fn().mockResolvedValue({}),
  };
  const service = new InventoryMovementsService(prisma, audit, {} as any, engine, productionCost);

  const post = () => service.postProductionMaterialMovementWithinTransaction(tx, 'doc1', 'mov1', 'u1', ctx);
  const postGeneric = () => service.postMovementWithinTransaction(tx, 'mov1', 'u1', ctx);
  const transactionalPost = async () => {
    const snapshot = {
      movementStatus: state.movementStatus,
      physical: new Map([...state.physical].map(([key, value]) => [key, new Prisma.Decimal(value)])),
      valuation: new Map([...state.valuation].map(([key, value]) => [key, { ...value, inventoryValue: new Prisma.Decimal(value.inventoryValue), averageUnitCost: new Prisma.Decimal(value.averageUnitCost) }])),
      physicalUpdates: [...state.physicalUpdates],
      monetaryUpdates: [...state.monetaryUpdates],
      quartetUpdates: [...state.quartetUpdates],
      movementLines: movementLines.map((line) => ({ ...line })),
    };
    try {
      return await post();
    } catch (error) {
      state.movementStatus = snapshot.movementStatus;
      state.physical = snapshot.physical;
      state.valuation = snapshot.valuation;
      state.physicalUpdates = snapshot.physicalUpdates;
      state.monetaryUpdates = snapshot.monetaryUpdates;
      state.quartetUpdates = snapshot.quartetUpdates;
      movementLines.forEach((line, index) => Object.assign(line, snapshot.movementLines[index]));
      throw error;
    }
  };

  return { state, tx, raw, movement, movementLines, doc, docLines, service, engine, post, postGeneric, transactionalPost, operationalCostCreate };
}

describe('VAL-R1F production material valuation', () => {
  it('ACTIVE production CONSUMPTION uses the current moving average (100/1000 - 20 = 80/800)', async () => {
    const h = makeHarness();
    await h.post();
    expect(h.state.physical.get('p1')!.toString()).toBe('80');
    expect(h.state.valuation.get('p1')!.inventoryValue.toString()).toBe('800');
    expect(h.state.valuation.get('p1')!.averageUnitCost.toString()).toBe('10');
  });

  it('physical quantity and quantityBase are decremented exactly once', async () => {
    const h = makeHarness();
    await h.post();
    expect(h.state.physicalUpdates).toHaveLength(1);
    expect(h.state.physicalUpdates[0]).toMatchObject({ quantity: 80 });
    expect(h.state.physicalUpdates[0].quantityBase.toString()).toBe('80');
  });

  it('monetary value is decremented exactly once', async () => {
    const h = makeHarness();
    await h.post();
    expect(h.state.monetaryUpdates).toHaveLength(1);
    expect(h.state.monetaryUpdates[0].inventoryValue.toString()).toBe('800');
  });

  it('persists the immutable monetary quartet on the exact movement line', async () => {
    const h = makeHarness();
    await h.post();
    expect(h.state.quartetUpdates).toHaveLength(1);
    expect(h.state.quartetUpdates[0].unitCost.toString()).toBe('10');
    expect(h.state.quartetUpdates[0].totalCost.toString()).toBe('200');
    expect(h.state.quartetUpdates[0].currencyCode).toBe('USD');
    expect(h.state.quartetUpdates[0].valuationMethod).toBe('WEIGHTED_AVERAGE');
  });

  it('blocks negative stock and the transaction restores every state', async () => {
    const h = makeHarness({ products: [{ id: 'p1', quantity: 10, value: 100, average: 10, consume: 20 }] });
    await expect(h.transactionalPost()).rejects.toThrow();
    expect(h.state.movementStatus).toBe('DRAFT');
    expect(h.state.physical.get('p1')!.toString()).toBe('10');
    expect(h.state.valuation.get('p1')!.inventoryValue.toString()).toBe('100');
    expect(h.state.quartetUpdates).toHaveLength(0);
  });

  it('full depletion removes exact residual value and resets average to zero', async () => {
    const h = makeHarness({ products: [{ id: 'p1', quantity: 3, value: 1, average: 0.33333333, consume: 3 }] });
    await h.post();
    expect(h.state.physical.get('p1')!.toString()).toBe('0');
    expect(h.state.valuation.get('p1')!.inventoryValue.toString()).toBe('0');
    expect(h.state.valuation.get('p1')!.averageUnitCost.toString()).toBe('0');
    expect(h.state.quartetUpdates[0].totalCost.toString()).toBe('1');
  });

  it('deduplicates and locks multi-line product scopes in canonical order before mutation', async () => {
    const h = makeHarness({ products: [
      { id: 'p2', quantity: 50, value: 250, average: 5, consume: 5 },
      { id: 'p1', quantity: 100, value: 1000, average: 10, consume: 10 },
      { id: 'p1', quantity: 100, value: 1000, average: 10, consume: 5 },
    ] });
    await h.post();
    const resources = h.raw.mock.calls.map((call: any[]) => call[1]).filter((value: any) => typeof value === 'string');
    expect(resources.slice(0, 2)).toEqual(['ATSOFT:VAL:WMA:c1:wh1:p1', 'ATSOFT:VAL:WMA:c1:wh1:p2']);
  });

  it('rolls back every earlier physical and monetary line when a later line fails', async () => {
    const h = makeHarness({ products: [
      { id: 'p1', quantity: 100, value: 1000, average: 10, consume: 20 },
      { id: 'p2', quantity: 5, value: 50, average: 10, consume: 10 },
    ] });
    await expect(h.transactionalPost()).rejects.toBeInstanceOf(BadRequestException);
    expect(h.state.movementStatus).toBe('DRAFT');
    expect(h.state.physical.get('p1')!.toString()).toBe('100');
    expect(h.state.valuation.get('p1')!.inventoryValue.toString()).toBe('1000');
    expect(h.state.physicalUpdates).toHaveLength(0);
    expect(h.state.monetaryUpdates).toHaveLength(0);
  });

  it('reposting an already POSTED movement never repeats physical or monetary effects', async () => {
    const h = makeHarness();
    await h.post();
    await h.post();
    expect(h.state.physicalUpdates).toHaveLength(1);
    expect(h.state.monetaryUpdates).toHaveLength(1);
    expect(h.state.quartetUpdates).toHaveLength(1);
  });

  it('preserves legacy physical-only posting when no ACTIVE valuation policy exists', async () => {
    const h = makeHarness({ active: false });
    await h.post();
    expect(h.state.physical.get('p1')!.toString()).toBe('80');
    expect(h.state.monetaryUpdates).toHaveLength(0);
    expect(h.state.quartetUpdates).toHaveLength(0);
  });

  it('linked RETURN uses the immutable original issue cost', async () => {
    const h = makeHarness({
      documentType: 'RETURN',
      products: [{ id: 'p1', quantity: 20, value: 300, average: 15, consume: 4 }],
      original: { quantity: 10, unitCost: 12, totalCost: 120 },
    });
    await h.post();
    expect(h.state.physical.get('p1')!.toString()).toBe('24');
    expect(h.state.valuation.get('p1')!.inventoryValue.toString()).toBe('348');
    expect(h.state.quartetUpdates[0].unitCost.toString()).toBe('12');
    expect(h.state.quartetUpdates[0].totalCost.toString()).toBe('48');
  });

  it('linked RETURN does not use the current warehouse average', async () => {
    const h = makeHarness({
      documentType: 'RETURN',
      products: [{ id: 'p1', quantity: 20, value: 300, average: 15, consume: 4 }],
      original: { quantity: 10, unitCost: 12, totalCost: 120 },
    });
    await h.post();
    expect(h.state.quartetUpdates[0].totalCost.toString()).not.toBe('60');
  });

  it('blocks a return that exceeds the original quantity after prior returns', async () => {
    const h = makeHarness({
      documentType: 'RETURN',
      products: [{ id: 'p1', quantity: 20, value: 300, average: 15, consume: 4 }],
      original: { quantity: 10, unitCost: 12, totalCost: 120 },
      priorReturns: [{ quantity: 7, totalCost: 84 }],
    });
    await expect(h.transactionalPost()).rejects.toMatchObject({ response: { messageKey: 'inventoryValuation.productionReturnExceedsOriginalIssue' } });
  });

  it('blocks an unlinked RETURN while ACTIVE before physical mutation', async () => {
    const h = makeHarness({ documentType: 'RETURN', originalIssueLineId: null });
    await expect(h.transactionalPost()).rejects.toMatchObject({ response: { messageKey: 'inventoryValuation.productionReturnOriginalIssueRequired' } });
    expect(h.state.physicalUpdates).toHaveLength(0);
  });

  it('conserves the exact original event total on the final rounded return remainder', async () => {
    const h = makeHarness({
      documentType: 'RETURN',
      products: [{ id: 'p1', quantity: 10, value: 20, average: 2, consume: 1 }],
      original: { quantity: 3, unitCost: 0.333333, totalCost: 1 },
      priorReturns: [{ quantity: 1, totalCost: 0.3333 }, { quantity: 1, totalCost: 0.3333 }],
    });
    await h.post();
    expect(h.state.quartetUpdates[0].unitCost.toString()).toBe('0.333333');
    expect(h.state.quartetUpdates[0].totalCost.toString()).toBe('0.3334');
  });

  it('blocks a cross-tenant production document/movement mismatch', async () => {
    const h = makeHarness({ companyId: 'c2' });
    await expect(h.transactionalPost()).rejects.toThrow();
    expect(h.state.physicalUpdates).toHaveLength(0);
  });

  it('keeps production substitution blocked while ACTIVE', async () => {
    const h = makeHarness({ documentType: 'SUBSTITUTION' });
    await expect(h.transactionalPost()).rejects.toMatchObject({ response: { messageKey: 'inventoryValuation.unsupportedActiveFlow' } });
  });

  it('blocks generic endpoint bypass for a production material source', async () => {
    const h = makeHarness();
    await expect(h.postGeneric()).rejects.toMatchObject({ response: { messageKey: 'inventoryValuation.unsupportedActiveFlow' } });
    expect(h.state.physicalUpdates).toHaveLength(0);
  });

  it('keeps finished-goods receipt posting blocked while ACTIVE', async () => {
    const h = makeHarness({
      movementType: 'PRODUCTION_FG_RECEIPT',
      sourceType: 'PRODUCTION_FINISHED_GOODS_RECEIPT',
    });
    await expect(h.postGeneric()).rejects.toMatchObject({ response: { messageKey: 'inventoryValuation.unsupportedActiveFlow' } });
    expect(h.state.physicalUpdates).toHaveLength(0);
  });

  it('does not create OperationalCostTransaction or a second material-cost authority', async () => {
    const h = makeHarness();
    await h.post();
    expect(h.operationalCostCreate).not.toHaveBeenCalled();
    expect(h.state.quartetUpdates).toHaveLength(1);
  });

  it('retains the posted production attribution and PRODUCTION cost-purpose snapshots untouched', async () => {
    const h = makeHarness();
    const before = { ...h.docLines[0] };
    await h.post();
    expect(h.docLines[0]).toMatchObject({
      costPurpose: 'PRODUCTION',
      productionLineId: 'line-snapshot',
      departmentId: 'dept-snapshot',
      costCenterId: 'cc-snapshot',
      machineId: 'machine-snapshot',
    });
    expect(h.docLines[0]).toEqual(before);
  });
});
