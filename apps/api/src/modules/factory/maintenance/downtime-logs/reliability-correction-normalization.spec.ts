import { NotFoundException } from '@nestjs/common';
import { DowntimeLogsService } from './downtime-logs.service';

/**
 * Phase 2 Batch 2C — correction/supersession normalization (D-2C-3, §11).
 * Every reliability KPI in the existing maintenance reliability authority must
 * exclude cancelled facts, exclude superseded/corrected originals, and keep the
 * corrected replacement so each live reliability event is counted exactly once.
 */
describe('DowntimeLogsService reliability correction normalization', () => {
  let service: DowntimeLogsService;
  let prisma: any;
  let audit: any;

  const ctx: any = { companyId: 'c1', branchId: 'b1' };
  const scope = { companyId: 'c1', OR: [{ branchId: 'b1' }, { branchId: null }] };

  beforeEach(() => {
    prisma = {
      machine: { findUnique: jest.fn(), findMany: jest.fn() },
      productionLine: { findMany: jest.fn() },
      downtimeLog: {
        count: jest.fn().mockResolvedValue(0),
        aggregate: jest.fn().mockResolvedValue({ _sum: { durationMinutes: 0 }, _avg: { durationMinutes: 0 }, _count: 0 }),
        groupBy: jest.fn().mockResolvedValue([]),
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn().mockResolvedValue(null),
      },
    };
    audit = { log: jest.fn().mockResolvedValue({}) };
    service = new DowntimeLogsService(prisma, audit);
  });

  const expectCorrectionsFilter = (where: any) => {
    expect(where.cancelledAt).toBeNull();
    expect(where.corrections).toEqual({ none: {} });
  };

  describe('MTBF', () => {
    it('excludes cancelled and superseded originals in the count where clause', async () => {
      prisma.downtimeLog.count.mockResolvedValue(2);
      prisma.downtimeLog.findFirst.mockResolvedValueOnce({ startTime: new Date('2026-08-01T00:00:00Z') });
      prisma.downtimeLog.findFirst.mockResolvedValueOnce({ startTime: new Date('2026-08-03T00:00:00Z') });

      const result = await service.getMtbf({ dateFrom: '2026-08-01', dateTo: '2026-08-04' }, ctx);

      expectCorrectionsFilter(prisma.downtimeLog.count.mock.calls[0][0].where);
      expect(result.totalEvents).toBe(2);
    });
  });

  describe('MTTR', () => {
    it('excludes cancelled and superseded originals', async () => {
      prisma.downtimeLog.aggregate.mockResolvedValue({ _sum: { durationMinutes: 120 }, _avg: { durationMinutes: 60 }, _count: 2 });

      await service.getMttr({}, ctx);

      const where = prisma.downtimeLog.aggregate.mock.calls[0][0].where;
      expectCorrectionsFilter(where);
      expect(where.endTime).toEqual({ not: null });
      expect(where.durationMinutes).toEqual({ not: null });
    });
  });

  describe('Total downtime', () => {
    it('excludes cancelled and superseded originals', async () => {
      await service.getTotalDowntime({}, ctx);
      expectCorrectionsFilter(prisma.downtimeLog.aggregate.mock.calls[0][0].where);
    });
  });

  describe('Downtime by machine / line / cause', () => {
    it('by-machine excludes cancelled and superseded originals', async () => {
      prisma.machine.findMany.mockResolvedValue([]);
      await service.getDowntimeByMachine({}, ctx);
      expectCorrectionsFilter(prisma.downtimeLog.groupBy.mock.calls[0][0].where);
    });

    it('by-production-line excludes cancelled and superseded originals', async () => {
      prisma.machine.findMany.mockResolvedValue([]);
      prisma.productionLine.findMany.mockResolvedValue([]);
      await service.getDowntimeByProductionLine({}, ctx);
      expectCorrectionsFilter(prisma.downtimeLog.groupBy.mock.calls[0][0].where);
      expect(prisma.downtimeLog.findMany).not.toHaveBeenCalled();
    });

    it('by-production-line aggregates by machine in SQL and tenant-scopes both reference reads', async () => {
      prisma.downtimeLog.groupBy.mockResolvedValue([
        { machineId: 'm1', _sum: { durationMinutes: 90 }, _count: 2 },
      ]);
      prisma.machine.findMany.mockResolvedValue([{ id: 'm1', productionLineId: 'line1' }]);
      prisma.productionLine.findMany.mockResolvedValue([{ id: 'line1', code: 'L1', name: 'Line 1' }]);

      const result = await service.getDowntimeByProductionLine({}, ctx);

      expect(result).toEqual([{ productionLine: { id: 'line1', code: 'L1', name: 'Line 1' }, totalMinutes: 90, totalHours: 1.5, eventCount: 2 }]);
      expect(prisma.machine.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining(scope) }));
      expect(prisma.productionLine.findMany).toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({ companyId: 'c1', branchId: 'b1' }),
      }));
    });

    it('by-cause excludes cancelled and superseded originals', async () => {
      await service.getDowntimeByCause({}, ctx);
      expectCorrectionsFilter(prisma.downtimeLog.groupBy.mock.calls[0][0].where);
    });
  });

  describe('Repeat failures and emergency response', () => {
    it('repeat-failures list excludes cancelled and superseded originals', async () => {
      await service.getRepeatFailures({}, ctx);
      const where = prisma.downtimeLog.findMany.mock.calls[0][0].where;
      expect(where.isRepeatFailure).toBe(true);
      expectCorrectionsFilter(where);
    });

    it('emergency response time excludes cancelled and superseded originals', async () => {
      prisma.downtimeLog.count.mockResolvedValue(0);
      await service.getEmergencyResponseTime({}, ctx);
      expectCorrectionsFilter(prisma.downtimeLog.findMany.mock.calls[0][0].where);
      expect(prisma.downtimeLog.findMany.mock.calls[0][0].take).toBe(2000);
    });

    it('emergency response fails before loading an oversized event set', async () => {
      prisma.downtimeLog.count.mockResolvedValue(2001);

      await expect(service.getEmergencyResponseTime({}, ctx)).rejects.toThrow('narrow the filters');

      expect(prisma.downtimeLog.findMany).not.toHaveBeenCalled();
    });
  });

  describe('Corrected replacement counted once', () => {
    it('counts the replacement, never the superseded original, in total downtime', async () => {
      let calledWithOriginal = false;
      let calledWithReplacement = false;
      prisma.downtimeLog.aggregate.mockImplementation(({ where }: any) => {
        if (where.corrections && where.corrections.none) {
          calledWithReplacement = true;
        } else {
          calledWithOriginal = true;
        }
        return Promise.resolve({ _sum: { durationMinutes: 45 }, _count: 1 });
      });

      // A corrected original (has a correction) must never satisfy `corrections: { none: {} }`.
      const supersededOriginal = { correctsLogId: null, corrections: [{ id: 'd2' }] };
      const replacement = { correctsLogId: 'd1', corrections: [] };
      const isLive = (log: any) => log.cancelledAt == null && log.corrections.length === 0;

      expect(isLive(supersededOriginal)).toBe(false);
      expect(isLive(replacement)).toBe(true);

      await service.getTotalDowntime({}, ctx);
      expect(calledWithReplacement).toBe(true);
      expect(calledWithOriginal).toBe(false);
    });
  });

  describe('Tenant and reference scoping', () => {
    it('scopes reliability queries through the owning machine', async () => {
      await service.getMtbf({}, ctx);
      const where = prisma.downtimeLog.count.mock.calls[0][0].where;
      expect(where.machine).toEqual(scope);
    });

    it('rejects a foreign machine id in MTBF', async () => {
      prisma.machine.findUnique.mockResolvedValue(null);
      await expect(service.getMtbf({ machineId: 'mForeign' }, ctx)).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('getReliabilityDrilldown', () => {
    it('returns only effective live events (cancelled and superseded excluded), tenant scoped', async () => {
      prisma.machine.findUnique.mockResolvedValue({ id: 'm1', companyId: 'c1', branchId: 'b1' });
      prisma.downtimeLog.findMany.mockResolvedValue([
        { id: 'd1', machine: { id: 'm1' }, segments: [], cancelledAt: null, endTime: new Date() },
      ]);
      prisma.downtimeLog.count.mockResolvedValue(1);

      const result = await service.getReliabilityDrilldown({ machineId: 'm1', page: 1, limit: 10 }, ctx);

      const where = prisma.downtimeLog.findMany.mock.calls[0][0].where;
      expectCorrectionsFilter(where);
      expect(where.machine).toEqual(scope);
      expect(result.meta.total).toBe(1);
      expect(result.data).toHaveLength(1);
    });

    it('resolves a production line to its owned machines', async () => {
      prisma.machine.findMany.mockResolvedValue([{ id: 'm1' }, { id: 'm2' }]);
      prisma.downtimeLog.findMany.mockResolvedValue([]);

      await service.getReliabilityDrilldown({ productionLineId: 'line1' }, ctx);

      const where = prisma.downtimeLog.findMany.mock.calls[0][0].where;
      expect(where.machineId).toEqual({ in: ['m1', 'm2'] });
    });

    it('includes linked production segment detail for the single-event link', async () => {
      prisma.downtimeLog.findMany.mockResolvedValue([
        { id: 'd1', machine: { id: 'm1' }, segments: [{ id: 'seg1', planned: false, productionRunId: 'run1' }], cancelledAt: null },
      ]);
      prisma.downtimeLog.count.mockResolvedValue(1);

      const result = await service.getReliabilityDrilldown({}, ctx);

      expect(result.data[0].segments).toEqual([{ id: 'seg1', planned: false, productionRunId: 'run1' }]);
    });

    it('rejects a foreign machine id', async () => {
      prisma.machine.findUnique.mockResolvedValue(null);
      await expect(service.getReliabilityDrilldown({ machineId: 'mForeign' }, ctx)).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
