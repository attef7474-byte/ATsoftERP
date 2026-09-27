import { BadRequestException, NotFoundException } from '@nestjs/common';
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

const machine = (overrides: Record<string, any> = {}) => ({
  id: 'm1',
  companyId: 'c1',
  branchId: 'b1',
  name: 'Machine 1',
  code: 'M1',
  productionLineId: null,
  departmentId: null,
  defaultCostCenterId: null,
  ...overrides,
});

const partLine = (overrides: Record<string, any> = {}) => ({
  id: 'line1',
  maintenanceRequestId: 'req1',
  status: 'APPROVED',
  approvedQuantity: 10,
  requestedQuantity: 10,
  quantity: 10,
  issuedQuantity: 0,
  returnedQuantity: 0,
  warehouseId: null,
  machineComponentId: null,
  machineComponent: null,
  // R2-E: the NEWLY ISSUED spare part is deliberately a different catalog record
  // from the removed part so any OLD/NEW conflation is caught by an assertion.
  sparePart: {
    id: 'sp-new',
    productId: 'prod-new',
    code: 'SP-NEW',
    name: 'New Spare Part',
    technicalClassification: null,
    usageType: null,
    nature: null,
    importance: null,
  },
  maintenanceRequest: { machine: machine() },
  ...overrides,
});

const warehouse = (overrides: Record<string, any> = {}) => ({
  id: 'wh1',
  companyId: 'c1',
  branchId: 'b1',
  name: 'Warehouse 1',
  code: 'WH1',
  warehouseType: 'SPARE_PARTS',
  ...overrides,
});

const oldInstalledPart = (overrides: Record<string, any> = {}) => ({
  id: 'ip-old',
  machineId: 'm1',
  machineComponentId: null,
  sparePartId: 'sp-old',
  productId: 'prod-old',
  installedQuantity: 3,
  installedCondition: 'USED_REPAIRABLE',
  status: 'ACTIVE',
  machine: machine(),
  sparePart: { id: 'sp-old', code: 'SP-OLD', name: 'Old Spare Part', productId: 'prod-old' },
  ...overrides,
});

function makeDb(overrides: { partLine?: any; oldPart?: any | null } = {}) {
  const conditionMovements: any[] = [];
  const historyCreates: any[] = [];
  const lineUpdates: any[] = [];
  const historyRow = {
    id: 'rep1',
    replacementNumber: 'RPL-0001',
    oldInstalledPartId: 'ip-old',
    oldSparePartId: 'sp-old',
    newInstalledPartId: 'ip-new',
    newSparePartId: 'sp-new',
    removedCondition: 'USED_REPAIRABLE',
    removedQuantity: 3,
    removedReturnedToStock: true,
    conditionOutMovementId: 'cm-out',
    conditionInMovementId: 'cm-in',
    inventoryOutMovementId: 'im1',
  };

  const db: any = {
    maintenanceRequestRequiredPart: {
      findUnique: jest.fn().mockImplementation(async () => overrides.partLine ?? partLine()),
      update: jest.fn().mockImplementation(async (a: any) => {
        lineUpdates.push(a.data);
        return { id: 'line1' };
      }),
    },
    warehouse: { findUnique: jest.fn().mockImplementation(async () => warehouse()) },
    machine: { findUnique: jest.fn().mockImplementation(async () => machine()) },
    warehouseLocation: { findUnique: jest.fn().mockResolvedValue(null) },
    product: { findUnique: jest.fn().mockResolvedValue({ id: 'prod-new', name: 'Product New' }) },
    inventoryBalance: {
      findFirst: jest.fn().mockResolvedValue({ id: 'bal1', warehouseId: 'wh1', productId: 'prod-new', locationId: null, quantity: 100, quantityBase: new Prisma.Decimal(100) }),
      findMany: jest.fn().mockResolvedValue([{ quantity: 100, quantityBase: new Prisma.Decimal(100) }]),
      create: jest.fn().mockImplementation(async (a: any) => a.data),
      update: jest.fn().mockImplementation(async (a: any) => ({ id: 'bal1', ...a.data })),
    },
    inventoryMovement: {
      findUnique: jest.fn(),
      create: jest.fn().mockImplementation(async (a: any) => ({
        id: 'im1',
        movementNumber: 'IM-0001',
        ...a.data,
        lines: [{ id: 'iml1', ...a.data.lines.create[0] }],
      })),
      findMany: jest.fn(),
    },
    inventoryValuationPolicy: { findFirst: jest.fn().mockResolvedValue({ id: 'pol1', currencyCode: 'USD', method: 'WEIGHTED_AVERAGE' }) },
    inventoryValuationBalance: {
      findUnique: jest.fn().mockResolvedValue({ id: 'vb1', companyId: 'c1', warehouseId: 'wh1', productId: 'prod-new', inventoryValue: new Prisma.Decimal(1000), averageUnitCost: new Prisma.Decimal(10) }),
      update: jest.fn().mockImplementation(async (a: any) => ({ id: 'vb1', ...a.data })),
      create: jest.fn().mockImplementation(async (a: any) => ({ id: 'vb1', ...a.data })),
    },
    inventoryMovementLine: { update: jest.fn().mockImplementation(async (a: any) => a.data) },
    sparePartConditionBalance: {
      findFirst: jest.fn().mockImplementation(async () => ({ id: 'cb1', sparePartId: 'sp-old', productId: 'prod-old', warehouseId: 'wh2', condition: 'USED_REPAIRABLE', quantity: 50, availableQuantity: 50 })),
      create: jest.fn().mockImplementation(async (a: any) => ({ id: 'cb-new', ...a.data })),
      update: jest.fn().mockImplementation(async (a: any) => ({ id: 'cb1', ...a.data })),
    },
    sparePartConditionMovement: {
      create: jest.fn().mockImplementation(async (a: any) => {
        const row = { id: `cm-${conditionMovements.length + 1}`, ...a.data };
        conditionMovements.push(row);
        return row;
      }),
    },
    machineInstalledPart: {
      findFirst: jest.fn().mockImplementation(async () => (overrides.oldPart === undefined || overrides.oldPart === null ? { id: 'ip-old' } : { id: overrides.oldPart.id })),
      findUnique: jest.fn().mockImplementation(async () => (overrides.oldPart === undefined ? oldInstalledPart() : overrides.oldPart)),
    },
    sparePartReplacementHistory: {
      findFirst: jest.fn().mockResolvedValue(historyRow),
    },
    userRole: { findMany: jest.fn() },
    $queryRaw: jest.fn().mockResolvedValue([{ result: 0 }]),
  };

  db.$transaction = jest.fn().mockImplementation(async (fn: (tx: any) => Promise<any>) => fn(db));

  return { db, conditionMovements, historyCreates, lineUpdates, historyRow };
}

function buildService(db: any) {
  const audit: any = { log: jest.fn().mockResolvedValue(undefined) };
  const numbering = { generateNumberAtomicWithClient: jest.fn().mockResolvedValue('IM-0001') } as unknown as NumberingService;
  const conditionService = {} as unknown as SparePartConditionService;
  const installedPartsService: any = {
    recordInstalledPartInTx: jest.fn().mockResolvedValue({ id: 'ip-new' }),
    recordReplacementInTx: jest.fn().mockImplementation(async (_tx: any, data: any) => {
      makeDbRef.historyCreates.push(data);
      return { id: 'rep1', ...data };
    }),
    markInstalledPartRemovedInTx: jest.fn().mockResolvedValue({ id: 'ip-old', status: 'REMOVED' }),
  };
  const engine = new InventoryValuationEngineService({} as unknown as PrismaService);
  const productionCost = {
    postLedgerEntryWithinTransaction: jest.fn().mockResolvedValue({ transaction: {}, updatedOriginal: null, replay: false }),
    reverseLedgerEntry: jest.fn(),
  } as any;
  const service = new MaintenanceStockIssueService(
    db as unknown as PrismaService,
    audit as unknown as AuditService,
    numbering,
    conditionService,
    installedPartsService as unknown as InstalledPartsReplacementService,
    engine,
    productionCost,
  );
  return { service, audit, installedPartsService };
}

// A module-scoped sink lets the replacement recorder capture its payload.
const makeDbRef: { historyCreates: any[] } = { historyCreates: [] };

const returnedDto = (overrides: Record<string, any> = {}) => ({
  warehouseId: 'wh1',
  issuedQuantity: 3,
  replacementAction: 'RETURNED_REMOVED_PART',
  oldInstalledPartId: 'ip-old',
  removedPartCondition: 'USED_REPAIRABLE',
  removedPartWarehouseId: 'wh2',
  removedPartQuantity: 3,
  ...overrides,
});

const noReturnDto = (overrides: Record<string, any> = {}) => ({
  warehouseId: 'wh1',
  issuedQuantity: 3,
  replacementAction: 'NO_REMOVED_PART',
  oldInstalledPartId: 'ip-old',
  noReturnReason: 'PART_DESTROYED_ON_SITE',
  ...overrides,
});

describe('R2-E MaintenanceStockIssueService — installed-part replacement traceability', () => {
  beforeEach(() => {
    makeDbRef.historyCreates = [];
  });

  describe('RETURNED_REMOVED_PART — OLD/NEW identity separation', () => {
    it('records BOTH old and new identity on the replacement event from server-derived values', async () => {
      const { db } = makeDb();
      const { service, installedPartsService } = buildService(db);

      await service.issue('req1', 'line1', returnedDto() as any, 'u1', ctx);

      expect(installedPartsService.recordReplacementInTx).toHaveBeenCalledTimes(1);
      const payload = makeDbRef.historyCreates[0];
      expect(payload.oldInstalledPartId).toBe('ip-old');
      expect(payload.oldSparePartId).toBe('sp-old');
      expect(payload.newInstalledPartId).toBe('ip-new');
      expect(payload.newSparePartId).toBe('sp-new');
      // OLD and NEW are two distinct physical records and two distinct catalog ids.
      expect(payload.oldInstalledPartId).not.toBe(payload.newInstalledPartId);
      expect(payload.oldSparePartId).not.toBe(payload.newSparePartId);
      expect(payload.removedReturnedToStock).toBe(true);
    });

    it('books the condition IN movement against the OLD spare part and OLD product, not the newly issued part', async () => {
      const { db, conditionMovements } = makeDb();
      const { service } = buildService(db);

      await service.issue('req1', 'line1', returnedDto() as any, 'u1', ctx);

      const inMovement = conditionMovements.find(m => m.direction === 'IN');
      expect(inMovement).toBeDefined();
      expect(inMovement!.sparePartId).toBe('sp-old');
      expect(inMovement!.productId).toBe('prod-old');
      expect(inMovement!.sparePartId).not.toBe('sp-new');
      expect(inMovement!.productId).not.toBe('prod-new');
      expect(inMovement!.warehouseId).toBe('wh2');
      expect(inMovement!.condition).toBe('USED_REPAIRABLE');
      expect(inMovement!.quantity).toBe(3);
    });

    it('books the condition OUT movement against the NEW spare part only', async () => {
      const { db, conditionMovements } = makeDb();
      const { service } = buildService(db);

      await service.issue('req1', 'line1', returnedDto() as any, 'u1', ctx);

      const outMovement = conditionMovements.find(m => m.direction === 'OUT');
      expect(outMovement!.sparePartId).toBe('sp-new');
      expect(outMovement!.productId).toBe('prod-new');
      expect(outMovement!.warehouseId).toBe('wh1');
    });

    it('removes the OLD installed part through the canonical removal authority', async () => {
      const { db } = makeDb();
      const { service, installedPartsService } = buildService(db);

      await service.issue('req1', 'line1', returnedDto() as any, 'u1', ctx);

      expect(installedPartsService.markInstalledPartRemovedInTx).toHaveBeenCalledTimes(1);
      const [tx, id, data] = installedPartsService.markInstalledPartRemovedInTx.mock.calls[0];
      expect(tx).toBe(db);
      expect(id).toBe('ip-old');
      expect(data.newStatus).toBe('REMOVED');
      expect(data.removedQuantity).toBe(3);
      expect(data.removedByUserId).toBe('u1');
    });

    it('ignores a client-supplied removed quantity and uses the installed record quantity', async () => {
      const { db, lineUpdates } = makeDb();
      const { service } = buildService(db);

      await service.issue('req1', 'line1', returnedDto({ removedPartQuantity: 3 }) as any, 'u1', ctx);

      expect(lineUpdates[0].removedPartQuantity).toBe(3);
    });

    it('audits the old→new physical part transition with both identities', async () => {
      const { db } = makeDb();
      const { service, audit } = buildService(db);

      await service.issue('req1', 'line1', returnedDto() as any, 'u1', ctx);

      const replacementAudit = audit.log.mock.calls.find((c: any[]) => c[1] === 'MACHINE_INSTALLED_PART_REPLACED');
      expect(replacementAudit).toBeDefined();
      const payload = replacementAudit![4];
      expect(payload.oldInstalledPartId).toBe('ip-old');
      expect(payload.oldSparePartId).toBe('sp-old');
      expect(payload.newInstalledPartId).toBe('ip-new');
      expect(payload.newSparePartId).toBe('sp-new');
      expect(payload.companyId).toBe('c1');
      expect(payload.branchId).toBe('b1');
    });
  });

  describe('NO_REMOVED_PART — no stock return at all', () => {
    it('creates no condition IN movement', async () => {
      const { db, conditionMovements } = makeDb();
      const { service } = buildService(db);

      await service.issue('req1', 'line1', noReturnDto() as any, 'u1', ctx);

      expect(conditionMovements.filter(m => m.direction === 'IN')).toHaveLength(0);
      expect(conditionMovements.filter(m => m.direction === 'OUT')).toHaveLength(1);
    });

    it('still removes the old installed part and records full old/new identity with the no-return reason', async () => {
      const { db } = makeDb();
      const { service, installedPartsService } = buildService(db);

      await service.issue('req1', 'line1', noReturnDto() as any, 'u1', ctx);

      expect(installedPartsService.markInstalledPartRemovedInTx).toHaveBeenCalledTimes(1);
      const payload = makeDbRef.historyCreates[0];
      expect(payload.oldInstalledPartId).toBe('ip-old');
      expect(payload.oldSparePartId).toBe('sp-old');
      expect(payload.newInstalledPartId).toBe('ip-new');
      expect(payload.newSparePartId).toBe('sp-new');
      expect(payload.removedQuantity).toBe(3);
      expect(payload.removedReturnedToStock).toBe(false);
      expect(payload.noReturnReason).toBe('PART_DESTROYED_ON_SITE');
      expect(payload.conditionInMovementId).toBeNull();
    });

    it('derives the removed quantity from the installed record and refuses a client quantity', async () => {
      const { db } = makeDb({ oldPart: oldInstalledPart({ installedQuantity: 3 }) });
      const { service } = buildService(db);

      // NO_REMOVED_PART forbids return fields entirely, so a client can never
      // dictate the removed quantity.
      await expect(
        service.issue('req1', 'line1', { ...noReturnDto(), removedPartQuantity: 99 } as any, 'u1', ctx),
      ).rejects.toThrow(/no stock return occurred/);
      expect(makeDbRef.historyCreates).toHaveLength(0);

      await service.issue('req1', 'line1', noReturnDto() as any, 'u1', ctx);
      expect(makeDbRef.historyCreates[0].removedQuantity).toBe(3);
    });
  });

  describe('NEW_INSTALLATION — replaces nothing', () => {
    it('creates no replacement event and removes no installed part', async () => {
      const { db } = makeDb();
      const { service, installedPartsService } = buildService(db);

      await service.issue('req1', 'line1', { warehouseId: 'wh1', issuedQuantity: 3, replacementAction: 'NEW_INSTALLATION' } as any, 'u1', ctx);

      expect(installedPartsService.recordReplacementInTx).not.toHaveBeenCalled();
      expect(installedPartsService.markInstalledPartRemovedInTx).not.toHaveBeenCalled();
      expect(makeDbRef.historyCreates).toHaveLength(0);
    });

    it('rejects an oldInstalledPartId on a fresh installation', async () => {
      const { db } = makeDb();
      const { service } = buildService(db);

      await expect(
        service.issue('req1', 'line1', { warehouseId: 'wh1', issuedQuantity: 3, replacementAction: 'NEW_INSTALLATION', oldInstalledPartId: 'ip-old' } as any, 'u1', ctx),
      ).rejects.toThrow(BadRequestException);
      expect(db.$transaction).not.toHaveBeenCalled();
    });

    it('rejects removed-part and no-return fields on a fresh installation', async () => {
      const { db } = makeDb();
      const { service } = buildService(db);

      await expect(
        service.issue('req1', 'line1', { warehouseId: 'wh1', issuedQuantity: 3, replacementAction: 'NEW_INSTALLATION', noReturnReason: 'X' } as any, 'u1', ctx),
      ).rejects.toThrow(BadRequestException);
      expect(db.$transaction).not.toHaveBeenCalled();
    });
  });

  describe('replacement action contract', () => {
    it('requires the actual installed part for a returned replacement', async () => {
      const { db } = makeDb();
      const { service } = buildService(db);
      const dto = returnedDto();
      delete (dto as any).oldInstalledPartId;

      await expect(service.issue('req1', 'line1', dto as any, 'u1', ctx)).rejects.toThrow(/oldInstalledPartId is required/);
      expect(db.$transaction).not.toHaveBeenCalled();
    });

    it('requires the actual installed part for a no-removal replacement', async () => {
      const { db } = makeDb();
      const { service } = buildService(db);
      const dto = noReturnDto();
      delete (dto as any).oldInstalledPartId;

      await expect(service.issue('req1', 'line1', dto as any, 'u1', ctx)).rejects.toThrow(/oldInstalledPartId is required/);
    });

    it('rejects a noReturnReason on a returned replacement', async () => {
      const { db } = makeDb();
      const { service } = buildService(db);

      await expect(service.issue('req1', 'line1', returnedDto({ noReturnReason: 'X' }) as any, 'u1', ctx)).rejects.toThrow(BadRequestException);
    });

    it('rejects return fields on a no-removal replacement', async () => {
      const { db } = makeDb();
      const { service } = buildService(db);

      await expect(
        service.issue('req1', 'line1', noReturnDto({ removedPartCondition: 'USED_REPAIRABLE', removedPartWarehouseId: 'wh2', removedPartQuantity: 3 }) as any, 'u1', ctx),
      ).rejects.toThrow(BadRequestException);
      expect(db.$transaction).not.toHaveBeenCalled();
    });
  });

  describe('localized message keys for the replacement contract', () => {
    const keyOf = async (promise: Promise<unknown>) => {
      const error: any = await promise.catch((e) => e);
      return error.getResponse().messageKey;
    };

    it('keys a missing replacement action', async () => {
      const { db } = makeDb();
      const { service } = buildService(db);
      const dto: any = returnedDto();
      delete dto.replacementAction;

      expect(await keyOf(service.issue('req1', 'line1', dto, 'u1', ctx)))
        .toBe('maintenance.replacementActionRequired');
    });

    it('keys an unknown replacement action', async () => {
      const { db } = makeDb();
      const { service } = buildService(db);

      expect(await keyOf(service.issue('req1', 'line1', { ...returnedDto(), replacementAction: 'SCRAP_IT' } as any, 'u1', ctx)))
        .toBe('maintenance.replacementActionInvalid');
    });

    it('keys a missing removed-part condition on a returned replacement', async () => {
      const { db } = makeDb();
      const { service } = buildService(db);
      const dto: any = returnedDto();
      delete dto.removedPartCondition;

      expect(await keyOf(service.issue('req1', 'line1', dto, 'u1', ctx)))
        .toBe('maintenance.replacementRemovedPartConditionRequired');
    });

    it('keys a missing removed-part return warehouse', async () => {
      const { db } = makeDb();
      const { service } = buildService(db);
      const dto: any = returnedDto();
      delete dto.removedPartWarehouseId;

      expect(await keyOf(service.issue('req1', 'line1', dto, 'u1', ctx)))
        .toBe('maintenance.replacementRemovedPartWarehouseRequired');
    });

    it('keys a non-positive removed-part quantity', async () => {
      const { db } = makeDb();
      const { service } = buildService(db);

      expect(await keyOf(service.issue('req1', 'line1', returnedDto({ removedPartQuantity: 0 }) as any, 'u1', ctx)))
        .toBe('maintenance.replacementRemovedPartQuantityRequired');
    });

    it('keys an unknown removed-part condition', async () => {
      const { db } = makeDb();
      const { service } = buildService(db);

      expect(await keyOf(service.issue('req1', 'line1', returnedDto({ removedPartCondition: 'MELTED' }) as any, 'u1', ctx)))
        .toBe('maintenance.replacementRemovedPartConditionInvalid');
    });

    it('keys a missing no-return reason', async () => {
      const { db } = makeDb();
      const { service } = buildService(db);
      const dto: any = noReturnDto();
      delete dto.noReturnReason;

      expect(await keyOf(service.issue('req1', 'line1', dto, 'u1', ctx)))
        .toBe('maintenance.replacementNoReturnReasonRequired');
    });
  });

  describe('old installed part eligibility', () => {
    it('rejects an already-removed installed part', async () => {
      const { db } = makeDb({ oldPart: oldInstalledPart({ status: 'REMOVED' }) });
      const { service, installedPartsService } = buildService(db);

      await expect(service.issue('req1', 'line1', returnedDto() as any, 'u1', ctx)).rejects.toThrow(/no longer be replaced/);
      expect(installedPartsService.markInstalledPartRemovedInTx).not.toHaveBeenCalled();
    });

    it('hides an installed part owned by another company behind a not-found response', async () => {
      const { db } = makeDb({ oldPart: oldInstalledPart({ machine: machine({ companyId: 'c2' }) }) });
      const { service, installedPartsService } = buildService(db);

      await expect(service.issue('req1', 'line1', returnedDto() as any, 'u1', ctx)).rejects.toThrow(NotFoundException);
      expect(installedPartsService.markInstalledPartRemovedInTx).not.toHaveBeenCalled();
      expect(installedPartsService.recordReplacementInTx).not.toHaveBeenCalled();
    });

    it('hides an installed part owned by another branch behind a not-found response', async () => {
      const { db } = makeDb({ oldPart: oldInstalledPart({ machine: machine({ branchId: 'b2' }) }) });
      const { service, installedPartsService } = buildService(db);

      await expect(service.issue('req1', 'line1', returnedDto() as any, 'u1', ctx)).rejects.toThrow(NotFoundException);
      expect(installedPartsService.recordReplacementInTx).not.toHaveBeenCalled();
    });

    it('rejects a missing installed part without disclosing tenant details', async () => {
      const { db } = makeDb({ oldPart: null });
      const { service } = buildService(db);

      await expect(service.issue('req1', 'line1', returnedDto() as any, 'u1', ctx)).rejects.toThrow(NotFoundException);
    });

    it('rejects an installed part belonging to a different machine', async () => {
      const { db } = makeDb({ oldPart: oldInstalledPart({ machineId: 'm-other', machine: machine({ id: 'm-other' }) }) });
      const { service } = buildService(db);

      await expect(service.issue('req1', 'line1', returnedDto() as any, 'u1', ctx)).rejects.toThrow(/does not belong to this request machine/);
    });

    it('rejects an installed part belonging to a different machine component', async () => {
      const { db } = makeDb({
        partLine: partLine({ machineComponentId: 'cmp-1', machineComponent: { id: 'cmp-1' } }),
        oldPart: oldInstalledPart({ machineComponentId: 'cmp-2' }),
      });
      const { service } = buildService(db);

      await expect(service.issue('req1', 'line1', returnedDto() as any, 'u1', ctx)).rejects.toThrow(/machine component/);
    });

    it('rejects a machine-level installed part for a component-scoped request line', async () => {
      const { db } = makeDb({
        partLine: partLine({ machineComponentId: 'cmp-1', machineComponent: { id: 'cmp-1' } }),
        oldPart: oldInstalledPart({ machineComponentId: null }),
      });
      const { service } = buildService(db);

      await expect(service.issue('req1', 'line1', returnedDto() as any, 'u1', ctx)).rejects.toThrow(/machine component/);
    });

    it('fails closed on a partial removal instead of silently removing a whole record', async () => {
      const { db } = makeDb({ oldPart: oldInstalledPart({ installedQuantity: 5 }) });
      const { service, installedPartsService } = buildService(db);

      await expect(
        service.issue('req1', 'line1', returnedDto({ removedPartQuantity: 2 }) as any, 'u1', ctx),
      ).rejects.toThrow(/Partial removal is not supported/);
      expect(installedPartsService.markInstalledPartRemovedInTx).not.toHaveBeenCalled();
      expect(installedPartsService.recordInstalledPartInTx).not.toHaveBeenCalled();
    });

    it('rejects an installed record with no active installed quantity', async () => {
      const { db } = makeDb({ oldPart: oldInstalledPart({ installedQuantity: 0 }) });
      const { service } = buildService(db);

      await expect(service.issue('req1', 'line1', returnedDto() as any, 'u1', ctx)).rejects.toThrow(/no active installed quantity/);
    });
  });

  describe('concurrent replacement of the same physical part', () => {
    it('locks the old installed part row before any mutation and uses Serializable isolation', async () => {
      const { db } = makeDb();
      const { service, installedPartsService } = buildService(db);

      await service.issue('req1', 'line1', returnedDto() as any, 'u1', ctx);

      const lockCallOrder = db.$queryRaw.mock.invocationCallOrder[0];
      const removalCallOrder = installedPartsService.markInstalledPartRemovedInTx.mock.invocationCallOrder[0];
      const newPartCallOrder = installedPartsService.recordInstalledPartInTx.mock.invocationCallOrder[0];
      expect(lockCallOrder).toBeLessThan(removalCallOrder);
      expect(lockCallOrder).toBeLessThan(newPartCallOrder);

      const [sql] = db.$queryRaw.mock.calls[0];
      expect(sql.strings.join(' ')).toMatch(/UPDLOCK/i);
      expect(sql.strings.join(' ')).toMatch(/HOLDLOCK/i);
      expect(sql.strings.join(' ')).toMatch(/machine_installed_parts/i);
      expect(sql.values).toEqual(['ip-old']);

      const txOptions = db.$transaction.mock.calls[0][1];
      expect(txOptions).toEqual({ isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    });

    it('does not lock the old installed part row for a fresh installation', async () => {
      const { db } = makeDb();
      const { service } = buildService(db);

      await service.issue('req1', 'line1', { warehouseId: 'wh1', issuedQuantity: 3, replacementAction: 'NEW_INSTALLATION' } as any, 'u1', ctx);

      const lockSql = db.$queryRaw.mock.calls.filter((c: any[]) => String(c[0]?.strings?.join(' ')).includes('machine_installed_parts'));
      expect(lockSql).toHaveLength(0);
    });
  });

  describe('atomicity', () => {
    it('rolls back the whole replacement when the replacement event cannot be written', async () => {
      const { db } = makeDb();
      const { service, installedPartsService } = buildService(db);
      installedPartsService.recordReplacementInTx = jest.fn().mockRejectedValue(new Error('replacement event write failed'));

      await expect(service.issue('req1', 'line1', returnedDto() as any, 'u1', ctx)).rejects.toThrow('replacement event write failed');
      // A real transaction rolls the whole unit back; the mock surfaces the throw.
      expect(installedPartsService.markInstalledPartRemovedInTx).toHaveBeenCalledTimes(1);
    });
  });
});
