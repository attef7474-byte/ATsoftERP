import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PerformanceKpiPreviewService } from './performance-kpi-preview.service';
import { aggregateFactor, availabilityFactor, idealRatePerHour, oeeProduct, performanceFactor, qualityFactor } from '../../factory/production-analytics/oee-formula.util';
import { deriveRunTotals } from '../../factory/production-runs/production-runs.util';

describe('PerformanceKpiPreviewService', () => {
  const prisma: any = {
    performanceKpiDefinition: { findFirst: jest.fn() },
    performanceProfileKpiEligibility: { findFirst: jest.fn() },
    operationalPerson: { findFirst: jest.fn() },
    downtimeLog: { findMany: jest.fn() },
    maintenancePersonnel: { findFirst: jest.fn() },
    machineResponsibilityAssignment: { findMany: jest.fn() },
    productionRun: { findMany: jest.fn() },
    productionLossQuantityEvent: { findMany: jest.fn() },
  };
  const contextService: any = { resolve: jest.fn() };
  const ctx: any = { companyId: 'c1', branchId: 'b1' };
  let service: PerformanceKpiPreviewService;

  beforeEach(() => { jest.resetAllMocks(); service = new PerformanceKpiPreviewService(prisma, contextService); });

  const baseDto = { operationalPersonId: 'p1', kpiCode: 'MAINT_RESPONSE_TIME_AVG', dateFrom: '2026-01-01T00:00:00.000Z', dateTo: '2026-01-31T23:59:59.999Z' };

  function mockProfileAndKpi(kpiOverrides: any = {}, eligible = true) {
    contextService.resolve.mockResolvedValue({ employee: { id: 'p1', code: 'E1', name: 'Emp' }, performanceProfile: { id: 'prof1', code: 'MAINT_TECH' }, organization: {} });
    prisma.performanceKpiDefinition.findFirst.mockResolvedValue({ id: 'k1', code: baseDto.kpiCode, name: 'Response Time', nameAr: null, nameEn: null, domain: 'MAINTENANCE_EXECUTION', measurementUnit: 'MINUTES', direction: 'LOWER_IS_BETTER', aggregationType: 'AVERAGE', calculationMode: 'FORMULA', sourceContractKey: 'maintenance.response_time', calculationVersion: 1, status: 'ACTIVE', isActive: true, ...kpiOverrides });
    prisma.performanceProfileKpiEligibility.findFirst.mockResolvedValue(eligible ? { id: 'e1' } : null);
  }

  it('returns NOT_APPLICABLE when KPI not eligible for profile', async () => {
    mockProfileAndKpi({}, false);
    const res = await service.preview(baseDto as any, ctx);
    expect(res.status).toBe('NOT_APPLICABLE');
  });

  it('returns INSUFFICIENT_DATA when no attributed records exist', async () => {
    mockProfileAndKpi();
    prisma.operationalPerson.findFirst.mockResolvedValue({ userId: 'u1' });
    prisma.downtimeLog.findMany.mockResolvedValue([]);
    const res = await service.preview(baseDto as any, ctx);
    expect(res.status).toBe('INSUFFICIENT_DATA');
  });

  it('calculates response time average and excludes missing timestamps/invalid values', async () => {
    mockProfileAndKpi();
    prisma.operationalPerson.findFirst.mockResolvedValue({ userId: 'u1' });
    prisma.downtimeLog.findMany.mockResolvedValue([
      { id: 'd1', startTime: new Date('2026-01-05T10:00:00Z'), detectedAt: new Date('2026-01-05T10:00:00Z'), responseStartedAt: new Date('2026-01-05T10:12:00Z'), machine: { code: 'M1' }, requestId: 'r1', executionId: 'ex1' },
      { id: 'd2', startTime: new Date('2026-01-06T10:00:00Z'), detectedAt: new Date('2026-01-06T10:00:00Z'), responseStartedAt: new Date('2026-01-06T10:18:00Z'), machine: { code: 'M1' }, requestId: 'r2', executionId: 'ex2' },
      { id: 'd3', startTime: new Date('2026-01-07T10:00:00Z'), detectedAt: new Date('2026-01-07T10:00:00Z'), responseStartedAt: null, machine: { code: 'M1' }, requestId: 'r3', executionId: 'ex3' },
    ]);
    const res = await service.preview(baseDto as any, ctx);
    expect(res.status).toBe('CALCULABLE');
    expect(res.rawValue).toBe(15);
    expect(res.evidenceCount).toBe(2);
    expect(res.excluded.count).toBe(1);
  });

  it('uses tenant-scoped downtime query for maintenance KPIs', async () => {
    mockProfileAndKpi();
    prisma.operationalPerson.findFirst.mockResolvedValue({ userId: 'u1' });
    prisma.downtimeLog.findMany.mockResolvedValue([]);
    await service.preview(baseDto as any, ctx);
    const arg = prisma.downtimeLog.findMany.mock.calls[0][0];
    expect(arg.where.machine).toEqual({ companyId: 'c1', OR: [{ branchId: 'b1' }, { branchId: null }] });
  });

  it('returns ATTRIBUTION_AMBIGUOUS when employee has no linked user for execution attribution', async () => {
    mockProfileAndKpi();
    prisma.operationalPerson.findFirst.mockResolvedValue({ userId: null });
    const res = await service.preview(baseDto as any, ctx);
    expect(res.status).toBe('ATTRIBUTION_AMBIGUOUS');
  });

  it('computes production OEE using canonical formula utilities for identical run/window', async () => {
    mockProfileAndKpi({ code: 'PROD_OEE', domain: 'PRODUCTION_EFFICIENCY', measurementUnit: 'PERCENT', direction: 'HIGHER_IS_BETTER', aggregationType: 'RATIO', calculationMode: 'DERIVED_FROM_CANONICAL_ANALYTICS', sourceContractKey: 'production.oee' });
    const from = new Date('2026-01-01T00:00:00.000Z');
    const to = new Date('2026-01-01T08:00:00.000Z');
    const run: any = {
      id: 'run1', runNumber: 'RUN-1', startedAt: from, endedAt: to, standardRate: new Prisma.Decimal(10), timeBasis: 'HOUR',
      productionOrder: { orderNumber: 'PO-1' }, productionLine: { code: 'L1' },
      sessions: [{ startedAt: from, closedAt: to }],
      downtimeSegments: [{ id: 's1', startedAt: new Date('2026-01-01T01:00:00.000Z'), endedAt: new Date('2026-01-01T01:30:00.000Z'), planned: false, status: 'CLOSED' }],
      outputEvents: [
        { id: 'o1', occurredAt: new Date('2026-01-01T02:00:00Z'), eventType: 'PRODUCTION', classification: 'FINAL_OUTPUT', quantity: new Prisma.Decimal(70), goodQuantity: new Prisma.Decimal(70), rejectQuantity: new Prisma.Decimal(0), correctsEventId: null, measurementPointId: 'mp1', measurementPoint: { isAuthoritativeFinal: true } },
        { id: 'o2', occurredAt: new Date('2026-01-01T03:00:00Z'), eventType: 'PRODUCTION', classification: 'FINAL_OUTPUT', quantity: new Prisma.Decimal(5), goodQuantity: new Prisma.Decimal(0), rejectQuantity: new Prisma.Decimal(5), correctsEventId: null, measurementPointId: 'mp1', measurementPoint: { isAuthoritativeFinal: true } },
      ],
    };
    prisma.productionRun.findMany.mockResolvedValue([run]);

    const res = await service.preview({ ...baseDto, kpiCode: 'PROD_OEE', dateFrom: from.toISOString(), dateTo: to.toISOString() } as any, ctx);
    expect(res.status).toBe('CALCULABLE');

    const planned = new Prisma.Decimal(480);
    const operating = new Prisma.Decimal(450);
    const ideal = idealRatePerHour(run.standardRate, run.timeBasis).mul(operating.div(60)).toDecimalPlaces(4);
    const totals = deriveRunTotals(run.outputEvents as any, { from, to });
    const total = new Prisma.Decimal(totals.finalOutputTotal);
    const good = new Prisma.Decimal(totals.finalOutputGood);
    const availability = availabilityFactor(planned, operating);
    const performance = performanceFactor(ideal, total);
    const quality = qualityFactor(good, total);
    const oee = oeeProduct(availability, performance, quality);
    expect(res.rawValue).toBe(Number(Number(oee.percent).toFixed(4)));
  });

  it('rejects preview window over 366 days', async () => {
    await expect(service.preview({ ...baseDto, dateFrom: '2025-01-01T00:00:00.000Z', dateTo: '2026-02-01T00:00:00.000Z' } as any, ctx)).rejects.toBeInstanceOf(BadRequestException);
  });
});
