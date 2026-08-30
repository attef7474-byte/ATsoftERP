import { NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../../common/prisma/prisma.service';
import { DowntimeLogsService } from '../downtime-logs/downtime-logs.service';
import { MaintenanceDashboardService } from './maintenance-dashboard.service';
import { ActiveOperationalContext } from '../../../../common/operational-context/operational-context.types';

const ctx: ActiveOperationalContext = {
  contextKey: 'c1:b1',
  scopeId: 'b1',
  companyId: 'c1',
  companyName: 'Company One',
  companyCode: 'C1',
  branchId: 'b1',
  branchName: 'Branch One',
  branchCode: 'B1',
  administrationId: null,
  administrationName: null,
  administrationCode: null,
  departmentId: null,
  departmentName: null,
  departmentCode: null,
  isDefault: true,
  source: 'EXPLICIT_SCOPE',
};

describe('MaintenanceDashboardService', () => {
  let prisma: any;
  let downtimeLogs: any;
  let service: MaintenanceDashboardService;
  const scope = { companyId: 'c1', OR: [{ branchId: 'b1' }, { branchId: null }] };

  beforeEach(() => {
    prisma = {
      maintenanceRequest: { count: jest.fn().mockResolvedValue(0), findMany: jest.fn().mockResolvedValue([]) },
      machine: { count: jest.fn().mockResolvedValue(0), findMany: jest.fn().mockResolvedValue([]), findFirst: jest.fn() },
      downtimeLog: { count: jest.fn().mockResolvedValue(0), findMany: jest.fn().mockResolvedValue([]) },
      maintenanceSchedule: { count: jest.fn().mockResolvedValue(0), findMany: jest.fn().mockResolvedValue([]) },
      maintenanceRequestCostEntry: { aggregate: jest.fn().mockResolvedValue({ _sum: { amount: 0 } }), groupBy: jest.fn().mockResolvedValue([]) },
      maintenancePersonnel: { count: jest.fn().mockResolvedValue(0), groupBy: jest.fn().mockResolvedValue([]) },
      maintenanceRequestAssignment: { count: jest.fn().mockResolvedValue(0), groupBy: jest.fn().mockResolvedValue([]) },
      maintenancePartAccountability: { count: jest.fn().mockResolvedValue(0), groupBy: jest.fn().mockResolvedValue([]) },
      machineResponsibilityAssignment: { count: jest.fn().mockResolvedValue(0), groupBy: jest.fn().mockResolvedValue([]) },
      notification: { count: jest.fn().mockResolvedValue(3) },
      $transaction: jest.fn((fn) => fn(prisma)),
    };
    downtimeLogs = {
      getMttr: jest.fn().mockResolvedValue({ mttrMinutes: 60, mttrHours: 1, totalEvents: 2 }),
      getMtbf: jest.fn().mockResolvedValue({ mtbfHours: 10, totalEvents: 1 }),
      getTotalDowntime: jest.fn().mockResolvedValue({ totalMinutes: 60, totalHours: 1, totalEvents: 2 }),
      getTopMachines: jest.fn().mockResolvedValue([]),
      getTopCauses: jest.fn().mockResolvedValue([]),
    };
    service = new MaintenanceDashboardService(prisma as PrismaService, downtimeLogs as DowntimeLogsService);
  });

  describe('getSummary', () => {
    it('scopes every operational count through the owning company and branch', async () => {
      const result = await service.getSummary(ctx);

      // Open requests scope
      const openWhere = prisma.maintenanceRequest.count.mock.calls
        .map((c: any) => c[0].where)
        .find((w: any) => w.status === 'OPEN');
      expect(openWhere.machine).toEqual(scope);

      // Machines under maintenance are scoped by direct machine tenure
      const machineWhere = prisma.machine.count.mock.calls[0][0].where;
      expect(machineWhere.companyId).toBe('c1');
      expect(machineWhere.OR).toEqual([{ branchId: 'b1' }, { branchId: null }]);

      // Current downtime scoped through the machine relation
      const downtimeWhere = prisma.downtimeLog.count.mock.calls
        .map((c: any) => c[0].where)
        .find((w: any) => w.endTime === null);
      expect(downtimeWhere.machine).toEqual(scope);

      // Personnel scoped through their assignment / responsibility / accountability machine relations
      const personnelWhere = prisma.maintenancePersonnel.count.mock.calls[0][0].where;
      expect(personnelWhere.isActive).toBe(true);
      expect(Array.isArray(personnelWhere.OR)).toBe(true);
      expect(personnelWhere.OR).toHaveLength(3);

      // SLA counts are dashboard-scoped
      const slaWhere = prisma.maintenanceRequest.count.mock.calls
        .map((c: any) => c[0].where)
        .find((w: any) => w.slaStatus === 'OVERDUE');
      expect(slaWhere.machine).toEqual(scope);
      expect(slaWhere.deletedAt).toBeNull();

      expect(result.unreadNotifications).toBe(3);
      expect(result.reliability.mttr).toBe(1);
      expect(result.reliability.totalDowntimeHours).toBe(1);
    });

    it('does not include maintenance requests outside the active company', async () => {
      await service.getSummary(ctx);
      const openWhere = prisma.maintenanceRequest.count.mock.calls
        .map((c: any) => c[0].where)
        .find((w: any) => w.status === 'OPEN');
      expect(openWhere.machine.companyId).toBe('c1');
      expect(openWhere.machine.OR.some((b: any) => b.branchId === 'b1')).toBe(true);
    });

    it('scopes the unread notification count to the authenticated user', async () => {
      await service.getSummary(ctx, 'user-1');
      const unreadCall = prisma.notification.count.mock.calls.at(-1);
      expect(unreadCall[0].where).toEqual({ userId: 'user-1', read: false });
    });
  });

  describe('getOpenRequests', () => {
    it('rejects a machine not owned by the active company', async () => {
      prisma.machine.findFirst.mockResolvedValue(null);

      await expect(service.getOpenRequests({ machineId: 'mForeign' }, ctx)).rejects.toThrow(NotFoundException);
    });

    it('scopes open request listing by machine tenure and paginates', async () => {
      prisma.maintenanceRequest.findMany.mockResolvedValue([{ id: 'r1' }]);
      prisma.maintenanceRequest.count.mockResolvedValue(25);

      const result = await service.getOpenRequests({ page: 2, limit: 10 }, ctx);

      const where = prisma.maintenanceRequest.findMany.mock.calls[0][0].where;
      expect(where.status).toBe('OPEN');
      expect(where.machine).toEqual(scope);
      expect(prisma.maintenanceRequest.findMany.mock.calls[0][0].skip).toBe(10);
      expect(prisma.maintenanceRequest.findMany.mock.calls[0][0].take).toBe(10);
      expect(result.meta.total).toBe(25);
      expect(result.meta.totalPages).toBe(3);
    });
  });

  describe('getCurrentDowntime', () => {
    it('only returns running downtime logs owned by the company', async () => {
      await service.getCurrentDowntime({}, ctx);

      const where = prisma.downtimeLog.findMany.mock.calls[0][0].where;
      expect(where.endTime).toBeNull();
      expect(where.cancelledAt).toBeNull();
      expect(where.machine).toEqual(scope);
    });
  });

  describe('getCostKpis', () => {
    it('scopes cost aggregation through the owning request machine and enriches top requests', async () => {
      prisma.maintenanceRequestCostEntry.groupBy.mockResolvedValue([
        { requestId: 'r1', _sum: { amount: 500 } },
      ]);
      prisma.maintenanceRequest.findMany.mockResolvedValue([
        { id: 'r1', requestNumber: 'MR-1', title: 'Fix', machine: { id: 'm1', code: 'M1', name: 'Lathe' } },
      ]);

      const result = await service.getCostKpis({}, ctx);

      const aggregateWhere = prisma.maintenanceRequestCostEntry.aggregate.mock.calls[0][0].where;
      expect(aggregateWhere.request.machine).toEqual(scope);
      expect(result.topRequestsByCost[0].requestNumber).toBe('MR-1');
    });
  });

  describe('getSlaOverdue / getSlaEscalated', () => {
    it('scopes SLA overdue requests by company machine tenure', async () => {
      await service.getSlaOverdue({}, ctx);

      const where = prisma.maintenanceRequest.findMany.mock.calls[0][0].where;
      expect(where.slaStatus).toBe('OVERDUE');
      expect(where.machine).toEqual(scope);
    });

    it('scopes SLA escalated requests by company machine tenure', async () => {
      await service.getSlaEscalated({}, ctx);

      const where = prisma.maintenanceRequest.findMany.mock.calls[0][0].where;
      expect(where.escalationLevel.not).toBe('NONE');
      expect(where.machine).toEqual(scope);
    });
  });
});