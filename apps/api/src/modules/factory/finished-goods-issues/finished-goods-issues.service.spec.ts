import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { FinishedGoodsIssuesService } from './finished-goods-issues.service';

const ctxA: any = { companyId: 'c1', branchId: 'b1' };
const ctxB: any = { companyId: 'c2', branchId: 'b2' };

const warehouse = (overrides: Record<string, any> = {}) => ({
  id: 'wh1',
  companyId: 'c1',
  branchId: 'b1',
  code: 'FG-WH',
  name: 'Finished Goods Warehouse',
  ...overrides,
});

const issue = (overrides: Record<string, any> = {}) => ({
  id: 'fgi1',
  companyId: 'c1',
  branchId: 'b1',
  issueNumber: 'FGI-000001',
  issueWarehouseId: 'wh1',
  status: 'DRAFT',
  movementId: 'mov1',
  movementNumber: 'IM-000001',
  sourceType: 'MANUAL',
  requestId: 'req-fgi-1',
  purpose: 'Sample dispatch',
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
      issueId: 'fgi1',
      productId: 'prod1',
      quantity: 5,
      unit: 'PC',
      product: { id: 'prod1', code: 'FG1', name: 'Finished Good' },
      warehouseLocation: null,
    },
  ],
  ...overrides,
});

const baseDto = (overrides: Record<string, any> = {}) => ({
  issueWarehouseId: 'wh1',
  requestId: 'req-fgi-1',
  lines: [{ productId: 'prod1', quantity: 5, unit: 'PC' }],
  ...overrides,
});

function makeService(overrides: Record<string, any> = {}) {
  const prisma: any = {
    finishedGoodsIssue: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      count: jest.fn(),
    },
    finishedGoodsIssueLine: {
      deleteMany: jest.fn(),
      createMany: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
      update: jest.fn(),
    },
    inventoryMovement: { create: jest.fn(), update: jest.fn(), findUnique: jest.fn() },
    inventoryMovementLine: {
      deleteMany: jest.fn(),
      createMany: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
    },
    // Balance mocks exist so tests can prove no code path writes stock directly.
    inventoryBalance: {
      findFirst: jest.fn().mockResolvedValue({ id: 'balance-wh1-prod1' }),
      create: jest.fn(),
      update: jest.fn(),
      upsert: jest.fn(),
      deleteMany: jest.fn(),
    },
    warehouse: { findUnique: jest.fn() },
    warehouseLocation: { findUnique: jest.fn() },
    product: { findMany: jest.fn() },
    productionProductDefinition: { findMany: jest.fn() },
    user: { findMany: jest.fn().mockResolvedValue([]) },
    ...overrides,
  };
  prisma.$transaction = jest.fn(async (cb: any) => cb(prisma));
  const audit: any = { log: jest.fn(), logWithClient: jest.fn() };
  const numbering: any = {
    generateNumberAtomicWithClient: jest
      .fn()
      .mockImplementation(async (code: string) =>
        code === 'FINISHED_GOODS_ISSUE' ? 'FGI-000001' : 'IM-000001',
      ),
  };
  const movements: any = {
    postMovementWithinTransaction: jest.fn().mockResolvedValue({}),
    resolveMovementLines: jest.fn(async (_tx: any, lines: any[]) =>
      lines.map((l) => ({
        ...l,
        quantityBase: l.quantityBase ?? l.quantity,
        productUomId: l.productUomId ?? null,
        enteredUnitId: l.enteredUnitId ?? null,
      })),
    ),
  };
  const service = new FinishedGoodsIssuesService(prisma, audit, numbering, movements);
  return { prisma, audit, numbering, movements, service };
}

/** Mocks the happy-path dependency lookups used by create/reverse. */
function primeCreate(prisma: any, created: any = issue()) {
  prisma.warehouse.findUnique.mockResolvedValue(warehouse());
  prisma.product.findMany.mockResolvedValue([{ id: 'prod1' }]);
  prisma.productionProductDefinition.findMany.mockResolvedValue([{ productId: 'prod1' }]);
  prisma.inventoryMovement.create.mockResolvedValue({ id: 'mov1', movementNumber: 'IM-000001' });
  prisma.finishedGoodsIssue.create.mockResolvedValue(created);
  prisma.finishedGoodsIssue.update.mockResolvedValue(created);
}

describe('FinishedGoodsIssuesService', () => {
  describe('tenant isolation', () => {
    it('rejects reading an issue from another company/branch', async () => {
      const { prisma, service } = makeService();
      prisma.finishedGoodsIssue.findFirst.mockResolvedValue(null);

      await expect(service.findOne('fgi1', ctxB)).rejects.toThrow(NotFoundException);
      expect(prisma.finishedGoodsIssue.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'fgi1', companyId: 'c2', branchId: 'b2' } }),
      );
    });

    it('scopes list queries to the active company and branch', async () => {
      const { prisma, service } = makeService();
      prisma.finishedGoodsIssue.findMany.mockResolvedValue([]);
      prisma.finishedGoodsIssue.count.mockResolvedValue(0);

      await service.findAll({ page: 1, limit: 20 } as any, ctxA);

      expect(prisma.finishedGoodsIssue.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { companyId: 'c1', branchId: 'b1' } }),
      );
    });

    it('resolves scalar actor ids to display names for the detail view', async () => {
      const { prisma, service } = makeService();
      prisma.finishedGoodsIssue.findFirst.mockResolvedValue(
        issue({ status: 'APPROVED', submittedById: 'u-requester', approvedById: 'u-warehouse' }),
      );
      prisma.user.findMany.mockResolvedValue([
        { id: 'u-requester', name: 'Requester' },
        { id: 'u-warehouse', name: 'Warehouse Keeper' },
      ]);

      const detail = await service.findOne('fgi1', ctxA);

      expect(detail.actorNames).toEqual({
        'u-requester': 'Requester',
        'u-warehouse': 'Warehouse Keeper',
      });
    });
  });

  describe('create', () => {
    it('returns the existing issue when the requestId already produced one (idempotency)', async () => {
      const { prisma, service } = makeService();
      prisma.finishedGoodsIssue.findFirst.mockResolvedValueOnce(issue());

      await expect(service.create(baseDto(), 'u1', ctxA)).resolves.toMatchObject({ id: 'fgi1' });
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('creates a DRAFT OUT issue with a linked DRAFT movement', async () => {
      const { prisma, service } = makeService();
      prisma.finishedGoodsIssue.findFirst.mockResolvedValue(null);
      primeCreate(prisma);

      const result = await service.create(baseDto(), 'u1', ctxA);

      expect(result.id).toBe('fgi1');
      const movementData = prisma.inventoryMovement.create.mock.calls[0][0].data;
      expect(movementData).toMatchObject({
        companyId: 'c1',
        branchId: 'b1',
        warehouseId: 'wh1',
        movementType: 'FINISHED_GOODS_ISSUE',
        status: 'DRAFT',
        sourceType: 'FINISHED_GOODS_ISSUE',
      });
      expect(movementData.lines.create[0]).toMatchObject({ productId: 'prod1', direction: 'OUT' });

      const issueData = prisma.finishedGoodsIssue.create.mock.calls[0][0].data;
      expect(issueData).toMatchObject({
        companyId: 'c1',
        branchId: 'b1',
        issueWarehouseId: 'wh1',
        status: 'DRAFT',
        sourceType: 'MANUAL',
        requestId: 'req-fgi-1',
      });
    });

    it('rejects a warehouse belonging to another company', async () => {
      const { prisma, service } = makeService();
      prisma.finishedGoodsIssue.findFirst.mockResolvedValue(null);
      prisma.warehouse.findUnique.mockResolvedValue(warehouse({ companyId: 'c2' }));

      await expect(service.create(baseDto(), 'u1', ctxA)).rejects.toThrow(BadRequestException);
    });

    it('rejects a warehouse belonging to another branch', async () => {
      const { prisma, service } = makeService();
      prisma.finishedGoodsIssue.findFirst.mockResolvedValue(null);
      prisma.warehouse.findUnique.mockResolvedValue(warehouse({ branchId: 'b2' }));

      await expect(service.create(baseDto(), 'u1', ctxA)).rejects.toThrow(BadRequestException);
    });

    it('rejects a product without an ACTIVE production definition (not finished goods)', async () => {
      const { prisma, service } = makeService();
      prisma.finishedGoodsIssue.findFirst.mockResolvedValue(null);
      prisma.warehouse.findUnique.mockResolvedValue(warehouse());
      prisma.product.findMany.mockResolvedValue([{ id: 'prod1' }]);
      prisma.productionProductDefinition.findMany.mockResolvedValue([]);

      await expect(service.create(baseDto(), 'u1', ctxA)).rejects.toThrow(BadRequestException);
      expect(prisma.inventoryMovement.create).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('only edits DRAFT issues', async () => {
      const { prisma, service } = makeService();
      prisma.finishedGoodsIssue.findFirst.mockResolvedValue(issue({ status: 'SUBMITTED' }));

      await expect(service.update('fgi1', { notes: 'x' } as any, 'u1', ctxA)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('lifecycle', () => {
    it('submits a DRAFT issue and stamps the requester', async () => {
      const { prisma, service } = makeService();
      // 1) public pre-check, 2) transition read, 3) post-transition read.
      prisma.finishedGoodsIssue.findFirst
        .mockResolvedValueOnce(issue({ status: 'DRAFT' }))
        .mockResolvedValueOnce(issue({ status: 'DRAFT' }))
        .mockResolvedValueOnce(issue({ status: 'SUBMITTED', submittedById: 'u1' }));

      const result = await service.submit('fgi1', 'u1', ctxA);
      expect(result.status).toBe('SUBMITTED');
      const claim = prisma.finishedGoodsIssue.updateMany.mock.calls[0][0];
      expect(claim.data).toMatchObject({ status: 'SUBMITTED', submittedById: 'u1' });
      expect(claim.where).toMatchObject({ id: 'fgi1', companyId: 'c1', branchId: 'b1', status: { in: ['DRAFT'] } });
    });

    it('does not submit an already-submitted issue', async () => {
      const { prisma, service } = makeService();
      prisma.finishedGoodsIssue.findFirst.mockResolvedValue(issue({ status: 'SUBMITTED' }));

      await expect(service.submit('fgi1', 'u1', ctxA)).rejects.toThrow(BadRequestException);
    });

    it('lets the recorded requester withdraw a SUBMITTED issue back to DRAFT', async () => {
      const { prisma, service } = makeService();
      prisma.finishedGoodsIssue.findFirst
        .mockResolvedValueOnce(issue({ status: 'SUBMITTED', submittedById: 'u1' }))
        .mockResolvedValueOnce(issue({ status: 'SUBMITTED', submittedById: 'u1' }))
        .mockResolvedValueOnce(issue({ status: 'DRAFT' }));

      const result = await service.withdraw('fgi1', { reason: 'fix line' }, 'u1', ctxA);
      expect(result.status).toBe('DRAFT');
      expect(prisma.finishedGoodsIssue.updateMany.mock.calls[0][0].data).toMatchObject({
        status: 'DRAFT',
        withdrawnById: 'u1',
        submittedById: null,
      });
    });

    it('blocks another user from withdrawing someone else\'s request', async () => {
      const { prisma, service } = makeService();
      prisma.finishedGoodsIssue.findFirst.mockResolvedValue(issue({ status: 'SUBMITTED', submittedById: 'u1' }));

      await expect(service.withdraw('fgi1', {}, 'u2', ctxA)).rejects.toThrow(ForbiddenException);
    });

    it('blocks self-approval', async () => {
      const { prisma, service } = makeService();
      prisma.finishedGoodsIssue.findFirst.mockResolvedValue(issue({ status: 'SUBMITTED', submittedById: 'u1' }));

      await expect(service.approve('fgi1', 'u1', ctxA)).rejects.toThrow(BadRequestException);
    });

    it('approves a SUBMITTED issue with a different warehouse actor', async () => {
      const { prisma, service } = makeService();
      prisma.finishedGoodsIssue.findFirst
        .mockResolvedValueOnce(issue({ status: 'SUBMITTED', submittedById: 'u1' }))
        .mockResolvedValueOnce(issue({ status: 'SUBMITTED', submittedById: 'u1' }))
        .mockResolvedValueOnce(issue({ status: 'APPROVED', approvedById: 'mgr' }));

      const result = await service.approve('fgi1', 'mgr', ctxA);
      expect(result.status).toBe('APPROVED');
      expect(prisma.finishedGoodsIssue.updateMany.mock.calls[0][0].data).toMatchObject({
        status: 'APPROVED',
        approvedById: 'mgr',
      });
    });

    it('rejects a SUBMITTED issue with a mandatory reason and a different actor', async () => {
      const { prisma, service } = makeService();
      prisma.finishedGoodsIssue.findFirst
        .mockResolvedValueOnce(issue({ status: 'SUBMITTED', submittedById: 'u1' }))
        .mockResolvedValueOnce(issue({ status: 'SUBMITTED', submittedById: 'u1' }))
        .mockResolvedValueOnce(issue({ status: 'REJECTED', rejectionReason: 'no stock' }));

      const result = await service.reject('fgi1', { reason: 'no stock' }, 'mgr', ctxA);
      expect(result.status).toBe('REJECTED');
      expect(prisma.finishedGoodsIssue.updateMany.mock.calls[0][0].data).toMatchObject({
        status: 'REJECTED',
        rejectionReason: 'no stock',
        rejectedById: 'mgr',
      });
    });

    it('cancels a prior approval back to SUBMITTED before posting', async () => {
      const { prisma, service } = makeService();
      prisma.finishedGoodsIssue.findFirst
        .mockResolvedValueOnce(issue({ status: 'APPROVED', approvedById: 'mgr' }))
        .mockResolvedValueOnce(issue({ status: 'APPROVED', approvedById: 'mgr' }))
        .mockResolvedValueOnce(issue({ status: 'SUBMITTED' }));

      const result = await service.cancelApproval('fgi1', { reason: 'recount' }, 'mgr', ctxA);
      expect(result.status).toBe('SUBMITTED');
      expect(prisma.finishedGoodsIssue.updateMany.mock.calls[0][0].data).toMatchObject({
        status: 'SUBMITTED',
        approvalCancellationReason: 'recount',
        approvalCancelledById: 'mgr',
      });
    });

    it('turns a concurrent transition race into a ConflictException', async () => {
      const { prisma, service } = makeService();
      prisma.finishedGoodsIssue.findFirst
        .mockResolvedValueOnce(issue({ status: 'DRAFT' }))
        .mockResolvedValueOnce(issue({ status: 'DRAFT' }));
      prisma.finishedGoodsIssue.updateMany.mockResolvedValue({ count: 0 });

      await expect(service.submit('fgi1', 'u1', ctxA)).rejects.toThrow(ConflictException);
    });
  });

  describe('post', () => {
    it('refuses to post an issue that is not APPROVED', async () => {
      const { prisma, service, movements } = makeService();
      prisma.finishedGoodsIssue.findFirst.mockResolvedValue(issue({ status: 'SUBMITTED' }));

      await expect(service.post('fgi1', 'mgr', ctxA)).rejects.toThrow(BadRequestException);
      expect(movements.postMovementWithinTransaction).not.toHaveBeenCalled();
    });

    it('posts through the canonical InventoryMovement contract and marks the issue POSTED', async () => {
      const { prisma, service, movements } = makeService();
      prisma.finishedGoodsIssue.findFirst.mockResolvedValue(issue({ status: 'APPROVED' }));
      prisma.finishedGoodsIssue.update.mockResolvedValue(issue({ status: 'POSTED' }));

      const result = await service.post('fgi1', 'mgr', ctxA);

      expect(movements.postMovementWithinTransaction).toHaveBeenCalledWith(
        expect.anything(),
        'mov1',
        'mgr',
        ctxA,
      );
      expect(result.status).toBe('POSTED');
      expect(prisma.finishedGoodsIssue.update.mock.calls[0][0].data).toMatchObject({
        status: 'POSTED',
        postedById: 'mgr',
      });
    });
  });

  describe('cancel', () => {
    it.each(['DRAFT', 'SUBMITTED', 'REJECTED'])('cancels a %s issue', async (status) => {
      const { prisma, service } = makeService();
      prisma.finishedGoodsIssue.findFirst
        .mockResolvedValueOnce(issue({ status }))
        .mockResolvedValueOnce(issue({ status: 'CANCELLED' }));
      prisma.inventoryMovement.findUnique.mockResolvedValue({ id: 'mov1', status: 'DRAFT' });

      const result = await service.cancel('fgi1', { reason: 'no longer needed' }, 'u1', ctxA);
      expect(result.status).toBe('CANCELLED');
    });

    it.each(['APPROVED', 'POSTED', 'CANCELLED'])('refuses to cancel a %s issue', async (status) => {
      const { prisma, service } = makeService();
      prisma.finishedGoodsIssue.findFirst.mockResolvedValue(issue({ status }));

      await expect(service.cancel('fgi1', { reason: 'x' }, 'u1', ctxA)).rejects.toThrow(BadRequestException);
    });
  });

  describe('reverse', () => {
    it('only reverses a POSTED issue', async () => {
      const { prisma, service } = makeService();
      prisma.finishedGoodsIssue.findFirst.mockResolvedValue(issue({ status: 'APPROVED' }));

      await expect(service.reverse('fgi1', {}, 'u1', ctxA)).rejects.toThrow(BadRequestException);
    });

    it('never reverses a reversal', async () => {
      const { prisma, service } = makeService();
      prisma.finishedGoodsIssue.findFirst.mockResolvedValue(
        issue({ status: 'POSTED', sourceType: 'REVERSE', reversesIssueId: 'fgi0' }),
      );

      await expect(service.reverse('fgi1', {}, 'u1', ctxA)).rejects.toThrow(BadRequestException);
    });

    it('refuses a second non-cancelled reversal of the same source', async () => {
      const { prisma, service } = makeService();
      prisma.finishedGoodsIssue.findFirst.mockResolvedValueOnce(issue({ status: 'POSTED' }));
      prisma.finishedGoodsIssue.findFirst.mockResolvedValueOnce({ id: 'fgi-existing' });

      await expect(service.reverse('fgi1', {}, 'u1', ctxA)).rejects.toThrow(ConflictException);
    });

    it('creates a DRAFT reversal issue whose movement is an IN effect', async () => {
      const { prisma, service } = makeService();
      // 1) source lookup (POSTED), 2) existing-reversal lookup (none).
      prisma.finishedGoodsIssue.findFirst
        .mockResolvedValueOnce(issue({ status: 'POSTED' }))
        .mockResolvedValueOnce(null);
      primeCreate(prisma, issue({ id: 'fgi2', sourceType: 'REVERSE', reversesIssueId: 'fgi1' }));
      prisma.inventoryMovementLine.findMany.mockResolvedValue([
        { productId: 'prod1', quantity: 5, direction: 'OUT', quantityBase: 5 },
      ]);

      const result = await service.reverse('fgi1', {}, 'u1', ctxA);

      expect(result.id).toBe('fgi2');
      const movementData = prisma.inventoryMovement.create.mock.calls[0][0].data;
      expect(movementData).toMatchObject({
        movementType: 'FINISHED_GOODS_ISSUE_REVERSAL',
        sourceType: 'FINISHED_GOODS_ISSUE',
        sourceId: 'fgi1',
      });
      expect(movementData.lines.create[0]).toMatchObject({ productId: 'prod1', direction: 'IN' });
    });
  });
});


describe('Finished goods issue catalog eligibility and warehouse-scoped stock', () => {
  it('allows an eligible finished product with no balance row in a DRAFT and never writes a balance', async () => {
    const { prisma, service, movements } = makeService();
    primeCreate(prisma);
    prisma.inventoryBalance.findFirst.mockResolvedValue(null);

    const result = await service.create(baseDto(), 'u1', ctxA);

    expect(result.status).toBe('DRAFT');
    expect(prisma.inventoryBalance.findFirst).toHaveBeenCalledTimes(1);
    expect(prisma.inventoryBalance.findFirst.mock.calls[0][0].where).toMatchObject({
      productId: 'prod1',
      warehouseId: 'wh1',
      warehouse: { companyId: 'c1', OR: [{ branchId: 'b1' }, { branchId: null }] },
    });
    expect(prisma.finishedGoodsIssue.create).toHaveBeenCalled();
    expect(prisma.inventoryBalance.create).not.toHaveBeenCalled();
    expect(prisma.inventoryBalance.update).not.toHaveBeenCalled();
    expect(prisma.inventoryBalance.upsert).not.toHaveBeenCalled();
    expect(prisma.inventoryBalance.deleteMany).not.toHaveBeenCalled();
    expect(movements.postMovementWithinTransaction).not.toHaveBeenCalled();
  });

  it('rejects a raw material passed directly to the finished-goods API', async () => {
    const { prisma, service } = makeService();
    primeCreate(prisma);
    prisma.productionProductDefinition.findMany.mockResolvedValue([]);
    await expect(service.create(baseDto(), 'u1', ctxA)).rejects.toMatchObject({ response: { messageKey: 'finishedGoodsIssue.productNotEligible' } });
    expect(prisma.finishedGoodsIssue.create).not.toHaveBeenCalled();
  });

  it('allows a zero-stock catalog item on a DRAFT update without direct balance writes', async () => {
    const { prisma, service } = makeService();
    primeCreate(prisma);
    prisma.finishedGoodsIssue.findFirst.mockResolvedValue(issue());
    prisma.inventoryBalance.findFirst.mockResolvedValue(null);

    const result = await service.update('fgi1', { lines: [{ productId: 'prod1', quantity: 5, unit: 'PC' }] }, 'u1', ctxA);

    expect(result.status).toBe('DRAFT');
    expect(prisma.inventoryBalance.findFirst).toHaveBeenCalledTimes(1);
    expect(prisma.inventoryBalance.findFirst.mock.calls[0][0].where).toMatchObject({
      productId: 'prod1',
      warehouseId: 'wh1',
      warehouse: { companyId: 'c1', OR: [{ branchId: 'b1' }, { branchId: null }] },
    });
    expect(prisma.finishedGoodsIssueLine.deleteMany).toHaveBeenCalled();
    expect(prisma.finishedGoodsIssueLine.createMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: [expect.objectContaining({ issueId: 'fgi1', productId: 'prod1' })] }),
    );
    expect(prisma.inventoryBalance.create).not.toHaveBeenCalled();
    expect(prisma.inventoryBalance.update).not.toHaveBeenCalled();
    expect(prisma.inventoryBalance.upsert).not.toHaveBeenCalled();
    expect(prisma.inventoryBalance.deleteMany).not.toHaveBeenCalled();
  });
});
