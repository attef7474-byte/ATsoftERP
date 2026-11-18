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
    sparePartIssue: { findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0) },
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
    expect(prisma.sparePartIssue.findMany).toHaveBeenCalled();
    expect(prisma.productionMaterialDocument.findMany).toHaveBeenCalled();
    expect(prisma.finishedGoodsIssue.findMany).toHaveBeenCalled();
    expect(result.meta.total).toBe(0);
  });

  it('scopes every family query to the active company/branch (tenant isolation)', async () => {
    const { prisma, service } = makeService();
    prisma.userRole.findMany.mockResolvedValue([
      userRole([
        'maintenance-request-parts:read',
        'spare-part-issue:read',
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
    expect(prisma.sparePartIssue.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ companyId: 'c1', branchId: 'b1' }) }),
    );
    expect(prisma.productionMaterialDocument.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ companyId: 'c1', branchId: 'b1' }) }),
    );
    expect(prisma.finishedGoodsIssue.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ companyId: 'c1', branchId: 'b1' }) }),
    );
  });

  it('never returns another tenant\'s vouchers when the active context is Company B', async () => {
    const ctxB: any = { companyId: 'c2', branchId: 'b2' };
    const { prisma, service } = makeService();
    prisma.userRole.findMany.mockResolvedValue([
      userRole([
        'maintenance-request-parts:read',
        'spare-part-issue:read',
        'production-material-document:read',
        'finished-goods-issue:read',
      ]),
    ]);

    await service.list(baseQuery, 'u1', ctxB);

    for (const model of [
      prisma.maintenanceRequestRequiredPart,
      prisma.sparePartIssue,
      prisma.productionMaterialDocument,
      prisma.finishedGoodsIssue,
    ]) {
      const where = model.findMany.mock.calls[0][0].where;
      expect(JSON.stringify(where)).not.toContain('c1');
      expect(JSON.stringify(where)).not.toContain('b1');
    }
    expect(prisma.sparePartIssue.findMany.mock.calls[0][0].where).toMatchObject({
      companyId: 'c2',
      branchId: 'b2',
    });
    expect(prisma.productionMaterialDocument.findMany.mock.calls[0][0].where).toMatchObject({
      companyId: 'c2',
      branchId: 'b2',
    });
    expect(prisma.finishedGoodsIssue.findMany.mock.calls[0][0].where).toMatchObject({
      companyId: 'c2',
      branchId: 'b2',
    });
    expect(prisma.maintenanceRequestRequiredPart.findMany.mock.calls[0][0].where).toMatchObject({
      maintenanceRequest: { machine: { companyId: 'c2', OR: [{ branchId: 'b2' }, { branchId: null }] } },
    });
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

  it('opens the inbox with only the standalone spare-part-issue read permission', async () => {
    const { prisma, service } = makeService();
    prisma.userRole.findMany.mockResolvedValue([userRole([
      'spare-part-issue:read',
      'spare-part-issue:approve',
      'spare-part-issue:reject',
      'spare-part-issue:withdraw',
      'spare-part-issue:cancel-approval',
    ])]);

    const result = await service.list(baseQuery, 'u1', ctxA);

    expect(prisma.maintenanceRequestRequiredPart.findMany).not.toHaveBeenCalled();
    expect(prisma.sparePartIssue.findMany).toHaveBeenCalled();
    expect(prisma.productionMaterialDocument.findMany).not.toHaveBeenCalled();
    expect(prisma.finishedGoodsIssue.findMany).not.toHaveBeenCalled();
    expect(result.permissions).toEqual(expect.arrayContaining([
      'spare-part-issue:read',
      'spare-part-issue:approve',
      'spare-part-issue:reject',
      'spare-part-issue:withdraw',
      'spare-part-issue:cancel-approval',
    ]));
  });

  it('aggregates standalone spare-part issues into counts.SPARE_PART with their own authority and requester name', async () => {
    const { prisma, service } = makeService();
    prisma.userRole.findMany.mockResolvedValue([
      userRole(['maintenance-request-parts:read', 'spare-part-issue:read']),
    ]);
    prisma.maintenanceRequestRequiredPart.count.mockResolvedValue(2);
    prisma.sparePartIssue.count.mockResolvedValue(3);
    prisma.sparePartIssue.findMany.mockResolvedValue([
      {
        id: 'spi1',
        issueNumber: 'SPI-000001',
        purpose: 'Manual issue',
        status: 'SUBMITTED',
        submittedAt: new Date('2026-03-02T10:00:00Z'),
        submittedById: 'u2',
        issueWarehouse: { id: 'wh1', code: 'SP', name: 'Spare Store' },
        lines: [{ quantity: 4 }, { quantity: 1.5 }],
        createdAt: new Date('2026-03-02T09:00:00Z'),
        issueDate: new Date('2026-03-02T09:00:00Z'),
        sourceType: 'MANUAL',
      },
    ]);
    prisma.user.findMany.mockResolvedValue([{ id: 'u2', name: 'Requester Two' }]);

    const result = await service.list(baseQuery, 'u1', ctxA);

    expect(result.meta.counts.SPARE_PART).toBe(5);
    expect(result.meta.total).toBe(5);
    expect(result.data).toHaveLength(1);
    expect(result.data[0]).toMatchObject({
      key: 'SPARE_PART_ISSUE:spi1',
      type: 'SPARE_PART',
      authority: 'SPARE_PART_ISSUE',
      entityId: 'spi1',
      parentEntityId: 'spi1',
      reference: 'SPI-000001',
      status: 'SUBMITTED',
      requestedById: 'u2',
      requestedByName: 'Requester Two',
      lineCount: 2,
      totalQuantity: 5.5,
    });
    expect(prisma.sparePartIssue.findMany.mock.calls[0][0]).toMatchObject({
      take: 20,
      include: {
        issueWarehouse: { select: { id: true, code: true, name: true } },
        lines: { select: { quantity: true } },
      },
    });
  });

  it('keeps the shared SUBMITTED/APPROVED/REJECTED vocabulary for standalone spare issues', async () => {
    const { prisma, service } = makeService();
    prisma.userRole.findMany.mockResolvedValue([userRole(['spare-part-issue:read'])]);

    await service.list({ page: 1, limit: 20, status: 'APPROVED' } as any, 'u1', ctxA);

    expect(prisma.sparePartIssue.findMany.mock.calls[0][0].where.status).toBe('APPROVED');
  });

  it('tags maintenance lines and flat authorities with their native authority', async () => {
    const { prisma, service } = makeService();
    prisma.userRole.findMany.mockResolvedValue([userRole([], 'SUPER_ADMIN')]);
    prisma.maintenanceRequestRequiredPart.findMany.mockResolvedValue([{
      id: 'part1', status: 'REQUESTED', requestedQuantity: 1,
      requestedByUserId: 'u1', requestedBy: { id: 'u1', name: 'R' },
      warehouse: { id: 'wh1', code: 'SP', name: 'Spare' },
      sparePart: { id: 'sp1', code: 'SP001', name: 'Bearing' },
      maintenanceRequest: { id: 'mr1', requestNumber: 'MR-1', title: null, machine: null },
      createdAt: new Date('2026-03-01T10:00:00Z'),
    }]);
    prisma.productionMaterialDocument.findMany.mockResolvedValue([{
      id: 'doc1', documentNumber: 'PMD-1', status: 'SUBMITTED',
      submittedById: 'u1', issueWarehouse: null, lines: [{ quantity: 2 }],
      createdAt: new Date('2026-03-01T08:00:00Z'), documentDate: new Date('2026-03-01T08:00:00Z'),
    }]);
    prisma.finishedGoodsIssue.findMany.mockResolvedValue([{
      id: 'fgi1', issueNumber: 'FGI-1', status: 'SUBMITTED',
      submittedById: 'u1', issueWarehouse: null, lines: [],
      createdAt: new Date('2026-03-01T09:00:00Z'), issueDate: new Date('2026-03-01T09:00:00Z'),
    }]);

    const result = await service.list(baseQuery, 'u1', ctxA);
    const byKey = new Map(result.data.map((row: any) => [row.key, row]));

    expect(byKey.get('SPARE_PART:part1')?.authority).toBe('MAINTENANCE_REQUEST_PART');
    expect(byKey.get('RAW_MATERIAL:doc1')?.authority).toBe('FLAT');
    expect(byKey.get('FINISHED_GOODS:fgi1')?.authority).toBe('FLAT');
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


describe('unified issue tracking query', () => {
  it('reads every native lifecycle status while preserving pending-only approval defaults', async () => {
    const { prisma, service } = makeService();
    prisma.userRole.findMany.mockResolvedValue([userRole([], 'SUPER_ADMIN')]);
    await service.list({ page: 1, limit: 20 } as any, 'root', ctxA, true);
    expect(prisma.finishedGoodsIssue.findMany.mock.calls[0][0].where).toEqual({ companyId: 'c1', branchId: 'b1' });
    expect(prisma.productionMaterialDocument.findMany.mock.calls[0][0].where).toEqual({ companyId: 'c1', branchId: 'b1', documentType: 'ISSUE' });
    expect(prisma.maintenanceRequestRequiredPart.findMany.mock.calls[0][0].where.status).toBeUndefined();
    await service.list(baseQuery, 'root', ctxA);
    expect(prisma.finishedGoodsIssue.findMany.mock.calls[1][0].where.status).toBe('SUBMITTED');
    expect(prisma.maintenanceRequestRequiredPart.findMany.mock.calls[1][0].where.status).toBe('REQUESTED');
  });
  it('scopes type/status/warehouse/requester/date/search filters without replacing tenant predicates', async () => {
    const { prisma, service } = makeService();
    prisma.userRole.findMany.mockResolvedValue([userRole(['finished-goods-issue:read'])]);
    await service.list({ page: 1, limit: 20, status: 'DRAFT', warehouseId: 'wa', requesterId: 'requester', search: 'FGI', dateTo: '2026-11-18' } as any, 'root', ctxA, true);
    const where = prisma.finishedGoodsIssue.findMany.mock.calls[0][0].where;
    expect(where).toMatchObject({ companyId: 'c1', branchId: 'b1', status: 'DRAFT', issueWarehouseId: 'wa', AND: [{ OR: [{ createdById: 'requester' }, { submittedById: 'requester' }] }] });
    expect(where.OR).toContainEqual({ issueNumber: { contains: 'FGI' } });
    expect(where.issueDate.lte.toISOString()).toBe('2026-11-18T23:59:59.999Z');
    expect(prisma.productionMaterialDocument.findMany).not.toHaveBeenCalled();
    expect(prisma.maintenanceRequestRequiredPart.findMany).not.toHaveBeenCalled();
  });
  it('fails closed when active company/branch is absent', async () => {
    const { prisma, service } = makeService();
    prisma.userRole.findMany.mockResolvedValue([userRole([], 'SUPER_ADMIN')]);
    await expect(service.list(baseQuery, 'root', {} as any, true)).rejects.toThrow(ForbiddenException);
    expect(prisma.finishedGoodsIssue.findMany).not.toHaveBeenCalled();
  });
});
