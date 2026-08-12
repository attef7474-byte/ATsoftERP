import { BadRequestException, NotFoundException } from '@nestjs/common';
import { InventoryStockAdjustmentsService } from './inventory-stock-adjustments.service';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { AuditService } from '../../../common/audit/audit.service';
import { NumberingService } from '../../numbering/numbering.service';
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

const line = (overrides: Record<string, any> = {}) => ({
  id: 'l1',
  adjustmentId: 'a1',
  productId: 'prd1',
  locationId: null,
  adjustmentType: 'ADJUSTMENT_IN',
  quantity: 5,
  movementId: null,
  notes: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

const adjustment = (overrides: Record<string, any> = {}) => ({
  id: 'a1',
  code: 'SA-0001',
  companyId: 'c1',
  branchId: 'b1',
  warehouseId: 'w1',
  locationId: null,
  status: 'DRAFT',
  documentDate: new Date('2026-08-01T10:00:00.000Z'),
  reason: 'Cycle count variance',
  notes: null,
  submittedAt: null,
  submittedById: null,
  approvedAt: null,
  approvedById: null,
  postedAt: null,
  postedById: null,
  rejectedAt: null,
  rejectedById: null,
  cancelledAt: null,
  cancelledById: null,
  createdById: 'u1',
  updatedById: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
  lines: [line()],
  ...overrides,
});

const createDto = {
  companyId: 'c1',
  branchId: 'b1',
  warehouseId: 'w1',
  reason: 'Cycle count variance',
  lines: [
    { productId: 'prd1', adjustmentType: 'ADJUSTMENT_IN' as const, quantity: 5 },
  ],
};

describe('InventoryStockAdjustmentsService', () => {
  let prisma: any;
  let numbering: any;
  let audit: any;
  let service: InventoryStockAdjustmentsService;
  let txOptions: any;

  beforeEach(() => {
    txOptions = undefined;
    prisma = {
      company: { findUnique: jest.fn() },
      branch: { findUnique: jest.fn() },
      warehouse: { findUnique: jest.fn() },
      warehouseLocation: { findUnique: jest.fn() },
      product: { findUnique: jest.fn() },
      inventoryStockAdjustment: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        count: jest.fn(),
      },
      inventoryStockAdjustmentLine: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        deleteMany: jest.fn(),
      },
      inventoryMovement: { create: jest.fn() },
      inventoryBalance: {
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      $transaction: jest.fn().mockImplementation(async (fn: (tx: any) => Promise<any>, options?: any) => {
        txOptions = options;
        return fn(prisma);
      }),
    };
    numbering = {
      generateNumberAtomic: jest.fn().mockResolvedValue('SA-0001'),
      generateNumberAtomicWithClient: jest.fn().mockResolvedValue('SA-0001'),
    };
    audit = {
      log: jest.fn().mockResolvedValue(undefined),
      logWithClient: jest.fn().mockResolvedValue(undefined),
    };
    service = new InventoryStockAdjustmentsService(
      prisma as PrismaService,
      audit as AuditService,
      numbering as NumberingService,
    );
  });

  describe('create', () => {
    it('creates the adjustment in the active company and branch, ignoring client tenant fields, and audits inside the transaction', async () => {
      prisma.company.findUnique.mockResolvedValue({ id: 'c1' });
      prisma.warehouse.findUnique.mockResolvedValue({ id: 'w1', companyId: 'c1', branchId: 'b1' });
      prisma.product.findUnique.mockResolvedValue({ id: 'prd1' });
      prisma.inventoryStockAdjustment.create.mockResolvedValue(adjustment());

      // Client attempts to force a different tenant; the service must ignore it.
      const result = await service.create({ ...createDto, companyId: 'c2', branchId: 'b9' }, 'u1', ctx);

      expect(numbering.generateNumberAtomicWithClient).toHaveBeenCalledWith('STOCK_ADJUSTMENT', prisma);
      expect(numbering.generateNumberAtomic).not.toHaveBeenCalled();
      const createCall = prisma.inventoryStockAdjustment.create.mock.calls[0][0];
      expect(createCall.data).toMatchObject({
        companyId: 'c1',
        branchId: 'b1',
        code: 'SA-0001',
        status: 'DRAFT',
        createdById: 'u1',
        reason: 'Cycle count variance',
      });
      expect(createCall.data.companyId).not.toBe('c2');
      expect(createCall.data.branchId).not.toBe('b9');
      expect(createCall.data.lines.create[0]).toMatchObject({
        productId: 'prd1',
        adjustmentType: 'ADJUSTMENT_IN',
        quantity: 5,
      });
      expect(audit.logWithClient).toHaveBeenCalledWith(
        prisma,
        expect.objectContaining({ userId: 'u1', action: 'CREATE', entity: 'InventoryStockAdjustment', entityId: 'a1' }),
      );
      expect(result.id).toBe('a1');
    });

    it('rejects a warehouse from another company', async () => {
      prisma.company.findUnique.mockResolvedValue({ id: 'c1' });
      prisma.warehouse.findUnique.mockResolvedValue({ id: 'wX', companyId: 'c2', branchId: 'b1' });

      const promise = service.create(createDto, 'u1', ctx);
      await expect(promise).rejects.toThrow(BadRequestException);
      const response = (await promise.catch((e) => e)).getResponse();
      expect(response.errors[0]).toMatchObject({ field: 'warehouseId', code: 'validation.invalidReference' });
    });

    it('rejects a warehouse from another branch', async () => {
      prisma.company.findUnique.mockResolvedValue({ id: 'c1' });
      prisma.warehouse.findUnique.mockResolvedValue({ id: 'wX', companyId: 'c1', branchId: 'b2' });

      const promise = service.create(createDto, 'u1', ctx);
      await expect(promise).rejects.toThrow(BadRequestException);
      const response = (await promise.catch((e) => e)).getResponse();
      expect(response.errors[0]).toMatchObject({ field: 'warehouseId', code: 'validation.invalidReference' });
    });

    it('rejects a document location that belongs to another warehouse', async () => {
      prisma.company.findUnique.mockResolvedValue({ id: 'c1' });
      prisma.warehouse.findUnique.mockResolvedValue({ id: 'w1', companyId: 'c1', branchId: 'b1' });
      prisma.warehouseLocation.findUnique.mockResolvedValue({ id: 'locX', warehouseId: 'wOther' });

      const promise = service.create({ ...createDto, locationId: 'locX' }, 'u1', ctx);
      await expect(promise).rejects.toThrow(BadRequestException);
      const response = (await promise.catch((e) => e)).getResponse();
      expect(response.errors[0]).toMatchObject({ field: 'locationId', code: 'validation.invalidReference' });
    });

    it('rejects a line location that belongs to another warehouse', async () => {
      prisma.company.findUnique.mockResolvedValue({ id: 'c1' });
      prisma.warehouse.findUnique.mockResolvedValue({ id: 'w1', companyId: 'c1', branchId: 'b1' });
      prisma.warehouseLocation.findUnique.mockResolvedValue({ id: 'locX', warehouseId: 'wOther' });
      prisma.product.findUnique.mockResolvedValue({ id: 'prd1' });

      const promise = service.create({
        ...createDto,
        lines: [{ productId: 'prd1', adjustmentType: 'ADJUSTMENT_IN', quantity: 5, locationId: 'locX' }],
      }, 'u1', ctx);
      await expect(promise).rejects.toThrow(BadRequestException);
      const response = (await promise.catch((e) => e)).getResponse();
      expect(response.errors[0]).toMatchObject({ field: 'lines.locationId', code: 'validation.invalidReference' });
      expect(prisma.inventoryStockAdjustment.create).not.toHaveBeenCalled();
    });

    it('rejects a missing product', async () => {
      prisma.company.findUnique.mockResolvedValue({ id: 'c1' });
      prisma.warehouse.findUnique.mockResolvedValue({ id: 'w1', companyId: 'c1', branchId: 'b1' });
      prisma.product.findUnique.mockResolvedValue(null);

      await expect(service.create(createDto, 'u1', ctx)).rejects.toThrow(NotFoundException);
      expect(prisma.inventoryStockAdjustment.create).not.toHaveBeenCalled();
    });

    it('rejects a non-positive quantity at the service boundary', async () => {
      prisma.company.findUnique.mockResolvedValue({ id: 'c1' });
      prisma.warehouse.findUnique.mockResolvedValue({ id: 'w1', companyId: 'c1', branchId: 'b1' });
      prisma.product.findUnique.mockResolvedValue({ id: 'prd1' });

      const promise = service.create({
        ...createDto,
        lines: [{ productId: 'prd1', adjustmentType: 'ADJUSTMENT_IN', quantity: 0 }],
      }, 'u1', ctx);
      await expect(promise).rejects.toThrow(BadRequestException);
      const response = (await promise.catch((e) => e)).getResponse();
      expect(response.messageKey).toBe('inventory.stockAdjustmentQuantityMustBePositive');
    });

    it('rejects an invalid adjustmentType', async () => {
      prisma.company.findUnique.mockResolvedValue({ id: 'c1' });
      prisma.warehouse.findUnique.mockResolvedValue({ id: 'w1', companyId: 'c1', branchId: 'b1' });
      prisma.product.findUnique.mockResolvedValue({ id: 'prd1' });

      const promise = service.create({
        ...createDto,
        lines: [{ productId: 'prd1', adjustmentType: 'SHRINKAGE', quantity: 5 }],
      }, 'u1', ctx);
      await expect(promise).rejects.toThrow(BadRequestException);
      const response = (await promise.catch((e) => e)).getResponse();
      expect(response.messageKey).toBe('inventory.stockAdjustmentInvalidType');
    });
  });

  describe('findOne (tenant isolation)', () => {
    it('returns the adjustment when it belongs to the active context', async () => {
      prisma.inventoryStockAdjustment.findUnique.mockResolvedValue(adjustment());
      const result = await service.findOne('a1', ctx);
      expect(result.id).toBe('a1');
    });

    it('rejects a company-level adjustment (null branch): not visible without an owning branch', async () => {
      prisma.inventoryStockAdjustment.findUnique.mockResolvedValue(adjustment({ branchId: null }));
      await expect(service.findOne('a1', ctx)).rejects.toThrow(NotFoundException);
    });

    it('throws NotFound when the adjustment belongs to another company', async () => {
      prisma.inventoryStockAdjustment.findUnique.mockResolvedValue(adjustment({ companyId: 'c2' }));
      const promise = service.findOne('a1', ctx);
      await expect(promise).rejects.toThrow(NotFoundException);
      const response = (await promise.catch((e) => e)).getResponse();
      expect(response.messageKey).toBe('inventory.stockAdjustmentNotFound');
    });

    it('throws NotFound when the adjustment belongs to another branch', async () => {
      prisma.inventoryStockAdjustment.findUnique.mockResolvedValue(adjustment({ branchId: 'b2' }));
      await expect(service.findOne('a1', ctx)).rejects.toThrow(NotFoundException);
    });

    it('throws NotFound when missing or soft-deleted', async () => {
      prisma.inventoryStockAdjustment.findUnique.mockResolvedValue(null);
      await expect(service.findOne('nope', ctx)).rejects.toThrow(NotFoundException);

      prisma.inventoryStockAdjustment.findUnique.mockResolvedValue(adjustment({ deletedAt: new Date() }));
      await expect(service.findOne('a1', ctx)).rejects.toThrow(NotFoundException);
    });
  });

  describe('findAll', () => {
    it('always scopes the query to the active company and the exact active branch', async () => {
      prisma.inventoryStockAdjustment.findMany.mockResolvedValue([]);
      prisma.inventoryStockAdjustment.count.mockResolvedValue(0);

      await service.findAll({ page: 1, limit: 10 }, ctx);
      expect(prisma.inventoryStockAdjustment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ companyId: 'c1', branchId: 'b1', deletedAt: null }),
        }),
      );
      expect(prisma.inventoryStockAdjustment.count).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ companyId: 'c1' }) }),
      );
    });

    it('ignores client-supplied companyId and branchId filters', async () => {
      prisma.inventoryStockAdjustment.findMany.mockResolvedValue([]);
      prisma.inventoryStockAdjustment.count.mockResolvedValue(0);

      await service.findAll({ companyId: 'c2', branchId: 'b2', page: 1, limit: 10 }, ctx);
      expect(prisma.inventoryStockAdjustment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ companyId: 'c1', branchId: 'b1' }),
        }),
      );
    });

    it('applies status and search filters', async () => {
      prisma.inventoryStockAdjustment.findMany.mockResolvedValue([]);
      prisma.inventoryStockAdjustment.count.mockResolvedValue(0);

      await service.findAll({ status: 'APPROVED', search: 'SA-00' }, ctx);
      expect(prisma.inventoryStockAdjustment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ status: 'APPROVED', OR: expect.any(Array) }) }),
      );
    });
  });

  describe('update (tenant isolation)', () => {
    it('rejects an update when the adjustment belongs to another company', async () => {
      prisma.inventoryStockAdjustment.findUnique.mockResolvedValue(adjustment({ companyId: 'c2' }));
      await expect(service.update('a1', { reason: 'X' }, 'u1', ctx)).rejects.toThrow(NotFoundException);
    });

    it('rejects an update when the adjustment belongs to another branch', async () => {
      prisma.inventoryStockAdjustment.findUnique.mockResolvedValue(adjustment({ branchId: 'b2' }));
      await expect(service.update('a1', { reason: 'X' }, 'u1', ctx)).rejects.toThrow(NotFoundException);
    });

    it('updates an owned DRAFT and audits it', async () => {
      prisma.inventoryStockAdjustment.findUnique.mockResolvedValue(adjustment());
      prisma.warehouse.findUnique.mockResolvedValue({ id: 'w1', companyId: 'c1', branchId: 'b1', status: 'ACTIVE' });
      prisma.inventoryStockAdjustment.update.mockResolvedValue(adjustment({ reason: 'changed' }));

      const result = await service.update('a1', { reason: 'changed' }, 'u1', ctx);
      expect(prisma.inventoryStockAdjustment.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'a1' } }),
      );
      expect(audit.logWithClient).toHaveBeenCalledWith(
        prisma,
        expect.objectContaining({ userId: 'u1', action: 'UPDATE', entity: 'InventoryStockAdjustment', entityId: 'a1' }),
      );
      expect(result.reason).toBe('changed');
    });

    it('never rewrites tenant fields from the client payload', async () => {
      prisma.inventoryStockAdjustment.findUnique.mockResolvedValue(adjustment());
      prisma.warehouse.findUnique.mockResolvedValue({ id: 'w1', companyId: 'c1', branchId: 'b1', status: 'ACTIVE' });
      prisma.inventoryStockAdjustment.update.mockResolvedValue(adjustment());

      await service.update('a1', { companyId: 'c2', branchId: 'b9', reason: 'changed' }, 'u1', ctx);

      const updateCall = prisma.inventoryStockAdjustment.update.mock.calls[0][0];
      expect(updateCall.data).not.toHaveProperty('companyId');
      expect(updateCall.data).not.toHaveProperty('branchId');
    });

    it('rejects a warehouseId from another company', async () => {
      prisma.inventoryStockAdjustment.findUnique.mockResolvedValue(adjustment());
      prisma.warehouse.findUnique.mockResolvedValue({ id: 'wX', companyId: 'c2', branchId: 'b1' });

      const promise = service.update('a1', { warehouseId: 'wX' }, 'u1', ctx);
      await expect(promise).rejects.toThrow(BadRequestException);
      const response = (await promise.catch((e) => e)).getResponse();
      expect(response.errors[0]).toMatchObject({ field: 'warehouseId', code: 'validation.invalidReference' });
      expect(prisma.inventoryStockAdjustment.update).not.toHaveBeenCalled();
    });

    it('rejects a warehouseId from another branch', async () => {
      prisma.inventoryStockAdjustment.findUnique.mockResolvedValue(adjustment());
      prisma.warehouse.findUnique.mockResolvedValue({ id: 'wX', companyId: 'c1', branchId: 'b2' });

      await expect(service.update('a1', { warehouseId: 'wX' }, 'u1', ctx)).rejects.toThrow(BadRequestException);
    });

    it('rejects a locationId that does not belong to the adjustment warehouse', async () => {
      prisma.inventoryStockAdjustment.findUnique.mockResolvedValue(adjustment());
      prisma.warehouse.findUnique.mockResolvedValue({ id: 'w1', companyId: 'c1', branchId: 'b1', status: 'ACTIVE' });
      prisma.warehouseLocation.findUnique.mockResolvedValue({ id: 'locX', warehouseId: 'wOther' });

      const promise = service.update('a1', { locationId: 'locX' }, 'u1', ctx);
      await expect(promise).rejects.toThrow(BadRequestException);
      const response = (await promise.catch((e) => e)).getResponse();
      expect(response.errors[0]).toMatchObject({ field: 'locationId', code: 'validation.invalidReference' });
    });

    it('rejects a warehouse change that would strand an existing located line', async () => {
      prisma.inventoryStockAdjustment.findUnique.mockResolvedValue(
        adjustment({ lines: [line({ locationId: 'loc1' })] }),
      );
      prisma.warehouse.findUnique.mockResolvedValue({ id: 'w2', companyId: 'c1', branchId: 'b1', status: 'ACTIVE' });
      prisma.warehouseLocation.findUnique.mockResolvedValue({ id: 'loc1', warehouseId: 'w1' });

      const promise = service.update('a1', { warehouseId: 'w2' }, 'u1', ctx);
      await expect(promise).rejects.toThrow(BadRequestException);
      const response = (await promise.catch((e) => e)).getResponse();
      expect(response.errors[0]).toMatchObject({ field: 'lines.locationId', code: 'validation.invalidReference' });
      expect(prisma.inventoryStockAdjustment.update).not.toHaveBeenCalled();
    });

    it('rejects a warehouse change that would strand the document location', async () => {
      prisma.inventoryStockAdjustment.findUnique.mockResolvedValue(adjustment({ locationId: 'locDoc' }));
      prisma.warehouse.findUnique.mockResolvedValue({ id: 'w2', companyId: 'c1', branchId: 'b1', status: 'ACTIVE' });
      prisma.warehouseLocation.findUnique.mockResolvedValue({ id: 'locDoc', warehouseId: 'w1' });

      const promise = service.update('a1', { warehouseId: 'w2' }, 'u1', ctx);
      await expect(promise).rejects.toThrow(BadRequestException);
      const response = (await promise.catch((e) => e)).getResponse();
      expect(response.errors[0]).toMatchObject({ field: 'locationId', code: 'validation.invalidReference' });
      expect(prisma.inventoryStockAdjustment.update).not.toHaveBeenCalled();
    });

    it('allows a warehouse change when every existing location belongs to the target warehouse', async () => {
      prisma.inventoryStockAdjustment.findUnique.mockResolvedValue(adjustment({ locationId: null }));
      prisma.warehouse.findUnique.mockResolvedValue({ id: 'w2', companyId: 'c1', branchId: 'b1', status: 'ACTIVE' });
      prisma.inventoryStockAdjustment.update.mockResolvedValue(adjustment({ warehouseId: 'w2' }));

      const result = await service.update('a1', { warehouseId: 'w2' }, 'u1', ctx);
      expect(prisma.inventoryStockAdjustment.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'a1' }, data: expect.objectContaining({ warehouseId: 'w2' }) }),
      );
      expect(result.warehouseId).toBe('w2');
    });

    it('rejects an inactive warehouse on update', async () => {
      prisma.inventoryStockAdjustment.findUnique.mockResolvedValue(adjustment());
      prisma.warehouse.findUnique.mockResolvedValue({ id: 'w1', companyId: 'c1', branchId: 'b1', status: 'INACTIVE' });

      const promise = service.update('a1', { reason: 'X' }, 'u1', ctx);
      await expect(promise).rejects.toThrow(BadRequestException);
      const response = (await promise.catch((e) => e)).getResponse();
      expect(response.errors[0]).toMatchObject({ field: 'warehouseId', code: 'validation.invalidReference' });
    });

    it('rejects updating a non-DRAFT adjustment', async () => {
      prisma.inventoryStockAdjustment.findUnique.mockResolvedValue(adjustment({ status: 'SUBMITTED' }));
      const promise = service.update('a1', { reason: 'X' }, 'u1', ctx);
      await expect(promise).rejects.toThrow(BadRequestException);
      const response = (await promise.catch((e) => e)).getResponse();
      expect(response.messageKey).toBe('inventory.stockAdjustmentOnlyDraftCanUpdate');
    });
  });

  describe('submit / approve / reject (tenant isolation)', () => {
    it('rejects submit of another company', async () => {
      prisma.inventoryStockAdjustment.findUnique.mockResolvedValue(adjustment({ companyId: 'c2' }));
      await expect(service.submit('a1', 'u1', ctx)).rejects.toThrow(NotFoundException);
    });

    it('submits an owned DRAFT and audits it', async () => {
      prisma.inventoryStockAdjustment.findUnique.mockResolvedValue(adjustment());
      prisma.inventoryStockAdjustment.update.mockResolvedValue(adjustment({ status: 'SUBMITTED' }));

      const result = await service.submit('a1', 'u1', ctx);
      expect(prisma.inventoryStockAdjustment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'a1' },
          data: expect.objectContaining({ status: 'SUBMITTED', submittedById: 'u1' }),
        }),
      );
      expect(audit.log).toHaveBeenCalledWith('u1', 'SUBMIT', 'InventoryStockAdjustment', 'a1', expect.any(Object));
      expect(result.status).toBe('SUBMITTED');
    });

    it('rejects submit of a non-DRAFT adjustment', async () => {
      prisma.inventoryStockAdjustment.findUnique.mockResolvedValue(adjustment({ status: 'APPROVED' }));
      const promise = service.submit('a1', 'u1', ctx);
      await expect(promise).rejects.toThrow(BadRequestException);
      const response = (await promise.catch((e) => e)).getResponse();
      expect(response.messageKey).toBe('inventory.stockAdjustmentOnlyDraftCanSubmit');
    });

    it('rejects approve of another branch', async () => {
      prisma.inventoryStockAdjustment.findUnique.mockResolvedValue(adjustment({ branchId: 'b2' }));
      await expect(service.approve('a1', 'u1', ctx)).rejects.toThrow(NotFoundException);
    });

    it('approves an owned SUBMITTED adjustment and audits it', async () => {
      prisma.inventoryStockAdjustment.findUnique.mockResolvedValue(adjustment({ status: 'SUBMITTED' }));
      prisma.inventoryStockAdjustment.update.mockResolvedValue(adjustment({ status: 'APPROVED' }));

      const result = await service.approve('a1', 'u1', ctx);
      expect(audit.log).toHaveBeenCalledWith('u1', 'APPROVE', 'InventoryStockAdjustment', 'a1', expect.any(Object));
      expect(result.status).toBe('APPROVED');
    });

    it('rejects approve of a non-SUBMITTED adjustment', async () => {
      prisma.inventoryStockAdjustment.findUnique.mockResolvedValue(adjustment({ status: 'DRAFT' }));
      const promise = service.approve('a1', 'u1', ctx);
      await expect(promise).rejects.toThrow(BadRequestException);
      const response = (await promise.catch((e) => e)).getResponse();
      expect(response.messageKey).toBe('inventory.stockAdjustmentOnlySubmittedCanApprove');
    });

    it('rejects reject of another company', async () => {
      prisma.inventoryStockAdjustment.findUnique.mockResolvedValue(adjustment({ companyId: 'c2' }));
      await expect(service.reject('a1', 'u1', ctx)).rejects.toThrow(NotFoundException);
    });

    it('rejects a non-SUBMITTED adjustment', async () => {
      prisma.inventoryStockAdjustment.findUnique.mockResolvedValue(adjustment({ status: 'DRAFT' }));
      const promise = service.reject('a1', 'u1', ctx);
      await expect(promise).rejects.toThrow(BadRequestException);
      const response = (await promise.catch((e) => e)).getResponse();
      expect(response.messageKey).toBe('inventory.stockAdjustmentOnlySubmittedCanReject');
    });
  });

  describe('cancel (tenant isolation)', () => {
    it('rejects cancel of another company', async () => {
      prisma.inventoryStockAdjustment.findUnique.mockResolvedValue(adjustment({ companyId: 'c2' }));
      await expect(service.cancel('a1', 'u1', ctx)).rejects.toThrow(NotFoundException);
      expect(prisma.inventoryStockAdjustment.update).not.toHaveBeenCalled();
    });

    it('cancels an owned DRAFT, records metadata and audits inside the transaction', async () => {
      prisma.inventoryStockAdjustment.findUnique.mockResolvedValue(adjustment());
      prisma.inventoryStockAdjustment.update.mockResolvedValue(adjustment({ status: 'CANCELLED' }));

      const result = await service.cancel('a1', 'u1', ctx);
      expect(prisma.inventoryStockAdjustment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'a1' },
          data: expect.objectContaining({ status: 'CANCELLED', cancelledById: 'u1', cancelledAt: expect.any(Date) }),
        }),
      );
      expect(audit.logWithClient).toHaveBeenCalledWith(
        prisma,
        expect.objectContaining({ userId: 'u1', action: 'CANCEL', entity: 'InventoryStockAdjustment', entityId: 'a1' }),
      );
      expect(result.status).toBe('CANCELLED');
    });

    it('rejects cancel of a POSTED adjustment', async () => {
      prisma.inventoryStockAdjustment.findUnique.mockResolvedValue(adjustment({ status: 'POSTED' }));
      const promise = service.cancel('a1', 'u1', ctx);
      await expect(promise).rejects.toThrow(BadRequestException);
      const response = (await promise.catch((e) => e)).getResponse();
      expect(response.messageKey).toBe('inventory.stockAdjustmentOnlyDraftOrSubmittedCanCancel');
    });
  });

  describe('post (tenant isolation + atomicity)', () => {
    it('rejects post of another company before any balance mutation', async () => {
      prisma.inventoryStockAdjustment.findUnique.mockResolvedValue(adjustment({ companyId: 'c2', status: 'APPROVED' }));
      await expect(service.post('a1', 'u1', ctx)).rejects.toThrow(NotFoundException);
      expect(prisma.inventoryBalance.update).not.toHaveBeenCalled();
      expect(prisma.inventoryMovement.create).not.toHaveBeenCalled();
    });

    it('rejects post of another branch', async () => {
      prisma.inventoryStockAdjustment.findUnique.mockResolvedValue(adjustment({ branchId: 'b2', status: 'APPROVED' }));
      await expect(service.post('a1', 'u1', ctx)).rejects.toThrow(NotFoundException);
    });

    it('rejects post of a non-APPROVED adjustment', async () => {
      prisma.inventoryStockAdjustment.findUnique.mockResolvedValue(adjustment({ status: 'SUBMITTED' }));
      const promise = service.post('a1', 'u1', ctx);
      await expect(promise).rejects.toThrow(BadRequestException);
      const response = (await promise.catch((e) => e)).getResponse();
      expect(response.messageKey).toBe('inventory.stockAdjustmentOnlyApprovedCanPost');
    });

    it('rejects a second post on an already POSTED adjustment before any side effect', async () => {
      prisma.inventoryStockAdjustment.findUnique.mockResolvedValue(adjustment({ status: 'POSTED' }));

      const promise = service.post('a1', 'u1', ctx);
      await expect(promise).rejects.toThrow(BadRequestException);
      const response = (await promise.catch((e) => e)).getResponse();
      expect(response.messageKey).toBe('inventory.stockAdjustmentOnlyApprovedCanPost');
      expect(prisma.inventoryBalance.update).not.toHaveBeenCalled();
      expect(prisma.inventoryMovement.create).not.toHaveBeenCalled();
      expect(prisma.inventoryStockAdjustment.update).not.toHaveBeenCalled();
      expect(audit.logWithClient).not.toHaveBeenCalled();
    });

    it('rejects post of a company-level adjustment (null branch)', async () => {
      prisma.inventoryStockAdjustment.findUnique.mockResolvedValue(adjustment({ branchId: null, status: 'APPROVED' }));
      await expect(service.post('a1', 'u1', ctx)).rejects.toThrow(NotFoundException);
      expect(prisma.inventoryBalance.update).not.toHaveBeenCalled();
      expect(prisma.inventoryMovement.create).not.toHaveBeenCalled();
    });

    it('re-checks ownership inside the transaction before mutating balances', async () => {
      prisma.inventoryStockAdjustment.findUnique
        .mockResolvedValueOnce(adjustment({ status: 'APPROVED' })) // findOwned passes
        .mockResolvedValueOnce(adjustment({ companyId: 'c2', status: 'APPROVED' })); // in-tx re-read is hostile

      await expect(service.post('a1', 'u1', ctx)).rejects.toThrow(NotFoundException);
      expect(prisma.inventoryBalance.update).not.toHaveBeenCalled();
      expect(prisma.inventoryMovement.create).not.toHaveBeenCalled();
    });

    it('posts IN lines atomically: movement inherits the adjustment tenant, balances updated with Decimal, audit in-tx, Serializable', async () => {
      prisma.inventoryStockAdjustment.findUnique.mockResolvedValue(adjustment({ status: 'APPROVED' }));
      prisma.warehouse.findUnique.mockResolvedValue({ id: 'w1', companyId: 'c1', branchId: 'b1', status: 'ACTIVE' });
      prisma.product.findUnique.mockResolvedValue({ id: 'prd1' });
      prisma.inventoryMovement.create.mockResolvedValue({ id: 'mv1' });
      prisma.inventoryBalance.findFirst.mockResolvedValue({ id: 'b1', warehouseId: 'w1', productId: 'prd1', quantity: 10 });
      prisma.inventoryBalance.update.mockResolvedValue({ id: 'b1', quantity: 15 });
      prisma.inventoryStockAdjustmentLine.update.mockResolvedValue(line({ movementId: 'mv1' }));
      prisma.inventoryStockAdjustment.update.mockResolvedValue(adjustment({ status: 'POSTED', lines: [line()] }));

      const result = await service.post('a1', 'u1', ctx);

      expect(txOptions).toEqual({ isolationLevel: 'Serializable' });
      expect(numbering.generateNumberAtomicWithClient).toHaveBeenCalledWith('INVENTORY_MOVEMENT', prisma);
      expect(numbering.generateNumberAtomic).not.toHaveBeenCalled();
      const movementCall = prisma.inventoryMovement.create.mock.calls[0][0];
      expect(movementCall.data).toMatchObject({
        movementNumber: 'SA-0001',
        companyId: 'c1',
        branchId: 'b1',
        warehouseId: 'w1',
        movementType: 'STOCK_ADJUSTMENT_IN',
        status: 'POSTED',
        sourceType: 'STOCK_ADJUSTMENT',
        sourceId: 'a1',
        postedById: 'u1',
        createdById: 'u1',
      });
      expect(movementCall.data.lines.create[0]).toMatchObject({ productId: 'prd1', direction: 'IN', quantity: 5 });

      const balanceCall = prisma.inventoryBalance.update.mock.calls[0][0];
      expect(balanceCall.where).toEqual({ id: 'b1' });
      expect(balanceCall.data.quantity).toBe(15);
      expect(Number(balanceCall.data.quantityBase)).toBe(15);

      expect(prisma.inventoryStockAdjustmentLine.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'l1' }, data: expect.objectContaining({ movementId: 'mv1' }) }),
      );
      expect(prisma.inventoryStockAdjustment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'a1' },
          data: expect.objectContaining({ status: 'POSTED', postedById: 'u1', postedAt: expect.any(Date) }),
        }),
      );
      expect(audit.logWithClient).toHaveBeenCalledWith(
        prisma,
        expect.objectContaining({ userId: 'u1', action: 'POST', entity: 'InventoryStockAdjustment', entityId: 'a1' }),
      );
      expect(result.status).toBe('POSTED');
    });

    it('posts OUT lines and decreases the balance', async () => {
      prisma.inventoryStockAdjustment.findUnique.mockResolvedValue(
        adjustment({ status: 'APPROVED', lines: [line({ adjustmentType: 'ADJUSTMENT_OUT' })] }),
      );
      prisma.warehouse.findUnique.mockResolvedValue({ id: 'w1', companyId: 'c1', branchId: 'b1', status: 'ACTIVE' });
      prisma.product.findUnique.mockResolvedValue({ id: 'prd1' });
      prisma.inventoryMovement.create.mockResolvedValue({ id: 'mv2' });
      prisma.inventoryBalance.findFirst.mockResolvedValue({ id: 'b1', warehouseId: 'w1', productId: 'prd1', quantity: 20 });
      prisma.inventoryBalance.update.mockResolvedValue({ id: 'b1', quantity: 15 });
      prisma.inventoryStockAdjustment.update.mockResolvedValue(adjustment({ status: 'POSTED', lines: [line()] }));

      const result = await service.post('a1', 'u1', ctx);

      expect(numbering.generateNumberAtomicWithClient).toHaveBeenCalledWith('INVENTORY_MOVEMENT', prisma);
      expect(numbering.generateNumberAtomic).not.toHaveBeenCalled();
      const movementCall = prisma.inventoryMovement.create.mock.calls[0][0];
      expect(movementCall.data.movementType).toBe('STOCK_ADJUSTMENT_OUT');
      expect(movementCall.data.lines.create[0]).toMatchObject({ productId: 'prd1', direction: 'OUT', quantity: 5 });

      const balanceCall = prisma.inventoryBalance.update.mock.calls[0][0];
      expect(balanceCall.data.quantity).toBe(15);
      expect(Number(balanceCall.data.quantityBase)).toBe(15);
      expect(result.status).toBe('POSTED');
    });

    it('rejects insufficient stock for OUT and leaves no committed writes', async () => {
      prisma.inventoryStockAdjustment.findUnique.mockResolvedValue(
        adjustment({ status: 'APPROVED', lines: [line({ adjustmentType: 'ADJUSTMENT_OUT' })] }),
      );
      prisma.warehouse.findUnique.mockResolvedValue({ id: 'w1', companyId: 'c1', branchId: 'b1', status: 'ACTIVE' });
      prisma.product.findUnique.mockResolvedValue({ id: 'prd1', name: 'Bearing' });
      prisma.inventoryMovement.create.mockResolvedValue({ id: 'mv2' });
      prisma.inventoryBalance.findFirst.mockResolvedValue({ id: 'b1', warehouseId: 'w1', productId: 'prd1', quantity: 2 });

      await expect(service.post('a1', 'u1', ctx)).rejects.toThrow(BadRequestException);
      expect(prisma.inventoryBalance.update).not.toHaveBeenCalled();
      expect(prisma.inventoryStockAdjustmentLine.update).not.toHaveBeenCalled();
      expect(prisma.inventoryStockAdjustment.update).not.toHaveBeenCalled();
      expect(audit.logWithClient).not.toHaveBeenCalled();
    });

    it('creates a zero balance row when none exists before applying the delta', async () => {
      prisma.inventoryStockAdjustment.findUnique.mockResolvedValue(adjustment({ status: 'APPROVED' }));
      prisma.warehouse.findUnique.mockResolvedValue({ id: 'w1', companyId: 'c1', branchId: 'b1', status: 'ACTIVE' });
      prisma.product.findUnique.mockResolvedValue({ id: 'prd1' });
      prisma.inventoryMovement.create.mockResolvedValue({ id: 'mv1' });
      prisma.inventoryBalance.findFirst.mockResolvedValue(null);
      prisma.inventoryBalance.create.mockResolvedValue({ id: 'b1', quantity: 0, quantityBase: 0 });
      prisma.inventoryBalance.update.mockResolvedValue({ id: 'b1', quantity: 5 });
      prisma.inventoryStockAdjustment.update.mockResolvedValue(adjustment({ status: 'POSTED', lines: [line()] }));

      await service.post('a1', 'u1', ctx);

      expect(prisma.inventoryBalance.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ warehouseId: 'w1', productId: 'prd1', quantity: 0, quantityBase: 0 }),
        }),
      );
    });

    it('rejects post when the document warehouse became foreign after approval', async () => {
      prisma.inventoryStockAdjustment.findUnique.mockResolvedValue(adjustment({ status: 'APPROVED' }));
      prisma.warehouse.findUnique.mockResolvedValue({ id: 'wF', companyId: 'c2', branchId: 'b2', status: 'ACTIVE' });
      prisma.product.findUnique.mockResolvedValue({ id: 'prd1' });

      const promise = service.post('a1', 'u1', ctx);
      await expect(promise).rejects.toThrow(BadRequestException);
      const response = (await promise.catch((e) => e)).getResponse();
      expect(response.errors[0]).toMatchObject({ field: 'warehouseId', code: 'validation.invalidReference' });
      expect(numbering.generateNumberAtomicWithClient).not.toHaveBeenCalled();
      expect(prisma.inventoryMovement.create).not.toHaveBeenCalled();
      expect(prisma.inventoryBalance.update).not.toHaveBeenCalled();
      expect(prisma.inventoryStockAdjustment.update).not.toHaveBeenCalled();
    });

    it('rejects post when the document warehouse became inactive after approval', async () => {
      prisma.inventoryStockAdjustment.findUnique.mockResolvedValue(adjustment({ status: 'APPROVED' }));
      prisma.warehouse.findUnique.mockResolvedValue({ id: 'w1', companyId: 'c1', branchId: 'b1', status: 'INACTIVE' });
      prisma.product.findUnique.mockResolvedValue({ id: 'prd1' });

      await expect(service.post('a1', 'u1', ctx)).rejects.toThrow(BadRequestException);
      expect(prisma.inventoryMovement.create).not.toHaveBeenCalled();
      expect(prisma.inventoryBalance.update).not.toHaveBeenCalled();
      expect(prisma.inventoryStockAdjustment.update).not.toHaveBeenCalled();
    });

    it('rejects post when a line location became foreign/incompatible after approval', async () => {
      prisma.inventoryStockAdjustment.findUnique.mockResolvedValue(
        adjustment({ status: 'APPROVED', lines: [line({ locationId: 'loc1' })] }),
      );
      prisma.warehouse.findUnique.mockResolvedValue({ id: 'w1', companyId: 'c1', branchId: 'b1', status: 'ACTIVE' });
      prisma.warehouseLocation.findUnique.mockResolvedValue({ id: 'loc1', warehouseId: 'wOther' });
      prisma.product.findUnique.mockResolvedValue({ id: 'prd1' });

      const promise = service.post('a1', 'u1', ctx);
      await expect(promise).rejects.toThrow(BadRequestException);
      const response = (await promise.catch((e) => e)).getResponse();
      expect(response.errors[0]).toMatchObject({ field: 'lines.locationId', code: 'validation.invalidReference' });
      expect(numbering.generateNumberAtomicWithClient).not.toHaveBeenCalled();
      expect(prisma.inventoryMovement.create).not.toHaveBeenCalled();
      expect(prisma.inventoryBalance.update).not.toHaveBeenCalled();
      expect(prisma.inventoryStockAdjustment.update).not.toHaveBeenCalled();
    });

    it('rejects post when the document location became incompatible after approval', async () => {
      prisma.inventoryStockAdjustment.findUnique.mockResolvedValue(adjustment({ status: 'APPROVED', locationId: 'locDoc' }));
      prisma.warehouse.findUnique.mockResolvedValue({ id: 'w1', companyId: 'c1', branchId: 'b1', status: 'ACTIVE' });
      prisma.warehouseLocation.findUnique.mockResolvedValue({ id: 'locDoc', warehouseId: 'wOther' });
      prisma.product.findUnique.mockResolvedValue({ id: 'prd1' });

      const promise = service.post('a1', 'u1', ctx);
      await expect(promise).rejects.toThrow(BadRequestException);
      const response = (await promise.catch((e) => e)).getResponse();
      expect(response.errors[0]).toMatchObject({ field: 'locationId', code: 'validation.invalidReference' });
      expect(numbering.generateNumberAtomicWithClient).not.toHaveBeenCalled();
      expect(prisma.inventoryMovement.create).not.toHaveBeenCalled();
      expect(prisma.inventoryBalance.update).not.toHaveBeenCalled();
      expect(prisma.inventoryStockAdjustment.update).not.toHaveBeenCalled();
    });

    it('rejects post when a line product became deleted after approval', async () => {
      prisma.inventoryStockAdjustment.findUnique.mockResolvedValue(adjustment({ status: 'APPROVED' }));
      prisma.warehouse.findUnique.mockResolvedValue({ id: 'w1', companyId: 'c1', branchId: 'b1', status: 'ACTIVE' });
      prisma.product.findUnique.mockResolvedValue({ id: 'prd1', deletedAt: new Date() });

      const promise = service.post('a1', 'u1', ctx);
      await expect(promise).rejects.toThrow(BadRequestException);
      const response = (await promise.catch((e) => e)).getResponse();
      expect(response.errors[0]).toMatchObject({ field: 'lines.productId', code: 'validation.invalidReference' });
      expect(numbering.generateNumberAtomicWithClient).not.toHaveBeenCalled();
      expect(prisma.inventoryMovement.create).not.toHaveBeenCalled();
      expect(prisma.inventoryBalance.update).not.toHaveBeenCalled();
      expect(prisma.inventoryStockAdjustment.update).not.toHaveBeenCalled();
    });
  });

  describe('remove (tenant isolation)', () => {
    it('rejects delete of another company before any deletion', async () => {
      prisma.inventoryStockAdjustment.findUnique.mockResolvedValue(adjustment({ companyId: 'c2' }));
      await expect(service.remove('a1', 'u1', ctx)).rejects.toThrow(NotFoundException);
      expect(prisma.inventoryStockAdjustmentLine.deleteMany).not.toHaveBeenCalled();
      expect(prisma.inventoryStockAdjustment.delete).not.toHaveBeenCalled();
    });

    it('rejects delete of a company-level adjustment (null branch)', async () => {
      prisma.inventoryStockAdjustment.findUnique.mockResolvedValue(adjustment({ branchId: null }));
      await expect(service.remove('a1', 'u1', ctx)).rejects.toThrow(NotFoundException);
      expect(prisma.inventoryStockAdjustmentLine.deleteMany).not.toHaveBeenCalled();
      expect(prisma.inventoryStockAdjustment.delete).not.toHaveBeenCalled();
    });

    it('deletes an owned DRAFT adjustment with its lines atomically and audits inside the transaction', async () => {
      prisma.inventoryStockAdjustment.findUnique.mockResolvedValue(adjustment());
      prisma.inventoryStockAdjustmentLine.deleteMany.mockResolvedValue({ count: 1 });
      prisma.inventoryStockAdjustment.delete.mockResolvedValue(adjustment());

      const result = await service.remove('a1', 'u1', ctx);
      expect(prisma.inventoryStockAdjustmentLine.deleteMany).toHaveBeenCalledWith({ where: { adjustmentId: 'a1' } });
      expect(prisma.inventoryStockAdjustment.delete).toHaveBeenCalledWith({ where: { id: 'a1' } });
      expect(audit.logWithClient).toHaveBeenCalledWith(
        prisma,
        expect.objectContaining({ userId: 'u1', action: 'DELETE', entity: 'InventoryStockAdjustment', entityId: 'a1' }),
      );
      expect(result.message).toBe('Stock adjustment deleted successfully');
    });

    it('re-checks ownership inside the transaction: hostile re-read leaves no deletion', async () => {
      prisma.inventoryStockAdjustment.findUnique
        .mockResolvedValueOnce(adjustment()) // findOwned passes
        .mockResolvedValueOnce(adjustment({ companyId: 'c2' })); // in-tx re-read is foreign

      await expect(service.remove('a1', 'u1', ctx)).rejects.toThrow(NotFoundException);
      expect(prisma.inventoryStockAdjustmentLine.deleteMany).not.toHaveBeenCalled();
      expect(prisma.inventoryStockAdjustment.delete).not.toHaveBeenCalled();
      expect(audit.logWithClient).not.toHaveBeenCalled();
    });

    it('is atomic: a failure deleting lines leaves the document and its audit untouched', async () => {
      prisma.inventoryStockAdjustment.findUnique.mockResolvedValue(adjustment());
      prisma.inventoryStockAdjustmentLine.deleteMany.mockRejectedValue(new Error('boom'));

      await expect(service.remove('a1', 'u1', ctx)).rejects.toThrow('boom');
      expect(prisma.inventoryStockAdjustment.delete).not.toHaveBeenCalled();
      expect(audit.logWithClient).not.toHaveBeenCalled();
    });

    it('rejects delete of a non-DRAFT adjustment', async () => {
      prisma.inventoryStockAdjustment.findUnique.mockResolvedValue(adjustment({ status: 'SUBMITTED' }));
      const promise = service.remove('a1', 'u1', ctx);
      await expect(promise).rejects.toThrow(BadRequestException);
      const response = (await promise.catch((e) => e)).getResponse();
      expect(response.messageKey).toBe('inventory.stockAdjustmentOnlyDraftCanDelete');
    });
  });

  describe('lines (tenant isolation)', () => {
    it('rejects addLine for an adjustment of another company', async () => {
      prisma.inventoryStockAdjustment.findUnique.mockResolvedValue(adjustment({ companyId: 'c2' }));
      await expect(
        service.addLine('a1', { productId: 'prd1', adjustmentType: 'ADJUSTMENT_IN', quantity: 3 }, 'u1', ctx),
      ).rejects.toThrow(NotFoundException);
    });

    it('rejects addLine for an adjustment of another branch', async () => {
      prisma.inventoryStockAdjustment.findUnique.mockResolvedValue(adjustment({ branchId: 'b2' }));
      await expect(
        service.addLine('a1', { productId: 'prd1', adjustmentType: 'ADJUSTMENT_IN', quantity: 3 }, 'u1', ctx),
      ).rejects.toThrow(NotFoundException);
    });

    it('rejects addLine with a location that does not belong to the adjustment warehouse', async () => {
      prisma.inventoryStockAdjustment.findUnique.mockResolvedValue(adjustment());
      prisma.warehouseLocation.findUnique.mockResolvedValue({ id: 'locX', warehouseId: 'wOther' });
      prisma.product.findUnique.mockResolvedValue({ id: 'prd1' });

      const promise = service.addLine('a1', { productId: 'prd1', adjustmentType: 'ADJUSTMENT_IN', quantity: 3, locationId: 'locX' }, 'u1', ctx);
      await expect(promise).rejects.toThrow(BadRequestException);
      const response = (await promise.catch((e) => e)).getResponse();
      expect(response.errors[0]).toMatchObject({ field: 'lines.locationId', code: 'validation.invalidReference' });
      expect(prisma.inventoryStockAdjustmentLine.create).not.toHaveBeenCalled();
    });

    it('adds a line to an owned DRAFT adjustment and audits it', async () => {
      prisma.inventoryStockAdjustment.findUnique.mockResolvedValue(adjustment());
      prisma.product.findUnique.mockResolvedValue({ id: 'prd1' });
      prisma.inventoryStockAdjustmentLine.create.mockResolvedValue({ id: 'l2', adjustmentId: 'a1', productId: 'prd1', quantity: 3 });

      const result = await service.addLine('a1', { productId: 'prd1', adjustmentType: 'ADJUSTMENT_IN', quantity: 3 }, 'u1', ctx);
      expect(audit.log).toHaveBeenCalledWith('u1', 'ADD_LINE', 'InventoryStockAdjustment', 'a1', expect.any(Object));
      expect(result.id).toBe('l2');
    });

    it('rejects updateLine for an adjustment of another company', async () => {
      prisma.inventoryStockAdjustment.findUnique.mockResolvedValue(adjustment({ companyId: 'c2' }));
      await expect(
        service.updateLine('a1', 'l1', { quantity: 9 }, 'u1', ctx),
      ).rejects.toThrow(NotFoundException);
    });

    it('rejects updateLine when the line belongs to another adjustment', async () => {
      prisma.inventoryStockAdjustment.findUnique.mockResolvedValue(adjustment());
      prisma.inventoryStockAdjustmentLine.findUnique.mockResolvedValue({ id: 'lX', adjustmentId: 'aOther' });

      const promise = service.updateLine('a1', 'lX', { quantity: 9 }, 'u1', ctx);
      await expect(promise).rejects.toThrow(NotFoundException);
      const response = (await promise.catch((e) => e)).getResponse();
      expect(response.messageKey).toBe('inventory.stockAdjustmentNotFound');
    });

    it('rejects updateLine with a location not belonging to the adjustment warehouse', async () => {
      prisma.inventoryStockAdjustment.findUnique.mockResolvedValue(adjustment());
      prisma.inventoryStockAdjustmentLine.findUnique.mockResolvedValue({ id: 'l1', adjustmentId: 'a1' });
      prisma.warehouseLocation.findUnique.mockResolvedValue({ id: 'locX', warehouseId: 'wOther' });

      await expect(
        service.updateLine('a1', 'l1', { locationId: 'locX' }, 'u1', ctx),
      ).rejects.toThrow(BadRequestException);
    });

    it('updates an owned line and audits it', async () => {
      prisma.inventoryStockAdjustment.findUnique.mockResolvedValue(adjustment());
      prisma.inventoryStockAdjustmentLine.findUnique.mockResolvedValue({ id: 'l1', adjustmentId: 'a1' });
      prisma.inventoryStockAdjustmentLine.update.mockResolvedValue({ id: 'l1', adjustmentId: 'a1', quantity: 9 });

      const result = await service.updateLine('a1', 'l1', { quantity: 9 }, 'u1', ctx);
      expect(prisma.inventoryStockAdjustmentLine.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'l1' }, data: expect.objectContaining({ quantity: 9 }) }),
      );
      expect(audit.log).toHaveBeenCalledWith('u1', 'UPDATE_LINE', 'InventoryStockAdjustment', 'a1', expect.any(Object));
      expect(result.quantity).toBe(9);
    });

    it('rejects removeLine for an adjustment of another company', async () => {
      prisma.inventoryStockAdjustment.findUnique.mockResolvedValue(adjustment({ companyId: 'c2' }));
      await expect(service.removeLine('a1', 'l1', 'u1', ctx)).rejects.toThrow(NotFoundException);
    });

    it('rejects removeLine when the line belongs to another adjustment', async () => {
      prisma.inventoryStockAdjustment.findUnique.mockResolvedValue(adjustment());
      prisma.inventoryStockAdjustmentLine.findUnique.mockResolvedValue({ id: 'lX', adjustmentId: 'aOther' });

      await expect(service.removeLine('a1', 'lX', 'u1', ctx)).rejects.toThrow(NotFoundException);
      expect(prisma.inventoryStockAdjustmentLine.delete).not.toHaveBeenCalled();
    });

    it('removes an owned line and audits it', async () => {
      prisma.inventoryStockAdjustment.findUnique.mockResolvedValue(adjustment());
      prisma.inventoryStockAdjustmentLine.findUnique.mockResolvedValue({ id: 'l1', adjustmentId: 'a1' });
      prisma.inventoryStockAdjustmentLine.delete.mockResolvedValue({ id: 'l1' });

      const result = await service.removeLine('a1', 'l1', 'u1', ctx);
      expect(prisma.inventoryStockAdjustmentLine.delete).toHaveBeenCalledWith({ where: { id: 'l1' } });
      expect(audit.log).toHaveBeenCalledWith('u1', 'REMOVE_LINE', 'InventoryStockAdjustment', 'a1', expect.any(Object));
      expect(result.message).toBe('Line removed successfully');
    });
  });

  describe('summary (tenant isolation)', () => {
    it('rejects summary of an adjustment belonging to another company', async () => {
      prisma.inventoryStockAdjustment.findUnique.mockResolvedValue(adjustment({ companyId: 'c2' }));
      await expect(service.summary('a1', ctx)).rejects.toThrow(NotFoundException);
    });

    it('computes totals for an owned adjustment', async () => {
      prisma.inventoryStockAdjustment.findUnique.mockResolvedValue(adjustment());
      prisma.inventoryStockAdjustmentLine.findMany.mockResolvedValue([
        { adjustmentType: 'ADJUSTMENT_IN', quantity: 5 },
        { adjustmentType: 'ADJUSTMENT_OUT', quantity: 2 },
      ]);

      const result = await service.summary('a1', ctx);
      expect(result).toMatchObject({ stockAdjustmentId: 'a1', code: 'SA-0001', totalIn: 5, totalOut: 2, lineCount: 2 });
    });
  });
});
