import { ForbiddenException, BadRequestException, NotFoundException } from '@nestjs/common';
import { InventoryOpeningBalancesService } from './inventory-opening-balances.service';
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

const line = (overrides: Record<string, any> = {}) => ({
  id: 'l1',
  openingBalanceId: 'ob1',
  productId: 'prd1',
  locationId: null,
  quantity: 10,
  movementId: null,
  notes: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

const doc = (overrides: Record<string, any> = {}) => ({
  id: 'ob1',
  code: 'OB-0001',
  companyId: 'c1',
  branchId: 'b1',
  warehouseId: 'w1',
  locationId: null,
  reason: 'Opening stock',
  notes: null,
  status: 'DRAFT',
  createdById: 'u1',
  updatedById: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
  lines: [line()],
  ...overrides,
});

describe('InventoryOpeningBalancesService tenant isolation', () => {
  let prisma: any;
  let numbering: any;
  let audit: any;
  let service: InventoryOpeningBalancesService;
  let txOptions: any;

  beforeEach(() => {
    txOptions = undefined;
    prisma = {
      warehouse: { findUnique: jest.fn() },
      warehouseLocation: { findUnique: jest.fn() },
      product: { findUnique: jest.fn() },
      inventoryOpeningBalance: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        count: jest.fn(),
      },
      inventoryOpeningBalanceLine: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        deleteMany: jest.fn(),
      },
      inventoryMovement: { create: jest.fn() },
      inventoryBalance: { findFirst: jest.fn(), create: jest.fn(), update: jest.fn() },
      $transaction: jest.fn().mockImplementation(async (fn: (tx: any) => Promise<any>, options?: any) => {
        txOptions = options;
        return fn(prisma);
      }),
    };
    numbering = {
      generateNumberAtomic: jest.fn().mockResolvedValue('OB-0001'),
      generateNumberAtomicWithClient: jest.fn().mockResolvedValue('OB-0001'),
    };
    audit = { log: jest.fn().mockResolvedValue(undefined) };
    service = new InventoryOpeningBalancesService(prisma as unknown as PrismaService, audit as unknown as AuditService, numbering as unknown as NumberingService);
  });

  describe('update', () => {
    it('rejects warehouse re-pointing to a foreign company warehouse', async () => {
      prisma.inventoryOpeningBalance.findUnique.mockResolvedValue(doc());
      prisma.warehouse.findUnique.mockResolvedValue(warehouse({ id: 'w-foreign', companyId: 'c2' }));

      await expect(
        service.update('ob1', { warehouseId: 'w-foreign' } as any, 'u1', ctx),
      ).rejects.toThrow(ForbiddenException);
      expect(prisma.inventoryOpeningBalance.update).not.toHaveBeenCalled();
    });

    it('never writes tenant fields from the DTO', async () => {
      prisma.inventoryOpeningBalance.findUnique.mockResolvedValue(doc());
      prisma.inventoryOpeningBalance.update.mockResolvedValue(doc());
      prisma.warehouseLocation.findUnique.mockResolvedValue(null);

      await service.update('ob1', {
        companyId: 'c2',
        branchId: 'b2',
        reason: 'updated',
      } as any, 'u1', ctx);

      const updateCall = prisma.inventoryOpeningBalance.update.mock.calls[0][0];
      expect(updateCall.data.companyId).toBeUndefined();
      expect(updateCall.data.branchId).toBeUndefined();
      expect(updateCall.data.reason).toBe('updated');
    });

    it('rejects locationId that does not belong to the effective warehouse', async () => {
      prisma.inventoryOpeningBalance.findUnique.mockResolvedValue(doc({ warehouseId: 'w1' }));
      prisma.warehouseLocation.findUnique.mockResolvedValue({
        id: 'loc-foreign', warehouseId: 'w2', code: 'L', name: 'L',
      });

      await expect(
        service.update('ob1', { locationId: 'loc-foreign' } as any, 'u1', ctx),
      ).rejects.toThrow(BadRequestException);
    });

    it('allows warehouse re-pointing within the same company', async () => {
      prisma.inventoryOpeningBalance.findUnique.mockResolvedValue(doc());
      prisma.warehouse.findUnique.mockResolvedValue(warehouse({ id: 'w2' }));
      prisma.inventoryOpeningBalance.update.mockResolvedValue(doc({ warehouseId: 'w2' }));

      const result = await service.update('ob1', { warehouseId: 'w2' } as any, 'u1', ctx);
      expect(result.warehouseId).toBe('w2');
      expect(prisma.inventoryOpeningBalance.update.mock.calls[0][0].data.warehouseId).toBe('w2');
    });
  });

  describe('post', () => {
    it('revalidates warehouse inside the transaction and uses in-tx numbering', async () => {
      prisma.inventoryOpeningBalance.findUnique.mockResolvedValue(doc({ status: 'APPROVED' }));
      prisma.warehouse.findUnique.mockResolvedValue(warehouse());
      prisma.inventoryMovement.create.mockResolvedValue({ id: 'mov1', lines: [] });
      prisma.inventoryBalance.findFirst.mockResolvedValue({ id: 'bal1', quantity: 5 });
      prisma.inventoryBalance.update.mockResolvedValue({});
      prisma.inventoryOpeningBalanceLine.update.mockResolvedValue({});
      prisma.inventoryOpeningBalance.update.mockResolvedValue(doc({ status: 'POSTED' }));

      await service.post('ob1', 'u1', ctx);

      expect(numbering.generateNumberAtomicWithClient).toHaveBeenCalledWith('INVENTORY_MOVEMENT', prisma);
      const created = prisma.inventoryMovement.create.mock.calls[0][0];
      expect(created.data.warehouseId).toBe('w1');
      expect(created.data.companyId).toBe('c1');
      expect(created.data.movementType).toBe('OPENING_BALANCE');
    });

    it('rejects posting a document whose warehouse belongs to another company', async () => {
      prisma.inventoryOpeningBalance.findUnique.mockResolvedValue(doc({ status: 'APPROVED', warehouseId: 'w-foreign' }));
      prisma.warehouse.findUnique.mockResolvedValue(warehouse({ id: 'w-foreign', companyId: 'c2' }));

      await expect(service.post('ob1', 'u1', ctx)).rejects.toThrow(ForbiddenException);
      expect(prisma.inventoryMovement.create).not.toHaveBeenCalled();
    });
  });

  describe('create', () => {
    it('rejects lines with a location belonging to a different warehouse', async () => {
      prisma.warehouse.findUnique.mockResolvedValue(warehouse());
      prisma.product.findUnique.mockResolvedValue({ id: 'prd1', name: 'P', code: 'P', unit: 'pc' });
      prisma.warehouseLocation.findUnique.mockResolvedValue({
        id: 'loc2', warehouseId: 'w2', code: 'L2', name: 'L2',
      });

      await expect(
        service.create({
          warehouseId: 'w1',
          reason: 'x',
          lines: [{ productId: 'prd1', quantity: 5, locationId: 'loc2' }],
        } as any, 'u1', ctx),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects when the warehouse is not in the active company', async () => {
      prisma.warehouse.findUnique.mockResolvedValue(warehouse({ companyId: 'c2' }));

      await expect(
        service.create({ warehouseId: 'w1', reason: 'x', lines: [] } as any, 'u1', ctx),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('findOne', () => {
    it('throws for a foreign-company document', async () => {
      prisma.inventoryOpeningBalance.findUnique.mockResolvedValue(doc({ companyId: 'c2' }));

      await expect(service.findOne('ob1', ctx)).rejects.toThrow(ForbiddenException);
    });
  });

  describe('addLine / updateLine', () => {
    it('addLine rejects a location that does not belong to the document warehouse', async () => {
      prisma.inventoryOpeningBalance.findUnique.mockResolvedValue(doc());
      prisma.product.findUnique.mockResolvedValue({ id: 'prd2', name: 'P', code: 'P', unit: 'pc' });
      prisma.warehouseLocation.findUnique.mockResolvedValue({
        id: 'loc2', warehouseId: 'w2', code: 'L2', name: 'L2',
      });

      await expect(
        service.addLine('ob1', { productId: 'prd2', quantity: 1, locationId: 'loc2' } as any, 'u1', ctx),
      ).rejects.toThrow(BadRequestException);
    });

    it('updateLine rejects re-pointing a line to a foreign location', async () => {
      prisma.inventoryOpeningBalance.findUnique.mockResolvedValue(doc());
      prisma.inventoryOpeningBalanceLine.findUnique.mockResolvedValue(line());
      prisma.warehouseLocation.findUnique.mockResolvedValue({
        id: 'loc2', warehouseId: 'w2', code: 'L2', name: 'L2',
      });

      await expect(
        service.updateLine('ob1', 'l1', { locationId: 'loc2' } as any, 'u1', ctx),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
