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

describe('RepairOrdersService', () => {
  let prisma: any;
  let audit: any;
  let numbering: any;
  let conditionService: any;
  let service: RepairOrdersService;

  beforeEach(() => {
    prisma = {
      sparePartReplacementHistory: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        findFirst: jest.fn(),
      },
      sparePartRepairOrder: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      sparePartConditionBalance: { findMany: jest.fn(), findUnique: jest.fn(), findFirst: jest.fn() },
      warehouse: { findUnique: jest.fn() },
      sparePart: { findUnique: jest.fn() },
    };
    audit = { log: jest.fn().mockResolvedValue(undefined) };
    numbering = {
      generateNumberAtomic: jest.fn().mockResolvedValue('RO-000001'),
      generateNumberAtomicWithClient: jest.fn().mockResolvedValue('RO-000001'),
    };
    conditionService = { recordMovement: jest.fn() };
    service = new RepairOrdersService(prisma, audit, numbering, conditionService);
  });

  describe('findRepairableQueue', () => {
    it('scopes repairable condition-balance reads to the active company and branch warehouse', async () => {
      prisma.sparePartReplacementHistory.findMany.mockResolvedValue([
        {
          id: 'h1',
          replacementNumber: 'RPL-0001',
          replacementAction: 'RETURNED_REMOVED_PART',
          replacedAt: new Date('2026-01-01'),
          removedReturnedToStock: true,
          removedCondition: 'USED_REPAIRABLE',
          removedQuantity: 2,
          // R2-E: the repairable source is the REMOVED part. OLD and NEW catalog
          // spare parts are deliberately different ids so a conflation is visible.
          oldSparePartId: 'sp1',
          newSparePartId: 'sp2',
          conditionInMovementId: null,
          machine: { id: 'm1', code: 'M1', name: 'Machine' },
          machineComponent: null,
          maintenanceRequest: null,
          oldSparePart: { id: 'sp1', code: 'SP1', name: 'Part', productId: 'p1', unit: 'PC' },
          newSparePart: { id: 'sp2', code: 'SP2', name: 'New Part', productId: 'p1', unit: 'PC' },
          oldInstalledPart: { id: 'ip-old', status: 'REMOVED', installedQuantity: 2 },
          newInstalledPart: { id: 'ip-new', status: 'ACTIVE', installedQuantity: 2 },
        },
      ]);
      prisma.sparePartRepairOrder.findFirst.mockResolvedValue(null);
      prisma.sparePartConditionBalance.findMany.mockResolvedValue([
        { id: 'b1', warehouseId: 'w1', condition: 'USED_REPAIRABLE', quantity: 5, availableQuantity: 5, warehouse: { id: 'w1', code: 'W1', name: 'WH', warehouseType: 'SPARE_PART' } },
      ]);

      const queue: any[] = await service.findRepairableQueue({}, ctx);

      expect(prisma.sparePartConditionBalance.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            sparePartKey: 'sp1',
            condition: 'USED_REPAIRABLE',
            quantity: { gt: 0 },
            warehouse: {
              companyId: 'c1',
              OR: [{ branchId: 'b1' }, { branchId: null }],
            },
          }),
        }),
      );
      // R2-E: the queue must never read condition stock of the newly installed part
      // as if it were the repair source.
      expect(prisma.sparePartConditionBalance.findMany).not.toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ sparePartKey: 'sp2' }) }),
      );
      expect(queue[0].sparePart.id).toBe('sp1');
      expect(queue[0].newSparePart.id).toBe('sp2');
    });

    it('keys the queue filter on the removed spare part, never the newly installed one', async () => {
      prisma.sparePartReplacementHistory.findMany.mockResolvedValue([]);

      await service.findRepairableQueue({ sparePartId: 'sp1' } as any, ctx);

      expect(prisma.sparePartReplacementHistory.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ oldSparePartId: 'sp1' }),
        }),
      );
      expect(prisma.sparePartReplacementHistory.findMany).not.toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ newSparePartId: 'sp1' }) }),
      );
    });
  });
});
