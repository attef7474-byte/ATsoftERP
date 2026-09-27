import { BadRequestException, NotFoundException } from '@nestjs/common';
import { RepairOrdersService } from './repair-orders.service';
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

const historyRow = (overrides: Record<string, any> = {}) => ({
  id: 'h1',
  replacementNumber: 'RPL-0001',
  machineId: 'm1',
  machineComponentId: null,
  maintenanceRequestId: 'req1',
  requiredPartId: 'line1',
  // R2-E: the removed identity is the repair source. It is intentionally a
  // different record from the newly installed part.
  oldInstalledPartId: 'ip-old',
  oldSparePartId: 'sp-old',
  newInstalledPartId: 'ip-new',
  newSparePartId: 'sp-new',
  removedCondition: 'USED_REPAIRABLE',
  removedQuantity: 2,
  removedReturnedToStock: true,
  replacementAction: 'RETURNED_REMOVED_PART',
  noReturnReason: null,
  conditionOutMovementId: 'cm-out',
  conditionInMovementId: 'cm-in',
  oldInstalledPart: { id: 'ip-old', productId: 'prod-old', status: 'REMOVED' },
  oldSparePart: { id: 'sp-old', code: 'SP-OLD', name: 'Old Spare', productId: 'prod-old' },
  newSparePart: { id: 'sp-new', productId: 'prod-new' },
  machine: { id: 'm1', companyId: 'c1', branchId: 'b1' },
  machineComponent: { id: 'cmp-1', name: 'Component 1' },
  maintenanceRequest: { id: 'req1', requestNumber: 'MR-0001', title: 'Request' },
  ...overrides,
});

const returnMovement = (overrides: Record<string, any> = {}) => ({
  id: 'cm-in',
  movementNumber: 'CM-0001',
  sparePartId: 'sp-old',
  productId: 'prod-old',
  warehouseId: 'wh-return',
  condition: 'USED_REPAIRABLE',
  direction: 'IN',
  quantity: 2,
  warehouse: {
    id: 'wh-return',
    code: 'WH-RET',
    name: 'Return Warehouse',
    warehouseType: 'SPARE_PART',
    companyId: 'c1',
    branchId: 'b1',
  },
  ...overrides,
});

describe('R2-E RepairOrdersService — repairable source identity handoff', () => {
  let prisma: any;
  let audit: any;
  let numbering: any;
  let conditionService: any;
  let service: RepairOrdersService;

  beforeEach(() => {
    prisma = {
      sparePartReplacementHistory: {
        findUnique: jest.fn().mockImplementation(async () => ({ ...historyRow(), machine: { id: 'm1', companyId: 'c1', branchId: 'b1' } })),
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn(),
      },
      sparePartRepairOrder: {
        findFirst: jest.fn().mockResolvedValue(null),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      sparePartConditionMovement: { findUnique: jest.fn().mockImplementation(async () => returnMovement()) },
      sparePartConditionBalance: { findMany: jest.fn().mockResolvedValue([]), findUnique: jest.fn(), findFirst: jest.fn() },
      warehouse: { findUnique: jest.fn().mockImplementation(async () => ({ id: 'wh-return', code: 'WH-RET', name: 'Return Warehouse', warehouseType: 'SPARE_PART', companyId: 'c1', branchId: 'b1' })) },
      sparePart: { findUnique: jest.fn() },
    };
    audit = { log: jest.fn().mockResolvedValue(undefined) };
    numbering = {
      generateNumberAtomic: jest.fn().mockResolvedValue('RO-000001'),
      generateNumberAtomicWithClient: jest.fn().mockResolvedValue('RO-000001'),
    };
    conditionService = {
      recordMovement: jest.fn(),
      getBalanceByKey: jest.fn().mockImplementation(async () => ({ id: 'cb1', sparePartKey: 'sp-old', warehouseKey: 'wh-return', condition: 'USED_REPAIRABLE', quantity: 2, availableQuantity: 2 })),
    };
    service = new RepairOrdersService(prisma, audit, numbering, conditionService);
  });

  describe('createFromReplacementHistory', () => {
    it('hands off the REMOVED part identity, never the newly installed part', async () => {
      const createSpy = jest.spyOn(service, 'create').mockResolvedValue({ id: 'ro1' } as any);

      await service.createFromReplacementHistory({ replacementHistoryId: 'h1' } as any, 'u1', ctx);

      const payload = createSpy.mock.calls[0][0];
      expect(payload.sparePartId).toBe('sp-old');
      expect(payload.sparePartId).not.toBe('sp-new');
      expect(payload.productId).toBe('prod-old');
      expect(payload.installedPartId).toBe('ip-old');
      expect(payload.installedPartId).not.toBe('ip-new');
      expect(payload.sourceCondition).toBe('USED_REPAIRABLE');
      expect(payload.sourceType).toBe('REPLACEMENT_HISTORY');
      expect(payload.replacementHistoryId).toBe('h1');
      expect(payload.conditionInMovementId).toBe('cm-in');
    });

    it('uses the exact return warehouse from the recorded condition IN movement', async () => {
      const createSpy = jest.spyOn(service, 'create').mockResolvedValue({ id: 'ro1' } as any);
      // A different warehouse also holds condition stock of the removed part.
      prisma.sparePartConditionBalance.findMany.mockResolvedValue([
        { warehouseId: 'wh-other', quantity: 99, availableQuantity: 99 },
      ]);

      await service.createFromReplacementHistory({ replacementHistoryId: 'h1' } as any, 'u1', ctx);

      expect(createSpy.mock.calls[0][0].warehouseId).toBe('wh-return');
      // The balance scan must not be used to pick a warehouse at all.
      expect(prisma.sparePartConditionBalance.findMany).not.toHaveBeenCalled();
    });

    it('fails closed when the return movement does not belong to the removed part', async () => {
      prisma.sparePartConditionMovement.findUnique.mockResolvedValue(returnMovement({ sparePartId: 'sp-new' }));
      const createSpy = jest.spyOn(service, 'create');

      await expect(service.createFromReplacementHistory({ replacementHistoryId: 'h1' } as any, 'u1', ctx)).rejects.toThrow(BadRequestException);
      expect(createSpy).not.toHaveBeenCalled();
    });

    it('fails closed when the return movement condition does not match the removed condition', async () => {
      prisma.sparePartConditionMovement.findUnique.mockResolvedValue(returnMovement({ condition: 'DAMAGED_REPAIRABLE' }));
      const createSpy = jest.spyOn(service, 'create');

      await expect(service.createFromReplacementHistory({ replacementHistoryId: 'h1' } as any, 'u1', ctx)).rejects.toThrow(BadRequestException);
      expect(createSpy).not.toHaveBeenCalled();
    });

    it('fails closed when the return movement is not a stock IN movement', async () => {
      prisma.sparePartConditionMovement.findUnique.mockResolvedValue(returnMovement({ direction: 'OUT' }));
      const createSpy = jest.spyOn(service, 'create');

      await expect(service.createFromReplacementHistory({ replacementHistoryId: 'h1' } as any, 'u1', ctx)).rejects.toThrow(BadRequestException);
      expect(createSpy).not.toHaveBeenCalled();
    });

    it('fails closed when the recorded return movement no longer exists', async () => {
      prisma.sparePartConditionMovement.findUnique.mockResolvedValue(null);
      const createSpy = jest.spyOn(service, 'create');

      await expect(service.createFromReplacementHistory({ replacementHistoryId: 'h1' } as any, 'u1', ctx)).rejects.toThrow(BadRequestException);
      expect(createSpy).not.toHaveBeenCalled();
    });

    it('hides a return movement warehouse outside the active company and branch', async () => {
      prisma.sparePartConditionMovement.findUnique.mockResolvedValue(
        returnMovement({ warehouse: { id: 'wh-foreign', code: 'F', name: 'Foreign', warehouseType: 'SPARE_PART', companyId: 'c2', branchId: 'b9' } }),
      );
      const createSpy = jest.spyOn(service, 'create');

      await expect(service.createFromReplacementHistory({ replacementHistoryId: 'h1' } as any, 'u1', ctx)).rejects.toThrow(NotFoundException);
      expect(createSpy).not.toHaveBeenCalled();
    });

    it('refuses a legacy event with no provable removed-part identity', async () => {
      prisma.sparePartReplacementHistory.findUnique.mockImplementation(async () => ({
        ...historyRow({ oldSparePartId: null, oldInstalledPartId: null }),
        machine: { id: 'm1', companyId: 'c1', branchId: 'b1' },
      }));
      const createSpy = jest.spyOn(service, 'create');

      await expect(service.createFromReplacementHistory({ replacementHistoryId: 'h1' } as any, 'u1', ctx)).rejects.toThrow(/no provable removed-part identity/);
      expect(createSpy).not.toHaveBeenCalled();
    });

    it('rejects a source that was not returned to stock', async () => {
      prisma.sparePartReplacementHistory.findUnique.mockImplementation(async () => ({
        ...historyRow({ removedReturnedToStock: false, conditionInMovementId: null }),
        machine: { id: 'm1', companyId: 'c1', branchId: 'b1' },
      }));

      await expect(service.createFromReplacementHistory({ replacementHistoryId: 'h1' } as any, 'u1', ctx)).rejects.toThrow(/not returned to stock/);
    });

    it('rejects a non-repairable removed condition', async () => {
      prisma.sparePartReplacementHistory.findUnique.mockImplementation(async () => ({
        ...historyRow({ removedCondition: 'DAMAGED_NOT_REPAIRABLE', conditionInMovementId: null }),
        machine: { id: 'm1', companyId: 'c1', branchId: 'b1' },
      }));

      await expect(service.createFromReplacementHistory({ replacementHistoryId: 'h1' } as any, 'u1', ctx)).rejects.toThrow(/not repairable/);
    });

    it('rejects a replacement event from another company', async () => {
      prisma.sparePartReplacementHistory.findUnique.mockImplementation(async () => ({
        ...historyRow(),
        machine: { id: 'm1', companyId: 'c2', branchId: 'b1' },
      }));

      await expect(service.createFromReplacementHistory({ replacementHistoryId: 'h1' } as any, 'u1', ctx)).rejects.toThrow(NotFoundException);
    });

    it('rejects a duplicate active repair order for the same source', async () => {
      prisma.sparePartRepairOrder.findFirst.mockResolvedValue({ id: 'ro-existing', status: 'OPEN' });

      await expect(service.createFromReplacementHistory({ replacementHistoryId: 'h1' } as any, 'u1', ctx)).rejects.toThrow(/already exists/);
    });

    it('falls back to a tenant-scoped balance scan for a legacy event with no recorded return movement', async () => {
      prisma.sparePartReplacementHistory.findUnique.mockImplementation(async () => ({
        ...historyRow({ conditionInMovementId: null }),
        machine: { id: 'm1', companyId: 'c1', branchId: 'b1' },
      }));
      prisma.sparePartConditionBalance.findMany.mockResolvedValue([
        { warehouseId: 'wh-legacy', quantity: 4, availableQuantity: 4 },
      ]);
      const createSpy = jest.spyOn(service, 'create').mockResolvedValue({ id: 'ro1' } as any);

      await service.createFromReplacementHistory({ replacementHistoryId: 'h1' } as any, 'u1', ctx);

      expect(createSpy.mock.calls[0][0].warehouseId).toBe('wh-legacy');
      expect(createSpy.mock.calls[0][0].sparePartId).toBe('sp-old');
    });
  });
});
