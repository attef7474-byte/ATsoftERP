import { BadRequestException } from '@nestjs/common';
import { OperationsReportsService } from './operations-reports.service';
import { OPERATIONS_REPORT_EXPORT_AUDIT_ENTITY, OPERATIONS_REPORT_LIMITS } from '../operations-reports.constants';

const ctx = { companyId: 'company-a', branchId: 'branch-a' } as any;
const query = { dateFrom: '2026-08-01', dateTo: '2026-08-08', productionLineId: 'line-a', machineId: 'machine-a' };

const factor = (numerator: string, denominator: string, percent: string) => ({
  fraction: String(Number(numerator) / Number(denominator)),
  percent,
  numerator,
  denominator,
  blockers: [],
  warnings: [],
});

const reliabilityResult = {
  metrics: {
    mtbf: { mtbfHours: 20, totalEvents: 3, metadata: { formulaVersion: '2C_MTBF_V1' } },
    mttr: { mttrHours: 2, totalEvents: 2, metadata: { formulaVersion: '2C_MTTR_V1' } },
    totalDowntime: { totalHours: 4, totalEvents: 2, metadata: { formulaVersion: '2C_TOTAL_DOWNTIME_V1' } },
    repeatFailureRate: { repeatFailureRate: 25, metadata: { formulaVersion: '2C_REPEAT_FAILURE_RATE_V1' } },
  },
  breakdown: {
    byMachine: { items: [{ machine: { code: '=M1' }, totalHours: 4, eventCount: 2 }], metadata: {} },
    byProductionLine: { items: [], metadata: {} },
    byCause: { items: [], metadata: {} },
  },
  productionPerformance: {
    formulaVersion: 'PHASE_1_9_OEE_V1',
    sourceModels: ['ProductionRun', 'ProductionSession'],
    aggregates: {
      runCount: 2,
      plannedMinutes: '960',
      operatingMinutes: '900',
      totalOutput: '100',
      goodOutput: '95',
      availability: factor('900', '960', '93.75'),
      performance: factor('100', '110', '90.9091'),
      quality: factor('95', '100', '95'),
      oee: factor('0.81', '1', '81'),
    },
  },
};

const costResult = {
  currencyCode: 'USD',
  aggregates: { totalAmount: '125.5000', transactionCount: 2 },
  byEventType: [{ eventType: 'DOWNTIME', amount: '125.5000', count: 2 }],
  byCostCenter: [],
};

describe('OperationsReportsService', () => {
  let reliability: any;
  let productionAnalytics: any;
  let audit: any;
  let service: OperationsReportsService;

  beforeEach(() => {
    reliability = { summary: jest.fn().mockResolvedValue(reliabilityResult) };
    productionAnalytics = {
      cost: jest.fn().mockResolvedValue(costResult),
      drilldown: jest.fn().mockResolvedValue({
        runs: [
          { runNumber: '=RUN-1', status: 'COMPLETED', productionLineCode: 'L1', machineCode: 'M1', metrics: { plannedMinutes: '480', operatingMinutes: '450', totalOutput: '50', goodOutput: '48', oee: { percent: '80' } } },
          { runNumber: 'RUN-2', status: 'COMPLETED', productionLineCode: 'L1', machineCode: 'M1', metrics: { plannedMinutes: '480', operatingMinutes: '450', totalOutput: '50', goodOutput: '47', oee: { percent: '82' } } },
        ],
        meta: { page: 1, limit: 20, total: 2, totalPages: 1 },
        sourceChanges: { changeCount: 0 },
      }),
    };
    audit = { log: jest.fn().mockResolvedValue({}) };
    service = new OperationsReportsService(reliability, productionAnalytics, audit);
  });

  it('composes existing authorities with the exact active tenant context and no client tenant fields', async () => {
    await service.overview(query, ctx);

    const authorityQuery = { ...query };
    expect(reliability.summary).toHaveBeenCalledWith(authorityQuery, ctx);
    expect(productionAnalytics.cost).toHaveBeenCalledWith(authorityQuery, ctx);
    expect(reliability.summary.mock.calls[0][0]).not.toHaveProperty('companyId');
    expect(reliability.summary.mock.calls[0][0]).not.toHaveProperty('branchId');
  });

  it('preserves OEE numerators/denominators and keeps fact counts in separate sections', async () => {
    const result = await service.overview(query, ctx);

    expect(result.summary.factors.availability).toEqual(factor('900', '960', '93.75'));
    expect(result.summary.factors.oee.percent).toBe('81');
    expect(result.reconciliation).toEqual(expect.objectContaining({ productionRunCount: 2, reliabilityEventCount: 2, costTransactionCount: 2 }));
    expect(result.cardinality.strategy).toBe('SECTIONED_AUTHORITY_COMPOSITION');
    expect(result.reconciliation).not.toHaveProperty('combinedEventCount');
  });

  it('forwards distinct A/B contexts independently and has no cross-tenant cache', async () => {
    const ctxB = { companyId: 'company-b', branchId: 'branch-b' } as any;
    await service.overview(query, ctx);
    await service.overview(query, ctxB);

    expect(reliability.summary.mock.calls[0][1]).toBe(ctx);
    expect(reliability.summary.mock.calls[1][1]).toBe(ctxB);
    expect(reliability.summary).toHaveBeenCalledTimes(2);
  });

  it('rejects inverted and over-366-day windows before querying authorities', async () => {
    await expect(service.overview({ dateFrom: '2026-08-08', dateTo: '2026-08-01' }, ctx)).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.overview({ dateFrom: '2025-01-01', dateTo: '2026-08-08' }, ctx)).rejects.toBeInstanceOf(BadRequestException);
    expect(reliability.summary).not.toHaveBeenCalled();
  });

  it('returns a bounded OEE drilldown whose total reconciles to the overview run count', async () => {
    const [overview, drilldown] = await Promise.all([
      service.overview(query, ctx),
      service.drilldown({ ...query, page: 1, limit: 50 }, ctx),
    ]);

    expect(drilldown.meta.total).toBe(overview.summary.runCount);
    expect(drilldown.data).toHaveLength(2);
    expect(productionAnalytics.drilldown).toHaveBeenCalledWith({ ...query, page: 1, limit: 50 }, ctx);
  });

  it('exports the same authority data, protects CSV formulas and audits tenant scope', async () => {
    const result = await service.export(query, 'user-1', ctx);

    expect(result.rowCount).toBeGreaterThan(0);
    expect(result.csv).toContain("'=RUN-1");
    expect(result.csv).toContain("'=M1");
    expect(result.csv).toContain('PHASE_1_9_OEE_V1');
    expect(audit.log).toHaveBeenCalledWith('user-1', 'EXPORT', OPERATIONS_REPORT_EXPORT_AUDIT_ENTITY, undefined, expect.objectContaining({
      companyId: 'company-a',
      branchId: 'branch-a',
      rowCount: result.rowCount,
    }));
  });

  it('hard-caps a large export and reads source runs in bounded pages', async () => {
    productionAnalytics.drilldown.mockImplementation(({ page, limit }: { page: number; limit: number }) => Promise.resolve({
      runs: Array.from({ length: limit }, (_, index) => ({ runNumber: `RUN-${page}-${index}`, metrics: {} })),
      meta: { page, limit, total: 1200, totalPages: Math.ceil(1200 / limit) },
      sourceChanges: null,
    }));

    const result = await service.export(query, 'user-1', ctx);

    expect(result.rowCount).toBe(OPERATIONS_REPORT_LIMITS.maxExportRows);
    expect(result.truncated).toBe(true);
    expect(productionAnalytics.drilldown.mock.calls.every(([arg]: any[]) => arg.limit <= OPERATIONS_REPORT_LIMITS.maxPageSize)).toBe(true);
    expect(productionAnalytics.drilldown.mock.calls.length).toBeLessThanOrEqual(Math.ceil(OPERATIONS_REPORT_LIMITS.maxExportRows / OPERATIONS_REPORT_LIMITS.maxPageSize));
  });
});
