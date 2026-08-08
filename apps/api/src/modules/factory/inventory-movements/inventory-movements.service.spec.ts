import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
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

const line = (overrides: Record<string, any> = {}) => ({
  id: 'l1',
  movementId: 'm1',
  productId: 'prd1',
  warehouseLocationId: null,
  quantity: 5,
  quantityBase: null,
  batchNumber: null,
  serialNumber: null,
  expiryDate: null,
  unit: 'pcs',
  direction: 'IN',
  notes: null,
  ...overrides,
});

const movement = (overrides: Record<string, any> = {}) => ({
  id: 'm1',
  companyId: 'c1',
  branchId: 'b1',
  movementNumber: 'IM-0001',
  movementType: 'MANUAL',
  warehouseId: 'w1',
  status: 'DRAFT',
  sourceType: null,
  sourceId: null,
  requestId: null,
  reversesMovementId: null,
  movementDate: new Date('2026-08-01T10:00:00.000Z'),
  postedAt: null,
  postedById: null,
  createdById: 'u1',
  notes: null,
  deletedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  lines: [line()],
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

const outLine = {
  id: 'l1', movementId: 'm1', productId: 'prd1', warehouseLocationId: null,
  quantity: 5, quantityBase: null, batchNumber: null, serialNumber: null,
  expiryDate: null, unit: 'pcs', direction: 'OUT',
};

describe('InventoryMovementsService', () => {
  let prisma: any;
  let numbering: any;
  let audit: any;
  let service: InventoryMovementsService;
  let txOptions: any;

  beforeEach(() => {
    txOptions = undefined;
    prisma = {
      company: { findUnique: jest.fn() },
      branch: { findUnique: jest.fn() },
      warehouse: { findUnique: jest.fn() },
      warehouseLocation: { findUnique: jest.fn() },
      product: { findUnique: jest.fn() },
      inventoryMovement: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
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
      $transaction: jest.fn().mockImplementation(async (fn: (tx: any) => Promise<any>, options?: any) => {
        txOptions = options;
        return fn(prisma);
      }),
    };
    numbering = {
      generateNumberAtomic: jest.fn().mockResolvedValue('IM-0001'),
    };
    audit = {
      log: jest.fn().mockResolvedValue(undefined),
      logWithClient: jest.fn().mockResolvedValue(undefined),
    };
    service = new InventoryMovementsService(
      prisma as PrismaService,
      audit as AuditService,
      numbering as NumberingService,
    );
  });

  describe('create', () => {
    it('creates the movement in the active company and audits it inside the transaction', async () => {
      prisma.company.findUnique.mockResolvedValue({ id: 'c1' });
      prisma.warehouse.findUnique.mockResolvedValue({ id: 'w1', companyId: 'c1', branchId: 'b1' });
      prisma.branch.findUnique.mockResolvedValue({ id: 'b1' });
      prisma.product.findUnique.mockResolvedValue({ id: 'prd1' });
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
      expect(txOptions).toEqual({ isolationLevel: 'Serializable' });
      expect(audit.logWithClient).toHaveBeenCalledWith(
        prisma,
        expect.objectContaining({ userId: 'u1', action: 'CREATE', entity: 'InventoryMovement', entityId: 'm1' }),
      );
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

    it('rejects a location that belongs to another warehouse', async () => {
      prisma.company.findUnique.mockResolvedValue({ id: 'c1' });
      prisma.warehouse.findUnique.mockResolvedValue({ id: 'w1', companyId: 'c1', branchId: 'b1' });
      prisma.branch.findUnique.mockResolvedValue({ id: 'b1' });
      prisma.product.findUnique.mockResolvedValue({ id: 'prd1' });
      prisma.warehouseLocation.findUnique.mockResolvedValue({ id: 'locX', warehouseId: 'wOther' });

      const dto = {
        ...createDto,
        lines: [{ productId: 'prd1', quantity: 5, unit: 'pcs', direction: 'IN' as const, warehouseLocationId: 'locX' }],
      };
      const promise = service.create(dto, 'u1', ctx);
      await expect(promise).rejects.toThrow(BadRequestException);
      expect(prisma.inventoryMovement.create).not.toHaveBeenCalled();
    });

    it('returns the committed movement when the same requestId is reused with identical data (idempotency)', async () => {
      const dto = { ...createDto, requestId: 'req-1' };
      const committed = movement({ requestId: 'req-1' });
      prisma.inventoryMovement.findFirst.mockResolvedValue(committed);

      const result = await service.create(dto, 'u1', ctx);

      expect(result.id).toBe('m1');
      expect(prisma.inventoryMovement.create).not.toHaveBeenCalled();
      expect(numbering.generateNumberAtomic).not.toHaveBeenCalled();
    });

    it('rejects the same requestId reused with different data (canonical conflict)', async () => {
      const dto = { ...createDto, requestId: 'req-1' };
      const committed = movement({
        requestId: 'req-1',
        lines: [line({ quantity: 9 })], // different payload than the retry
      });
      prisma.inventoryMovement.findFirst.mockResolvedValue(committed);

      const promise = service.create(dto, 'u1', ctx);
      await expect(promise).rejects.toThrow(ConflictException);
      const response = (await promise.catch((e) => e)).getResponse();
      expect(response.messageKey).toBe('inventory.movementRequestConflict');
    });

    it('resolves a P2002 race by returning the concurrently committed movement', async () => {
      const dto = { ...createDto, requestId: 'req-1' };
      prisma.company.findUnique.mockResolvedValue({ id: 'c1' });
      prisma.warehouse.findUnique.mockResolvedValue({ id: 'w1', companyId: 'c1', branchId: 'b1' });
      prisma.branch.findUnique.mockResolvedValue({ id: 'b1' });
      prisma.product.findUnique.mockResolvedValue({ id: 'prd1' });
      prisma.inventoryMovement.findFirst
        .mockResolvedValueOnce(null) // pre-check: no existing requestId
        .mockResolvedValueOnce(null) // in-transaction race check: still none
        .mockResolvedValueOnce(movement({ requestId: 'req-1' })); // re-check after P2002
      prisma.inventoryMovement.create.mockRejectedValue({ code: 'P2002' });

      const result = await service.create(dto, 'u1', ctx);

      expect(result.id).toBe('m1');
      expect(audit.logWithClient).not.toHaveBeenCalled();
    });

    it('throws a canonical conflict when P2002 has no committed movement to return', async () => {
      const dto = { ...createDto, requestId: 'req-1' };
      prisma.company.findUnique.mockResolvedValue({ id: 'c1' });
      prisma.warehouse.findUnique.mockResolvedValue({ id: 'w1', companyId: 'c1', branchId: 'b1' });
      prisma.branch.findUnique.mockResolvedValue({ id: 'b1' });
      prisma.product.findUnique.mockResolvedValue({ id: 'prd1' });
      prisma.inventoryMovement.findFirst.mockResolvedValue(null);
      prisma.inventoryMovement.create.mockRejectedValue({ code: 'P2002' });

      const promise = service.create(dto, 'u1', ctx);
      await expect(promise).rejects.toThrow(ConflictException);
      const response = (await promise.catch((e) => e)).getResponse();
      expect(response.messageKey).toBe('inventory.movementRequestConflict');
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

    it('cancels an owned DRAFT movement, records cancellation metadata and audits inside the transaction', async () => {
      prisma.inventoryMovement.findUnique.mockResolvedValue(movement());
      prisma.inventoryMovement.update.mockResolvedValue(movement({ status: 'CANCELLED' }));

      const result = await service.cancel('m1', 'u1', ctx);
      expect(prisma.inventoryMovement.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'm1' },
          data: expect.objectContaining({ status: 'CANCELLED', cancelledById: 'u1', cancelledAt: expect.any(Date) }),
        }),
      );
      expect(audit.logWithClient).toHaveBeenCalledWith(
        prisma,
        expect.objectContaining({ userId: 'u1', action: 'CANCEL', entity: 'InventoryMovement', entityId: 'm1' }),
      );
      expect(result.status).toBe('CANCELLED');
    });

    it('rejects post of a movement belonging to another company before any balance mutation', async () => {
      prisma.inventoryMovement.findUnique.mockResolvedValue(movement({ companyId: 'c2' }));
      await expect(service.post('m1', 'u1', ctx)).rejects.toThrow(NotFoundException);
      expect(prisma.inventoryBalance.update).not.toHaveBeenCalled();
    });

    it('posts an owned DRAFT movement with Serializable isolation, updates balances and audits inside the transaction', async () => {
      prisma.inventoryMovement.findUnique.mockResolvedValue(movement());
      prisma.inventoryBalance.findFirst.mockResolvedValue({ id: 'b1', quantity: 10 });
      prisma.inventoryBalance.update.mockResolvedValue({ id: 'b1', quantity: 15 });
      prisma.inventoryMovement.update.mockResolvedValue(movement({ status: 'POSTED' }));

      const result = await service.post('m1', 'u1', ctx);

      expect(txOptions).toEqual({ isolationLevel: 'Serializable' });
      expect(prisma.inventoryBalance.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ quantity: 15 }) }),
      );
      const balanceUpdateCall = prisma.inventoryBalance.update.mock.calls[0][0];
      expect(Number(balanceUpdateCall.data.quantityBase)).toBe(15);
      expect(prisma.inventoryMovement.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: 'POSTED', postedById: 'u1' }) }),
      );
      expect(audit.logWithClient).toHaveBeenCalledWith(
        prisma,
        expect.objectContaining({ userId: 'u1', action: 'POST', entity: 'InventoryMovement', entityId: 'm1' }),
      );
      expect(result.status).toBe('POSTED');
    });

    it('returns the same committed result when posting an already POSTED movement (idempotency)', async () => {
      prisma.inventoryMovement.findUnique.mockResolvedValue(movement({ status: 'POSTED' }));

      const result = await service.post('m1', 'u1', ctx);

      expect(result.status).toBe('POSTED');
      expect(prisma.inventoryBalance.update).not.toHaveBeenCalled();
      expect(prisma.inventoryMovement.update).not.toHaveBeenCalled();
      expect(audit.logWithClient).not.toHaveBeenCalled();
    });

    it('rejects a negative balance when posting OUT movement and leaves no partial writes', async () => {
      prisma.inventoryMovement.findUnique.mockResolvedValue(
        movement({ lines: [line(outLine)] }),
      );
      prisma.inventoryBalance.findFirst.mockResolvedValue({ id: 'b1', quantity: 2 });
      prisma.product.findUnique.mockResolvedValue({ id: 'prd1', name: 'Bearing' });

      await expect(service.post('m1', 'u1', ctx)).rejects.toThrow(BadRequestException);
      expect(prisma.inventoryBalance.update).not.toHaveBeenCalled();
      expect(prisma.inventoryMovement.update).not.toHaveBeenCalled();
      expect(audit.logWithClient).not.toHaveBeenCalled();
    });
  });

  describe('reverse (Phase 2)', () => {
    it('rejects reversing a movement of another company', async () => {
      prisma.inventoryMovement.findUnique.mockResolvedValue(movement({ companyId: 'c2' }));
      await expect(service.reverse('m1', {}, 'u1', ctx)).rejects.toThrow(NotFoundException);
      expect(prisma.inventoryMovement.create).not.toHaveBeenCalled();
    });

    it('rejects reversing a movement of another branch', async () => {
      prisma.inventoryMovement.findUnique.mockResolvedValue(movement({ branchId: 'b2' }));
      await expect(service.reverse('m1', {}, 'u1', ctx)).rejects.toThrow(NotFoundException);
    });

    it('only POSTED movements can be reversed', async () => {
      prisma.inventoryMovement.findUnique.mockResolvedValue(movement({ status: 'DRAFT' }));
      const promise = service.reverse('m1', {}, 'u1', ctx);
      await expect(promise).rejects.toThrow(BadRequestException);
      const response = (await promise.catch((e) => e)).getResponse();
      expect(response.messageKey).toBe('inventory.movementOnlyPostedCanReverse');
    });

    it('a reversal movement itself cannot be reversed', async () => {
      prisma.inventoryMovement.findUnique.mockResolvedValue(
        movement({ status: 'POSTED', reversesMovementId: 'm0' }),
      );
      const promise = service.reverse('m1', {}, 'u1', ctx);
      await expect(promise).rejects.toThrow(BadRequestException);
      const response = (await promise.catch((e) => e)).getResponse();
      expect(response.messageKey).toBe('inventory.movementReversalCannotReverse');
    });

    it('creates a compensating DRAFT movement with flipped directions and never mutates the original', async () => {
      prisma.inventoryMovement.findUnique.mockResolvedValue(
        movement({ status: 'POSTED', lines: [line(), line({ id: 'l2', productId: 'prd2', quantity: 3, direction: 'OUT' })] }),
      );
      prisma.inventoryMovement.create.mockResolvedValue(movement({ id: 'm2', movementNumber: 'IM-0002', status: 'DRAFT' }));

      const result = await service.reverse('m1', {}, 'u1', ctx);

      const createCall = prisma.inventoryMovement.create.mock.calls[0][0];
      expect(createCall.data).toMatchObject({
        companyId: 'c1',
        branchId: 'b1',
        warehouseId: 'w1',
        movementType: 'MANUAL',
        status: 'DRAFT',
        sourceType: 'INVENTORY_MOVEMENT_REVERSAL',
        sourceId: 'm1',
        reversesMovementId: 'm1',
        createdById: 'u1',
      });
      expect(createCall.data.lines.create[0].direction).toBe('OUT'); // IN flipped
      expect(createCall.data.lines.create[1].direction).toBe('IN');  // OUT flipped
      expect(txOptions).toEqual({ isolationLevel: 'Serializable' });
      expect(audit.logWithClient).toHaveBeenCalledWith(
        prisma,
        expect.objectContaining({ userId: 'u1', action: 'REVERSE', entity: 'InventoryMovement', entityId: 'm1' }),
      );
      // The original movement is never deleted or updated by the reversal.
      expect(prisma.inventoryMovement.update).not.toHaveBeenCalled();
      expect(prisma.inventoryMovementLine.delete).not.toHaveBeenCalled();
      expect(result.status).toBe('DRAFT');
    });

    it('is idempotent: reusing the same requestId returns the committed reversal', async () => {
      prisma.inventoryMovement.findUnique.mockResolvedValue(movement({ status: 'POSTED' }));
      const committed = movement({ id: 'm2', movementNumber: 'IM-0002', status: 'DRAFT', requestId: 'req-rev-1' });
      prisma.inventoryMovement.findFirst.mockResolvedValue(committed);

      const result = await service.reverse('m1', { requestId: 'req-rev-1' }, 'u1', ctx);

      expect(result.id).toBe('m2');
      expect(prisma.inventoryMovement.create).not.toHaveBeenCalled();
    });

    it('throws a canonical conflict when the same reversal requestId arrives with different notes', async () => {
      prisma.inventoryMovement.findUnique.mockResolvedValue(movement({ status: 'POSTED' }));
      const committed = movement({
        id: 'm2', movementNumber: 'IM-0002', status: 'DRAFT', requestId: 'req-rev-1', notes: 'Original note',
      });
      prisma.inventoryMovement.findFirst.mockResolvedValue(committed);

      const promise = service.reverse('m1', { requestId: 'req-rev-1', notes: 'A different note' }, 'u1', ctx);
      await expect(promise).rejects.toThrow(ConflictException);
      const response = (await promise.catch((e) => e)).getResponse();
      expect(response.messageKey).toBe('inventory.movementRequestConflict');
      expect(prisma.inventoryMovement.create).not.toHaveBeenCalled();
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

  describe('postMovementWithinTransaction (Phase 1.7 refactor, Phase 2 hardening)', () => {
    it('rejects a movement outside the active context', async () => {
      prisma.inventoryMovement.findUnique.mockResolvedValue(movement({ companyId: 'c2' }));
      await expect(service.postMovementWithinTransaction(prisma, 'm1', 'u1', ctx)).rejects.toThrow(NotFoundException);
    });

    it('applies OUT deltas to the balance using Decimal arithmetic for quantityBase', async () => {
      prisma.inventoryMovement.findUnique.mockResolvedValue(movement({ lines: [line(outLine)] }));
      prisma.inventoryBalance.findFirst.mockResolvedValue({ id: 'bal1', warehouseId: 'w1', productId: 'prd1', quantity: 20 });
      prisma.inventoryBalance.update.mockResolvedValue({ id: 'bal1', quantity: 15 });

      await service.postMovementWithinTransaction(prisma, 'm1', 'u1', ctx);

      const balanceCall = prisma.inventoryBalance.update.mock.calls[0][0];
      expect(balanceCall.where).toEqual({ id: 'bal1' });
      expect(balanceCall.data.quantity).toBe(15);
      expect(Number(balanceCall.data.quantityBase)).toBe(15);
      expect(prisma.inventoryMovement.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'POSTED', postedById: 'u1' }),
        }),
      );
    });

    it('keeps the balance Decimal-safe for fractional quantities', async () => {
      prisma.inventoryMovement.findUnique.mockResolvedValue(
        movement({ lines: [line({ quantity: 0.3333, quantityBase: 0.3333 })] }),
      );
      prisma.inventoryBalance.findFirst.mockResolvedValue({ id: 'bal1', warehouseId: 'w1', productId: 'prd1', quantity: 10 });
      prisma.inventoryBalance.update.mockResolvedValue({ id: 'bal1', quantity: 10.3333 });

      await service.postMovementWithinTransaction(prisma, 'm1', 'u1', ctx);

      const balanceCall = prisma.inventoryBalance.update.mock.calls[0][0];
      expect(Number(balanceCall.data.quantityBase)).toBeCloseTo(10.3333, 4);
    });

    it('creates a balance row when none exists and applies the delta', async () => {
      prisma.inventoryMovement.findUnique.mockResolvedValue(movement({ lines: [line(outLine)] }));
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
      prisma.inventoryMovement.findUnique.mockResolvedValue(movement({ lines: [line(outLine)] }));
      prisma.inventoryBalance.findFirst.mockResolvedValue({ id: 'bal1', warehouseId: 'w1', productId: 'prd1', quantity: 3 });
      prisma.product.findUnique.mockResolvedValue({ id: 'prd1', name: 'Material' });

      await expect(service.postMovementWithinTransaction(prisma, 'm1', 'u1', ctx)).rejects.toThrow(BadRequestException);
      expect(prisma.inventoryBalance.update).not.toHaveBeenCalled();
      expect(prisma.inventoryMovement.update).not.toHaveBeenCalled();
    });

    it('rejects a line location that belongs to another warehouse', async () => {
      prisma.inventoryMovement.findUnique.mockResolvedValue(
        movement({ lines: [line({ warehouseLocationId: 'locX' })] }),
      );
      prisma.warehouseLocation.findUnique.mockResolvedValue({ id: 'locX', warehouseId: 'wOther' });

      const promise = service.postMovementWithinTransaction(prisma, 'm1', 'u1', ctx);
      await expect(promise).rejects.toThrow(BadRequestException);
      expect(prisma.inventoryBalance.findFirst).not.toHaveBeenCalled();
      expect(prisma.inventoryMovement.update).not.toHaveBeenCalled();
    });

    it('rejects posting a movement that is not DRAFT', async () => {
      prisma.inventoryMovement.findUnique.mockResolvedValue(movement({ status: 'POSTED', lines: [line(outLine)] }));
      await expect(service.postMovementWithinTransaction(prisma, 'm1', 'u1', ctx)).rejects.toThrow(BadRequestException);
    });
  });
});
