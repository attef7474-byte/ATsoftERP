import { NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { MaintenanceReportsService } from './maintenance-reports.service';
import { ActiveOperationalContext } from '../../../common/operational-context/operational-context.types';

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

describe('MaintenanceReportsService', () => {
  let prisma: any;
  let service: MaintenanceReportsService;
  const scope = { companyId: 'c1', OR: [{ branchId: 'b1' }, { branchId: null }] };

  beforeEach(() => {
    prisma = {
      machine: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
      },
      productionLine: { findFirst: jest.fn() },
      maintenanceRequest: {
        count: jest.fn().mockResolvedValue(0),
        findMany: jest.fn().mockResolvedValue([]),
        aggregate: jest.fn().mockResolvedValue({}),
        groupBy: jest.fn().mockResolvedValue([]),
      },
      downtimeLog: {
        count: jest.fn().mockResolvedValue(0),
        findMany: jest.fn().mockResolvedValue([]),
        aggregate: jest.fn().mockResolvedValue({ _sum: { durationMinutes: 0 }, _avg: { durationMinutes: 0 } }),
        findFirst: jest.fn(),
      },
      maintenanceSchedule: { count: jest.fn().mockResolvedValue(0), findMany: jest.fn().mockResolvedValue([]) },
      maintenanceRequestCostEntry: {
        count: jest.fn().mockResolvedValue(0),
        aggregate: jest.fn().mockResolvedValue({ _sum: { amount: 0 } }),
        groupBy: jest.fn().mockResolvedValue([]),
        findMany: jest.fn().mockResolvedValue([]),
      },
      maintenanceRequestPartUsage: {
        count: jest.fn().mockResolvedValue(0),
        aggregate: jest.fn().mockResolvedValue({ _sum: { totalCost: 0, quantity: 0 } }),
        findMany: jest.fn().mockResolvedValue([]),
      },
      sparePartRepairOrder: {
        count: jest.fn().mockResolvedValue(0),
        aggregate: jest.fn().mockResolvedValue({ _sum: { actualRepairCost: 0 } }),
      },
      sparePart: { findFirst: jest.fn() },
    };
    service = new MaintenanceReportsService(prisma as PrismaService);
  });

  describe('getMaintenanceRequestsReport', () => {
    it('scopes all request counts through the owning machine and returns pagination', async () => {
      prisma.maintenanceRequest.findMany.mockResolvedValue([{ id: 'r1', machine: { name: 'Lathe' } }]);
      prisma.maintenanceRequest.count.mockResolvedValue(25);

      const result = await service.getMaintenanceRequestsReport({ page: 1, pageSize: 20 }, ctx);

      const where = prisma.maintenanceRequest.findMany.mock.calls[0][0].where;
      expect(where.machine).toEqual(scope);
      expect(prisma.maintenanceRequest.count).toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({ machine: scope }),
      }));
      expect(result.total).toBe(25);
      expect(result.totalPages).toBe(2);
      expect(result.cards.map((c: any) => c.label)).toContain('totalRequests');
    });

    it('rejects a machine owned by another company', async () => {
      prisma.machine.findFirst.mockResolvedValue(null);

      await expect(service.getMaintenanceRequestsReport({ machineId: 'mForeign' }, ctx)).rejects.toThrow(NotFoundException);
    });

    it('validates line ownership before applying a production line filter', async () => {
      prisma.productionLine.findFirst.mockResolvedValue(null);

      await expect(service.getMaintenanceRequestsReport({ productionLineId: 'lineForeign' }, ctx)).rejects.toThrow(NotFoundException);
    });
  });

  describe('getMachineDowntimeReport', () => {
    it('scopes downtime logs through the owning machine relation', async () => {
      await service.getMachineDowntimeReport({}, ctx);

      const where = prisma.downtimeLog.findMany.mock.calls[0][0].where;
      expect(where.machine).toEqual(scope);
    });
  });

  describe('getMaintenanceCostsReport', () => {
    it('scopes cost rows through the owning request machine', async () => {
      await service.getMaintenanceCostsReport({}, ctx);

      const where = prisma.maintenanceRequestCostEntry.findMany.mock.calls[0][0].where;
      expect(where.request).toEqual(expect.objectContaining({ machine: scope }));
    });

    it('rejects a machine owned by another company', async () => {
      prisma.machine.findFirst.mockResolvedValue(null);

      await expect(service.getMaintenanceCostsReport({ machineId: 'mForeign' }, ctx)).rejects.toThrow(NotFoundException);
    });
  });

  describe('getCostAnalysis', () => {
    it('aggregates cost entries, part usage and repair orders within the tenant and enriches per-machine cost', async () => {
      prisma.maintenanceRequestCostEntry.aggregate
        .mockResolvedValueOnce({ _sum: { amount: 1000 } })
        .mockResolvedValue({ _sum: { amount: 100 } });
      prisma.maintenanceRequestCostEntry.count.mockResolvedValue(3);
      prisma.maintenanceRequestPartUsage.aggregate
        .mockResolvedValueOnce({ _sum: { totalCost: 400, quantity: 30 } })
        .mockResolvedValue({ _sum: { totalCost: 50, quantity: 0 } });
      prisma.maintenanceRequestPartUsage.count.mockResolvedValue(2);
      prisma.sparePartRepairOrder.aggregate.mockResolvedValue({ _sum: { actualRepairCost: 200 } });
      prisma.sparePartRepairOrder.count.mockResolvedValue(1);
      prisma.maintenanceRequest.groupBy
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ machineId: 'm1', _count: 2 }]);
      prisma.machine.count.mockResolvedValue(4);
      prisma.machine.findUnique.mockResolvedValue({ id: 'm1', code: 'M1', name: 'Lathe' });

      const result = await service.getCostAnalysis({}, ctx);

      const costWhere = prisma.maintenanceRequestCostEntry.aggregate.mock.calls[0][0].where;
      expect(costWhere.request.machine).toEqual(scope);

      const cards = Object.fromEntries((result.cards as any[]).map((c: any) => [c.label, c.value]));
      expect(cards.totalCost).toBe(1000 + 400 + 200);
      expect(cards.partsCost).toBe(400);
      expect(cards.otherCost).toBe(1000);
      expect(cards.repairCost).toBe(200);
      expect(cards.costPerMachine).toBe(Math.round((1000 + 400 + 200) / 4));

      expect((result.costByMachine[0] as any).machine.code).toBe('M1');
      expect(result.costByMachine[0].requestCount).toBe(2);
      expect(result.costByMachine[0].totalCost).toBe(150);
    });
  });

  describe('getScheduleCompliance', () => {
    it('scopes schedules and computes compliance from completed preventive requests', async () => {
      prisma.maintenanceSchedule.count.mockResolvedValue(10);
      prisma.maintenanceRequest.count.mockResolvedValue(6);

      const result = await service.getScheduleCompliance({}, ctx);

      const scheduleWhere = prisma.maintenanceSchedule.count.mock.calls[0][0].where;
      expect(scheduleWhere.machine).toEqual(scope);

      const cards = Object.fromEntries((result.cards as any[]).map((c: any) => [c.label, c.value]));
      expect(cards.complianceRate).toBe(60);
    });
  });

  describe('getKpiOverview', () => {
    it('enforces tenant scope on every KPI and computes derived percentages', async () => {
      prisma.maintenanceRequest.count
        .mockResolvedValueOnce(10) // totalRequests
        .mockResolvedValueOnce(3)  // openRequests
        .mockResolvedValueOnce(4)  // inProgressRequests
        .mockResolvedValueOnce(6)  // completedRequests
        .mockResolvedValueOnce(1)  // cancelledRequests
        .mockResolvedValueOnce(5)  // correctiveCount
        .mockResolvedValueOnce(4)  // preventiveCount
        .mockResolvedValueOnce(2)  // emergencyCount
        .mockResolvedValueOnce(0)  // openBacklog
        .mockResolvedValueOnce(0)  // slaOverdueCount
        .mockResolvedValue(0);     // totalSlaCount + defaults
      prisma.downtimeLog.count = jest.fn()
        .mockResolvedValueOnce(7)  // totalDowntimeEvents
        .mockResolvedValue(0);     // activeDowntime

      const result = await service.getKpiOverview({}, ctx);

      const requestWhere = prisma.maintenanceRequest.count.mock.calls[0][0].where;
      expect(requestWhere.machine).toEqual(scope);

      const cards = Object.fromEntries((result.cards as any[]).map((c: any) => [c.label, c.value]));
      expect(cards.totalRequests).toBe(10);
      expect(cards.pmCmRatio).toBe(44);
      expect(cards.emergencyPercentage).toBe(20);
      expect(result.cards).toHaveLength(18);
    });

    it('rejects a foreign machine id before computing KPI cards', async () => {
      prisma.machine.findFirst.mockResolvedValue(null);

      await expect(service.getKpiOverview({ machineId: 'mForeign' }, ctx)).rejects.toThrow(NotFoundException);
    });
  });
});