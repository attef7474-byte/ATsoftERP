import { ConflictException } from '@nestjs/common';
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

  beforeEach(() => {
    prisma = {
      productionPerformanceTarget: { findMany: jest.fn() },
      productionRun: {
        findMany: jest.fn().mockResolvedValue([runRecord()]),
        count: jest.fn().mockResolvedValue(1),
      },
    };
    targets = new ProductionPerformanceTargetsService(prisma, { log: jest.fn() } as any, { generateNumberAtomic: jest.fn() } as any);
    service = new ProductionAnalyticsService(prisma, targets, { log: jest.fn() } as any);
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
});
