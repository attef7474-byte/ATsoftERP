import { ForbiddenException, BadRequestException } from '@nestjs/common';
import { InventoryPhysicalCountsService } from './inventory-physical-counts.service';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { AuditService } from '../../../common/audit/audit.service';
import { NumberingService } from '../../../modules/numbering/numbering.service';
import { ActiveOperationalContext } from '../../../common/operational-context/operational-context.types';

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

const warehouse = (overrides: Record<string, any> = {}) => ({
  id: 'w1',
  companyId: 'c1',
  branchId: 'b1',
  code: 'WH1',
  name: 'Main Warehouse',
  ...overrides,
});

const countDoc = (overrides: Record<string, any> = {}) => ({
  id: 'pc1',
  countNumber: 'PC-0001',
  companyId: 'c1',
  branchId: 'b1',
  warehouseId: 'w1',
  status: 'DRAFT',
  notes: null,
  countDate: new Date(),
  createdById: 'u1',
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
  lines: [],
  ...overrides,
});

const line = (overrides: Record<string, any> = {}) => ({
  id: 'l1',
  physicalCountId: 'pc1',
  productId: 'prd1',
  warehouseLocationId: null,
  systemQty: 10,
  countedQty: 8,
  varianceQty: -2,
  notes: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

describe('InventoryPhysicalCountsService tenant isolation', () => {
  let prisma: any;
  let numbering: any;
  let audit: any;
  let service: InventoryPhysicalCountsService;

  beforeEach(() => {
    prisma = {
      warehouse: { findUnique: jest.fn() },
      warehouseLocation: { findUnique: jest.fn() },
      product: { findUnique: jest.fn() },
      inventoryPhysicalCount: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
      },
      inventoryPhysicalCountLine: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      inventoryMovement: { create: jest.fn() },
      inventoryBalance: { findFirst: jest.fn(), create: jest.fn(), update: jest.fn() },
      auditLog: { findMany: jest.fn().mockResolvedValue([]) },
      $transaction: jest.fn().mockImplementation(async (fn: (tx: any) => Promise<any>) => fn(prisma)),
    };
    numbering = {
      generateNumberAtomic: jest.fn().mockResolvedValue('PC-0001'),
      generateNumberAtomicWithClient: jest.fn().mockResolvedValue('PC-0001'),
    };
    audit = { log: jest.fn().mockResolvedValue(undefined) };
    service = new InventoryPhysicalCountsService(prisma as unknown as PrismaService, audit as unknown as AuditService, numbering as unknown as NumberingService, { findActivePolicyForWarehouse: jest.fn().mockResolvedValue(null) } as any);
  });

  describe('update', () => {
    it('rejects warehouse re-pointing to a foreign company warehouse', async () => {
      prisma.inventoryPhysicalCount.findUnique.mockResolvedValue(countDoc());
      prisma.warehouse.findUnique.mockResolvedValue(warehouse({ id: 'w-foreign', companyId: 'c2' }));

      await expect(
        service.update('pc1', { warehouseId: 'w-foreign' } as any, 'u1', ctx),
      ).rejects.toThrow(ForbiddenException);
      expect(prisma.inventoryPhysicalCount.update).not.toHaveBeenCalled();
    });

    it('allows warehouse re-pointing within the same company', async () => {
      prisma.inventoryPhysicalCount.findUnique.mockResolvedValue(countDoc());
      prisma.warehouse.findUnique.mockResolvedValue(warehouse({ id: 'w2' }));
      prisma.inventoryPhysicalCount.update.mockResolvedValue(countDoc({ warehouseId: 'w2' }));

      const result = await service.update('pc1', { warehouseId: 'w2' } as any, 'u1', ctx);
      expect(result.warehouseId).toBe('w2');
    });
  });

  describe('addLine', () => {
    it('rejects a location that belongs to a different warehouse', async () => {
      prisma.inventoryPhysicalCount.findUnique.mockResolvedValue(countDoc());
      prisma.product.findUnique.mockResolvedValue({ id: 'prd2', name: 'P', code: 'P', unit: 'pc' });
      prisma.warehouseLocation.findUnique.mockResolvedValue({
        id: 'loc2', warehouseId: 'w2', code: 'L2', name: 'L2',
      });

      await expect(
        service.addLine('pc1', 'prd2', 'loc2', 'u1', ctx),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('post', () => {
    it('revalidates warehouse inside the transaction', async () => {
      prisma.inventoryPhysicalCount.findUnique.mockResolvedValue(countDoc({ status: 'APPROVED', lines: [] }));
      prisma.inventoryPhysicalCountLine.findMany.mockResolvedValue([line()]);
      prisma.warehouse.findUnique.mockResolvedValue(warehouse());
      prisma.inventoryBalance.findFirst.mockResolvedValue({ id: 'bal1', quantity: 10 });
      prisma.inventoryBalance.update.mockResolvedValue({});
      prisma.inventoryMovement.create.mockResolvedValue({ id: 'mov1' });
      prisma.inventoryPhysicalCount.update.mockResolvedValue(countDoc({ status: 'POSTED' }));

      await service.post('pc1', 'u1', ctx);

      expect(prisma.inventoryMovement.create).toHaveBeenCalled();
    });

    it('rejects posting when the count warehouse belongs to another company', async () => {
      prisma.inventoryPhysicalCount.findUnique.mockResolvedValue(countDoc({ status: 'APPROVED', warehouseId: 'w-foreign' }));
      prisma.inventoryPhysicalCountLine.findMany.mockResolvedValue([line()]);
      prisma.warehouse.findUnique.mockResolvedValue(warehouse({ id: 'w-foreign', companyId: 'c2' }));

      await expect(service.post('pc1', 'u1', ctx)).rejects.toThrow(ForbiddenException);
      expect(prisma.inventoryMovement.create).not.toHaveBeenCalled();
    });
  });

  describe('createLineWithBalance via create', () => {
    it('rejects lines whose location belongs to a different warehouse', async () => {
      prisma.warehouse.findUnique.mockResolvedValue(warehouse());
      prisma.inventoryPhysicalCount.create.mockResolvedValue(countDoc());
      prisma.warehouseLocation.findUnique.mockResolvedValue({
        id: 'loc2', warehouseId: 'w2', code: 'L2', name: 'L2',
      });
      prisma.inventoryBalance.findFirst.mockResolvedValue({ id: 'bal1', quantity: 5 });
      prisma.inventoryPhysicalCountLine.create.mockResolvedValue(line());

      await expect(
        service.create({
          warehouseId: 'w1',
          notes: 'x',
          lines: [{ productId: 'prd1', warehouseLocationId: 'loc2' }],
        } as any, 'u1', ctx),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.inventoryPhysicalCountLine.create).not.toHaveBeenCalled();
    });
  });
});
