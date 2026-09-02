import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { MaintenanceStockIssueService } from './maintenance-stock-issue.service';
import { InventoryValuationEngineService } from '../../inventory-valuation/inventory-valuation-engine.service';
import { PrismaService } from '../../../../common/prisma/prisma.service';
import { AuditService } from '../../../../common/audit/audit.service';
import { NumberingService } from '../../../numbering/numbering.service';
import { SparePartConditionService } from '../spare-part-conditions/spare-part-conditions.service';
import { InstalledPartsReplacementService } from '../installed-parts-replacement/installed-parts-replacement.service';
import { ActiveOperationalContext } from '../../../../common/operational-context/operational-context.types';

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
    version?: { increment: number };
  }[];
  lineUpdates: {
    unitCost?: Prisma.Decimal;
    totalCost?: Prisma.Decimal;
    currencyCode?: string;
    valuationMethod?: string;
  }[];
  forcePhysicalUpdateError: boolean;
  inventoryBalance: Record<string, unknown>;
  inventoryValuationBalance: Record<string, unknown>;
  maintenanceRequestRequiredPart: {
    findUnique: jest.Mock;
    update: jest.Mock;
  };
  inventoryMovementLine: {
    update: jest.Mock;
  };
  $transaction: jest.Mock;
  [key: string]: any;
}

const partLine = (overrides: Record<string, any> = {}) => ({
  id: 'line1',
  maintenanceRequestId: 'req1',
  status: 'APPROVED',
  approvedQuantity: 100,
  requestedQuantity: 100,
  quantity: 100,
  issuedQuantity: 0,
  returnedQuantity: 0,
  warehouseId: null,
  machineComponentId: null,
  machineComponent: null,
  sparePart: { id: 'sp1', productId: 'prod1', code: 'SP1', name: 'Spare Part 1' },
  maintenanceRequest: {
    machine: { id: 'm1', companyId: 'c1', branchId: 'b1', productionLineId: null, departmentId: null, defaultCostCenterId: null },
  },
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

const machine = (overrides: Record<string, any> = {}) => ({
  id: 'm1',
  companyId: 'c1',
  branchId: 'b1',
  productionLineId: null,
  departmentId: null,
  defaultCostCenterId: null,
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
  partLine?: any;
  partLineFindUnique?: jest.Mock;
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
    inventoryBalance: { quantity: state.physicalQuantity, quantityBase: state.physicalQuantityBase },
    inventoryValuationBalance: {
      id: 'vb1',
      inventoryValue: state.valuationInventoryValue,
      averageUnitCost: state.valuationAverageUnitCost,
      lastHistoricalUnitCost: null,
    },
    maintenanceRequestRequiredPart: {
      findUnique: overrides.partLineFindUnique ?? jest.fn().mockResolvedValue(overrides.partLine ?? partLine()),
      update: jest.fn().mockResolvedValue({}),
    },
    inventoryMovementLine: { update: jest.fn() },
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
  db.inventoryBalance.create = jest.fn().mockImplementation(async (args: any) => args.data);
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

  db.inventoryValuationPolicy = {
    findFirst: jest.fn().mockResolvedValue(policy),
  };
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
      version: d.version,
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
  db.machine = { findUnique: jest.fn().mockImplementation(async () => machine()) };
  db.warehouseLocation = { findUnique: jest.fn().mockResolvedValue(null) };
  db.product = { findUnique: jest.fn().mockResolvedValue({ id: 'prod1', name: 'Product 1' }) };
  db.sparePartConditionBalance = {
    findFirst: jest.fn().mockImplementation(async () => ({ id: 'cb1', sparePartId: 'sp1', productId: 'prod1', warehouseId: 'wh1', condition: 'NEW', quantity: 100, availableQuantity: 100 })),
    create: jest.fn().mockImplementation(async (a: any) => ({ id: 'cb1', ...a.data })),
    update: jest.fn().mockImplementation(async (a: any) => ({ id: 'cb1', ...a.data })),
  };
  db.sparePartConditionMovement = { create: jest.fn().mockImplementation(async (a: any) => ({ id: 'cm1', ...a.data })) };
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
    generateNumberAtomicWithClient: jest.fn().mockResolvedValue('IM-0001'),
  } as unknown as NumberingService;
  const conditionService = {} as unknown as SparePartConditionService;
  const installedPartsService = {
    recordInstalledPartInTx: jest.fn().mockResolvedValue({ id: 'ip1' }),
    recordReplacementInTx: jest.fn().mockResolvedValue({ id: 'rep1' }),
  } as unknown as InstalledPartsReplacementService;
  const engine = new InventoryValuationEngineService({} as unknown as PrismaService);
  const productionCost = {
    postLedgerEntryWithinTransaction: jest.fn().mockResolvedValue({ transaction: {}, updatedOriginal: null, replay: false }),
    reverseLedgerEntry: jest.fn(),
  } as any;
  const service = new MaintenanceStockIssueService(
    db as unknown as PrismaService,
    audit,
    numbering,
    conditionService,
    installedPartsService,
    engine,
    productionCost,
  );
  return { service, audit, numbering, installedPartsService, productionCost };
}

const baseIssueDto = {
  warehouseId: 'wh1',
  issuedQuantity: 20,
  replacementAction: 'NEW_INSTALLATION',
};

describe('VAL-R1E MaintenanceStockIssueService — valuation-aware maintenance issue', () => {
  describe('ACTIVE issue — real-state physical + monetary contract', () => {
    it('Q100→V1000→Q80/V800 AVG10, snapshot unitCost10/totalCost200, one physical + one monetary decrement', async () => {
      const db = makeDb();
      const { service } = buildService(db);

      await service.issue('req1', 'line1', baseIssueDto as any, 'u1', ctx);

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
        partLine: partLine({ approvedQuantity: 20, requestedQuantity: 20, quantity: 20 }),
      });
      const { service } = buildService(db);
      const dto = { warehouseId: 'wh1', issuedQuantity: 20, replacementAction: 'NEW_INSTALLATION' };

      await service.issue('req1', 'line1', dto as any, 'u1', ctx);

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

      await service.issue('req1', 'line1', baseIssueDto as any, 'u1', ctx);

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

      await expect(service.issue('req1', 'line1', baseIssueDto as any, 'u1', ctx)).rejects.toThrow(
        'simulated physical update failure',
      );

      expect(db.state.physicalQuantity).toBe(100);
      expect(db.state.physicalQuantityBase.toString()).toBe('100');
      expect(db.state.valuationInventoryValue.toString()).toBe('1000');
      expect(db.state.valuationAverageUnitCost.toString()).toBe('10');
      expect(db.maintenanceRequestRequiredPart.update).not.toHaveBeenCalled();
    });
  });

  describe('PROVEN INACTIVE flow (legacy preserved)', () => {
    it('no ACTIVE policy → one physical decrement, no monetary engine call, twin-synced', async () => {
      const db = makeDb({ policy: null });
      const { service } = buildService(db);

      await service.issue('req1', 'line1', baseIssueDto as any, 'u1', ctx);

      expect(db.physicalUpdates).toHaveLength(1);
      expect(db.physicalUpdates[0].quantity).toBe(80);
      expect(db.physicalUpdates[0].quantityBase.toString()).toBe('80');
      expect(db.valuationUpdates).toHaveLength(0);
      expect(db.lineUpdates).toHaveLength(0);
    });
  });

  describe('returnStock — ACTIVE warehouse', () => {
    it('blocks an ACTIVE warehouse return (no trusted original-issue linkage)', async () => {
      const db = makeDb({ partLine: partLine({ issuedQuantity: 50, returnedQuantity: 0 }) });
      const { service } = buildService(db);

      await expect(service.returnStock('req1', 'line1', { returnQuantity: 10 } as any, 'u1', ctx)).rejects.toThrow(
        BadRequestException,
      );
      expect(db.physicalUpdates).toHaveLength(0);
    });
  });

  describe('issue — negative stock & tenant isolation', () => {
    it('blocks issuing more than available stock (no mutation)', async () => {
      const db = makeDb({ physicalQuantity: 5, physicalQuantityBase: 5, valuationInventoryValue: 50, valuationAverageUnitCost: 10 });
      const { service } = buildService(db);

      await expect(
        service.issue('req1', 'line1', { ...baseIssueDto, issuedQuantity: 20 } as any, 'u1', ctx),
      ).rejects.toThrow(BadRequestException);

      expect(db.physicalUpdates).toHaveLength(0);
      expect(db.valuationUpdates).toHaveLength(0);
    });

    it('rejects issuing to a foreign-company warehouse (tenant isolation, no mutation)', async () => {
      const db = makeDb({ warehouse: warehouse({ id: 'wh-foreign', companyId: 'c2' }) });
      const { service } = buildService(db);

      await expect(
        service.issue('req1', 'line1', { ...baseIssueDto, warehouseId: 'wh-foreign' } as any, 'u1', ctx),
      ).rejects.toThrow(ForbiddenException);

      expect(db.physicalUpdates).toHaveLength(0);
      expect(db.valuationUpdates).toHaveLength(0);
    });

    it('rejects a part line whose machine belongs to another company', async () => {
      const db = makeDb({
        partLine: partLine({ maintenanceRequest: { machine: machine({ companyId: 'c2' }) } }),
      });
      const { service } = buildService(db);

      await expect(service.issue('req1', 'line1', baseIssueDto as any, 'u1', ctx)).rejects.toThrow(ForbiddenException);
      expect(db.physicalUpdates).toHaveLength(0);
      expect(db.valuationUpdates).toHaveLength(0);
    });

    it('rejects a part line belonging to another request', async () => {
      const db = makeDb({ partLine: partLine({ maintenanceRequestId: 'req-other' }) });
      const { service } = buildService(db);

      await expect(service.issue('req1', 'line1', baseIssueDto as any, 'u1', ctx)).rejects.toThrow(BadRequestException);
      expect(db.physicalUpdates).toHaveLength(0);
      expect(db.valuationUpdates).toHaveLength(0);
    });
  });

  describe('regression guard — exactly one physical decrement per successful flow', () => {
    it('ACTIVE issue physical mutation count = 1 (no double, no zero)', async () => {
      const db = makeDb();
      const { service } = buildService(db);
      await service.issue('req1', 'line1', baseIssueDto as any, 'u1', ctx);
      expect(db.physicalUpdates).toHaveLength(1);
      expect(db.physicalUpdates).toHaveLength(1);
    });

    it('INACTIVE issue physical mutation count = 1 (no double, no zero)', async () => {
      const db = makeDb({ policy: null });
      const { service } = buildService(db);
      await service.issue('req1', 'line1', baseIssueDto as any, 'u1', ctx);
      expect(db.physicalUpdates).toHaveLength(1);
    });
  });

  describe('COST-R1B unified ledger projection for valued maintenance issue', () => {
    it('projects a canonical PRIMARY_COST entry with the exact valued totalCost on an ACTIVE issue', async () => {
      const db = makeDb();
      const { service, productionCost } = buildService(db);

      await service.issue('req1', 'line1', baseIssueDto as any, 'u1', ctx);

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
      expect(opts.sourceNumberSnapshot).toBe('IM-0001');
    });

    it('skips the ledger projection entirely for the legacy/unvalued no-policy flow', async () => {
      const db = makeDb({ policy: null });
      const { service, productionCost } = buildService(db);

      await service.issue('req1', 'line1', baseIssueDto as any, 'u1', ctx);

      expect(productionCost.postLedgerEntryWithinTransaction).not.toHaveBeenCalled();
    });

    it('never writes a maintenance return reversal (- returnStock has no valued ledger evidence)', async () => {
      const db = makeDb({ partLine: partLine({ issuedQuantity: 50, returnedQuantity: 0 }) });
      const { service, productionCost } = buildService(db);

      await service.returnStock('req1', 'line1', { returnQuantity: 10 } as any, 'u1', ctx).catch(() => undefined);

      expect(productionCost.reverseLedgerEntry).not.toHaveBeenCalled();
      expect(productionCost.postLedgerEntryWithinTransaction).not.toHaveBeenCalled();
    });
  });

  describe('concurrent issue state and bounded P2034 retry', () => {
    it('uses the fresh in-transaction issuedQuantity instead of losing a concurrent update', async () => {
      const staleOuter = partLine({ issuedQuantity: 20 });
      const freshTransactional = partLine({ issuedQuantity: 50 });
      const partLineFindUnique = jest.fn()
        .mockResolvedValueOnce(staleOuter)
        .mockResolvedValue(freshTransactional);
      const db = makeDb({ partLineFindUnique });
      const { service } = buildService(db);

      await service.issue(
        'req1',
        'line1',
        { ...baseIssueDto, issuedQuantity: 15 } as any,
        'u1',
        ctx,
      );

      expect(db.maintenanceRequestRequiredPart.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'line1' },
          data: expect.objectContaining({ issuedQuantity: 65 }),
        }),
      );
    });

    it('retries the whole transaction once for P2034 and creates one movement only', async () => {
      const db = makeDb();
      const transient = new Prisma.PrismaClientKnownRequestError(
        'Transaction failed due to a write conflict or deadlock',
        { code: 'P2034', clientVersion: '7.8.0' },
      );
      db.$transaction.mockRejectedValueOnce(transient);
      const { service } = buildService(db);

      await service.issue('req1', 'line1', baseIssueDto as any, 'u1', ctx);

      expect(db.$transaction).toHaveBeenCalledTimes(2);
      expect(db.inventoryMovement.create).toHaveBeenCalledTimes(1);
      expect(db.physicalUpdates).toHaveLength(1);
      expect(db.valuationUpdates).toHaveLength(1);
    });
  });
});
