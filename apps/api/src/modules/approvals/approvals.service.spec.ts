import { ForbiddenException } from '@nestjs/common';
import { ApprovalsService } from './approvals.service';

const ctxA: any = { companyId: 'c1', branchId: 'b1' };

const userRole = (keys: string[], code = 'WAREHOUSE') => ({
  role: {
    status: 'ACTIVE',
    code,
    permissions: keys.map((key) => ({ permission: { status: 'ACTIVE', key } })),
  },
});

function makeService(overrides: Record<string, any> = {}) {
  const prisma: any = {
    userRole: { findMany: jest.fn().mockResolvedValue([]) },
    maintenanceRequestRequiredPart: { findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0) },
    productionMaterialDocument: { findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0) },
    finishedGoodsIssue: { findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0) },
    user: { findMany: jest.fn().mockResolvedValue([]) },
    ...overrides,
  };
  return { prisma, service: new ApprovalsService(prisma) };
}

const baseQuery = { page: 1, limit: 20 } as any;

describe('ApprovalsService', () => {
  it('rejects a user with none of the three underlying read permissions', async () => {
    const { service } = makeService();

    await expect(service.list(baseQuery, 'u1', ctxA)).rejects.toThrow(ForbiddenException);
  });

  it('does not treat an umbrella-only (non-existent) permission as access', async () => {
    const { prisma, service } = makeService();
    prisma.userRole.findMany.mockResolvedValue([userRole(['warehouse-approvals:read'])]);

    await expect(service.list(baseQuery, 'u1', ctxA)).rejects.toThrow(ForbiddenException);
  });

  it('only queries the families the user can read', async () => {
    const { prisma, service } = makeService();
    prisma.userRole.findMany.mockResolvedValue([userRole(['finished-goods-issue:read'])]);
    prisma.finishedGoodsIssue.count.mockResolvedValue(1);
    prisma.finishedGoodsIssue.findMany.mockResolvedValue([
      {
        id: 'fgi1',
        issueNumber: 'FGI-000001',
        purpose: 'Dispatch',
        status: 'SUBMITTED',
        submittedAt: new Date('2026-03-01T10:00:00Z'),
        submittedById: 'u1',
        issueWarehouse: { id: 'wh1', code: 'FG', name: 'FG Store' },
        lines: [{ quantity: 5 }, { quantity: 3 }],
        createdAt: new Date('2026-03-01T09:00:00Z'),
      },
    ]);
    prisma.user.findMany.mockResolvedValue([{ id: 'u1', name: 'Requester' }]);

    const result = await service.list(baseQuery, 'u1', ctxA);

    expect(prisma.maintenanceRequestRequiredPart.findMany).not.toHaveBeenCalled();
    expect(prisma.productionMaterialDocument.findMany).not.toHaveBeenCalled();
    expect(result.meta.counts).toEqual({ SPARE_PART: 0, RAW_MATERIAL: 0, FINISHED_GOODS: 1 });
    expect(result.data).toHaveLength(1);
    expect(result.data[0]).toMatchObject({
      type: 'FINISHED_GOODS',
      reference: 'FGI-000001',
      lineCount: 2,
      totalQuantity: 8,
      requestedByName: 'Requester',
    });
    expect(result.permissions).toEqual(
      expect.arrayContaining(['finished-goods-issue:read']),
    );
  });

  it('grants SUPER_ADMIN access to every family', async () => {
    const { prisma, service } = makeService();
    prisma.userRole.findMany.mockResolvedValue([userRole([], 'SUPER_ADMIN')]);

    const result = await service.list(baseQuery, 'root', ctxA);

    expect(prisma.maintenanceRequestRequiredPart.findMany).toHaveBeenCalled();
    expect(prisma.productionMaterialDocument.findMany).toHaveBeenCalled();
    expect(prisma.finishedGoodsIssue.findMany).toHaveBeenCalled();
    expect(result.meta.total).toBe(0);
  });

  it('scopes every family query to the active company/branch (tenant isolation)', async () => {
    const { prisma, service } = makeService();
    prisma.userRole.findMany.mockResolvedValue([
      userRole([
        'maintenance-request-parts:read',
        'production-material-document:read',
        'finished-goods-issue:read',
      ]),
    ]);

    await service.list(baseQuery, 'u1', ctxA);

    expect(prisma.maintenanceRequestRequiredPart.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          maintenanceRequest: expect.objectContaining({
            deletedAt: null,
            machine: {
              companyId: 'c1',
              OR: [{ branchId: 'b1' }, { branchId: null }],
            },
          }),
        }),
      }),
    );
    expect(prisma.productionMaterialDocument.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ companyId: 'c1', branchId: 'b1' }) }),
    );
    expect(prisma.finishedGoodsIssue.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ companyId: 'c1', branchId: 'b1' }) }),
    );
  });

  it('defaults to SUBMITTED and only accepts pending-decision statuses', async () => {
    const { prisma, service } = makeService();
    prisma.userRole.findMany.mockResolvedValue([userRole(['finished-goods-issue:read'])]);

    await service.list({ page: 0, limit: 500, status: 'DRAFT' } as any, 'u1', ctxA);

    const where = prisma.finishedGoodsIssue.findMany.mock.calls[0][0].where;
    expect(where.status).toBe('SUBMITTED');
    const call = prisma.finishedGoodsIssue.findMany.mock.calls[0][0];
    // page 0 clamps to 1 and limit 500 clamps to 100, so each family reads at most 100 rows.
    expect(call.take).toBe(100);
  });

  it('maps the inbox pending vocabulary to the spare-part native REQUESTED status', async () => {
    const { prisma, service } = makeService();
    prisma.userRole.findMany.mockResolvedValue([userRole(['maintenance-request-parts:read'])]);
    prisma.maintenanceRequestRequiredPart.count.mockResolvedValue(1);
    prisma.maintenanceRequestRequiredPart.findMany.mockResolvedValue([
      {
        id: 'part1',
        status: 'REQUESTED',
        requestedQuantity: 4,
        quantity: 4,
        requestedByUserId: 'u1',
        requestedBy: { id: 'u1', name: 'Requester' },
        warehouse: { id: 'wh1', code: 'SP', name: 'Spare Store' },
        sparePart: { id: 'sp1', code: 'SP001', name: 'Bearing' },
        maintenanceRequest: { id: 'mr1', requestNumber: 'MR-000001', title: 'Line stop', machine: null },
        createdAt: new Date('2026-03-01T10:00:00Z'),
      },
    ]);

    const result = await service.list(baseQuery, 'u1', ctxA);

    expect(prisma.maintenanceRequestRequiredPart.findMany.mock.calls[0][0].where.status).toBe('REQUESTED');
    expect(prisma.maintenanceRequestRequiredPart.count.mock.calls[0][0].where.status).toBe('REQUESTED');
    expect(result.meta.counts.SPARE_PART).toBe(1);
    expect(result.meta.total).toBe(1);
    expect(result.data[0]).toMatchObject({
      type: 'SPARE_PART',
      entityId: 'part1',
      parentEntityId: 'mr1',
      status: 'REQUESTED',
      reference: 'MR-000001 · SP001',
      totalQuantity: 4,
    });
  });

  it('keeps explicit APPROVED/REJECTED decisions in the spare-part family native status', async () => {
    const { prisma, service } = makeService();
    prisma.userRole.findMany.mockResolvedValue([userRole(['maintenance-request-parts:read'])]);

    await service.list({ page: 1, limit: 20, status: 'APPROVED' } as any, 'u1', ctxA);

    expect(prisma.maintenanceRequestRequiredPart.findMany.mock.calls[0][0].where.status).toBe('APPROVED');
    expect(prisma.maintenanceRequestRequiredPart.count.mock.calls[0][0].where.status).toBe('APPROVED');
  });

  it('returns a globally ordered, bounded page across families', async () => {
    const { prisma, service } = makeService();
    prisma.userRole.findMany.mockResolvedValue([
      userRole(['production-material-document:read', 'finished-goods-issue:read']),
    ]);
    prisma.productionMaterialDocument.count.mockResolvedValue(1);
    prisma.productionMaterialDocument.findMany.mockResolvedValue([
      {
        id: 'doc1',
        documentNumber: 'PMD-000001',
        status: 'SUBMITTED',
        submittedAt: new Date('2026-03-01T08:00:00Z'),
        submittedById: 'u1',
        productionOrder: { id: 'po1', orderNumber: 'PO-1' },
        productionRun: { id: 'run1', runNumber: 'RUN-1' },
        issueWarehouse: { id: 'wh1', code: 'RM', name: 'Raw Store' },
        lines: [{ quantity: 2 }],
        createdAt: new Date('2026-03-01T08:00:00Z'),
      },
    ]);
    prisma.finishedGoodsIssue.count.mockResolvedValue(1);
    prisma.finishedGoodsIssue.findMany.mockResolvedValue([
      {
        id: 'fgi1',
        issueNumber: 'FGI-000001',
        purpose: null,
        status: 'SUBMITTED',
        submittedAt: null,
        submittedById: null,
        issueWarehouse: null,
        lines: [],
        createdAt: new Date('2026-03-01T09:00:00Z'),
      },
    ]);

    const result = await service.list(baseQuery, 'u1', ctxA);

    expect(result.meta.total).toBe(2);
    expect(result.data.map((row: any) => row.type)).toEqual(['FINISHED_GOODS', 'RAW_MATERIAL']);
    expect(prisma.productionMaterialDocument.findMany.mock.calls[0][0].take).toBe(20);
  });
});
