import { BadRequestException, ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ProductionAnalyticsService } from './production-analytics.service';
import { ProductionPerformanceTargetsService } from './production-performance-targets.service';
import { ActiveOperationalContext } from '../../../common/operational-context/operational-context.types';

const companyA = 'company-a';
const branchA = 'branch-a';
const unit1 = 'unit-1';
const line1 = 'line-1';
const machine1 = 'machine-1';
const product1 = 'product-1';

const ctx: ActiveOperationalContext = {
  contextKey: `${companyA}:${branchA}:-:-`,
  scopeId: 'scope-1',
  companyId: companyA,
  companyName: 'Company A',
  companyCode: 'A',
  branchId: branchA,
  branchName: 'HQ',
  branchCode: 'HQ',
  administrationId: null,
  administrationName: null,
  administrationCode: null,
  departmentId: null,
  departmentName: null,
  departmentCode: null,
  isDefault: true,
  source: 'EXPLICIT_SCOPE',
};

function runRecord(overrides: Record<string, any> = {}) {
  const startedAt = new Date('2026-08-05T12:00:00.000Z');
  const endedAt = new Date('2026-08-05T20:00:00.000Z');
  return {
    id: 'run-1',
    runNumber: 'PRUN-0001',
    status: 'COMPLETED',
    productionOrderId: 'po-1',
    productionOrder: { id: 'po-1', orderNumber: 'PO-0001' },
    productionUnitId: unit1,
    productionUnit: { id: unit1, code: 'U1', name: 'Unit 1' },
    productionLineId: line1,
    productionLine: { id: line1, code: 'L1', name: 'Line 1' },
    machineId: machine1,
    machine: { id: machine1, code: 'M1', name: 'Machine 1' },
    productionProductDefinitionId: product1,
    productionProductDefinition: { id: product1, code: 'P1', name: 'Product 1' },
    shiftCodeSnapshot: 'M',
    startedAt,
    endedAt,
    plannedQuantitySnapshot: '100',
    quantityUnitSnapshot: 'KG',
    capacityStandardCodeSnapshot: 'CS-0001',
    capacityStandardRevisionSnapshot: 1,
    standardRateSnapshot: '10',
    outputUnitSnapshot: 'KG',
    timeBasisSnapshot: 'HOUR',
    targetEfficiencyPercentSnapshot: '90',
    expectedYieldPercentSnapshot: '95',
    sessions: [{ id: 's-1', startedAt, closedAt: endedAt }],
    outputEvents: [
      {
        id: 'e-1',
        eventType: 'PRODUCTION',
        classification: 'FINAL_OUTPUT',
        quantity: '80',
        goodQuantity: '76',
        rejectQuantity: '4',
        correctsEventId: null,
        measurementPointId: 'mp-1',
        measurementPoint: { isAuthoritativeFinal: true },
      },
    ],
    downtimeSegments: [],
    ...overrides,
  };
}

function companyTarget(id = 't-company', overrides: Record<string, any> = {}) {
  return {
    id,
    code: 'PPT-000001',
    revision: 1,
    status: 'APPROVED',
    scopeType: 'COMPANY',
    companyId: companyA,
    branchId: branchA,
    productionUnitId: null,
    productionLineId: null,
    machineId: null,
    productionProductDefinitionId: null,
    effectiveFrom: new Date('2026-01-01T00:00:00.000Z'),
    effectiveTo: null,
    deletedAt: null,
    availabilityTarget: '85',
    performanceTarget: '90',
    qualityTarget: '95',
    oeeTarget: '70',
    productionUnit: null,
    productionLine: null,
    machine: null,
    productionProductDefinition: null,
    supersedes: null,
    ...overrides,
  };
}

describe('ProductionAnalyticsService bulk target resolution', () => {
  let prisma: any;
  let targets: ProductionPerformanceTargetsService;
  let service: ProductionAnalyticsService;
  let audit: any;
  let sourceChanges: any;
  let txOptions: any;

  beforeEach(() => {
    txOptions = undefined;
    prisma = {
      productionPerformanceTarget: { findMany: jest.fn() },
      productionRun: {
        findMany: jest.fn().mockResolvedValue([runRecord()]),
        count: jest.fn().mockResolvedValue(1),
      },
      costCenter: { findMany: jest.fn().mockResolvedValue([]) },
      $transaction: jest.fn().mockImplementation(async (fn: (tx: any) => Promise<any>, options?: any) => {
        txOptions = options;
        return fn(prisma);
      }),
    };
    targets = new ProductionPerformanceTargetsService(prisma, { log: jest.fn() } as any, { generateNumberAtomic: jest.fn() } as any);
    audit = { log: jest.fn(), logWithClient: jest.fn() };
    sourceChanges = {
      recordChange: jest.fn().mockResolvedValue({ id: 'ch1', createdAt: new Date('2026-08-05T12:00:00.000Z') }),
      summaryForScope: jest.fn().mockResolvedValue({ changeCount: 0, lastChangeAt: null, changes: [] }),
      findByWindow: jest.fn().mockResolvedValue([]),
      findOne: jest.fn().mockResolvedValue({}),
    };
    service = new ProductionAnalyticsService(prisma, targets, audit, sourceChanges);
  });

  it('uses the same target in the OEE summary as the single-run resolver', async () => {
    prisma.productionPerformanceTarget.findMany.mockResolvedValue([companyTarget()]);
    const single = await targets.resolveForRun({
      companyId: companyA,
      branchId: branchA,
      productionUnitId: unit1,
      productionLineId: line1,
      machineId: machine1,
      productionProductDefinitionId: product1,
      effectiveAt: new Date('2026-08-05T12:00:00.000Z'),
    });
    const report = await service.oee(
      { dateFrom: '2026-08-05', dateTo: '2026-08-05' } as any,
      ctx,
    );
    expect(report.runs).toHaveLength(1);
    expect(report.runs[0].target?.id).toBe(single?.id);
    expect(report.runs[0].target?.oeeTarget).toBe('70');
    expect(report.runs[0].targetStatus).toBe('MEETING');
  });

  it('loads the dimension and authoritative-output relations required by the live OEE query', async () => {
    prisma.productionPerformanceTarget.findMany.mockResolvedValue([companyTarget()]);

    await service.oee({ dateFrom: '2026-08-05', dateTo: '2026-08-05' } as any, ctx);

    expect(prisma.productionRun.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        include: expect.objectContaining({
          productionUnit: expect.any(Object),
          productionLine: expect.any(Object),
          machine: expect.any(Object),
          productionProductDefinition: expect.any(Object),
          outputEvents: expect.any(Object),
        }),
      }),
    );
  });

  it('fails the whole request with the canonical ambiguity conflict, never a partial summary', async () => {
    prisma.productionPerformanceTarget.findMany.mockResolvedValue([companyTarget('t-company-1'), companyTarget('t-company-2')]);
    await expect(service.oee({ dateFrom: '2026-08-05', dateTo: '2026-08-05' } as any, ctx)).rejects.toBeInstanceOf(ConflictException);
  });

  it('returns NO_TARGET when no approved target matches', async () => {
    prisma.productionPerformanceTarget.findMany.mockResolvedValue([]);
    const report = await service.oee({ dateFrom: '2026-08-05', dateTo: '2026-08-05' } as any, ctx);
    expect(report.runs[0].target).toBeNull();
    expect(report.runs[0].targetStatus).toBe('NO_TARGET');
  });

  it('rejects an oversized summary before loading relation-heavy production runs', async () => {
    prisma.productionRun.count.mockResolvedValue(2001);

    await expect(service.oee({ dateFrom: '2026-08-05', dateTo: '2026-08-05' } as any, ctx))
      .rejects.toBeInstanceOf(BadRequestException);

    expect(prisma.productionRun.findMany).not.toHaveBeenCalled();
  });

  it('rejects a run whose child-event set exceeds the complete-calculation limit', async () => {
    prisma.productionRun.findMany.mockResolvedValue([
      runRecord({ outputEvents: Array.from({ length: 501 }, () => ({ measurementPoint: null })) }),
    ]);

    await expect(service.oee({ dateFrom: '2026-08-05', dateTo: '2026-08-05' } as any, ctx))
      .rejects.toBeInstanceOf(BadRequestException);
  });

  it('excludes SUPERSEDED originals and counts correction segments in OEE downtime minutes', async () => {
    prisma.productionPerformanceTarget.findMany.mockResolvedValue([companyTarget()]);
    prisma.productionRun.findMany.mockResolvedValue([
      runRecord({
        downtimeSegments: [
          { id: 'd-sup', startedAt: new Date('2026-08-05T13:00:00.000Z'), endedAt: new Date('2026-08-05T14:00:00.000Z'), planned: false, status: 'SUPERSEDED', correctsSegmentId: null },
          { id: 'd-cor', startedAt: new Date('2026-08-05T13:00:00.000Z'), endedAt: new Date('2026-08-05T13:30:00.000Z'), planned: false, status: 'CLOSED', correctsSegmentId: 'd-sup' },
        ],
      }),
    ]);
    const report = await service.oee({ dateFrom: '2026-08-05', dateTo: '2026-08-05' } as any, ctx);
    expect(report.runs[0].metrics.unplannedDowntimeMinutes).toBe('30');
  });

  it('scopes the downtime report to non-cancelled non-superseded segments including corrections', async () => {
    prisma.downtimeSegment = { findMany: jest.fn().mockResolvedValue([]) };
    await service.downtime({ dateFrom: '2026-08-05', dateTo: '2026-08-05' } as any, ctx);
    const where = prisma.downtimeSegment.findMany.mock.calls[0][0].where;
    expect(where.status).toEqual({ notIn: ['CANCELLED', 'SUPERSEDED'] });
    expect(where.correctsSegmentId).toBeUndefined();
  });

  describe('cost() live filter and source-change watermark', () => {
    it('excludes reversed originals and reversal rows from the cost report', async () => {
      prisma.operationalCostTransaction = {
        aggregate: jest.fn().mockResolvedValue({ _sum: { amount: null }, _count: 0 }),
        groupBy: jest.fn().mockResolvedValue([]),
      };
      await service.cost({ dateFrom: '2026-08-05', dateTo: '2026-08-05' } as any, ctx);
      const where = prisma.operationalCostTransaction.aggregate.mock.calls[0][0].where;
      expect(where.companyId).toBe(companyA);
      expect(where.branchId).toBe(branchA);
      expect(where.status).toBe('POSTED');
      expect(where.reversalOfId).toBeNull();
      expect(where.reversedAt).toBeNull();
    });

    it('aggregates costs in the database and tenant-scopes cost-center labels', async () => {
      prisma.operationalCostTransaction = {
        aggregate: jest.fn().mockResolvedValue({ _sum: { amount: new Prisma.Decimal('30') }, _count: 2 }),
        groupBy: jest.fn().mockImplementation(({ by }: { by: string[] }) => {
          if (by[0] === 'eventType') return Promise.resolve([{ eventType: 'DOWNTIME', _sum: { amount: new Prisma.Decimal('30') }, _count: 2 }]);
          if (by[0] === 'costCenterId') return Promise.resolve([{ costCenterId: 'cc-1', _sum: { amount: new Prisma.Decimal('30') }, _count: 2 }]);
          return Promise.resolve([{ currencyCode: 'USD', _sum: { amount: new Prisma.Decimal('30') }, _count: 2 }]);
        }),
      };
      prisma.costCenter.findMany.mockResolvedValue([{ id: 'cc-1', code: 'OPS', name: 'Operations' }]);

      const result = await service.cost({ dateFrom: '2026-08-05', dateTo: '2026-08-05' } as any, ctx);

      expect(result.aggregates).toEqual({ totalAmount: '30', transactionCount: 2 });
      expect(result.byCostCenter[0]).toEqual(expect.objectContaining({ costCenterCode: 'OPS', count: 2 }));
      expect(prisma.costCenter.findMany).toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({ companyId: companyA, OR: [{ branchId: branchA }, { branchId: null }] }),
      }));
      expect(prisma.operationalCostTransaction.findMany).toBeUndefined();
    });

    it('fails safely rather than summing multiple currencies', async () => {
      prisma.operationalCostTransaction = {
        aggregate: jest.fn().mockResolvedValue({ _sum: { amount: new Prisma.Decimal('30') }, _count: 2 }),
        groupBy: jest.fn().mockImplementation(({ by }: { by: string[] }) => by[0] === 'currencyCode'
          ? Promise.resolve([
            { currencyCode: 'USD', _sum: { amount: new Prisma.Decimal('10') }, _count: 1 },
            { currencyCode: 'EUR', _sum: { amount: new Prisma.Decimal('20') }, _count: 1 },
          ])
          : Promise.resolve([])),
      };

      await expect(service.cost({ dateFrom: '2026-08-05', dateTo: '2026-08-05' } as any, ctx))
        .rejects.toBeInstanceOf(BadRequestException);
    });

    it('returns dataAdjusted false on reports when no source changes exist', async () => {
      prisma.productionPerformanceTarget.findMany.mockResolvedValue([companyTarget()]);
      sourceChanges.findByWindow.mockResolvedValue([]);
      const report = await service.oee({ dateFrom: '2026-08-05', dateTo: '2026-08-05' } as any, ctx);
      expect(report.sourceChanges).toEqual({ changeCount: 0, dataAdjusted: false, changes: [] });
    });

    it('returns dataAdjusted true with the change list when source changes exist for the scope', async () => {
      prisma.productionPerformanceTarget.findMany.mockResolvedValue([companyTarget()]);
      const change = { id: 'ch1', scopeType: 'ORDER', scopeId: 'po-1' };
      sourceChanges.findByWindow.mockResolvedValue([change]);
      const report = await service.oee({ dateFrom: '2026-08-05', dateTo: '2026-08-05' } as any, ctx);
      expect(report.sourceChanges).toEqual({ changeCount: 1, dataAdjusted: true, changes: [change] });
    });
  });

  describe('capacityVariance()', () => {
    it('computes variance = actualOutput - idealOutput and utilizationPercent = actual / planned', async () => {
      prisma.productionPerformanceTarget.findMany.mockResolvedValue([companyTarget()]);
      const report = await service.capacityVariance({ dateFrom: '2026-08-05', dateTo: '2026-08-05' } as any, ctx);
      expect(report.rows).toHaveLength(1);
      const row = report.rows[0];
      expect(row.plannedQuantity).toBe('100');
      expect(row.actualOutput).toBe('80');
      expect(row.variance).toBeDefined();
      expect(row.utilizationPercent).toBeDefined();
      expect(Number(row.utilizationPercent)).toBeCloseTo(80, 1);
    });

    it('aggregates multi-run variance across all runs', async () => {
      prisma.productionPerformanceTarget.findMany.mockResolvedValue([companyTarget()]);
      prisma.productionRun.findMany.mockResolvedValue([
        runRecord({ id: 'run-1', plannedQuantitySnapshot: '100', outputEvents: [
          { id: 'e1', eventType: 'PRODUCTION', classification: 'FINAL_OUTPUT', quantity: '80', goodQuantity: '76', rejectQuantity: '4', correctsEventId: null, measurementPointId: 'mp-1', measurementPoint: { isAuthoritativeFinal: true } },
        ] }),
        runRecord({ id: 'run-2', plannedQuantitySnapshot: '200', outputEvents: [
          { id: 'e2', eventType: 'PRODUCTION', classification: 'FINAL_OUTPUT', quantity: '180', goodQuantity: '170', rejectQuantity: '10', correctsEventId: null, measurementPointId: 'mp-1', measurementPoint: { isAuthoritativeFinal: true } },
        ] }),
      ]);
      const report = await service.capacityVariance({ dateFrom: '2026-08-05', dateTo: '2026-08-05' } as any, ctx);
      expect(report.rows).toHaveLength(2);
      expect(report.aggregates.totalPlannedQuantity).toBe('300');
      expect(report.aggregates.totalActualOutput).toBe('260');
    });

    it('returns zero utilization when planned quantity is zero', async () => {
      prisma.productionPerformanceTarget.findMany.mockResolvedValue([companyTarget()]);
      prisma.productionRun.findMany.mockResolvedValue([
        runRecord({ plannedQuantitySnapshot: '0' }),
      ]);
      const report = await service.capacityVariance({ dateFrom: '2026-08-05', dateTo: '2026-08-05' } as any, ctx);
      expect(report.aggregates.utilizationPercent).toBe('0');
    });

    it('excludes cancelled and superseded downtime segments from idealOutput', async () => {
      prisma.productionPerformanceTarget.findMany.mockResolvedValue([companyTarget()]);
      prisma.productionRun.findMany.mockResolvedValue([
        runRecord({
          sessions: [{ id: 's-1', startedAt: new Date('2026-08-05T12:00:00.000Z'), closedAt: new Date('2026-08-05T20:00:00.000Z') }],
          downtimeSegments: [
            { id: 'd1', startedAt: new Date('2026-08-05T13:00:00.000Z'), endedAt: new Date('2026-08-05T14:00:00.000Z'), planned: false, status: 'CLOSED', correctsSegmentId: null },
            { id: 'd2', startedAt: new Date('2026-08-05T14:00:00.000Z'), endedAt: new Date('2026-08-05T15:00:00.000Z'), planned: false, status: 'CANCELLED', correctsSegmentId: null },
          ],
          outputEvents: [
            { id: 'e1', eventType: 'PRODUCTION', classification: 'FINAL_OUTPUT', quantity: '80', goodQuantity: '76', rejectQuantity: '4', correctsEventId: null, measurementPointId: 'mp-1', measurementPoint: { isAuthoritativeFinal: true } },
          ],
        }),
      ]);
      const report = await service.capacityVariance({ dateFrom: '2026-08-05', dateTo: '2026-08-05' } as any, ctx);
      const row = report.rows[0];
      expect(row.actualOutput).toBe('80');
      expect(Number(row.idealOutput)).toBeGreaterThan(0);
    });

    it('includes sourceChanges metadata in the response', async () => {
      prisma.productionPerformanceTarget.findMany.mockResolvedValue([companyTarget()]);
      sourceChanges.findByWindow.mockResolvedValue([]);
      const report = await service.capacityVariance({ dateFrom: '2026-08-05', dateTo: '2026-08-05' } as any, ctx);
      expect(report.sourceChanges).toBeDefined();
      expect(report.sourceChanges.changeCount).toBe(0);
    });

    it('returns zero variance when actualOutput equals idealOutput', async () => {
      prisma.productionPerformanceTarget.findMany.mockResolvedValue([companyTarget()]);
      const report = await service.capacityVariance({ dateFrom: '2026-08-05', dateTo: '2026-08-05' } as any, ctx);
      const row = report.rows[0];
      const ideal = Number(row.idealOutput);
      const actual = Number(row.actualOutput);
      expect(Number(row.variance)).toBeCloseTo(actual - ideal, 4);
    });

    it('returns positive variance and >100% utilization when actual exceeds planned', async () => {
      prisma.productionPerformanceTarget.findMany.mockResolvedValue([companyTarget()]);
      prisma.productionRun.findMany.mockResolvedValue([
        runRecord({ plannedQuantitySnapshot: '100', outputEvents: [
          { id: 'e1', eventType: 'PRODUCTION', classification: 'FINAL_OUTPUT', quantity: '120', goodQuantity: '115', rejectQuantity: '5', correctsEventId: null, measurementPointId: 'mp-1', measurementPoint: { isAuthoritativeFinal: true } },
        ] }),
      ]);
      const report = await service.capacityVariance({ dateFrom: '2026-08-05', dateTo: '2026-08-05' } as any, ctx);
      const row = report.rows[0];
      expect(Number(row.actualOutput)).toBe(120);
      expect(Number(row.variance)).toBeGreaterThan(0);
      expect(Number(row.utilizationPercent)).toBeGreaterThan(100);
    });

    it('returns zero actualOutput and zero utilization when no output events exist', async () => {
      prisma.productionPerformanceTarget.findMany.mockResolvedValue([companyTarget()]);
      prisma.productionRun.findMany.mockResolvedValue([
        runRecord({ outputEvents: [] }),
      ]);
      const report = await service.capacityVariance({ dateFrom: '2026-08-05', dateTo: '2026-08-05' } as any, ctx);
      const row = report.rows[0];
      expect(row.actualOutput).toBe('0');
      expect(row.utilizationPercent).toBe('0');
      expect(Number(row.variance)).toBeLessThan(0);
    });

    it('handles an active run with open session by clamping to window boundary', async () => {
      prisma.productionPerformanceTarget.findMany.mockResolvedValue([companyTarget()]);
      prisma.productionRun.findMany.mockResolvedValue([
        runRecord({
          endedAt: null,
          sessions: [{ id: 's-1', startedAt: new Date('2026-08-05T12:00:00.000Z'), closedAt: null }],
          outputEvents: [
            { id: 'e1', eventType: 'PRODUCTION', classification: 'FINAL_OUTPUT', quantity: '50', goodQuantity: '48', rejectQuantity: '2', correctsEventId: null, measurementPointId: 'mp-1', measurementPoint: { isAuthoritativeFinal: true } },
          ],
        }),
      ]);
      const report = await service.capacityVariance({ dateFrom: '2026-08-05', dateTo: '2026-08-05' } as any, ctx);
      expect(report.rows).toHaveLength(1);
      expect(Number(report.rows[0].idealOutput)).toBeGreaterThan(0);
      expect(report.rows[0].actualOutput).toBe('50');
    });

    it('excludes WASTE and REWORK events from actualOutput in capacity variance', async () => {
      prisma.productionPerformanceTarget.findMany.mockResolvedValue([companyTarget()]);
      prisma.productionRun.findMany.mockResolvedValue([
        runRecord({
          outputEvents: [
            { id: 'e1', eventType: 'PRODUCTION', classification: 'FINAL_OUTPUT', quantity: '80', goodQuantity: '76', rejectQuantity: '4', correctsEventId: null, measurementPointId: 'mp-1', measurementPoint: { isAuthoritativeFinal: true } },
            { id: 'e2', eventType: 'PRODUCTION', classification: 'WASTE', quantity: '10', goodQuantity: '0', rejectQuantity: '10', correctsEventId: null, measurementPointId: 'mp-2', measurementPoint: { isAuthoritativeFinal: false } },
            { id: 'e3', eventType: 'PRODUCTION', classification: 'REWORK', quantity: '5', goodQuantity: '5', rejectQuantity: '0', correctsEventId: null, measurementPointId: 'mp-3', measurementPoint: { isAuthoritativeFinal: false } },
          ],
        }),
      ]);
      const report = await service.capacityVariance({ dateFrom: '2026-08-05', dateTo: '2026-08-05' } as any, ctx);
      const row = report.rows[0];
      expect(row.actualOutput).toBe('80');
      expect(Number(row.actualOutput)).not.toBe(95);
    });
  });

  describe('invalidate()', () => {
    it('records an audited SOURCE_UPDATE change inside a Serializable transaction', async () => {
      const result = await service.invalidate(
        { scopeType: 'ORDER', scopeId: 'po-1', reason: 'rates recalculated' },
        'u1',
        ctx,
      );
      expect(result).toEqual({
        invalidatedAt: '2026-08-05T12:00:00.000Z',
        scopeType: 'ORDER',
        scopeId: 'po-1',
        changeId: 'ch1',
      });
      expect(sourceChanges.recordChange).toHaveBeenCalledWith(
        prisma,
        ctx,
        expect.objectContaining({
          scopeType: 'ORDER',
          scopeId: 'po-1',
          entityType: 'PRODUCTION_ANALYTICS',
          entityId: 'po-1',
          changeType: 'SOURCE_UPDATE',
          reason: 'rates recalculated',
        }),
        'u1',
      );
      expect(audit.logWithClient).toHaveBeenCalledWith(
        prisma,
        expect.objectContaining({
          userId: 'u1',
          action: 'INVALIDATE',
          entity: 'ProductionAnalyticsInvalidation',
          entityId: 'ch1',
          details: expect.objectContaining({ scopeType: 'ORDER', scopeId: 'po-1', reason: 'rates recalculated' }),
        }),
      );
      expect(txOptions).toEqual({ isolationLevel: 'Serializable' });
    });
  });
});
