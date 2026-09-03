import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { MaintenanceWorkOrdersService } from './maintenance-work-orders.service';
import { InventoryValuationEngineService } from '../../inventory-valuation/inventory-valuation-engine.service';
import { PrismaService } from '../../../../common/prisma/prisma.service';
import { AuditService } from '../../../../common/audit/audit.service';
import { NumberingService } from '../../../numbering/numbering.service';
import { ActiveOperationalContext } from '../../../../common/operational-context/operational-context.types';
import { CurrentUserType } from '../../../auth/types/current-user.type';

const ctx: ActiveOperationalContext = {
  contextKey: 'c1:b1:-:-',
  scopeId: 's1',
  companyId: 'c1',
  companyName: 'Company A',
  companyCode: 'A',
  branchId: 'b1',
  branchName: 'HQ',
  branchCode: 'HQ',
  administrationId: null,
  administrationName: null,
  administrationCode: null,
  departmentId: null,
  departmentName: null,
  departmentCode: null,
  isDefault: true,
  source: 'EXPLICIT_SCOPE',
};

const user: CurrentUserType = { id: 'u1', sub: 'u1', email: 'u@a.com', name: 'U' };

interface DbState {
  physicalQuantity: number;
  physicalQuantityBase: Prisma.Decimal;
  valuationInventoryValue: Prisma.Decimal;
  valuationAverageUnitCost: Prisma.Decimal;
}

interface MockDb {
  state: DbState;
  policy: { id: string; currencyCode: string; method: string } | null;
  physicalUpdates: { quantity: number; quantityBase: Prisma.Decimal }[];
  valuationUpdates: {
    inventoryValue: Prisma.Decimal;
    averageUnitCost: Prisma.Decimal;
    lastHistoricalUnitCost?: Prisma.Decimal;
  }[];
  lineUpdates: {
    unitCost?: Prisma.Decimal;
    totalCost?: Prisma.Decimal;
    currencyCode?: string;
    valuationMethod?: string;
  }[];
  forcePhysicalUpdateError: boolean;
  maintenanceWorkOrder: { findUnique: jest.Mock };
  maintenanceWorkOrderPart: { findMany: jest.Mock; update: jest.Mock };
  inventoryValuationBalance: Record<string, unknown>;
  $transaction: jest.Mock;
  [key: string]: any;
}

const wo = (overrides: Record<string, any> = {}) => ({
  id: 'wo1',
  companyId: 'c1',
  branchId: 'b1',
  workOrderNumber: 'WO-0001',
  title: 'Fix motor',
  status: 'PLANNED',
  warehouseId: 'wh1',
  machineId: null,
  machineComponentId: null,
  requestId: null,
  ...overrides,
});

const part = (overrides: Record<string, any> = {}) => ({
  id: 'p1',
  workOrderId: 'wo1',
  productId: 'prod1',
  sparePartId: 'sp1',
  quantity: 20,
  issuedQuantity: 0,
  stockIssueStatus: 'PENDING',
  ...overrides,
});

const warehouse = (overrides: Record<string, any> = {}) => ({
  id: 'wh1',
  companyId: 'c1',
  branchId: 'b1',
  code: 'WH1',
  name: 'Warehouse 1',
  warehouseType: 'SPARE_PARTS',
  ...overrides,
});

function cloneState(state: DbState): DbState {
  return {
    physicalQuantity: state.physicalQuantity,
    physicalQuantityBase: new Prisma.Decimal(state.physicalQuantityBase.toString()),
    valuationInventoryValue: new Prisma.Decimal(state.valuationInventoryValue.toString()),
    valuationAverageUnitCost: new Prisma.Decimal(state.valuationAverageUnitCost.toString()),
  };
}

function makeDb(overrides: {
  physicalQuantity?: number;
  physicalQuantityBase?: number;
  valuationInventoryValue?: number;
  valuationAverageUnitCost?: number;
  policy?: { id: string; currencyCode: string; method: string } | null;
  forcePhysicalUpdateError?: boolean;
  parts?: any[];
  warehouse?: any;
} = {}): MockDb {
  const state: DbState = {
    physicalQuantity: overrides.physicalQuantity ?? 100,
    physicalQuantityBase: new Prisma.Decimal(overrides.physicalQuantityBase ?? overrides.physicalQuantity ?? 100),
    valuationInventoryValue: new Prisma.Decimal(overrides.valuationInventoryValue ?? 1000),
    valuationAverageUnitCost: new Prisma.Decimal(overrides.valuationAverageUnitCost ?? 10),
  };
  const policy = overrides.policy === undefined ? { id: 'pol1', currencyCode: 'USD', method: 'WEIGHTED_AVERAGE' } : overrides.policy;

  const physicalUpdates: MockDb['physicalUpdates'] = [];
  const valuationUpdates: MockDb['valuationUpdates'] = [];
  const lineUpdates: MockDb['lineUpdates'] = [];

  const db: MockDb = {
    state,
    policy,
    physicalUpdates,
    valuationUpdates,
    lineUpdates,
    forcePhysicalUpdateError: overrides.forcePhysicalUpdateError ?? false,
    maintenanceWorkOrder: { findUnique: jest.fn().mockResolvedValue(wo()) },
    maintenanceWorkOrderPart: {
      findMany: jest.fn().mockResolvedValue(overrides.parts ?? [part()]),
      update: jest.fn().mockResolvedValue({}),
    },
    inventoryValuationBalance: {
      id: 'vb1',
      inventoryValue: state.valuationInventoryValue,
      averageUnitCost: state.valuationAverageUnitCost,
      lastHistoricalUnitCost: null,
    },
    inventoryBalance: { quantity: state.physicalQuantity, quantityBase: state.physicalQuantityBase },
    inventoryMovementLine: { update: jest.fn() },
    inventoryMovement: { create: jest.fn() },
    $transaction: jest.fn(),
  };

  db.inventoryBalance.findFirst = jest.fn().mockImplementation(async () => ({
    id: 'bal1',
    warehouseId: 'wh1',
    productId: 'prod1',
    locationId: null,
    quantity: state.physicalQuantity,
    quantityBase: state.physicalQuantityBase,
  }));
  db.inventoryBalance.findMany = jest.fn().mockImplementation(async () => ([{
    quantity: state.physicalQuantity,
    quantityBase: state.physicalQuantityBase,
  }]));
  db.inventoryBalance.create = jest.fn().mockImplementation(async (args: any) => ({ id: 'bal1', ...args.data }));
  db.inventoryBalance.update = jest.fn().mockImplementation(async (args: any) => {
    if (db.forcePhysicalUpdateError) {
      throw new Error('simulated physical update failure');
    }
    const d = args.data;
    physicalUpdates.push({ quantity: d.quantity, quantityBase: d.quantityBase });
    state.physicalQuantity = d.quantity;
    state.physicalQuantityBase = new Prisma.Decimal(d.quantityBase.toString());
    return { id: 'bal1', ...d };
  });

  db.inventoryValuationPolicy = { findFirst: jest.fn().mockResolvedValue(policy) };
  db.inventoryValuationBalance.findUnique = jest.fn().mockImplementation(async () => ({
    id: 'vb1',
    companyId: 'c1',
    warehouseId: 'wh1',
    productId: 'prod1',
    inventoryValue: state.valuationInventoryValue,
    averageUnitCost: state.valuationAverageUnitCost,
  }));
  db.inventoryValuationBalance.update = jest.fn().mockImplementation(async (args: any) => {
    const d = args.data;
    valuationUpdates.push({
      inventoryValue: d.inventoryValue,
      averageUnitCost: d.averageUnitCost,
      lastHistoricalUnitCost: d.lastHistoricalUnitCost,
    });
    state.valuationInventoryValue = new Prisma.Decimal(d.inventoryValue.toString());
    state.valuationAverageUnitCost = new Prisma.Decimal(d.averageUnitCost.toString());
    return { id: 'vb1', ...d };
  });
  db.inventoryValuationBalance.create = jest.fn().mockImplementation(async (args: any) => ({ id: 'vb1', ...args.data }));

  db.inventoryMovementLine.update = jest.fn().mockImplementation(async (args: any) => {
    lineUpdates.push(args.data);
    return args.data;
  });

  db.inventoryMovement = {
    create: jest.fn().mockImplementation(async (args: any) => ({
      id: 'im1',
      movementNumber: 'IM-0001',
      ...args.data,
      lines: [{ id: 'line1', ...args.data.lines.create[0] }],
    })),
  };
  db.warehouse = { findUnique: jest.fn().mockImplementation(async () => overrides.warehouse ?? warehouse()) };
  db.machine = { findUnique: jest.fn().mockImplementation(async () => wo().machineId) };
  db.sparePart = { findUnique: jest.fn().mockResolvedValue({ id: 'sp1', productId: 'prod1' }) };
  db.product = { findUnique: jest.fn().mockResolvedValue({ id: 'prod1', name: 'Product 1' }) };
  db.$queryRaw = jest.fn().mockResolvedValue([{ result: 0 }]);

  const snapshot = () => cloneState(state);

  db.$transaction = jest.fn().mockImplementation(async (fn: (tx: any) => Promise<any>) => {
    const before = snapshot();
    try {
      return await fn(db);
    } catch (e) {
      state.physicalQuantity = before.physicalQuantity;
      state.physicalQuantityBase = new Prisma.Decimal(before.physicalQuantityBase.toString());
      state.valuationInventoryValue = new Prisma.Decimal(before.valuationInventoryValue.toString());
      state.valuationAverageUnitCost = new Prisma.Decimal(before.valuationAverageUnitCost.toString());
      throw e;
    }
  });

  return db;
}

function buildService(db: MockDb) {
  const audit = { log: jest.fn().mockResolvedValue(undefined) } as unknown as AuditService;
  const numbering = {
    generateNumberAtomic: jest.fn().mockResolvedValue('WO-0001'),
    generateNumberAtomicWithClient: jest.fn().mockResolvedValue('IM-0001'),
  } as unknown as NumberingService;
  const engine = new InventoryValuationEngineService({} as unknown as PrismaService);
  const productionCost = {
    postLedgerEntryWithinTransaction: jest.fn().mockResolvedValue({ transaction: {}, updatedOriginal: null, replay: false }),
    reverseLedgerEntry: jest.fn(),
  } as any;
  const service = new MaintenanceWorkOrdersService(
    db as unknown as PrismaService,
    audit,
    numbering,
    engine,
    productionCost,
    { resolveWithClient: jest.fn() } as any,
  );
  return { service, audit, numbering, productionCost };
}

describe('VAL-R1E MaintenanceWorkOrdersService — valuation-aware work-order part issue', () => {
  describe('ACTIVE issue — real-state physical + monetary contract', () => {
    it('Q100→V1000→Q80/V800 AVG10, snapshot unitCost10/totalCost200, one physical + one monetary decrement', async () => {
      const db = makeDb();
      const { service } = buildService(db);

      await service.issueParts('wo1', {}, user, ctx);

      expect(db.physicalUpdates).toHaveLength(1);
      expect(db.physicalUpdates[0].quantity).toBe(80);
      expect(db.physicalUpdates[0].quantityBase.toString()).toBe('80');

      expect(db.valuationUpdates).toHaveLength(1);
      expect(db.valuationUpdates[0].inventoryValue.toString()).toBe('800');
      expect(db.valuationUpdates[0].averageUnitCost.toString()).toBe('10');
      expect(db.valuationUpdates[0].lastHistoricalUnitCost!.toString()).toBe('10');

      expect(db.lineUpdates).toHaveLength(1);
      expect(db.lineUpdates[0].unitCost!.toString()).toBe('10');
      expect(db.lineUpdates[0].totalCost!.toString()).toBe('200');
      expect(db.lineUpdates[0].currencyCode).toBe('USD');
      expect(db.lineUpdates[0].valuationMethod).toBe('WEIGHTED_AVERAGE');

      expect(db.state.physicalQuantity).toBe(80);
      expect(db.state.physicalQuantityBase.toString()).toBe('80');
      expect(db.state.valuationInventoryValue.toString()).toBe('800');
      expect(db.state.valuationAverageUnitCost.toString()).toBe('10');
    });

    it('full depletion: Q20 V200 AVG10 issue 20 → physical 0/0, inventoryValue 0 EXACT, avg 0', async () => {
      const db = makeDb({
        physicalQuantity: 20,
        physicalQuantityBase: 20,
        valuationInventoryValue: 200,
        valuationAverageUnitCost: 10,
        parts: [part({ quantity: 20 })],
      });
      const { service } = buildService(db);

      await service.issueParts('wo1', {}, user, ctx);

      expect(db.physicalUpdates[0].quantity).toBe(0);
      expect(db.physicalUpdates[0].quantityBase.toString()).toBe('0');
      expect(db.valuationUpdates[0].inventoryValue.toString()).toBe('0');
      expect(db.valuationUpdates[0].averageUnitCost.toString()).toBe('0');
      expect(db.valuationUpdates[0].lastHistoricalUnitCost!.toString()).toBe('10');
      expect(db.state.physicalQuantityBase.toString()).toBe('0');
      expect(db.state.valuationInventoryValue.toString()).toBe('0');
    });

    it('passes the PRE-mutation qold (100) to the engine, not the post-decrement 80', async () => {
      const db = makeDb();
      const { service } = buildService(db);
      const engine = (service as any).valuationEngine as InventoryValuationEngineService;
      const spy = jest.spyOn(engine, 'applyValuedIssue');

      await service.issueParts('wo1', {}, user, ctx);

      expect(spy).toHaveBeenCalledTimes(1);
      const qoldArg = spy.mock.calls[0][1].qold as Prisma.Decimal;
      expect(qoldArg.toString()).toBe('100');
      spy.mockRestore();
    });
  });

  describe('ACTIVE issue — rollback atomicity', () => {
    it('physical failure after engine call rolls back monetary + physical to original (atomic)', async () => {
      const db = makeDb({ forcePhysicalUpdateError: true });
      const { service } = buildService(db);

      await expect(service.issueParts('wo1', {}, user, ctx)).rejects.toThrow('simulated physical update failure');

      expect(db.state.physicalQuantity).toBe(100);
      expect(db.state.physicalQuantityBase.toString()).toBe('100');
      expect(db.state.valuationInventoryValue.toString()).toBe('1000');
      expect(db.state.valuationAverageUnitCost.toString()).toBe('10');
      expect(db.maintenanceWorkOrderPart.update).not.toHaveBeenCalled();
    });
  });

  describe('PROVEN INACTIVE flow (legacy preserved)', () => {
    it('no ACTIVE policy → one physical decrement, no monetary engine call, twin-synced', async () => {
      const db = makeDb({ policy: null });
      const { service } = buildService(db);

      await service.issueParts('wo1', {}, user, ctx);

      expect(db.physicalUpdates).toHaveLength(1);
      expect(db.physicalUpdates[0].quantity).toBe(80);
      expect(db.physicalUpdates[0].quantityBase.toString()).toBe('80');
      expect(db.valuationUpdates).toHaveLength(0);
      expect(db.lineUpdates).toHaveLength(0);
    });
  });

  describe('issueParts — negative stock & tenant isolation', () => {
    it('negative stock aborts with NO physical decrement and NO valuation call', async () => {
      const db = makeDb({ physicalQuantity: 1, physicalQuantityBase: 1, valuationInventoryValue: 10, valuationAverageUnitCost: 10 });
      const { service } = buildService(db);

      await expect(service.issueParts('wo1', {}, user, ctx)).rejects.toThrow(BadRequestException);

      expect(db.physicalUpdates).toHaveLength(0);
      expect(db.valuationUpdates).toHaveLength(0);
      expect(db.maintenanceWorkOrderPart.update).not.toHaveBeenCalled();
    });

    it('rejects issuing from a foreign-company warehouse (tenant isolation, no mutation)', async () => {
      const db = makeDb({ warehouse: warehouse({ id: 'wh-foreign', companyId: 'c2' }) });
      const { service } = buildService(db);

      await expect(
        service.issueParts('wo1', { warehouseId: 'wh-foreign' } as any, user, ctx),
      ).rejects.toThrow(BadRequestException);

      expect(db.physicalUpdates).toHaveLength(0);
      expect(db.valuationUpdates).toHaveLength(0);
    });
  });

  describe('regression guard — exactly one physical decrement per successful flow', () => {
    it('ACTIVE issue physical mutation count = 1 (no double, no zero)', async () => {
      const db = makeDb();
      const { service } = buildService(db);
      await service.issueParts('wo1', {}, user, ctx);
      expect(db.physicalUpdates).toHaveLength(1);
    });

    it('INACTIVE issue physical mutation count = 1 (no double, no zero)', async () => {
      const db = makeDb({ policy: null });
      const { service } = buildService(db);
      await service.issueParts('wo1', {}, user, ctx);
      expect(db.physicalUpdates).toHaveLength(1);
    });
  });

  describe('COST-R1B unified ledger projection for valued maintenance issue', () => {
    it('projects a canonical PRIMARY_COST entry with the exact valued totalCost on an ACTIVE issue', async () => {
      const db = makeDb();
      const { service, productionCost } = buildService(db);

      await service.issueParts('wo1', {}, user, ctx);

      expect(productionCost.postLedgerEntryWithinTransaction).toHaveBeenCalledTimes(1);
      const opts = productionCost.postLedgerEntryWithinTransaction.mock.calls[0][1];
      expect(opts.eventType).toBe('MATERIAL');
      expect(opts.sourceType).toBe('INVENTORY_MOVEMENT_LINE');
      expect(opts.sourceId).toBe('line1');
      expect(opts.sourceLineId).toBe('line1');
      expect(opts.costNature).toBe('ACTUAL');
      expect(opts.costPurpose).toBe('MAINTENANCE');
      expect(opts.entryRole).toBe('PRIMARY_COST');
      expect(opts.amount.toString()).toBe('200');
      expect(opts.refs._currencyCodeFromInventory).toBe('USD');
      expect(opts.clientRequestId).toBe('im1-line:line1-maintenance-issue');
    });

    it('skips the ledger projection entirely for the legacy/unvalued no-policy flow', async () => {
      const db = makeDb({ policy: null });
      const { service, productionCost } = buildService(db);

      await service.issueParts('wo1', {}, user, ctx);

      expect(productionCost.postLedgerEntryWithinTransaction).not.toHaveBeenCalled();
    });
  });
});
