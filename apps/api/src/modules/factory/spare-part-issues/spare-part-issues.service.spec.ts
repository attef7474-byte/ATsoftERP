import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { SparePartIssuesService } from './spare-part-issues.service';

const ctxA: any = { companyId: 'c1', branchId: 'b1' };
const ctxB: any = { companyId: 'c2', branchId: 'b2' };

const warehouse = (overrides: Record<string, any> = {}) => ({
  id: 'wh1',
  companyId: 'c1',
  branchId: 'b1',
  code: 'SP-WH',
  name: 'Spare Parts Warehouse',
  warehouseType: 'SPARE_PART',
  ...overrides,
});

const sparePart = (overrides: Record<string, any> = {}) => ({
  id: 'sp1',
  code: 'SP-1',
  name: 'Bearing',
  productId: 'prod1',
  product: { id: 'prod1', code: 'P-1', name: 'Bearing Product', status: 'ACTIVE', deletedAt: null },
  ...overrides,
});

const issue = (overrides: Record<string, any> = {}) => ({
  id: 'spi1',
  companyId: 'c1',
  branchId: 'b1',
  issueNumber: 'SPI-000001',
  issueWarehouseId: 'wh1',
  status: 'DRAFT',
  movementId: 'mov1',
  movementNumber: 'IM-000001',
  sourceType: 'MANUAL',
  requestId: 'req-spi-1',
  purpose: 'Routine replacement',
  notes: null,
  issueDate: new Date('2026-03-01T10:00:00Z'),
  submittedAt: null,
  submittedById: null,
  approvedAt: null,
  approvedById: null,
  rejectedAt: null,
  rejectedById: null,
  rejectionReason: null,
  withdrawnAt: null,
  withdrawnById: null,
  approvalCancelledAt: null,
  approvalCancelledById: null,
  approvalCancellationReason: null,
  postedAt: null,
  postedById: null,
  cancelledAt: null,
  cancelledById: null,
  createdById: 'u1',
  createdAt: new Date('2026-03-01T09:00:00Z'),
  lines: [{ id: 'line1', issueId: 'spi1', sparePartId: 'sp1', productId: 'prod1', quantity: 5, unit: 'PC' }],
  ...overrides,
});

const baseDto = (overrides: Record<string, any> = {}) => ({
  issueWarehouseId: 'wh1',
  requestId: 'req-spi-1',
  lines: [{ sparePartId: 'sp1', quantity: 5, unit: 'PC' }],
  ...overrides,
});

function makeService(overrides: Record<string, any> = {}) {
  const prisma: any = {
    sparePartIssue: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      count: jest.fn(),
    },
    sparePartIssueLine: { deleteMany: jest.fn(), createMany: jest.fn(), findMany: jest.fn().mockResolvedValue([]) },
    inventoryMovement: { create: jest.fn(), update: jest.fn(), findUnique: jest.fn() },
    inventoryMovementLine: { deleteMany: jest.fn(), createMany: jest.fn() },
    // No balance dependency is allowed at DRAFT creation. These mocks exist only
    // so the tests can PROVE the service never touches them.
    inventoryBalance: {
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn(),
      update: jest.fn(),
      upsert: jest.fn(),
      deleteMany: jest.fn(),
    },
    warehouse: { findUnique: jest.fn() },
    warehouseLocation: { findUnique: jest.fn() },
    sparePart: { findMany: jest.fn() },
    user: { findMany: jest.fn().mockResolvedValue([]) },
    ...overrides,
  };
  prisma.$transaction = jest.fn(async (cb: any) => cb(prisma));
  const audit: any = { log: jest.fn(), logWithClient: jest.fn() };
  const numbering: any = {
    generateNumberAtomicWithClient: jest
      .fn()
      .mockImplementation(async (code: string) => (code === 'SPARE_PART_ISSUE' ? 'SPI-000001' : 'IM-000001')),
  };
  const movements: any = {
    postMovementWithinTransaction: jest.fn().mockResolvedValue({}),
    resolveMovementLines: jest.fn(async (_tx: any, lines: any[]) =>
      lines.map((line) => ({ ...line, quantityBase: line.quantityBase ?? line.quantity }))),
  };
  const service = new SparePartIssuesService(prisma, audit, numbering, movements);
  return { prisma, audit, numbering, movements, service };
}

function primeCreate(prisma: any, created: any = issue()) {
  prisma.warehouse.findUnique.mockResolvedValue(warehouse());
  prisma.sparePart.findMany.mockResolvedValue([sparePart()]);
  prisma.inventoryMovement.create.mockResolvedValue({ id: 'mov1', movementNumber: 'IM-000001' });
  prisma.sparePartIssue.create.mockResolvedValue(created);
  prisma.sparePartIssue.update.mockResolvedValue(created);
}

describe('SparePartIssuesService (standalone voucher authority)', () => {
  describe('tenant isolation and reads', () => {
    it('company B cannot find company A\'s issue by id', async () => {
      const { prisma, service } = makeService();
      prisma.sparePartIssue.findFirst.mockResolvedValue(null);

      await expect(service.findOne('spi1', ctxB)).rejects.toThrow(NotFoundException);
      expect(prisma.sparePartIssue.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'spi1', companyId: 'c2', branchId: 'b2' } }),
      );
    });

    it('scopes the paginated list and resolves actor names in one user lookup', async () => {
      const { prisma, service } = makeService();
      prisma.sparePartIssue.findMany.mockResolvedValue([issue()]);
      prisma.sparePartIssue.count.mockResolvedValue(1);
      prisma.user.findMany.mockResolvedValue([{ id: 'u1', name: 'Requester' }]);

      const result = await service.findAll({ page: 1, limit: 20 } as any, ctxA);

      expect(prisma.sparePartIssue.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { companyId: 'c1', branchId: 'b1' } }),
      );
      expect(result.meta).toMatchObject({ page: 1, limit: 20, total: 1 });
      expect(result.data[0].actorNames).toEqual({ u1: 'Requester' });
      expect(prisma.user.findMany).toHaveBeenCalledTimes(1);
    });
  });

  describe('create validation', () => {
    it('rejects a warehouse belonging to another company', async () => {
      const { prisma, service } = makeService();
      prisma.sparePartIssue.findFirst.mockResolvedValue(null);
      prisma.warehouse.findUnique.mockResolvedValue(warehouse({ companyId: 'c2' }));

      await expect(service.create(baseDto(), 'u1', ctxA)).rejects.toMatchObject({
        response: { messageKey: 'sparePartIssue.warehouseTenantMismatch' },
      });
    });

    it('rejects a warehouse belonging to another branch', async () => {
      const { prisma, service } = makeService();
      prisma.sparePartIssue.findFirst.mockResolvedValue(null);
      prisma.warehouse.findUnique.mockResolvedValue(warehouse({ branchId: 'b2' }));

      await expect(service.create(baseDto(), 'u1', ctxA)).rejects.toMatchObject({
        response: { messageKey: 'sparePartIssue.warehouseBranchMismatch' },
      });
    });

    it('rejects a PRODUCT warehouse as the wrong issue classification', async () => {
      const { prisma, service } = makeService();
      prisma.sparePartIssue.findFirst.mockResolvedValue(null);
      prisma.warehouse.findUnique.mockResolvedValue(warehouse({ warehouseType: 'PRODUCT' }));

      await expect(service.create(baseDto(), 'u1', ctxA)).rejects.toMatchObject({
        response: { messageKey: 'inventory.issueVoucher.invalidSelection' },
      });
    });

    it('rejects a spare part without a linked ACTIVE Product', async () => {
      const { prisma, service } = makeService();
      prisma.sparePartIssue.findFirst.mockResolvedValue(null);
      prisma.warehouse.findUnique.mockResolvedValue(warehouse());
      prisma.sparePart.findMany.mockResolvedValue([
        sparePart({ product: { id: 'prod1', code: 'P-1', name: 'Bearing', status: 'INACTIVE', deletedAt: null } }),
      ]);

      await expect(service.create(baseDto(), 'u1', ctxA)).rejects.toThrow(NotFoundException);
      expect(prisma.inventoryMovement.create).not.toHaveBeenCalled();
      expect(prisma.sparePartIssue.create).not.toHaveBeenCalled();
    });

    it('rejects a client-supplied productId that differs from the canonical spare-part link', async () => {
      const { prisma, service } = makeService();
      prisma.sparePartIssue.findFirst.mockResolvedValue(null);
      prisma.warehouse.findUnique.mockResolvedValue(warehouse());
      prisma.sparePart.findMany.mockResolvedValue([sparePart()]);

      await expect(
        service.create(baseDto({ lines: [{ sparePartId: 'sp1', productId: 'prod-other', quantity: 1, unit: 'PC' }] }), 'u1', ctxA),
      ).rejects.toMatchObject({ response: { messageKey: 'inventory.issueVoucher.invalidSelection' } });
      expect(prisma.inventoryMovement.create).not.toHaveBeenCalled();
    });

    it('rejects a foreign warehouse location', async () => {
      const { prisma, service } = makeService();
      prisma.sparePartIssue.findFirst.mockResolvedValue(null);
      prisma.warehouse.findUnique.mockResolvedValue(warehouse());
      prisma.sparePart.findMany.mockResolvedValue([sparePart()]);
      prisma.warehouseLocation.findUnique.mockResolvedValue({ id: 'loc1', warehouseId: 'wh-other' });

      await expect(
        service.create(baseDto({ lines: [{ sparePartId: 'sp1', quantity: 1, unit: 'PC', warehouseLocationId: 'loc1' }] }), 'u1', ctxA),
      ).rejects.toMatchObject({ response: { messageKey: 'sparePartIssue.locationWarehouseMismatch' } });
      expect(prisma.inventoryMovement.create).not.toHaveBeenCalled();
    });

    it('rejects duplicate stock-identity lines', async () => {
      const { prisma, service } = makeService();
      prisma.sparePartIssue.findFirst.mockResolvedValue(null);
      primeCreate(prisma);
      const line = { sparePartId: 'sp1', quantity: 1, unit: 'PC', batchNumber: 'B1' };

      await expect(service.create(baseDto({ lines: [line, { ...line }] }), 'u1', ctxA)).rejects.toMatchObject({
        response: { messageKey: 'inventory.issueVoucher.invalidSelection' },
      });
      expect(prisma.inventoryMovement.create).not.toHaveBeenCalled();
    });
  });

  describe('create writing path', () => {
    it('creates one DRAFT issue and all multi-line DRAFT OUT movement lines', async () => {
      const { prisma, service, audit, numbering } = makeService();
      prisma.sparePartIssue.findFirst.mockResolvedValue(null);
      primeCreate(prisma);
      prisma.sparePart.findMany.mockResolvedValue([
        sparePart(),
        sparePart({ id: 'sp2', code: 'SP-2', name: 'Seal', productId: 'prod2', product: { id: 'prod2', code: 'P-2', name: 'Seal Product', status: 'ACTIVE', deletedAt: null } }),
      ]);

      await service.create(baseDto({
        requestId: undefined,
        lines: [
          { sparePartId: 'sp1', quantity: 5, unit: 'PC' },
          { sparePartId: 'sp2', quantity: 2, unit: 'PC', productUomId: 'uom-box' },
        ],
      }), 'u1', ctxA);

      const movementData = prisma.inventoryMovement.create.mock.calls[0][0].data;
      expect(movementData).toMatchObject({
        companyId: 'c1',
        branchId: 'b1',
        warehouseId: 'wh1',
        movementType: 'SPARE_PART_ISSUE',
        sourceType: 'SPARE_PART_ISSUE',
        status: 'DRAFT',
      });
      expect(movementData.lines.create).toHaveLength(2);
      expect(movementData.lines.create).toEqual([
        expect.objectContaining({ productId: 'prod1', direction: 'OUT', quantity: 5, productUomId: null }),
        expect.objectContaining({ productId: 'prod2', direction: 'OUT', quantity: 2, productUomId: 'uom-box' }),
      ]);

      const issueData = prisma.sparePartIssue.create.mock.calls[0][0].data;
      expect(issueData).toMatchObject({
        companyId: 'c1', branchId: 'b1', issueWarehouseId: 'wh1', status: 'DRAFT', sourceType: 'MANUAL',
      });
      expect(issueData.lines.create).toHaveLength(2);
      expect(issueData.lines.create[0]).toMatchObject({
        sparePartId: 'sp1', productId: 'prod1', sparePartCodeSnapshot: 'SP-1', productCodeSnapshot: 'P-1', productUomId: null,
      });
      expect(issueData.lines.create[1]).toMatchObject({ sparePartId: 'sp2', productId: 'prod2', productUomId: 'uom-box' });
      expect(numbering.generateNumberAtomicWithClient).toHaveBeenCalledWith('SPARE_PART_ISSUE', expect.anything());
      expect(numbering.generateNumberAtomicWithClient).toHaveBeenCalledWith('INVENTORY_MOVEMENT', expect.anything());
      expect(audit.logWithClient).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ action: 'CREATE', entity: 'SparePartIssue', entityId: 'spi1' }),
      );
    });

    it('allows a zero/no-balance DRAFT and never queries or mutates InventoryBalance', async () => {
      const { prisma, service } = makeService();
      prisma.sparePartIssue.findFirst.mockResolvedValue(null);
      primeCreate(prisma);
      prisma.inventoryBalance.findFirst.mockResolvedValue(null);

      const result = await service.create(baseDto({ requestId: undefined }), 'u1', ctxA);

      expect(result.status).toBe('DRAFT');
      expect(prisma.inventoryBalance.findFirst).not.toHaveBeenCalled();
      expect(prisma.inventoryBalance.create).not.toHaveBeenCalled();
      expect(prisma.inventoryBalance.update).not.toHaveBeenCalled();
      expect(prisma.inventoryBalance.upsert).not.toHaveBeenCalled();
      expect(prisma.inventoryBalance.deleteMany).not.toHaveBeenCalled();
    });

    it('returns the existing issue for a repeated requestId (idempotency)', async () => {
      const { prisma, service } = makeService();
      prisma.sparePartIssue.findFirst.mockResolvedValueOnce(issue());

      await expect(service.create(baseDto(), 'u1', ctxA)).resolves.toMatchObject({ id: 'spi1' });
      expect(prisma.$transaction).not.toHaveBeenCalled();
      expect(prisma.sparePartIssue.create).not.toHaveBeenCalled();
    });

    it('turns a unique-index race into a duplicate-request conflict unless the request is already persisted', async () => {
      const { prisma, service } = makeService();
      primeCreate(prisma);
      prisma.sparePartIssue.findFirst.mockResolvedValue(null);
      prisma.sparePartIssue.create.mockRejectedValue({ code: 'P2002' });

      await expect(service.create(baseDto(), 'u1', ctxA)).rejects.toMatchObject({
        response: { messageKey: 'sparePartIssue.duplicateRequest' },
      });
    });
  });

  describe('update and transitions', () => {
    it('only edits DRAFT issues', async () => {
      const { prisma, service } = makeService();
      prisma.sparePartIssue.findFirst.mockResolvedValue(issue({ status: 'APPROVED' }));

      await expect(service.update('spi1', { notes: 'x' } as any, 'u1', ctxA)).rejects.toMatchObject({
        response: { messageKey: 'sparePartIssue.notDraft' },
      });
    });

    it('submits a DRAFT issue and stamps the requester', async () => {
      const { prisma, service } = makeService();
      prisma.sparePartIssue.findFirst
        .mockResolvedValueOnce(issue())
        .mockResolvedValueOnce(issue())
        .mockResolvedValueOnce(issue({ status: 'SUBMITTED', submittedById: 'u1' }));

      const result = await service.submit('spi1', 'u1', ctxA);
      expect(result.status).toBe('SUBMITTED');
      expect(prisma.sparePartIssue.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'spi1', companyId: 'c1', branchId: 'b1', status: { in: ['DRAFT'] } },
          data: expect.objectContaining({ status: 'SUBMITTED', submittedById: 'u1' }),
        }),
      );
    });

    it('refuses invalid transitions', async () => {
      const { prisma, service } = makeService();
      prisma.sparePartIssue.findFirst.mockResolvedValue(issue({ status: 'APPROVED' }));

      await expect(service.submit('spi1', 'u1', ctxA)).rejects.toMatchObject({
        response: { messageKey: 'sparePartIssue.notDraft' },
      });
      await expect(service.reject('spi1', { reason: 'x' }, 'mgr', ctxA)).rejects.toMatchObject({
        response: { messageKey: 'sparePartIssue.notSubmitted' },
      });
    });

    it('blocks self-approval and withdrawal by another user (separation of duties)', async () => {
      const { prisma, service } = makeService();
      prisma.sparePartIssue.findFirst.mockResolvedValue(issue({ status: 'SUBMITTED', submittedById: 'u1' }));

      await expect(service.approve('spi1', 'u1', ctxA)).rejects.toMatchObject({
        response: { messageKey: 'sparePartIssue.cannotApproveOwnRequest' },
      });
      await expect(service.withdraw('spi1', {}, 'someone-else', ctxA)).rejects.toThrow(ForbiddenException);
    });

    it('turns a concurrent transition race into a ConflictException', async () => {
      const { prisma, service } = makeService();
      prisma.sparePartIssue.findFirst.mockResolvedValue(issue());
      prisma.sparePartIssue.updateMany.mockResolvedValue({ count: 0 });

      await expect(service.submit('spi1', 'u1', ctxA)).rejects.toThrow(ConflictException);
    });

    it('approves with a different warehouse actor and cancels that approval with a reason', async () => {
      const { prisma, service } = makeService();
      prisma.sparePartIssue.findFirst
        .mockResolvedValueOnce(issue({ status: 'SUBMITTED', submittedById: 'u1' }))
        .mockResolvedValueOnce(issue({ status: 'SUBMITTED', submittedById: 'u1' }))
        .mockResolvedValueOnce(issue({ status: 'APPROVED', approvedById: 'mgr' }))
        .mockResolvedValueOnce(issue({ status: 'APPROVED', approvedById: 'mgr' }))
        .mockResolvedValueOnce(issue({ status: 'APPROVED', approvedById: 'mgr' }))
        .mockResolvedValueOnce(issue({ status: 'SUBMITTED' }));

      const approved = await service.approve('spi1', 'mgr', ctxA);
      expect(approved.status).toBe('APPROVED');
      const cancelled = await service.cancelApproval('spi1', { reason: 'recount' }, 'mgr', ctxA);
      expect(cancelled.status).toBe('SUBMITTED');
      expect(prisma.sparePartIssue.updateMany).toHaveBeenLastCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: { in: ['APPROVED'] } }),
          data: expect.objectContaining({ status: 'SUBMITTED', approvalCancellationReason: 'recount' }),
        }),
      );
    });
  });

  describe('post (the only physical stock authority path)', () => {
    it('refuses to post anything that is not APPROVED', async () => {
      const { prisma, service, movements } = makeService();
      prisma.sparePartIssue.findFirst.mockResolvedValue(issue({ status: 'SUBMITTED' }));

      await expect(service.post('spi1', 'mgr', ctxA)).rejects.toMatchObject({
        response: { messageKey: 'sparePartIssue.notApproved' },
      });
      expect(movements.postMovementWithinTransaction).not.toHaveBeenCalled();
    });

    it('delegates to postMovementWithinTransaction and never writes InventoryBalance', async () => {
      const { prisma, service, movements } = makeService();
      prisma.sparePartIssue.findFirst.mockResolvedValue(issue({ status: 'APPROVED' }));
      prisma.sparePartIssue.update.mockResolvedValue(issue({ status: 'POSTED' }));

      const result = await service.post('spi1', 'mgr', ctxA);

      expect(movements.postMovementWithinTransaction).toHaveBeenCalledWith(expect.anything(), 'mov1', 'mgr', ctxA);
      expect(result.status).toBe('POSTED');
      expect(prisma.sparePartIssue.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: 'POSTED', postedById: 'mgr' }) }),
      );
      expect(prisma.inventoryBalance.findFirst).not.toHaveBeenCalled();
      expect(prisma.inventoryBalance.update).not.toHaveBeenCalled();
      expect(prisma.inventoryBalance.create).not.toHaveBeenCalled();
    });

    it('a failure after movement posting aborts the whole transaction: status stays APPROVED, no success reported', async () => {
      const { prisma, service, audit } = makeService();
      prisma.sparePartIssue.findFirst.mockResolvedValue(issue({ status: 'APPROVED' }));
      prisma.sparePartIssue.update.mockRejectedValue(new Error('transient follow-up failure'));

      await expect(service.post('spi1', 'mgr', ctxA)).rejects.toThrow('transient follow-up failure');
      expect(audit.logWithClient).not.toHaveBeenCalled();
      expect(prisma.sparePartIssue.update.mock.calls[0][0].data.status).toBe('POSTED');
    });
  });

  describe('cancel', () => {
    it.each(['DRAFT', 'SUBMITTED', 'REJECTED'])('cancels a %s issue and its DRAFT movement', async (status) => {
      const { prisma, service } = makeService();
      prisma.sparePartIssue.findFirst
        .mockResolvedValueOnce(issue({ status }))
        .mockResolvedValueOnce(issue({ status: 'CANCELLED' }));
      prisma.inventoryMovement.findUnique.mockResolvedValue({ id: 'mov1', status: 'DRAFT' });

      const result = await service.cancel('spi1', { reason: 'no longer needed' }, 'u1', ctxA);

      expect(result.status).toBe('CANCELLED');
      expect(prisma.inventoryMovement.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'mov1' }, data: expect.objectContaining({ status: 'CANCELLED' }) }),
      );
    });

    it.each(['APPROVED', 'POSTED', 'CANCELLED'])('refuses to cancel an %s issue', async (status) => {
      const { prisma, service } = makeService();
      prisma.sparePartIssue.findFirst.mockResolvedValue(issue({ status }));

      await expect(service.cancel('spi1', { reason: 'x' }, 'u1', ctxA)).rejects.toMatchObject({
        response: { messageKey: 'sparePartIssue.invalidTransition' },
      });
    });
  });
});
