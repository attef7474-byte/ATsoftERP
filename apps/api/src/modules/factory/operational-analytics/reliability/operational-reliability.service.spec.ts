import { BadRequestException } from '@nestjs/common';
import { OperationalReliabilityService } from './operational-reliability.service';
import { MaintenanceReliabilityService } from '../../maintenance/maintenance-reliability/maintenance-reliability.service';
import { DowntimeLogsService } from '../../maintenance/downtime-logs/downtime-logs.service';
import { ProductionAnalyticsService } from '../../production-analytics/production-analytics.service';
import { OPERATIONAL_RELIABILITY_EXPORT_AUDIT_ENTITY } from './operational-reliability.constants';
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

const baseQuery = { dateFrom: '2026-08-01', dateTo: '2026-08-08' };

const oeeAvailabilityResult = {
  formulaVersion: 'PHASE_1_9_OEE_V1',
  aggregates: {
    runCount: 2,
    plannedMinutes: '960',
    operatingMinutes: '900',
    availability: {
      fraction: '0.9375',
      percent: '93.75',
      numerator: '900',
      denominator: '960',
      unit: 'minutes',
      blockers: [],
      warnings: [],
    },
  },
};

describe('OperationalReliabilityService (facade)', () => {
  let maintenanceReliability: any;
  let downtimeLogs: any;
  let productionAnalytics: any;
  let audit: any;
  let service: OperationalReliabilityService;

  beforeEach(() => {
    maintenanceReliability = {
      getMtbf: jest.fn().mockResolvedValue({ mtbfHours: 20, totalEvents: 3 }),
      getMttr: jest.fn().mockResolvedValue({ mttrHours: 1, totalEvents: 2 }),
      getTotalDowntime: jest.fn().mockResolvedValue({ totalHours: 4, totalEvents: 2 }),
      getRepeatFailureRate: jest.fn().mockResolvedValue({ totalEvents: 4, repeatEvents: 1, repeatFailureRate: 25 }),
      getEmergencyResponseTime: jest.fn().mockResolvedValue({ avgResponseTimeHours: 0.5, totalEvents: 2 }),
      getSlaTimes: jest.fn().mockResolvedValue({ avgResponseTimeHours: 2, samplesResponse: 1 }),
      getDowntimeByMachine: jest.fn().mockResolvedValue([]),
      getDowntimeByProductionLine: jest.fn().mockResolvedValue([]),
      getDowntimeByCause: jest.fn().mockResolvedValue([]),
      getRepeatFailures: jest.fn().mockResolvedValue([]),
    };
    downtimeLogs = {
      getReliabilityDrilldown: jest.fn().mockResolvedValue({
        data: [{ id: 'd1', machine: { id: 'm1' }, segments: [] }],
        meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
      }),
    };
    productionAnalytics = {
      oee: jest.fn().mockResolvedValue(oeeAvailabilityResult),
    };
    audit = { log: jest.fn().mockResolvedValue({}) };
    service = new OperationalReliabilityService(
      maintenanceReliability as unknown as MaintenanceReliabilityService,
      downtimeLogs as unknown as DowntimeLogsService,
      productionAnalytics as unknown as ProductionAnalyticsService,
      audit,
    );
  });

  describe('summary — delegation to the maintenance reliability authority', () => {
    it('delegates every maintenance reliability metric to the authority with window + context', async () => {
      await service.summary(baseQuery, ctx);

      expect(maintenanceReliability.getMtbf).toHaveBeenCalledWith(
        { machineId: undefined, productionLineId: undefined, dateFrom: '2026-08-01', dateTo: '2026-08-08' },
        ctx,
      );
      expect(maintenanceReliability.getMttr).toHaveBeenCalled();
      expect(maintenanceReliability.getTotalDowntime).toHaveBeenCalled();
      expect(maintenanceReliability.getRepeatFailureRate).toHaveBeenCalledWith(
        { machineId: undefined, productionLineId: undefined, dateFrom: '2026-08-01', dateTo: '2026-08-08', operationTypeId: undefined, costCenterId: undefined },
        ctx,
      );
      expect(maintenanceReliability.getEmergencyResponseTime).toHaveBeenCalled();
      expect(maintenanceReliability.getSlaTimes).toHaveBeenCalled();
      expect(maintenanceReliability.getDowntimeByMachine).toHaveBeenCalled();
      expect(maintenanceReliability.getDowntimeByProductionLine).toHaveBeenCalled();
      expect(maintenanceReliability.getDowntimeByCause).toHaveBeenCalled();
      expect(maintenanceReliability.getRepeatFailures).toHaveBeenCalled();
    });

    it('does not recompute MTBF/MTTR: summary values equal the authority outputs (single-engine ownership)', async () => {
      const result = await service.summary(baseQuery, ctx);

      expect(result.metrics.mtbf.mtbfHours).toBe(20);
      expect(result.metrics.mtbf.totalEvents).toBe(3);
      expect(result.metrics.mttr.mttrHours).toBe(1);
      expect(result.metrics.totalDowntime.totalHours).toBe(4);
      expect(result.metrics.repeatFailureRate.repeatFailureRate).toBe(25);
      expect(result.metrics.slaTimes.avgResponseTimeHours).toBe(2);
    });

    it('preserves machine and line filters to the authorities', async () => {
      const query = { dateFrom: '2026-08-01', dateTo: '2026-08-08', machineId: 'm1', productionLineId: 'l1', operationTypeId: 'op1', costCenterId: 'cc1' };
      await service.summary(query, ctx);

      expect(maintenanceReliability.getMtbf).toHaveBeenCalledWith(
        { machineId: 'm1', productionLineId: 'l1', dateFrom: '2026-08-01', dateTo: '2026-08-08' },
        ctx,
      );
      expect(productionAnalytics.oee).toHaveBeenCalledWith(
        { dateFrom: '2026-08-01', dateTo: '2026-08-08', machineId: 'm1', productionLineId: 'l1' },
        ctx,
      );
    });
  });

  describe('summary — canonical availability reuses the OEE authority', () => {
    it('exposes the OEE availability numbers with the reused PHASE_1_9_OEE_V1 version', async () => {
      const result = await service.summary(baseQuery, ctx);

      expect(productionAnalytics.oee).toHaveBeenCalledTimes(1);
      const availability = result.metrics.availability;
      expect(availability.percent).toBe('93.75');
      expect(availability.numerator).toBe('900');
      expect(availability.denominator).toBe('960');
      expect(availability.plannedMinutes).toBe('960');
      expect(availability.operatingMinutes).toBe('900');
      expect(availability.metadata.formulaVersion).toBe('PHASE_1_9_OEE_V1');
      expect(availability.metadata.authority).toBe('production-analytics');
      expect(availability.metadata.plannedTimeBasis).toContain('ProductionSession');
      expect(availability.metadata.downtimeBehavior).toContain('planned segments do not reduce availability');
    });

    it('marks a missing planned-time basis as blocked instead of inventing a formula', async () => {
      productionAnalytics.oee.mockResolvedValue({
        formulaVersion: 'PHASE_1_9_OEE_V1',
        aggregates: {
          runCount: 0,
          plannedMinutes: '0',
          operatingMinutes: '0',
          availability: { fraction: null, percent: null, numerator: '0', denominator: '0', unit: 'minutes', blockers: ['noPlannedProductionTime'], warnings: [] },
        },
      });

      const result = await service.summary(baseQuery, ctx);
      expect(result.metrics.availability.percent).toBeNull();
      expect(result.metrics.availability.blockers).toContain('noPlannedProductionTime');
    });
  });

  describe('summary — normalized contract metadata', () => {
    it('envelopes every metric with formulaVersion, authority and source model', async () => {
      const result = await service.summary(baseQuery, ctx);
      const metrics: Record<string, any> = result.metrics;

      for (const key of ['mtbf', 'mttr', 'totalDowntime', 'repeatFailureRate', 'emergencyResponseTime', 'slaTimes', 'availability']) {
        expect(metrics[key].metadata.key).toBe(key);
        expect(metrics[key].metadata.formulaVersion).toBeTruthy();
        expect(metrics[key].metadata.authority).toBeTruthy();
        expect(metrics[key].metadata.sourceModel).toBeTruthy();
      }
      expect(result.normalization).toEqual({
        cancelledExcluded: true,
        supersededOriginalsExcluded: true,
        correctedReplacementCountedOnce: true,
        dedupByDowntimeLogId: true,
      });
      expect(result.metricMetadata).toHaveLength(9);
    });

    it('exposes the applied window and filters', async () => {
      const result = await service.summary(baseQuery, ctx);
      expect(result.window.from).toBe('2026-08-01T00:00:00.000Z');
      expect(result.window.to).toBe('2026-08-08T23:59:59.999Z');
      expect(result.filters).toEqual({ machineId: null, productionLineId: null, operationTypeId: null, costCenterId: null });
    });

    it('rejects an inverted window', async () => {
      await expect(service.summary({ dateFrom: '2026-08-08', dateTo: '2026-08-01' }, ctx)).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('drilldown', () => {
    it('delegates to the maintenance authority and exposes the single-event link contract', async () => {
      const result = await service.drilldown({ ...baseQuery, page: 2, limit: 10 }, ctx);

      expect(downtimeLogs.getReliabilityDrilldown).toHaveBeenCalledWith(
        { page: 2, limit: 10, dateFrom: '2026-08-01', dateTo: '2026-08-08', machineId: undefined, productionLineId: undefined },
        ctx,
      );
      expect(result.data).toHaveLength(1);
      expect(result.deduplication).toContain('one DowntimeLog header + linked DowntimeSegments = one physical event');
      expect(result.normalization.supersededOriginalsExcluded).toBe(true);
    });

    it('preserves tenant scope by delegating the active context (no client spoofing surface)', async () => {
      await service.drilldown({ ...baseQuery, page: 1, limit: 20 }, ctx);
      const [, passedCtx] = downtimeLogs.getReliabilityDrilldown.mock.calls[0];
      expect(passedCtx).toBe(ctx);
    });
  });

  describe('export', () => {
    it('serializes the same summary semantics without an alternate formula', async () => {
      maintenanceReliability.getDowntimeByMachine.mockResolvedValue([
        { machine: { code: 'M1' }, totalHours: 2, eventCount: 1 },
      ]);
      const result = await service.export(baseQuery, 'u1', ctx);

      expect(result.report).toBe('reliability');
      expect(result.csv).toContain('mtbf');
      expect(result.csv).toContain('2C_MTBF_V1');
      expect(result.csv).toContain('PHASE_1_9_OEE_V1');
      expect(result.csv).toContain('downtimeByMachine');
      expect(result.csv).toContain('M1');
      expect(audit.log).toHaveBeenCalledWith('u1', 'EXPORT', OPERATIONAL_RELIABILITY_EXPORT_AUDIT_ENTITY, undefined, expect.objectContaining({
        companyId: 'c1',
        branchId: 'b1',
        report: 'reliability',
      }));
    });
  });
});
