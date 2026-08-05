import { BadRequestException, NotFoundException } from '@nestjs/common';
import { InventoryMovementsService } from './inventory-movements.service';
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

const movement = (overrides: Record<string, any> = {}) => ({
  id: 'm1',
  companyId: 'c1',
  branchId: 'b1',
  movementNumber: 'IM-0001',
  movementType: 'MANUAL',
  warehouseId: 'w1',
  status: 'DRAFT',
  postedAt: null,
  postedById: null,
  createdById: 'u1',
  notes: null,
  deletedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  lines: [
    { id: 'l1', movementId: 'm1', productId: 'prd1', quantity: 5, direction: 'IN' },
  ],
  ...overrides,
});

const createDto = {
  warehouseId: 'w1',
  branchId: 'b1',
  companyId: 'c1',
  movementType: 'MANUAL',
  lines: [
    { productId: 'prd1', quantity: 5, unit: 'pcs', direction: 'IN' as const },
  ],
};

describe('InventoryMovementsService', () => {
  let prisma: any;
  let numbering: any;
  let audit: any;
  let service: InventoryMovementsService;

  beforeEach(() => {
    prisma = {
      company: { findUnique: jest.fn() },
      branch: { findUnique: jest.fn() },
      warehouse: { findUnique: jest.fn() },
      product: { findUnique: jest.fn() },
      inventoryMovement: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
      },
      inventoryMovementLine: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      inventoryBalance: {
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      $transaction: jest.fn(),
    };
    numbering = {
      generateNumberAtomic: jest.fn().mockResolvedValue('IM-0001'),
    };
    audit = { log: jest.fn().mockResolvedValue(undefined) };
    service = new InventoryMovementsService(
      prisma as PrismaService,
      audit as AuditService,
      numbering as NumberingService,
    );
  });

  describe('create', () => {
    it('creates the movement in the active company and audits it', async () => {
      prisma.company.findUnique.mockResolvedValue({ id: 'c1' });
      prisma.warehouse.findUnique.mockResolvedValue({ id: 'w1', companyId: 'c1', branchId: 'b1' });
      prisma.branch.findUnique.mockResolvedValue({ id: 'b1' });
      prisma.product.findUnique.mockResolvedValue({ id: 'prd1' });
      prisma.$transaction.mockImplementation(async (fn: (tx: any) => Promise<any>) => fn(prisma));
      prisma.inventoryMovement.create.mockResolvedValue(movement());

      const result = await service.create(createDto, 'u1', ctx);

      expect(numbering.generateNumberAtomic).toHaveBeenCalledWith('INVENTORY_MOVEMENT');
      const createCall = prisma.inventoryMovement.create.mock.calls[0][0];
      expect(createCall.data).toMatchObject({
        companyId: 'c1',
        movementNumber: 'IM-0001',
        status: 'DRAFT',
        createdById: 'u1',
      });
      expect(createCall.data.lines.create[0]).toMatchObject({
        productId: 'prd1',
        quantity: 5,
        direction: 'IN',
      });
      expect(audit.log).toHaveBeenCalledWith('u1', 'CREATE', 'InventoryMovement', 'm1', expect.any(Object));
      expect(result.id).toBe('m1');
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
  });

  describe('findOne (tenant isolation)', () => {
    it('returns the movement when it belongs to the active context', async () => {
      prisma.inventoryMovement.findUnique.mockResolvedValue(movement());
      const result = await service.findOne('m1', ctx);
      expect(result.id).toBe('m1');
    });

    it('returns a company-level movement (null branch) of the same company', async () => {
      prisma.inventoryMovement.findUnique.mockResolvedValue(movement({ branchId: null }));
      const result = await service.findOne('m1', ctx);
      expect(result.id).toBe('m1');
    });

    it('throws NotFound when the movement belongs to another company', async () => {
      prisma.inventoryMovement.findUnique.mockResolvedValue(movement({ companyId: 'c2' }));
      const promise = service.findOne('m1', ctx);
      await expect(promise).rejects.toThrow(NotFoundException);
      const response = (await promise.catch((e) => e)).getResponse();
      expect(response.messageKey).toBe('inventory.movementNotFound');
    });

    it('throws NotFound when the movement belongs to another branch', async () => {
      prisma.inventoryMovement.findUnique.mockResolvedValue(movement({ branchId: 'b2' }));
      await expect(service.findOne('m1', ctx)).rejects.toThrow(NotFoundException);
    });

    it('throws NotFound when missing or soft-deleted', async () => {
      prisma.inventoryMovement.findUnique.mockResolvedValue(null);
      await expect(service.findOne('nope', ctx)).rejects.toThrow(NotFoundException);

      prisma.inventoryMovement.findUnique.mockResolvedValue(movement({ deletedAt: new Date() }));
      await expect(service.findOne('m1', ctx)).rejects.toThrow(NotFoundException);
    });
  });

  describe('findAll', () => {
    it('always scopes the query to the active company and compatible branches', async () => {
      prisma.inventoryMovement.findMany.mockResolvedValue([]);
      prisma.inventoryMovement.count.mockResolvedValue(0);

      await service.findAll({ page: 1, limit: 10 }, ctx);
      expect(prisma.inventoryMovement.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ companyId: 'c1', branchId: { in: ['b1', null] }, deletedAt: null }),
        }),
      );
      expect(prisma.inventoryMovement.count).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ companyId: 'c1' }) }),
      );
    });

    it('ignores client-supplied companyId and branchId filters', async () => {
      prisma.inventoryMovement.findMany.mockResolvedValue([]);
      prisma.inventoryMovement.count.mockResolvedValue(0);

      await service.findAll({ companyId: 'c2', branchId: 'b2', page: 1, limit: 10 }, ctx);
      expect(prisma.inventoryMovement.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ companyId: 'c1', branchId: { in: ['b1', null] } }),
        }),
      );
    });

    it('applies status and search filters', async () => {
      prisma.inventoryMovement.findMany.mockResolvedValue([]);
      prisma.inventoryMovement.count.mockResolvedValue(0);

      await service.findAll({ status: 'POSTED', search: 'IM-00' }, ctx);
      expect(prisma.inventoryMovement.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ status: 'POSTED', OR: expect.any(Array) }) }),
      );
    });
  });

  describe('update / cancel / post (tenant isolation)', () => {
    it('rejects an update when the movement belongs to another company', async () => {
      prisma.inventoryMovement.findUnique.mockResolvedValue(movement({ companyId: 'c2' }));
      await expect(service.update('m1', { notes: 'X' }, 'u1', ctx)).rejects.toThrow(NotFoundException);
    });

    it('updates an owned DRAFT movement and audits it', async () => {
      prisma.inventoryMovement.findUnique.mockResolvedValue(movement());
      prisma.inventoryMovement.update.mockResolvedValue(movement({ notes: 'changed' }));

      const result = await service.update('m1', { notes: 'changed' }, 'u1', ctx);
      expect(prisma.inventoryMovement.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'm1' } }),
      );
      expect(audit.log).toHaveBeenCalledWith('u1', 'UPDATE', 'InventoryMovement', 'm1', expect.any(Object));
      expect(result.notes).toBe('changed');
    });

    it('rejects cancel of a movement belonging to another branch', async () => {
      prisma.inventoryMovement.findUnique.mockResolvedValue(movement({ branchId: 'b2' }));
      await expect(service.cancel('m1', 'u1', ctx)).rejects.toThrow(NotFoundException);
    });

    it('cancels an owned DRAFT movement and audits it', async () => {
      prisma.inventoryMovement.findUnique.mockResolvedValue(movement());
      prisma.inventoryMovement.update.mockResolvedValue(movement({ status: 'CANCELLED' }));

      const result = await service.cancel('m1', 'u1', ctx);
      expect(prisma.inventoryMovement.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'm1' }, data: expect.objectContaining({ status: 'CANCELLED' }) }),
      );
      expect(audit.log).toHaveBeenCalledWith('u1', 'CANCEL', 'InventoryMovement', 'm1', expect.any(Object));
      expect(result.status).toBe('CANCELLED');
    });

    it('rejects post of a movement belonging to another company before any balance mutation', async () => {
      prisma.inventoryMovement.findUnique.mockResolvedValue(movement({ companyId: 'c2' }));
      await expect(service.post('m1', 'u1', ctx)).rejects.toThrow(NotFoundException);
      expect(prisma.inventoryBalance.update).not.toHaveBeenCalled();
    });

    it('posts an owned DRAFT movement, updates balances and audits it', async () => {
      prisma.inventoryMovement.findUnique.mockResolvedValue(movement());
      prisma.$transaction.mockImplementation(async (fn: (tx: any) => Promise<any>) => fn(prisma));
      prisma.inventoryBalance.findFirst.mockResolvedValue({ id: 'b1', quantity: 10 });
      prisma.inventoryBalance.update.mockResolvedValue({ id: 'b1', quantity: 15 });
      prisma.inventoryMovement.update.mockResolvedValue(movement({ status: 'POSTED' }));

      const result = await service.post('m1', 'u1', ctx);
      expect(prisma.inventoryBalance.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ quantity: 15 }) }),
      );
      expect(prisma.inventoryMovement.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: 'POSTED', postedById: 'u1' }) }),
      );
      expect(audit.log).toHaveBeenCalledWith('u1', 'POST', 'InventoryMovement', 'm1', expect.any(Object));
      expect(result.status).toBe('POSTED');
    });

    it('rejects a negative balance when posting OUT movement', async () => {
      prisma.inventoryMovement.findUnique.mockResolvedValue(
        movement({ lines: [{ id: 'l1', movementId: 'm1', productId: 'prd1', quantity: 5, direction: 'OUT' }] }),
      );
      prisma.$transaction.mockImplementation(async (fn: (tx: any) => Promise<any>) => fn(prisma));
      prisma.inventoryBalance.findFirst.mockResolvedValue({ id: 'b1', quantity: 2 });
      prisma.product.findUnique.mockResolvedValue({ id: 'prd1', name: 'Bearing' });

      await expect(service.post('m1', 'u1', ctx)).rejects.toThrow(BadRequestException);
      expect(prisma.inventoryBalance.update).not.toHaveBeenCalled();
    });
  });

  describe('lines (tenant isolation)', () => {
    it('rejects addLine for a movement of another company', async () => {
      prisma.inventoryMovement.findUnique.mockResolvedValue(movement({ companyId: 'c2' }));
      await expect(
        service.addLine('m1', { productId: 'prd1', quantity: 1, unit: 'pcs', direction: 'IN' }, 'u1', ctx),
      ).rejects.toThrow(NotFoundException);
    });

    it('rejects updateLine for a movement of another branch', async () => {
      prisma.inventoryMovement.findUnique.mockResolvedValue(movement({ branchId: 'b2' }));
      await expect(
        service.updateLine('m1', 'l1', { quantity: 9 }, 'u1', ctx),
      ).rejects.toThrow(NotFoundException);
    });

    it('rejects removeLine for a movement of another company', async () => {
      prisma.inventoryMovement.findUnique.mockResolvedValue(movement({ companyId: 'c2' }));
      await expect(service.removeLine('m1', 'l1', 'u1', ctx)).rejects.toThrow(NotFoundException);
    });

    it('rejects a line that belongs to another movement', async () => {
      prisma.inventoryMovement.findUnique.mockResolvedValue(movement());
      prisma.inventoryMovementLine.findUnique.mockResolvedValue({ id: 'lX', movementId: 'mOther' });

      const promise = service.updateLine('m1', 'lX', { quantity: 9 }, 'u1', ctx);
      await expect(promise).rejects.toThrow(NotFoundException);
      const response = (await promise.catch((e) => e)).getResponse();
      expect(response.messageKey).toBe('inventory.movementNotFound');
    });

    it('adds a line to an owned DRAFT movement and audits it', async () => {
      prisma.inventoryMovement.findUnique.mockResolvedValue(movement());
      prisma.product.findUnique.mockResolvedValue({ id: 'prd1' });
      prisma.inventoryMovementLine.create.mockResolvedValue({ id: 'l2', movementId: 'm1', productId: 'prd1', quantity: 3 });

      const result = await service.addLine('m1', { productId: 'prd1', quantity: 3, unit: 'pcs', direction: 'IN' }, 'u1', ctx);
      expect(audit.log).toHaveBeenCalledWith('u1', 'ADD_LINE', 'InventoryMovement', 'm1', expect.any(Object));
      expect(result.id).toBe('l2');
    });

    it('removes a line from an owned DRAFT movement and audits it', async () => {
      prisma.inventoryMovement.findUnique.mockResolvedValue(movement());
      prisma.inventoryMovementLine.findUnique.mockResolvedValue({ id: 'l1', movementId: 'm1' });
      prisma.inventoryMovementLine.delete.mockResolvedValue({ id: 'l1' });

      const result = await service.removeLine('m1', 'l1', 'u1', ctx);
      expect(prisma.inventoryMovementLine.delete).toHaveBeenCalledWith({ where: { id: 'l1' } });
      expect(audit.log).toHaveBeenCalledWith('u1', 'REMOVE_LINE', 'InventoryMovement', 'm1', expect.any(Object));
      expect(result.message).toBe('Line removed successfully');
    });
  });

  describe('summary', () => {
    it('rejects summary of a movement belonging to another company', async () => {
      prisma.inventoryMovement.findUnique.mockResolvedValue(movement({ companyId: 'c2' }));
      await expect(service.summary('m1', ctx)).rejects.toThrow(NotFoundException);
    });

    it('computes totals for an owned movement', async () => {
      prisma.inventoryMovement.findUnique.mockResolvedValue(movement());
      prisma.inventoryMovementLine.findMany.mockResolvedValue([
        { direction: 'IN', quantity: 5 },
        { direction: 'OUT', quantity: 2 },
      ]);

      const result = await service.summary('m1', ctx);
      expect(result).toMatchObject({ movementId: 'm1', totalInQty: 5, totalOutQty: 2, lineCount: 2 });
    });
  });

  describe('postMovementWithinTransaction (Phase 1.7 refactor)', () => {
    const outLine = { id: 'l1', movementId: 'm1', productId: 'prd1', warehouseLocationId: null, quantity: 5, direction: 'OUT', batchNumber: null, serialNumber: null, expiryDate: null };

    it('rejects a movement outside the active context', async () => {
      prisma.inventoryMovement.findUnique.mockResolvedValue(movement({ companyId: 'c2' }));
      await expect(service.postMovementWithinTransaction(prisma, 'm1', 'u1', ctx)).rejects.toThrow(NotFoundException);
    });

    it('applies OUT deltas to the balance and writes the Decimal shadow quantityBase', async () => {
      prisma.inventoryMovement.findUnique.mockResolvedValue(movement({ lines: [outLine] }));
      prisma.inventoryBalance.findFirst.mockResolvedValue({ id: 'bal1', warehouseId: 'w1', productId: 'prd1', quantity: 20 });
      prisma.inventoryBalance.update.mockResolvedValue({ id: 'bal1', quantity: 15 });

      await service.postMovementWithinTransaction(prisma, 'm1', 'u1', ctx);

      expect(prisma.inventoryBalance.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'bal1' },
          data: { quantity: 15, quantityBase: 15 },
        }),
      );
      expect(prisma.inventoryMovement.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'POSTED', postedById: 'u1' }),
        }),
      );
    });

    it('creates a balance row when none exists and applies the delta', async () => {
      prisma.inventoryMovement.findUnique.mockResolvedValue(movement({ lines: [outLine] }));
      prisma.inventoryBalance.findFirst.mockResolvedValue(null);
      prisma.inventoryBalance.create.mockResolvedValue({ id: 'bal1', quantity: 0 });

      await expect(service.postMovementWithinTransaction(prisma, 'm1', 'u1', ctx)).rejects.toThrow(BadRequestException);

      expect(prisma.inventoryBalance.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ warehouseId: 'w1', productId: 'prd1', quantity: 0, quantityBase: 0 }),
        }),
      );
    });

    it('rejects posting when the OUT quantity would drive the balance negative', async () => {
      prisma.inventoryMovement.findUnique.mockResolvedValue(movement({ lines: [outLine] }));
      prisma.inventoryBalance.findFirst.mockResolvedValue({ id: 'bal1', warehouseId: 'w1', productId: 'prd1', quantity: 3 });
      prisma.product.findUnique.mockResolvedValue({ id: 'prd1', name: 'Material' });

      await expect(service.postMovementWithinTransaction(prisma, 'm1', 'u1', ctx)).rejects.toThrow(BadRequestException);
      expect(prisma.inventoryBalance.update).not.toHaveBeenCalled();
      expect(prisma.inventoryMovement.update).not.toHaveBeenCalled();
    });

    it('rejects posting a movement that is not DRAFT', async () => {
      prisma.inventoryMovement.findUnique.mockResolvedValue(movement({ status: 'POSTED', lines: [outLine] }));
      await expect(service.postMovementWithinTransaction(prisma, 'm1', 'u1', ctx)).rejects.toThrow(BadRequestException);
    });
  });
});
