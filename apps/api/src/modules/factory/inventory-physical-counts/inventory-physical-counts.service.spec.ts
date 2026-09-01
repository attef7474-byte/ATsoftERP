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
      inventoryMovementLine: { create: jest.fn().mockResolvedValue({ id: 'ml1' }) },
      inventoryBalance: { findFirst: jest.fn(), create: jest.fn(), update: jest.fn() },
      userRole: { findMany: jest.fn() },
      auditLog: { findMany: jest.fn().mockResolvedValue([]) },
      $transaction: jest.fn().mockImplementation(async (fn: (tx: any) => Promise<any>) => fn(prisma)),
    };
    numbering = {
      generateNumberAtomic: jest.fn().mockResolvedValue('PC-0001'),
      generateNumberAtomicWithClient: jest.fn().mockResolvedValue('PC-0001'),
    };
    audit = { log: jest.fn().mockResolvedValue(undefined) };
    const D = require('@prisma/client').Prisma;
    service = new InventoryPhysicalCountsService(prisma as unknown as PrismaService, audit as unknown as AuditService, numbering as unknown as NumberingService, { findActivePolicyForWarehouse: jest.fn().mockResolvedValue(null), aggregatePhysicalQuantity: jest.fn().mockResolvedValue(new D.Decimal(10)) } as any);
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

  describe('post with ACTIVE valuation policy (VAL-R1D)', () => {
    const D = () => require('@prisma/client').Prisma;
    function makeActiveService(engine: Record<string, any> = {}) {
      return new InventoryPhysicalCountsService(
        prisma as unknown as PrismaService, audit as unknown as AuditService, numbering as unknown as NumberingService,
        {
          findActivePolicyForWarehouse: jest.fn().mockResolvedValue({ id: 'pol-1', method: 'WEIGHTED_AVERAGE', currencyCode: 'USD' }),
          aggregatePhysicalQuantity: jest.fn().mockResolvedValue(new (require('@prisma/client').Prisma).Decimal(10)),
          applyValuedReceipt: jest.fn().mockResolvedValue({}),
          applyValuedIssue: jest.fn().mockResolvedValue({}),
          ...engine,
        } as any,
      );
    }

    it('PHYSICAL_SURPLUS_VALUED: a surplus posts a valued receipt with the exact movement-line id and explicit cost', async () => {
      const applyValuedReceipt = jest.fn().mockResolvedValue({});
      service = makeActiveService({ applyValuedReceipt });
      prisma.inventoryPhysicalCount.findUnique.mockResolvedValue(countDoc({ status: 'APPROVED', lines: [] }));
      prisma.inventoryPhysicalCountLine.findMany.mockResolvedValue([
        line({ varianceQty: 2, countedQty: 12, systemQty: 10, unitCost: 15, currencyCode: 'USD', valuationReason: 'surplus' }),
      ]);
      prisma.warehouse.findUnique.mockResolvedValue(warehouse());
      prisma.inventoryBalance.findFirst.mockResolvedValue({ id: 'bal1', quantity: 10, quantityBase: 10 });
      prisma.inventoryBalance.update.mockResolvedValue({});
      prisma.inventoryMovement.create.mockResolvedValue({ id: 'mov1' });
      prisma.inventoryMovementLine.create.mockResolvedValue({ id: 'ml1' });
      prisma.userRole.findMany.mockResolvedValue([{ role: { status: 'ACTIVE', code: 'SUPER_ADMIN', permissions: [] } }]);
      prisma.inventoryPhysicalCount.update.mockResolvedValue(countDoc({ status: 'POSTED' }));

      await service.post('pc1', 'u1', ctx);

      expect(applyValuedReceipt).toHaveBeenCalledTimes(1);
      const call = applyValuedReceipt.mock.calls[0][1];
      expect(call.lineId).toBe('ml1');
      expect(call.movementId).toBe('mov1');
      expect(call.unitCost.toNumber()).toBe(15);
      expect(call.quantity.toNumber()).toBe(2);
      expect(call.currencyCode).toBe('USD');
    });

    it('PHYSICAL_SHORTAGE_VALUED: a shortage posts a valued issue at the current moving average', async () => {
      const applyValuedIssue = jest.fn().mockResolvedValue({});
      service = makeActiveService({ applyValuedIssue });
      prisma.inventoryPhysicalCount.findUnique.mockResolvedValue(countDoc({ status: 'APPROVED', lines: [] }));
      prisma.inventoryPhysicalCountLine.findMany.mockResolvedValue([
        line({ varianceQty: -2, countedQty: 8, systemQty: 10 }),
      ]);
      prisma.warehouse.findUnique.mockResolvedValue(warehouse());
      prisma.inventoryBalance.findFirst.mockResolvedValue({ id: 'bal1', quantity: 10, quantityBase: 10 });
      prisma.inventoryBalance.update.mockResolvedValue({});
      prisma.inventoryMovement.create.mockResolvedValue({ id: 'mov1' });
      prisma.inventoryMovementLine.create.mockResolvedValue({ id: 'ml1' });
      prisma.inventoryPhysicalCount.update.mockResolvedValue(countDoc({ status: 'POSTED' }));

      await service.post('pc1', 'u1', ctx);

      expect(applyValuedIssue).toHaveBeenCalledTimes(1);
      const call = applyValuedIssue.mock.calls[0][1];
      expect(call.lineId).toBe('ml1');
      expect(call.quantity.toNumber()).toBe(2);
    });

    it('MOVEMENT_LINE_SOURCE_CORRELATION: each count line creates its own movement line and passes its exact id to the engine', async () => {
      const applyValuedReceipt = jest.fn().mockResolvedValue({});
      const applyValuedIssue = jest.fn().mockResolvedValue({});
      service = makeActiveService({ applyValuedReceipt, applyValuedIssue });
      prisma.inventoryPhysicalCount.findUnique.mockResolvedValue(countDoc({ status: 'APPROVED', lines: [] }));
      prisma.inventoryPhysicalCountLine.findMany.mockResolvedValue([
        line({ id: 'cl1', varianceQty: 2, countedQty: 12, systemQty: 10, unitCost: 15, currencyCode: 'USD', valuationReason: 'a' }),
        line({ id: 'cl2', varianceQty: -3, countedQty: 7, systemQty: 10 }),
      ]);
      prisma.warehouse.findUnique.mockResolvedValue(warehouse());
      prisma.inventoryBalance.findFirst.mockResolvedValue({ id: 'bal1', quantity: 10, quantityBase: 10 });
      prisma.inventoryBalance.update.mockResolvedValue({});
      prisma.inventoryMovement.create
        .mockResolvedValueOnce({ id: 'mov-in' })
        .mockResolvedValueOnce({ id: 'mov-out' });
      prisma.inventoryMovementLine.create
        .mockResolvedValueOnce({ id: 'ml-in' })
        .mockResolvedValueOnce({ id: 'ml-out' });
      prisma.userRole.findMany.mockResolvedValue([{ role: { status: 'ACTIVE', code: 'SUPER_ADMIN', permissions: [] } }]);
      prisma.inventoryPhysicalCount.update.mockResolvedValue(countDoc({ status: 'POSTED' }));

      await service.post('pc1', 'u1', ctx);

      expect(applyValuedReceipt.mock.calls[0][1].lineId).toBe('ml-in');
      expect(applyValuedIssue.mock.calls[0][1].lineId).toBe('ml-out');
      // each line maps 1:1 to a distinct movement line, never correlated by index
      expect(prisma.inventoryMovementLine.create).toHaveBeenCalledTimes(2);
    });

    it('PHYSICAL_DOUBLE_MUTATION=0: each count line mutates the physical balance exactly once (never twice)', async () => {
      service = makeActiveService();
      prisma.inventoryPhysicalCount.findUnique.mockResolvedValue(countDoc({ status: 'APPROVED', lines: [] }));
      prisma.inventoryPhysicalCountLine.findMany.mockResolvedValue([
        line({ id: 'cl1', varianceQty: 2, countedQty: 12, systemQty: 10, unitCost: 15, currencyCode: 'USD', valuationReason: 'a' }),
      ]);
      prisma.warehouse.findUnique.mockResolvedValue(warehouse());
      prisma.inventoryBalance.findFirst.mockResolvedValue({ id: 'bal1', quantity: 10, quantityBase: 10 });
      prisma.inventoryBalance.update.mockResolvedValue({});
      prisma.inventoryMovement.create.mockResolvedValue({ id: 'mov1' });
      prisma.inventoryMovementLine.create.mockResolvedValue({ id: 'ml1' });
      prisma.userRole.findMany.mockResolvedValue([{ role: { status: 'ACTIVE', code: 'SUPER_ADMIN', permissions: [] } }]);
      prisma.inventoryPhysicalCount.update.mockResolvedValue(countDoc({ status: 'POSTED' }));

      await service.post('pc1', 'u1', ctx);

      // exactly one physical mutator (applyCountBalanceDelta) for the one line
      expect(prisma.inventoryBalance.update).toHaveBeenCalledTimes(1);
    });

    it('PHYSICAL_SURPLUS_COST_REQUIRED: a surplus without explicit cost is rejected before any movement', async () => {
      service = makeActiveService();
      prisma.inventoryPhysicalCount.findUnique.mockResolvedValue(countDoc({ status: 'APPROVED', lines: [] }));
      prisma.inventoryPhysicalCountLine.findMany.mockResolvedValue([
        line({ varianceQty: 2, countedQty: 12, systemQty: 10, unitCost: undefined, currencyCode: 'USD' }),
      ]);
      prisma.warehouse.findUnique.mockResolvedValue(warehouse());

      const promise = service.post('pc1', 'u1', ctx);
      await expect(promise).rejects.toThrow(BadRequestException);
      const response = (await promise.catch((e) => e)).getResponse();
      expect(response.messageKey).toBe('inventoryValuation.countSurplusCostRequired');
      expect(prisma.inventoryMovement.create).not.toHaveBeenCalled();
      expect(prisma.inventoryBalance.update).not.toHaveBeenCalled();
    });

    it('PHYSICAL_SURPLUS_WRONG_CURRENCY: a surplus currency mismatch is rejected before any movement', async () => {
      service = makeActiveService();
      prisma.inventoryPhysicalCount.findUnique.mockResolvedValue(countDoc({ status: 'APPROVED', lines: [] }));
      prisma.inventoryPhysicalCountLine.findMany.mockResolvedValue([
        line({ varianceQty: 2, countedQty: 12, systemQty: 10, unitCost: 15, currencyCode: 'EUR', valuationReason: 'a' }),
      ]);
      prisma.warehouse.findUnique.mockResolvedValue(warehouse());

      const promise = service.post('pc1', 'u1', ctx);
      await expect(promise).rejects.toThrow(BadRequestException);
      const response = (await promise.catch((e) => e)).getResponse();
      expect(response.messageKey).toBe('inventoryValuation.currencyMismatch');
      expect(prisma.inventoryMovement.create).not.toHaveBeenCalled();
      expect(prisma.inventoryBalance.update).not.toHaveBeenCalled();
    });

    it('PHYSICAL_SURPLUS_ZERO_COST_REASON: a zero-cost surplus requires an explicit valuation reason', async () => {
      service = makeActiveService();
      prisma.inventoryPhysicalCount.findUnique.mockResolvedValue(countDoc({ status: 'APPROVED', lines: [] }));
      prisma.inventoryPhysicalCountLine.findMany.mockResolvedValue([
        line({ varianceQty: 2, countedQty: 12, systemQty: 10, unitCost: 0, currencyCode: 'USD', valuationReason: null }),
      ]);
      prisma.warehouse.findUnique.mockResolvedValue(warehouse());

      const promise = service.post('pc1', 'u1', ctx);
      await expect(promise).rejects.toThrow(BadRequestException);
      expect(prisma.inventoryMovement.create).not.toHaveBeenCalled();
      expect(prisma.inventoryBalance.update).not.toHaveBeenCalled();
    });

    it('PHYSICAL_SURPLUS_MISSING_PERMISSION: a non-admin without cost-input is forbidden', async () => {
      const applyValuedReceipt = jest.fn().mockResolvedValue({});
      service = makeActiveService({ applyValuedReceipt });
      prisma.inventoryPhysicalCount.findUnique.mockResolvedValue(countDoc({ status: 'APPROVED', lines: [] }));
      prisma.inventoryPhysicalCountLine.findMany.mockResolvedValue([
        line({ varianceQty: 2, countedQty: 12, systemQty: 10, unitCost: 15, currencyCode: 'USD', valuationReason: 'a' }),
      ]);
      prisma.warehouse.findUnique.mockResolvedValue(warehouse());
      prisma.userRole.findMany.mockResolvedValue([
        { role: { status: 'ACTIVE', code: 'STOREKEEPER', permissions: [] } },
      ]);

      const promise = service.post('pc1', 'u1', ctx);
      await expect(promise).rejects.toThrow(ForbiddenException);
      expect(applyValuedReceipt).not.toHaveBeenCalled();
      expect(prisma.inventoryMovement.create).not.toHaveBeenCalled();
    });
  });
});
