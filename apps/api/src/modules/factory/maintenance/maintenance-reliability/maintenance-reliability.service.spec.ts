import { NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../../common/prisma/prisma.service';
import { DowntimeLogsService } from '../downtime-logs/downtime-logs.service';
import { MaintenanceReliabilityService } from './maintenance-reliability.service';
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

describe('MaintenanceReliabilityService', () => {
  let prisma: any;
  let downtimeLogs: any;
  let service: MaintenanceReliabilityService;
  const scope = { companyId: 'c1', OR: [{ branchId: 'b1' }, { branchId: null }] };

  beforeEach(() => {
    prisma = {
      machine: { findUnique: jest.fn(), findFirst: jest.fn(), findMany: jest.fn() },
      productionLine: { findFirst: jest.fn() },
      downtimeLog: { count: jest.fn(), aggregate: jest.fn(), findFirst: jest.fn(), findMany: jest.fn() },
      maintenanceRequest: { findFirst: jest.fn(), findMany: jest.fn(), count: jest.fn().mockResolvedValue(0) },
    };
    downtimeLogs = {
      getMttr: jest.fn().mockResolvedValue({ mttrHours: 1, totalEvents: 2 }),
      getMtbf: jest.fn().mockResolvedValue({ mtbfHours: 10 }),
      getTotalDowntime: jest.fn().mockResolvedValue({ totalMinutes: 60, totalHours: 1, totalEvents: 2 }),
      getDowntimeByMachine: jest.fn().mockResolvedValue([]),
      getDowntimeByProductionLine: jest.fn().mockResolvedValue([]),
      getDowntimeByCause: jest.fn().mockResolvedValue([]),
      getRepeatFailures: jest.fn().mockResolvedValue([]),
      getEmergencyResponseTime: jest.fn().mockResolvedValue(0),
      getTopMachines: jest.fn().mockResolvedValue([]),
      getTopCauses: jest.fn().mockResolvedValue([]),
    };
    service = new MaintenanceReliabilityService(prisma as PrismaService, downtimeLogs as DowntimeLogsService);
  });

  describe('pre-existing KPIs', () => {
    it('delegates MTTR to the downtime logs service with the active context', async () => {
      await service.getMttr({ machineId: 'm1' }, ctx);
      expect(downtimeLogs.getMttr).toHaveBeenCalledWith({ machineId: 'm1' }, ctx);
    });

    it('delegates total downtime with the active context', async () => {
      await service.getTotalDowntime({}, ctx);
      expect(downtimeLogs.getTotalDowntime).toHaveBeenCalledWith({}, ctx);
    });
  });

  describe('getRepeatFailureRate', () => {
    it('scopes repeated and total events through the owning machine', async () => {
      prisma.downtimeLog.count.mockResolvedValue(4);
      prisma.downtimeLog.count.mockResolvedValueOnce(4).mockResolvedValueOnce(1);

      const result = await service.getRepeatFailureRate({}, ctx);

      expect(prisma.downtimeLog.count).toHaveBeenNthCalledWith(1, expect.objectContaining({
        where: expect.objectContaining({ machine: scope }),
      }));
      const first = prisma.downtimeLog.count.mock.calls[0][0].where;
      const second = prisma.downtimeLog.count.mock.calls[1][0].where;
      expect(second.isRepeatFailure).toBe(true);
      expect(first.isRepeatFailure ?? false).toBe(false);
      expect(result.totalEvents).toBe(4);
      expect(result.repeatEvents).toBe(1);
      expect(result.repeatFailureRate).toBe(25);
    });

    it('merges operationTypeId and costCenterId filters into the machine relation', async () => {
      prisma.downtimeLog.count.mockResolvedValue(0);

      await service.getRepeatFailureRate({ operationTypeId: 'op1', costCenterId: 'cc1' }, ctx);

      const where = prisma.downtimeLog.count.mock.calls[0][0].where;
      expect(where.machine.companyId).toBe('c1');
      expect(where.machine.operationTypeId).toBe('op1');
      expect(where.machine.defaultCostCenterId).toBe('cc1');
    });

    it('rejects a foreign machine id', async () => {
      prisma.machine.findFirst.mockResolvedValue(null);

      await expect(service.getRepeatFailureRate({ machineId: 'mForeign' }, ctx)).rejects.toThrow(NotFoundException);
    });

    it('rejects a foreign production line id', async () => {
      prisma.productionLine.findFirst.mockResolvedValue(null);

      await expect(service.getRepeatFailureRate({ productionLineId: 'lineForeign' }, ctx)).rejects.toThrow(NotFoundException);
    });

    it('excludes cancelled and superseded originals via correction normalization', async () => {
      prisma.downtimeLog.count.mockResolvedValue(0);

      await service.getRepeatFailureRate({}, ctx);

      const where = prisma.downtimeLog.count.mock.calls[0][0].where;
      expect(where.cancelledAt).toBeNull();
      expect(where.corrections).toEqual({ none: {} });
    });
  });

  describe('getAvailability', () => {
    it('computes availability over an explicit date range', async () => {
      prisma.downtimeLog.aggregate.mockResolvedValue({ _sum: { durationMinutes: 120 } });

      const result = await service.getAvailability(
        { dateFrom: '2026-08-01T00:00:00.000Z', dateTo: '2026-08-02T00:00:00.000Z' },
        ctx,
      );

      expect(result.periodHours).toBe(24);
      expect(result.downtimeHours).toBe(2);
      expect(result.uptimeHours).toBe(22);
      expect(result.availabilityPercent).toBeCloseTo(91.67, 1);
    });

    it('returns a note instead of a percentage when the period cannot be derived', async () => {
      prisma.downtimeLog.aggregate.mockResolvedValue({ _sum: { durationMinutes: 0 } });
      prisma.downtimeLog.findFirst.mockResolvedValue(null);

      const result = await service.getAvailability({}, ctx);

      expect(result.availabilityPercent).toBeNull();
      expect(result.note).toBe('Insufficient data to calculate period');
    });

    it('excludes cancelled and superseded originals via correction normalization', async () => {
      prisma.downtimeLog.aggregate.mockResolvedValue({ _sum: { durationMinutes: 0 } });
      prisma.downtimeLog.findFirst.mockResolvedValue(null);

      await service.getAvailability({}, ctx);

      const where = prisma.downtimeLog.aggregate.mock.calls[0][0].where;
      expect(where.cancelledAt).toBeNull();
      expect(where.corrections).toEqual({ none: {} });
    });
  });

  describe('getSlaTimes', () => {
    it('derives average response, repair and completion times from SLA target fields', async () => {
      prisma.maintenanceRequest.findMany.mockResolvedValue([
        {
          createdAt: new Date('2026-08-01T08:00:00.000Z'),
          responseDueAt: new Date('2026-08-01T10:00:00.000Z'),
          startDueAt: new Date('2026-08-01T10:00:00.000Z'),
          completeDueAt: new Date('2026-08-01T14:00:00.000Z'),
          startDate: new Date('2026-08-01T10:00:00.000Z'),
          endDate: new Date('2026-08-01T15:00:00.000Z'),
        },
      ]);

      const result = await service.getSlaTimes({}, ctx);

      expect(result.avgResponseTimeHours).toBe(2);
      expect(result.avgRepairTimeHours).toBe(4);
      expect(result.avgCompletionTimeHours).toBe(5);
      expect(result.samplesResponse).toBe(1);
    });

    it('does not allow reading SLA metrics for a foreign machine', async () => {
      prisma.machine.findFirst.mockResolvedValue(null);

      await expect(service.getSlaTimes({ machineId: 'mForeign' }, ctx)).rejects.toThrow(NotFoundException);
    });

    it('fails before loading a silently truncated SLA sample', async () => {
      prisma.maintenanceRequest.count.mockResolvedValue(1001);

      await expect(service.getSlaTimes({}, ctx)).rejects.toThrow('narrow the filters');

      expect(prisma.maintenanceRequest.findMany).not.toHaveBeenCalled();
    });
  });
});
