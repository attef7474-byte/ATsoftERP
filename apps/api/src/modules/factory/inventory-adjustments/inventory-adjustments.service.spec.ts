import { ForbiddenException, BadRequestException, NotFoundException } from '@nestjs/common';
import { InventoryAdjustmentsService } from './inventory-adjustments.service';
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
  adjustmentId: 'a1',
  productId: 'prd1',
  warehouseLocationId: null,
  systemQty: 10,
  countedQty: 8,
  differenceQty: -2,
  notes: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

const adjustment = (overrides: Record<string, any> = {}) => ({
  id: 'a1',
  adjustmentNumber: 'ADJ-0001',
  companyId: 'c1',
  branchId: 'b1',
  warehouseId: 'w1',
  inventoryCountId: null,
  reason: 'Adjustment',
  notes: null,
  status: 'DRAFT',
  createdById: 'u1',
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
  lines: [line()],
  ...overrides,
});

const count = (overrides: Record<string, any> = {}) => ({
  id: 'ic1',
  countNumber: 'IC-0001',
  companyId: 'c1',
  branchId: 'b1',
  warehouseId: 'w1',
  status: 'COMPLETED',
  lines: [
    { id: 'cl1', productId: 'prd1', warehouseLocationId: null, systemQty: 10, countedQty: 8, differenceQty: -2 },
  ],
  ...overrides,
});

describe('InventoryAdjustmentsService tenant isolation', () => {
  let prisma: any;
  let numbering: any;
  let audit: any;
  let service: InventoryAdjustmentsService;

  beforeEach(() => {
    prisma = {
      warehouse: { findUnique: jest.fn() },
      warehouseLocation: { findUnique: jest.fn() },
      product: { findUnique: jest.fn() },
      inventoryCount: { findUnique: jest.fn() },
      inventoryAdjustment: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
      },
      inventoryAdjustmentLine: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      inventoryBalance: { findFirst: jest.fn(), create: jest.fn(), update: jest.fn() },
      $transaction: jest.fn().mockImplementation(async (fn: (tx: any) => Promise<any>) => fn(prisma)),
    };
    numbering = {
      generateNumberAtomic: jest.fn().mockResolvedValue('ADJ-0001'),
      generateNumberAtomicWithClient: jest.fn().mockResolvedValue('ADJ-0001'),
    };
    audit = { log: jest.fn().mockResolvedValue(undefined) };
    service = new InventoryAdjustmentsService(prisma as unknown as PrismaService, audit as unknown as AuditService, numbering as unknown as NumberingService, { findActivePolicyForWarehouse: jest.fn().mockResolvedValue(null), findActivePoliciesInScope: jest.fn().mockResolvedValue([]) } as any);
  });

  describe('create', () => {
    it('rejects a foreign-company warehouse even though revalidated inside the tx', async () => {
      prisma.warehouse.findUnique.mockResolvedValue(warehouse({ id: 'w-foreign', companyId: 'c2' }));
      prisma.product.findUnique.mockResolvedValue({ id: 'prd1', name: 'P', code: 'P', unit: 'pc' });

      await expect(
        service.create({
          warehouseId: 'w-foreign',
          reason: 'x',
          lines: [{ productId: 'prd1', systemQty: 1, countedQty: 2 }],
        } as any, 'u1', ctx),
      ).rejects.toThrow(ForbiddenException);
      expect(prisma.inventoryAdjustment.create).not.toHaveBeenCalled();
    });

    it('rejects a foreign-company inventoryCountId reference', async () => {
      prisma.warehouse.findUnique.mockResolvedValue(warehouse());
      prisma.inventoryCount.findUnique.mockResolvedValue(count({ id: 'ic2', companyId: 'c2' }));
      prisma.product.findUnique.mockResolvedValue({ id: 'prd1', name: 'P', code: 'P', unit: 'pc' });

      await expect(
        service.create({
          warehouseId: 'w1',
          inventoryCountId: 'ic2',
          reason: 'x',
          lines: [{ productId: 'prd1', systemQty: 1, countedQty: 2 }],
        } as any, 'u1', ctx),
      ).rejects.toThrow(ForbiddenException);
      expect(prisma.inventoryAdjustment.create).not.toHaveBeenCalled();
    });

    it('rejects a line location that does not belong to the selected warehouse', async () => {
      prisma.warehouse.findUnique.mockResolvedValue(warehouse());
      prisma.product.findUnique.mockResolvedValue({ id: 'prd1', name: 'P', code: 'P', unit: 'pc' });
      prisma.warehouseLocation.findUnique.mockResolvedValue({
        id: 'loc2', warehouseId: 'w2', code: 'L2', name: 'L2',
      });

      await expect(
        service.create({
          warehouseId: 'w1',
          reason: 'x',
          lines: [{ productId: 'prd1', systemQty: 1, countedQty: 2, warehouseLocationId: 'loc2' }],
        } as any, 'u1', ctx),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('generateFromCount', () => {
    it('rejects a foreign-company count', async () => {
      prisma.inventoryCount.findUnique.mockResolvedValue(count({ id: 'ic2', companyId: 'c2' }));

      await expect(service.generateFromCount('ic2', 'u1', ctx)).rejects.toThrow(ForbiddenException);
      expect(prisma.inventoryAdjustment.create).not.toHaveBeenCalled();
    });

    it('rejects line locations that do not belong to the count warehouse', async () => {
      prisma.inventoryCount.findUnique.mockResolvedValue(count({
        lines: [
          { id: 'cl1', productId: 'prd1', warehouseLocationId: 'loc2', systemQty: 10, countedQty: 8, differenceQty: -2 },
        ],
      }));
      prisma.warehouse.findUnique.mockResolvedValue(warehouse());
      prisma.warehouseLocation.findUnique.mockResolvedValue({
        id: 'loc2', warehouseId: 'w2', code: 'L2', name: 'L2',
      });
      prisma.inventoryAdjustment.findFirst.mockResolvedValue(null);

      await expect(service.generateFromCount('ic1', 'u1', ctx)).rejects.toThrow(BadRequestException);
      expect(prisma.inventoryAdjustment.create).not.toHaveBeenCalled();
    });
  });

  describe('post', () => {
    it('revalidates warehouse inside the transaction and uses in-tx numbering', async () => {
      prisma.inventoryAdjustment.findUnique.mockResolvedValue(adjustment());
      prisma.warehouse.findUnique.mockResolvedValue(warehouse());
      prisma.inventoryBalance.findFirst.mockResolvedValue({ id: 'bal1', quantity: 50 });
      prisma.inventoryBalance.update.mockResolvedValue({});
      prisma.inventoryAdjustment.update.mockResolvedValue(adjustment({ status: 'POSTED' }));

      await service.post('a1', 'u1', ctx);

      expect(numbering.generateNumberAtomicWithClient).not.toHaveBeenCalledWith('INVENTORY_MOVEMENT', expect.anything());
      expect(prisma.inventoryAdjustment.update.mock.calls[0][0].data.status).toBe('POSTED');
    });

    it('rejects posting an adjustment whose warehouse belongs to another company', async () => {
      prisma.inventoryAdjustment.findUnique.mockResolvedValue(adjustment({ warehouseId: 'w-foreign' }));
      prisma.warehouse.findUnique.mockResolvedValue(warehouse({ id: 'w-foreign', companyId: 'c2' }));

      await expect(service.post('a1', 'u1', ctx)).rejects.toThrow(ForbiddenException);
      expect(prisma.inventoryBalance.update).not.toHaveBeenCalled();
    });
  });

  describe('findOne read contract enrichment', () => {
    const enrichedLine = (overrides: Record<string, any> = {}) => ({
      ...line({
        product: { id: 'prd1', name: 'Widget', code: 'PRD-001', unit: 'pc' },
        warehouseLocation: { id: 'loc1', code: 'L1', name: 'Aisle 1' },
      }),
      ...overrides,
    });

    const enrichedAdjustment = (overrides: Record<string, any> = {}) => adjustment({
      lines: [enrichedLine()],
      company: { id: 'c1', name: 'Company A' },
      branch: { id: 'b1', name: 'HQ' },
      warehouse: warehouse(),
      inventoryCount: { id: 'ic1', countNumber: 'IC-0001', status: 'COMPLETED' },
      ...overrides,
    });

    it('IAR-P01: authorized detail read returns product.unit from the canonical Prisma selection', async () => {
      prisma.inventoryAdjustment.findUnique.mockResolvedValue(enrichedAdjustment());

      const result = await service.findOne('a1', ctx);

      expect(result.lines[0].product).toEqual({
        id: 'prd1',
        name: 'Widget',
        code: 'PRD-001',
        unit: 'pc',
      });
      // Regression guard: the Prisma selection itself must request the unit.
      // Removing `unit: true` from the service must fail this assertion.
      const query = prisma.inventoryAdjustment.findUnique.mock.calls[0][0];
      expect(query.where).toEqual({ id: 'a1' });
      expect(query.include.lines.include.product.select).toEqual({
        id: true,
        name: true,
        code: true,
        unit: true,
      });
    });

    it('IAR-P02: product code and name remain unchanged', async () => {
      prisma.inventoryAdjustment.findUnique.mockResolvedValue(enrichedAdjustment());

      const result = await service.findOne('a1', ctx);

      expect(result.lines[0].product.code).toBe('PRD-001');
      expect(result.lines[0].product.name).toBe('Widget');
    });

    it('IAR-P03/P04/P05: systemQty, countedQty and differenceQty are unchanged', async () => {
      prisma.inventoryAdjustment.findUnique.mockResolvedValue(enrichedAdjustment());

      const result = await service.findOne('a1', ctx);

      expect(result.lines[0].systemQty).toBe(10);
      expect(result.lines[0].countedQty).toBe(8);
      expect(result.lines[0].differenceQty).toBe(-2);
    });

    it('IAR-P06: optional inventoryCount.countNumber remains unchanged', async () => {
      prisma.inventoryAdjustment.findUnique.mockResolvedValue(enrichedAdjustment());

      const result = await service.findOne('a1', ctx);

      expect(result.inventoryCount).toEqual({ id: 'ic1', countNumber: 'IC-0001', status: 'COMPLETED' });
    });

    it('IAR-P07: a cross-company record remains denied', async () => {
      prisma.inventoryAdjustment.findUnique.mockResolvedValue(enrichedAdjustment({ companyId: 'c2' }));

      await expect(service.findOne('a1', ctx)).rejects.toThrow(ForbiddenException);
    });

    it('IAR-P08: a cross-branch record remains denied', async () => {
      prisma.inventoryAdjustment.findUnique.mockResolvedValue(enrichedAdjustment({ branchId: 'b2' }));

      await expect(service.findOne('a1', ctx)).rejects.toThrow(ForbiddenException);
    });

    it('IAR-P09: a soft-deleted record remains unavailable', async () => {
      prisma.inventoryAdjustment.findUnique.mockResolvedValue(enrichedAdjustment({ deletedAt: new Date() }));

      await expect(service.findOne('a1', ctx)).rejects.toThrow(NotFoundException);
    });

    it('IAR-P11: readable warehouse location code and name are returned from the canonical selection', async () => {
      prisma.inventoryAdjustment.findUnique.mockResolvedValue(enrichedAdjustment());

      const result = await service.findOne('a1', ctx);

      expect(result.lines[0].warehouseLocation).toEqual({ id: 'loc1', code: 'L1', name: 'Aisle 1' });
      const query = prisma.inventoryAdjustment.findUnique.mock.calls[0][0];
      expect(query.include.lines.include.warehouseLocation.select).toEqual({
        id: true,
        code: true,
        name: true,
      });
    });

    it('IAR-P12: a line without a location stays null and does not throw', async () => {
      prisma.inventoryAdjustment.findUnique.mockResolvedValue(enrichedAdjustment({
        lines: [enrichedLine({ warehouseLocationId: null, warehouseLocation: null })],
      }));

      const result = await service.findOne('a1', ctx);

      expect(result.lines[0].warehouseLocation).toBeNull();
    });

    it('findOne performs no business writes', async () => {
      prisma.inventoryAdjustment.findUnique.mockResolvedValue(enrichedAdjustment());

      await service.findOne('a1', ctx);

      expect(prisma.inventoryAdjustment.create).not.toHaveBeenCalled();
      expect(prisma.inventoryAdjustment.update).not.toHaveBeenCalled();
      expect(prisma.inventoryAdjustmentLine.create).not.toHaveBeenCalled();
      expect(prisma.inventoryAdjustmentLine.update).not.toHaveBeenCalled();
      expect(prisma.inventoryAdjustmentLine.delete).not.toHaveBeenCalled();
      expect(prisma.inventoryBalance.update).not.toHaveBeenCalled();
      expect(audit.log).not.toHaveBeenCalled();
    });
  });

  describe('addLine / updateLine', () => {
    it('addLine rejects a location that does not belong to the adjustment warehouse', async () => {
      prisma.inventoryAdjustment.findUnique.mockResolvedValue(adjustment());
      prisma.product.findUnique.mockResolvedValue({ id: 'prd2', name: 'P', code: 'P', unit: 'pc' });
      prisma.warehouseLocation.findUnique.mockResolvedValue({
        id: 'loc2', warehouseId: 'w2', code: 'L2', name: 'L2',
      });

      await expect(
        service.addLine('a1', { productId: 'prd2', systemQty: 1, countedQty: 2, warehouseLocationId: 'loc2' } as any, 'u1', ctx),
      ).rejects.toThrow(BadRequestException);
    });

    it('updateLine rejects re-pointing to a foreign location', async () => {
      prisma.inventoryAdjustment.findUnique.mockResolvedValue(adjustment());
      prisma.inventoryAdjustmentLine.findUnique.mockResolvedValue(line());
      prisma.warehouseLocation.findUnique.mockResolvedValue({
        id: 'loc2', warehouseId: 'w2', code: 'L2', name: 'L2',
      });

      await expect(
        service.updateLine('a1', 'l1', { warehouseLocationId: 'loc2' } as any, 'u1', ctx),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
