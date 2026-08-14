import { DashboardService } from './dashboard.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ActiveOperationalContext } from '../../common/operational-context/operational-context.types';

const ctx: ActiveOperationalContext = {
  contextKey: 'company-a:branch-a:-:-',
  scopeId: 'scope-a',
  companyId: 'company-a',
  companyName: 'Company A',
  companyCode: 'A',
  branchId: 'branch-a',
  branchName: 'Branch A',
  branchCode: 'BA',
  administrationId: null,
  administrationName: null,
  administrationCode: null,
  departmentId: null,
  departmentName: null,
  departmentCode: null,
  isDefault: true,
  source: 'EXPLICIT_SCOPE',
};

describe('DashboardService tenant isolation', () => {
  let prisma: any;
  let service: DashboardService;

  beforeEach(() => {
    const count = jest.fn().mockResolvedValue(0);
    prisma = {
      user: { count: jest.fn().mockResolvedValue(1) },
      role: { count },
      permission: { count },
      product: { count },
      warehouse: { count: jest.fn().mockResolvedValue(2) },
      machine: {
        count: jest.fn().mockResolvedValue(3),
        groupBy: jest.fn().mockResolvedValue([]),
      },
      company: { count },
      branch: { count },
      department: { count },
      productCategory: { count },
      machineCategory: { count },
      notification: { count: jest.fn().mockResolvedValue(4) },
      maintenanceRequest: {
        count: jest.fn().mockResolvedValue(0),
        findMany: jest.fn().mockResolvedValue([]),
      },
      inventoryCount: {
        count: jest.fn().mockResolvedValue(0),
        groupBy: jest.fn().mockResolvedValue([]),
      },
      maintenanceSchedule: { count: jest.fn().mockResolvedValue(0) },
      downtimeLog: { count: jest.fn().mockResolvedValue(0) },
      inventoryMovement: { count: jest.fn().mockResolvedValue(0) },
      inventoryAdjustment: { count: jest.fn().mockResolvedValue(0) },
      inventoryBalance: { count: jest.fn().mockResolvedValue(0) },
    };
    service = new DashboardService(prisma as PrismaService);
  });

  it('scopes summary tenant-owned counts and unread notifications to the current user', async () => {
    const result = await service.getSummary(ctx, 'user-a');

    expect(result).toMatchObject({
      users: 1,
      warehouses: 2,
      machines: 3,
      unreadNotifications: 4,
    });
    expect(prisma.user.count).toHaveBeenCalledWith({
      where: {
        companyId: 'company-a',
        deletedAt: null,
        AND: [
          {
            OR: [{ branchId: null }, { branchId: 'branch-a' }],
          },
        ],
      },
    });
    expect(prisma.warehouse.count).toHaveBeenCalledWith({
      where: {
        companyId: 'company-a',
        deletedAt: null,
        AND: [
          {
            OR: [{ branchId: null }, { branchId: 'branch-a' }],
          },
        ],
      },
    });
    expect(prisma.notification.count).toHaveBeenCalledWith({
      where: { userId: 'user-a', read: false },
    });
    expect(prisma.company.count).toHaveBeenCalledWith({
      where: { id: 'company-a', deletedAt: null },
    });
    expect(prisma.branch.count).toHaveBeenCalledWith({
      where: {
        id: 'branch-a',
        companyId: 'company-a',
        deletedAt: null,
      },
    });
  });

  it('scopes every operational aggregate through the active company and branch', async () => {
    await service.getOperations(ctx);

    const machineWhere = {
      companyId: 'company-a',
      deletedAt: null,
      AND: [
        {
          OR: [{ branchId: null }, { branchId: 'branch-a' }],
        },
      ],
    };
    expect(prisma.machine.groupBy).toHaveBeenCalledWith({
      by: ['status'],
      where: machineWhere,
      _count: true,
    });
    expect(prisma.maintenanceRequest.count).toHaveBeenCalledWith({
      where: expect.objectContaining({
        machine: machineWhere,
      }),
    });
    expect(prisma.inventoryCount.groupBy).toHaveBeenCalledWith({
      by: ['status'],
      where: expect.objectContaining({
        companyId: 'company-a',
        deletedAt: null,
        AND: [
          {
            OR: [{ branchId: null }, { branchId: 'branch-a' }],
          },
        ],
      }),
      _count: true,
    });
    for (const call of [
      prisma.inventoryMovement.count.mock.calls[0][0],
      prisma.inventoryAdjustment.count.mock.calls[0][0],
    ]) {
      expect(call.where).toMatchObject({
        companyId: 'company-a',
        deletedAt: null,
        warehouse: {
          companyId: 'company-a',
          deletedAt: null,
        },
      });
      expect(call.where.AND).toEqual([
        {
          OR: [{ branchId: null }, { branchId: 'branch-a' }],
        },
      ]);
      expect(call.where.warehouse.AND).toEqual([
        {
          OR: [{ branchId: null }, { branchId: 'branch-a' }],
        },
      ]);
    }
  });

  it('never issues an unscoped KPI query for tenant-owned entities', async () => {
    await service.getKpis(ctx);

    for (const mock of [
      prisma.machine.count,
      prisma.maintenanceRequest.count,
      prisma.inventoryCount.count,
      prisma.inventoryMovement.count,
    ]) {
      for (const [argument] of mock.mock.calls) {
        expect(argument).toHaveProperty('where');
      }
    }
    expect(prisma.inventoryCount.count.mock.calls[0][0].where).toMatchObject({
      companyId: 'company-a',
      deletedAt: null,
    });
    expect(
      prisma.inventoryCount.count.mock.calls[0][0].where.AND,
    ).toEqual([
      {
        OR: [{ branchId: null }, { branchId: 'branch-a' }],
      },
    ]);
  });
});
