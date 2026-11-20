import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { CreateGeneralInventoryIssueDto } from './dto/general-inventory-issue.dto';
import { GeneralInventoryIssuesService } from './general-inventory-issues.service';

const ctxA: any = { companyId: 'c1', branchId: 'b1' };
const ctxB: any = { companyId: 'c2', branchId: 'b2' };

const warehouse = (overrides: Record<string, any> = {}) => ({
  id: 'wh1',
  companyId: 'c1',
  branchId: 'b1',
  code: 'GEN-WH',
  name: 'General Warehouse',
  status: 'ACTIVE',
  deletedAt: null,
  ...overrides,
});

const product = (overrides: Record<string, any> = {}) => ({
  id: 'prod1',
  code: 'CONS-1',
  name: 'Consumable 1',
  itemType: 'GENERAL',
  status: 'ACTIVE',
  deletedAt: null,
  ...overrides,
});

const issue = (overrides: Record<string, any> = {}) => ({
  id: 'gii1',
  companyId: 'c1',
  branchId: 'b1',
  issueNumber: 'GIS-000001',
  issueType: 'GENERAL',
  issueWarehouseId: 'wh1',
  status: 'DRAFT',
  movementId: 'mov1',
  movementNumber: 'IM-000001',
  sourceType: 'MANUAL',
  requestId: 'req-gii-1',
  purpose: 'Daily consumption',
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
  reversesIssueId: null,
  createdById: 'u1',
  createdAt: new Date('2026-03-01T09:00:00Z'),
  lines: [
    {
      id: 'line1',
      issueId: 'gii1',
      productId: 'prod1',
      quantity: 5,
      unit: 'PC',
      productCodeSnapshot: 'CONS-1',
      productNameSnapshot: 'Consumable 1',
      productUomId: null,
      enteredUnitId: null,
      product: { id: 'prod1', code: 'CONS-1', name: 'Consumable 1' },
      warehouseLocation: null,
    },
  ],
  ...overrides,
});

const baseDto = (overrides: Record<string, any> = {}): CreateGeneralInventoryIssueDto => ({
  issueWarehouseId: 'wh1',
  issueType: 'GENERAL' as const,
  requestId: 'req-gii-1',
  lines: [{ productId: 'prod1', quantity: 5, unit: 'PC' }],
  ...overrides,
} as CreateGeneralInventoryIssueDto);

function makeService(overrides: Record<string, any> = {}) {
  const prisma: any = {
    generalInventoryIssue: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      count: jest.fn(),
    },
    generalInventoryIssueLine: {
      deleteMany: jest.fn(),
      createMany: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
      update: jest.fn(),
    },
    inventoryMovement: {
      create: jest.fn(),
      update: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    inventoryMovementLine: {
      deleteMany: jest.fn(),
      createMany: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
    },
    // Balance mocks exist so tests can prove no code path writes stock directly.
    inventoryBalance: {
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn(),
      update: jest.fn(),
      upsert: jest.fn(),
      deleteMany: jest.fn(),
    },
    warehouse: { findUnique: jest.fn(), findFirst: jest.fn() },
    warehouseLocation: { findUnique: jest.fn(), findFirst: jest.fn() },
    product: { findMany: jest.fn() },
    productUom: { findUnique: jest.fn(), findFirst: jest.fn() },
    user: { findMany: jest.fn().mockResolvedValue([]) },
    ...overrides,
  };
  prisma.$transaction = jest.fn(async (cb: any) => cb(prisma));
  const audit: any = { log: jest.fn(), logWithClient: jest.fn() };
  const numbering: any = {
    generateNumberAtomicWithClient: jest
      .fn()
      .mockImplementation(async (code: string) =>
        code === 'GENERAL_INVENTORY_ISSUE' ? 'GIS-000001' : 'IM-000001',
      ),
  };
  const movements: any = {
    postMovementWithinTransaction: jest.fn().mockResolvedValue({}),
    postGeneralIssueReversalMovementWithinTransaction: jest.fn().mockResolvedValue({}),
    resolveMovementLines: jest.fn(async (_tx: any, lines: any[]) =>
      lines.map((l) => ({
        ...l,
        quantityBase: l.quantityBase ?? l.quantity,
        productUomId: l.productUomId ?? null,
        enteredUnitId: l.enteredUnitId ?? null,
      })),
    ),
  };
  const service = new GeneralInventoryIssuesService(prisma, audit, numbering, movements);
  return { prisma, audit, numbering, movements, service };
}

/** Mocks the happy-path dependency lookups used by create/reverse. */
function primeCreate(prisma: any, created: any = issue()) {
  prisma.warehouse.findUnique.mockResolvedValue(warehouse());
  prisma.warehouse.findFirst.mockResolvedValue(warehouse());
  prisma.product.findMany.mockResolvedValue([product()]);
  prisma.inventoryMovement.create.mockResolvedValue({ id: 'mov1', movementNumber: 'IM-000001' });
  prisma.generalInventoryIssue.create.mockResolvedValue(created);
  prisma.generalInventoryIssue.update.mockResolvedValue(created);
}

describe('GeneralInventoryIssuesService', () => {
  describe('tenant isolation', () => {
    it('rejects reading an issue from another company/branch and asserts the scoped where', async () => {
      const { prisma, service } = makeService();
      prisma.generalInventoryIssue.findFirst.mockResolvedValue(null);

      await expect(service.findOne('gii1', ctxB)).rejects.toThrow(NotFoundException);
      expect(prisma.generalInventoryIssue.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'gii1', companyId: 'c2', branchId: 'b2' } }),
      );
    });

    it('scopes list queries to the active company and branch', async () => {
      const { prisma, service } = makeService();
      prisma.generalInventoryIssue.findMany.mockResolvedValue([]);
      prisma.generalInventoryIssue.count.mockResolvedValue(0);

      await service.findAll({ page: 1, limit: 20 } as any, ctxA);

      expect(prisma.generalInventoryIssue.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { companyId: 'c1', branchId: 'b1' } }),
      );
      expect(prisma.generalInventoryIssue.count).toHaveBeenCalledWith(
        expect.objectContaining({ where: { companyId: 'c1', branchId: 'b1' } }),
      );
    });

    it('rejects a missing active operational context', async () => {
      const { service } = makeService();
      await expect(service.findAll({} as any, { companyId: 'c1', branchId: null } as any)).rejects.toThrow(BadRequestException);
    });
  });

  describe('create', () => {
    it('returns the existing issue when the requestId already produced one (idempotency)', async () => {
      const { prisma, service } = makeService();
      prisma.generalInventoryIssue.findFirst.mockResolvedValueOnce(issue());

      await expect(service.create(baseDto(), 'u1', ctxA)).resolves.toMatchObject({ id: 'gii1' });
      expect(prisma.$transaction).not.toHaveBeenCalled();
      expect(prisma.generalInventoryIssue.create).not.toHaveBeenCalled();
    });

    it('creates a DRAFT OUT issue with a linked DRAFT movement using the canonical source and movement type', async () => {
      const { prisma, movements, service } = makeService();
      prisma.generalInventoryIssue.findFirst.mockResolvedValue(null);
      primeCreate(prisma);

      const result = await service.create(baseDto(), 'u1', ctxA);

      expect(result.id).toBe('gii1');
      const movementData = prisma.inventoryMovement.create.mock.calls[0][0].data;
      expect(movementData).toMatchObject({
        companyId: 'c1',
        branchId: 'b1',
        warehouseId: 'wh1',
        movementType: 'GENERAL_INVENTORY_ISSUE',
        status: 'DRAFT',
        sourceType: 'GENERAL_INVENTORY_ISSUE',
      });
      expect(movementData.lines.create[0]).toMatchObject({ productId: 'prod1', direction: 'OUT' });

      const issueData = prisma.generalInventoryIssue.create.mock.calls[0][0].data;
      expect(issueData).toMatchObject({
        companyId: 'c1',
        branchId: 'b1',
        issueType: 'GENERAL',
        issueWarehouseId: 'wh1',
        status: 'DRAFT',
        sourceType: 'MANUAL',
        requestId: 'req-gii-1',
      });
      expect(movements.postMovementWithinTransaction).not.toHaveBeenCalled();
    });

    it('scopes the warehouse lookup to the active company and branch', async () => {
      const { prisma, service } = makeService();
      prisma.generalInventoryIssue.findFirst.mockResolvedValue(null);
      prisma.warehouse.findFirst.mockResolvedValue(null);

      await expect(service.create(baseDto(), 'u1', ctxA)).rejects.toThrow(NotFoundException);
      expect(prisma.warehouse.findFirst).toHaveBeenCalledWith({
        where: {
          id: 'wh1',
          companyId: 'c1',
          OR: [{ branchId: 'b1' }, { branchId: null }],
        },
      });
      expect(prisma.inventoryMovement.create).not.toHaveBeenCalled();
    });

    it('rejects a warehouse from an unreachable branch context', async () => {
      const { prisma, service } = makeService();
      prisma.generalInventoryIssue.findFirst.mockResolvedValue(null);
      prisma.warehouse.findFirst.mockResolvedValue(null);

      await expect(service.create(baseDto(), 'u1', ctxB)).rejects.toThrow(NotFoundException);
      expect(prisma.warehouse.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ companyId: 'c2', OR: [{ branchId: 'b2' }, { branchId: null }] }),
        }),
      );
    });

    it('rejects an inactive warehouse', async () => {
      const { prisma, service } = makeService();
      prisma.generalInventoryIssue.findFirst.mockResolvedValue(null);
      prisma.warehouse.findFirst.mockResolvedValue(warehouse({ status: 'INACTIVE' }));

      await expect(service.create(baseDto(), 'u1', ctxA)).rejects.toThrow(BadRequestException);
    });

    it.each(['CONSUMABLE', 'PACKAGING_MATERIAL', 'GENERAL'])('accepts an exact owned item type %s', async (itemType) => {
      const { prisma, service } = makeService();
      prisma.generalInventoryIssue.findFirst.mockResolvedValue(null);
      primeCreate(prisma);
      prisma.product.findMany.mockResolvedValue([product({ itemType })]);

      await expect(service.create(baseDto({ issueType: itemType }), 'u1', ctxA)).resolves.toMatchObject({ id: 'gii1' });
    });

    it.each([
      ['a mismatched item type', 'SPARE_PART'],
      ['a null/unclassified item type', null],
      ['an unclassified finished-good product', 'FINISHED_GOOD'],
    ])('rejects %s', async (_label, itemType) => {
      const { prisma, service } = makeService();
      prisma.generalInventoryIssue.findFirst.mockResolvedValue(null);
      primeCreate(prisma);
      prisma.product.findMany.mockResolvedValue([product({ itemType })]);

      await expect(service.create(baseDto(), 'u1', ctxA)).rejects.toMatchObject({
        response: { messageKey: 'generalInventoryIssue.productTypeMismatch' },
      });
      expect(prisma.inventoryMovement.create).not.toHaveBeenCalled();
      expect(prisma.generalInventoryIssue.create).not.toHaveBeenCalled();
    });

    it('rejects a non-ACTIVE or deleted product', async () => {
      const { prisma, service } = makeService();
      prisma.generalInventoryIssue.findFirst.mockResolvedValue(null);
      primeCreate(prisma);
      prisma.product.findMany.mockResolvedValue([]); // the ACTIVE/not-deleted query returns no row

      await expect(service.create(baseDto(), 'u1', ctxA)).rejects.toThrow(NotFoundException);
      expect(prisma.inventoryMovement.create).not.toHaveBeenCalled();
    });

    it('scopes the location lookup to the issue warehouse and rejects inactive locations', async () => {
      const cases = [
        { label: 'foreign location', location: null, error: NotFoundException },
        { label: 'inactive location', location: { id: 'loc1', warehouseId: 'wh1', status: 'INACTIVE' }, error: BadRequestException },
      ];
      for (const testCase of cases) {
        const { prisma, service } = makeService();
        prisma.generalInventoryIssue.findFirst.mockResolvedValue(null);
        primeCreate(prisma);
        prisma.warehouseLocation.findFirst.mockResolvedValue(testCase.location);

        await expect(
          service.create(baseDto({ lines: [{ productId: 'prod1', quantity: 5, unit: 'PC', warehouseLocationId: 'loc1' }] }), 'u1', ctxA),
        ).rejects.toThrow(testCase.error);
        expect(prisma.warehouseLocation.findFirst).toHaveBeenCalledWith({
          where: { id: 'loc1', warehouseId: 'wh1' },
        });
      }
    });

    it('scopes the UOM lookup to the line product and rejects inactive UOMs', async () => {
      const cases = [
        { label: 'foreign UOM', uom: null, error: NotFoundException },
        { label: 'inactive UOM', uom: { id: 'uom1', productId: 'prod1', isActive: false }, error: BadRequestException },
      ];
      for (const testCase of cases) {
        const { prisma, service } = makeService();
        prisma.generalInventoryIssue.findFirst.mockResolvedValue(null);
        primeCreate(prisma);
        prisma.productUom.findFirst.mockResolvedValue(testCase.uom);

        await expect(
          service.create(baseDto({ lines: [{ productId: 'prod1', quantity: 5, unit: 'PC', productUomId: 'uom1' }] }), 'u1', ctxA),
        ).rejects.toThrow(testCase.error);
        expect(prisma.productUom.findFirst).toHaveBeenCalledWith({
          where: { id: 'uom1', productId: 'prod1' },
        });
      }
    });

    it('accepts an active UOM owned by the product', async () => {
      const { prisma, service } = makeService();
      prisma.generalInventoryIssue.findFirst.mockResolvedValue(null);
      primeCreate(prisma);
      prisma.productUom.findFirst.mockResolvedValue({ id: 'uom1', productId: 'prod1', isActive: true });

      await expect(
        service.create(baseDto({ lines: [{ productId: 'prod1', quantity: 5, unit: 'PC', productUomId: 'uom1' }] }), 'u1', ctxA),
      ).resolves.toMatchObject({ id: 'gii1' });
    });
  });

  describe('update', () => {
    it('only edits DRAFT issues', async () => {
      const { prisma, service } = makeService();
      prisma.generalInventoryIssue.findFirst.mockResolvedValue(issue({ status: 'SUBMITTED' }));

      await expect(service.update('gii1', { notes: 'x' } as any, 'u1', ctxA)).rejects.toThrow(BadRequestException);
    });

    it('atomically rebuilds DRAFT lines and DRAFT movement lines', async () => {
      const { prisma, movements, service } = makeService();
      prisma.generalInventoryIssue.findFirst.mockResolvedValue(issue({ status: 'DRAFT' }));
      prisma.warehouse.findFirst.mockResolvedValue(warehouse());
      prisma.product.findMany.mockResolvedValue([product()]);
      prisma.inventoryMovement.findFirst.mockResolvedValue({ id: 'mov1', status: 'DRAFT' });

      await service.update(
        'gii1',
        { lines: [{ productId: 'prod1', quantity: 3, unit: 'PC' }] } as any,
        'u1',
        ctxA,
      );

      expect(prisma.generalInventoryIssueLine.deleteMany).toHaveBeenCalledWith({ where: { issueId: 'gii1' } });
      expect(prisma.generalInventoryIssueLine.createMany).toHaveBeenCalledWith(
        expect.objectContaining({ data: [expect.objectContaining({ issueId: 'gii1', productId: 'prod1' })] }),
      );
      expect(prisma.inventoryMovementLine.deleteMany).toHaveBeenCalledWith({ where: { movementId: 'mov1' } });
      expect(prisma.inventoryMovementLine.createMany).toHaveBeenCalled();
      expect(prisma.inventoryMovement.updateMany).toHaveBeenCalledWith({
        where: { id: 'mov1', companyId: 'c1', branchId: 'b1', status: 'DRAFT' },
        data: { warehouseId: 'wh1' },
      });
      expect(movements.postMovementWithinTransaction).not.toHaveBeenCalled();
    });
  });

  describe('lifecycle', () => {
    it('lets the recorded requester withdraw a SUBMITTED issue back to DRAFT', async () => {
      const { prisma, service } = makeService();
      prisma.generalInventoryIssue.findFirst
        .mockResolvedValueOnce(issue({ status: 'SUBMITTED', submittedById: 'u1' }))
        .mockResolvedValueOnce(issue({ status: 'SUBMITTED', submittedById: 'u1' }))
        .mockResolvedValueOnce(issue({ status: 'DRAFT' }));

      const result = await service.withdraw('gii1', { reason: 'fix line' }, 'u1', ctxA);
      expect(result.status).toBe('DRAFT');
      expect(prisma.generalInventoryIssue.updateMany.mock.calls[0][0].data).toMatchObject({
        status: 'DRAFT',
        withdrawnById: 'u1',
        submittedById: null,
      });
    });

    it('blocks another user from withdrawing someone else\'s request', async () => {
      const { prisma, service } = makeService();
      prisma.generalInventoryIssue.findFirst.mockResolvedValue(issue({ status: 'SUBMITTED', submittedById: 'u1' }));
      await expect(service.withdraw('gii1', {}, 'u2', ctxA)).rejects.toThrow(ForbiddenException);
    });

    it('rejects self-approval', async () => {
      const { prisma, service, movements } = makeService();
      prisma.generalInventoryIssue.findFirst.mockResolvedValue(issue({ status: 'SUBMITTED', submittedById: 'u1' }));

      await expect(service.approve('gii1', 'u1', ctxA)).rejects.toThrow(BadRequestException);
      expect(movements.postMovementWithinTransaction).not.toHaveBeenCalled();
    });

    it('approves a SUBMITTED issue with a separate warehouse actor', async () => {
      const { prisma, service } = makeService();
      prisma.generalInventoryIssue.findFirst
        .mockResolvedValueOnce(issue({ status: 'SUBMITTED', submittedById: 'u1' }))
        .mockResolvedValueOnce(issue({ status: 'SUBMITTED', submittedById: 'u1' }))
        .mockResolvedValueOnce(issue({ status: 'APPROVED', approvedById: 'mgr' }));

      const result = await service.approve('gii1', 'mgr', ctxA);
      expect(result.status).toBe('APPROVED');
      expect(prisma.generalInventoryIssue.updateMany.mock.calls[0][0].data).toMatchObject({
        status: 'APPROVED',
        approvedById: 'mgr',
      });
    });

    it('requires a reason to reject and persists it', async () => {
      const { prisma, service } = makeService();
      prisma.generalInventoryIssue.findFirst.mockResolvedValue(issue({ status: 'SUBMITTED', submittedById: 'u1' }));

      await expect(service.reject('gii1', { reason: '   ' } as any, 'mgr', ctxA)).rejects.toThrow(BadRequestException);
    });

    it('rejects a SUBMITTED issue with a mandatory reason and a different actor', async () => {
      const { prisma, service } = makeService();
      prisma.generalInventoryIssue.findFirst
        .mockResolvedValueOnce(issue({ status: 'SUBMITTED', submittedById: 'u1' }))
        .mockResolvedValueOnce(issue({ status: 'SUBMITTED', submittedById: 'u1' }))
        .mockResolvedValueOnce(issue({ status: 'REJECTED', rejectionReason: 'no stock' }));

      const result = await service.reject('gii1', { reason: 'no stock' }, 'mgr', ctxA);
      expect(result.status).toBe('REJECTED');
      expect(prisma.generalInventoryIssue.updateMany.mock.calls[0][0].data).toMatchObject({
        status: 'REJECTED',
        rejectionReason: 'no stock',
        rejectedById: 'mgr',
      });
    });

    it('cancels a prior approval back to SUBMITTED', async () => {
      const { prisma, service } = makeService();
      prisma.generalInventoryIssue.findFirst
        .mockResolvedValueOnce(issue({ status: 'APPROVED', approvedById: 'mgr' }))
        .mockResolvedValueOnce(issue({ status: 'APPROVED', approvedById: 'mgr' }))
        .mockResolvedValueOnce(issue({ status: 'SUBMITTED' }));

      const result = await service.cancelApproval('gii1', { reason: 'recount' }, 'mgr', ctxA);
      expect(result.status).toBe('SUBMITTED');
      expect(prisma.generalInventoryIssue.updateMany.mock.calls[0][0].data).toMatchObject({
        status: 'SUBMITTED',
        approvalCancellationReason: 'recount',
        approvalCancelledById: 'mgr',
      });
    });

    it('turns a concurrent transition race into a ConflictException', async () => {
      const { prisma, service } = makeService();
      prisma.generalInventoryIssue.findFirst.mockResolvedValue(issue({ status: 'DRAFT' }));
      prisma.generalInventoryIssue.updateMany.mockResolvedValue({ count: 0 });

      await expect(service.submit('gii1', 'u1', ctxA)).rejects.toThrow(ConflictException);
    });
  });

  describe('post', () => {
    it('refuses to post an issue that is not APPROVED', async () => {
      const { prisma, service, movements } = makeService();
      prisma.generalInventoryIssue.findFirst.mockResolvedValue(issue({ status: 'SUBMITTED' }));

      await expect(service.post('gii1', 'mgr', ctxA)).rejects.toThrow(BadRequestException);
      expect(movements.postMovementWithinTransaction).not.toHaveBeenCalled();
    });

    it('posts only from APPROVED through the canonical movement contract', async () => {
      const { prisma, service, movements } = makeService();
      prisma.generalInventoryIssue.findFirst
        .mockResolvedValueOnce(issue({ status: 'APPROVED' }))
        .mockResolvedValueOnce(issue({ status: 'POSTED' }));

      const result = await service.post('gii1', 'mgr', ctxA);

      expect(movements.postMovementWithinTransaction).toHaveBeenCalledWith(expect.anything(), 'mov1', 'mgr', ctxA);
      expect(result.status).toBe('POSTED');
      expect(prisma.generalInventoryIssue.updateMany.mock.calls[0][0]).toMatchObject({
        where: { id: 'gii1', companyId: 'c1', branchId: 'b1', status: 'APPROVED' },
        data: { status: 'POSTED', postedById: 'mgr' },
      });
    });

    it('rejects a second post of an already POSTED issue', async () => {
      const { prisma, service, movements } = makeService();
      prisma.generalInventoryIssue.findFirst.mockResolvedValue(issue({ status: 'POSTED' }));

      await expect(service.post('gii1', 'mgr', ctxA)).rejects.toThrow(BadRequestException);
      expect(movements.postMovementWithinTransaction).not.toHaveBeenCalled();
    });

    it('posts a reversal through the trusted original-cost entrypoint', async () => {
      const { prisma, service, movements } = makeService();
      prisma.generalInventoryIssue.findFirst
        .mockResolvedValueOnce(issue({
          status: 'APPROVED',
          sourceType: 'REVERSE',
          reversesIssueId: 'gii-source',
        }))
        .mockResolvedValueOnce(issue({ status: 'POSTED', sourceType: 'REVERSE', reversesIssueId: 'gii-source' }));

      await service.post('gii1', 'mgr', ctxA);

      expect(movements.postGeneralIssueReversalMovementWithinTransaction).toHaveBeenCalledWith(
        expect.anything(), 'gii1', 'mov1', 'mgr', ctxA,
      );
      expect(movements.postMovementWithinTransaction).not.toHaveBeenCalled();
    });
  });

  describe('cancel', () => {
    it.each(['DRAFT', 'SUBMITTED', 'REJECTED'])('cancels a %s issue', async (status) => {
      const { prisma, service } = makeService();
      prisma.generalInventoryIssue.findFirst
        .mockResolvedValueOnce(issue({ status }))
        .mockResolvedValueOnce(issue({ status: 'CANCELLED' }));
      prisma.inventoryMovement.findFirst.mockResolvedValue({ id: 'mov1', status: 'DRAFT' });

      const result = await service.cancel('gii1', { reason: 'no longer needed' }, 'u1', ctxA);
      expect(result.status).toBe('CANCELLED');
      expect(prisma.inventoryMovement.findFirst).toHaveBeenCalledWith({
        where: { id: 'mov1', companyId: 'c1', branchId: 'b1' },
      });
      expect(prisma.inventoryMovement.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'mov1', companyId: 'c1', branchId: 'b1', status: 'DRAFT' },
        }),
      );
    });

    it.each(['APPROVED', 'POSTED', 'CANCELLED'])('refuses to cancel a %s issue', async (status) => {
      const { prisma, service } = makeService();
      prisma.generalInventoryIssue.findFirst.mockResolvedValue(issue({ status }));
      await expect(service.cancel('gii1', { reason: 'x' }, 'u1', ctxA)).rejects.toThrow(BadRequestException);
    });
  });

  describe('reverse', () => {
    it('only reverses a POSTED issue', async () => {
      const { prisma, service } = makeService();
      prisma.generalInventoryIssue.findFirst.mockResolvedValue(issue({ status: 'APPROVED' }));
      await expect(service.reverse('gii1', {}, 'u1', ctxA)).rejects.toThrow(BadRequestException);
    });

    it('never reverses a reversal', async () => {
      const { prisma, service } = makeService();
      prisma.generalInventoryIssue.findFirst.mockResolvedValue(
        issue({ status: 'POSTED', sourceType: 'REVERSE', reversesIssueId: 'gii0' }),
      );
      await expect(service.reverse('gii1', {}, 'u1', ctxA)).rejects.toThrow(BadRequestException);
    });

    it('refuses a second non-cancelled reversal of the same source', async () => {
      const { prisma, service } = makeService();
      prisma.generalInventoryIssue.findFirst
        .mockResolvedValueOnce(issue({ status: 'POSTED' }))
        .mockResolvedValueOnce({ id: 'gii-existing' });

      await expect(service.reverse('gii1', {}, 'u1', ctxA)).rejects.toThrow(ConflictException);
    });

    it('creates a DRAFT IN reversal that replays the historical base quantity and never posts it', async () => {
      const { prisma, service, movements } = makeService();
      const source: any = issue({ status: 'POSTED' });
      source.lines[0] = { ...source.lines[0], productUomId: 'uom1', enteredUnitId: 'unit1' };
      prisma.generalInventoryIssue.findFirst
        .mockResolvedValueOnce(source)
        .mockResolvedValueOnce(null);
      primeCreate(prisma, issue({ id: 'gii2', sourceType: 'REVERSE', reversesIssueId: 'gii1' }));
      prisma.inventoryMovementLine.findMany.mockResolvedValue([
        { productId: 'prod1', quantity: 5, direction: 'OUT', quantityBase: 7 },
      ]);

      const result = await service.reverse('gii1', {}, 'u1', ctxA);

      expect(result.id).toBe('gii2');
      // UOM fields are deliberately not replayed: the source's immutable
      // conversion result must be reused, not recalculated with today's factor.
      expect(movements.resolveMovementLines).toHaveBeenCalledWith(
        expect.anything(),
        [expect.objectContaining({
          productId: 'prod1',
          direction: 'IN',
          quantityBase: 7,
          productUomId: null,
          enteredUnitId: null,
        })],
      );
      expect(prisma.warehouse.findFirst).toHaveBeenCalledWith({
        where: { id: 'wh1', companyId: 'c1', OR: [{ branchId: 'b1' }, { branchId: null }] },
      });
      const movementData = prisma.inventoryMovement.create.mock.calls[0][0].data;
      expect(movementData).toMatchObject({
        movementType: 'GENERAL_INVENTORY_ISSUE_REVERSAL',
        sourceType: 'GENERAL_INVENTORY_ISSUE',
        sourceId: 'gii1',
        status: 'DRAFT',
      });
      expect(movementData.lines.create[0]).toMatchObject({
        productId: 'prod1',
        direction: 'IN',
        quantityBase: 7,
      });
      expect(prisma.generalInventoryIssue.create.mock.calls[0][0].data).toMatchObject({
        issueType: 'GENERAL',
        status: 'DRAFT',
        sourceType: 'REVERSE',
        reversesIssueId: 'gii1',
      });
      // The reversal is a separate document: it is not auto-posted and no balance is touched.
      expect(movements.postMovementWithinTransaction).not.toHaveBeenCalled();
      expect(prisma.inventoryBalance.update).not.toHaveBeenCalled();
      expect(prisma.inventoryBalance.upsert).not.toHaveBeenCalled();
      expect(prisma.inventoryBalance.deleteMany).not.toHaveBeenCalled();
    });

    it('returns the existing reversal document for a duplicate requestId without a second transaction', async () => {
      const { prisma, service } = makeService();
      prisma.generalInventoryIssue.findFirst.mockResolvedValueOnce(issue({ id: 'gii2', sourceType: 'REVERSE' }));

      const result = await service.reverse('gii1', { requestId: 'req-reversal-1' }, 'u1', ctxA);

      expect(result.id).toBe('gii2');
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('retries a transient P2034 reversal conflict instead of surfacing a deadlock', async () => {
      const { prisma, service } = makeService();
      prisma.generalInventoryIssue.findFirst.mockImplementation(async (args: any) =>
        args.where.reversesIssueId ? null : issue({ status: 'POSTED' }));
      primeCreate(prisma, issue({ id: 'gii2', sourceType: 'REVERSE', reversesIssueId: 'gii1' }));
      const transient = new Prisma.PrismaClientKnownRequestError('write conflict', {
        code: 'P2034',
        clientVersion: 'test',
      });
      prisma.$transaction
        .mockRejectedValueOnce(transient)
        .mockImplementation(async (cb: any) => cb(prisma));

      const result = await service.reverse('gii1', {}, 'u1', ctxA);

      expect(result.id).toBe('gii2');
      expect(prisma.$transaction).toHaveBeenCalledTimes(2);
    });
  });

  describe('audit', () => {
    it('writes scoped audit records with the GeneralInventoryIssue entity', async () => {
      const { prisma, audit, service } = makeService();
      prisma.generalInventoryIssue.findFirst
        .mockResolvedValueOnce(issue({ status: 'SUBMITTED', submittedById: 'u1' }))
        .mockResolvedValueOnce(issue({ status: 'SUBMITTED', submittedById: 'u1' }))
        .mockResolvedValueOnce(issue({ status: 'APPROVED', approvedById: 'mgr' }));

      await service.approve('gii1', 'mgr', ctxA);

      expect(audit.logWithClient).toHaveBeenCalledWith(
        prisma,
        expect.objectContaining({
          userId: 'mgr',
          action: 'APPROVE',
          entity: 'GeneralInventoryIssue',
          entityId: 'gii1',
          details: expect.objectContaining({ companyId: 'c1', branchId: 'b1' }),
        }),
      );
    });
  });
});
