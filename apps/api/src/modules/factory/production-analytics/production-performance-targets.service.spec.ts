import { ConflictException } from '@nestjs/common';
import { ProductionPerformanceTargetsService, TargetResolutionContext } from './production-performance-targets.service';

const companyA = 'company-a';
const branchA = 'branch-a';
const companyB = 'company-b';
const branchB = 'branch-b';
const unit1 = 'unit-1';
const line1 = 'line-1';
const machine1 = 'machine-1';
const product1 = 'product-1';
const product2 = 'product-2';

const at = new Date('2026-08-05T12:00:00.000Z');

function baseCtx(overrides: Partial<TargetResolutionContext> = {}): TargetResolutionContext {
  return {
    companyId: companyA,
    branchId: branchA,
    productionUnitId: unit1,
    productionLineId: line1,
    machineId: machine1,
    productionProductDefinitionId: product1,
    effectiveAt: at,
    ...overrides,
  };
}

function target(overrides: Record<string, any> = {}) {
  return {
    id: 't-company',
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

const machineTarget = target({ id: 't-machine', code: 'PPT-000002', scopeType: 'MACHINE', machineId: machine1, productionProductDefinitionId: null, productionUnitId: null, productionLineId: null });
const lineProductTarget = target({ id: 't-line-product', code: 'PPT-000003', scopeType: 'LINE', productionLineId: line1, productionProductDefinitionId: product1, productionUnitId: null, machineId: null });
const productTarget = target({ id: 't-product', code: 'PPT-000004', scopeType: 'PRODUCT', productionProductDefinitionId: product1, productionUnitId: null, productionLineId: null, machineId: null });
const lineTarget = target({ id: 't-line', code: 'PPT-000005', scopeType: 'LINE', productionLineId: line1, productionProductDefinitionId: null, productionUnitId: null, machineId: null });
const unitTarget = target({ id: 't-unit', code: 'PPT-000006', scopeType: 'UNIT', productionUnitId: unit1, productionLineId: null, machineId: null, productionProductDefinitionId: null });
const branchTarget = target({ id: 't-branch', code: 'PPT-000007', scopeType: 'BRANCH', productionUnitId: null, productionLineId: null, machineId: null, productionProductDefinitionId: null });
const companyTarget = target({ id: 't-company', code: 'PPT-000008', scopeType: 'COMPANY', productionUnitId: null, productionLineId: null, machineId: null, productionProductDefinitionId: null });

describe('ProductionPerformanceTargetsService resolution', () => {
  let prisma: any;
  let service: ProductionPerformanceTargetsService;

  beforeEach(() => {
    prisma = {
      productionPerformanceTarget: {
        findMany: jest.fn(),
      },
    };
    service = new ProductionPerformanceTargetsService(prisma, { log: jest.fn() } as any, { generateNumberAtomic: jest.fn() } as any);
  });

  describe('single vs bulk parity', () => {
    it('resolves the identical target through resolveForRun and resolveForRuns', async () => {
      prisma.productionPerformanceTarget.findMany.mockResolvedValue([companyTarget]);
      const single = await service.resolveForRun(baseCtx());
      const bulk = await service.resolveForRuns(
        [{ startedAt: at, productionUnitId: unit1, productionLineId: line1, machineId: machine1, productionProductDefinitionId: product1 }],
        { companyId: companyA, branchId: branchA },
        new Date('2026-08-05T00:00:00.000Z'),
        new Date('2026-08-05T23:59:59.999Z'),
      );
      expect(bulk).toHaveLength(1);
      expect(bulk[0]?.id).toBe(single?.id);
      expect(bulk[0]?.id).toBe('t-company');
    });

    it('both return null when no target matches', async () => {
      prisma.productionPerformanceTarget.findMany.mockResolvedValue([]);
      const single = await service.resolveForRun(baseCtx());
      const bulk = await service.resolveForRuns(
        [{ startedAt: at, productionUnitId: unit1, productionLineId: line1, machineId: machine1, productionProductDefinitionId: product1 }],
        { companyId: companyA, branchId: branchA },
        new Date('2026-08-05T00:00:00.000Z'),
        new Date('2026-08-05T23:59:59.999Z'),
      );
      expect(single).toBeNull();
      expect(bulk).toEqual([null]);
    });

    it('both fail with the canonical ambiguity conflict', async () => {
      prisma.productionPerformanceTarget.findMany.mockResolvedValue([companyTarget, { ...companyTarget, id: 't-company-2', code: 'PPT-000009' }]);
      await expect(service.resolveForRun(baseCtx())).rejects.toBeInstanceOf(ConflictException);
      await expect(
        service.resolveForRuns(
          [{ startedAt: at, productionUnitId: unit1, productionLineId: line1, machineId: machine1, productionProductDefinitionId: product1 }],
          { companyId: companyA, branchId: branchA },
          new Date('2026-08-05T00:00:00.000Z'),
          new Date('2026-08-05T23:59:59.999Z'),
        ),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('bulk with several runs resolves every non-ambiguous run like the single path', async () => {
      prisma.productionPerformanceTarget.findMany.mockResolvedValue([machineTarget, lineProductTarget, companyTarget]);
      const runA = { startedAt: at, productionUnitId: unit1, productionLineId: line1, machineId: machine1, productionProductDefinitionId: product1 };
      const runB = { ...runA, machineId: 'machine-2' };
      const singleA = await service.resolveForRun(baseCtx());
      const bulk = await service.resolveForRuns([runA, runB], { companyId: companyA, branchId: branchA }, new Date('2026-08-05T00:00:00.000Z'), new Date('2026-08-05T23:59:59.999Z'));
      expect(bulk[0]?.id).toBe(singleA?.id);
      expect(bulk[1]?.id).toBe(lineProductTarget.id);
    });
  });

  describe('precedence and effective-at filtering', () => {
    it('prefers machine over line+product over product over line over unit over branch over company', async () => {
      prisma.productionPerformanceTarget.findMany.mockResolvedValue([companyTarget, branchTarget, unitTarget, lineTarget, productTarget, lineProductTarget, machineTarget]);
      const resolved = await service.resolveForRun(baseCtx());
      expect(resolved?.id).toBe(machineTarget.id);
    });

    it('skips a machine target that belongs to another machine and falls back to line+product', async () => {
      prisma.productionPerformanceTarget.findMany.mockResolvedValue([machineTarget, lineProductTarget]);
      const resolved = await service.resolveForRun(baseCtx({ machineId: 'machine-other' }));
      expect(resolved?.id).toBe(lineProductTarget.id);
    });

    it('ignores targets effective outside the run point in bulk resolution', async () => {
      const future = target({ id: 't-future', scopeType: 'MACHINE', machineId: machine1, effectiveFrom: new Date('2026-09-01T00:00:00.000Z') });
      const expired = target({ id: 't-expired', scopeType: 'MACHINE', machineId: machine1, effectiveFrom: new Date('2025-01-01T00:00:00.000Z'), effectiveTo: new Date('2025-12-31T00:00:00.000Z') });
      prisma.productionPerformanceTarget.findMany.mockResolvedValue([future, expired, companyTarget]);
      const bulk = await service.resolveForRuns(
        [{ startedAt: at, productionUnitId: unit1, productionLineId: line1, machineId: machine1, productionProductDefinitionId: product1 }],
        { companyId: companyA, branchId: branchA },
        new Date('2026-08-05T00:00:00.000Z'),
        new Date('2026-08-05T23:59:59.999Z'),
      );
      expect(bulk[0]?.id).toBe(companyTarget.id);
    });

    it('excludes DRAFT, INACTIVE and soft-deleted targets even if the query returned them', async () => {
      const draft = target({ id: 't-draft', status: 'DRAFT' });
      const inactive = target({ id: 't-inactive', status: 'INACTIVE' });
      const deleted = target({ id: 't-deleted', deletedAt: new Date('2026-01-01T00:00:00.000Z') });
      prisma.productionPerformanceTarget.findMany.mockResolvedValue([draft, inactive, deleted]);
      const single = await service.resolveForRun(baseCtx());
      const bulk = await service.resolveForRuns(
        [{ startedAt: at, productionUnitId: unit1, productionLineId: line1, machineId: machine1, productionProductDefinitionId: product1 }],
        { companyId: companyA, branchId: branchA },
        new Date('2026-08-05T00:00:00.000Z'),
        new Date('2026-08-05T23:59:59.999Z'),
      );
      expect(single).toBeNull();
      expect(bulk).toEqual([null]);
    });
  });

  describe('ambiguity fails (never a silent revision tie-break)', () => {
    it('rejects two approved targets at the same rank with the canonical conflict', async () => {
      const second = target({ id: 't-company-2', code: 'PPT-000010', revision: 7 });
      prisma.productionPerformanceTarget.findMany.mockResolvedValue([companyTarget, second]);
      await expect(service.resolveForRun(baseCtx())).rejects.toMatchObject({ response: { messageKey: 'performanceTarget.ambiguousResolution' } });
      await expect(
        service.resolveForRuns(
          [{ startedAt: at, productionUnitId: unit1, productionLineId: line1, machineId: machine1, productionProductDefinitionId: product1 }],
          { companyId: companyA, branchId: branchA },
          new Date('2026-08-05T00:00:00.000Z'),
          new Date('2026-08-05T23:59:59.999Z'),
        ),
      ).rejects.toMatchObject({ response: { messageKey: 'performanceTarget.ambiguousResolution' } });
    });

    it('never lets a higher revision win a same-rank tie', async () => {
      const lowRevision = target({ id: 't-low', revision: 1 });
      const highRevision = target({ id: 't-high', revision: 9 });
      prisma.productionPerformanceTarget.findMany.mockResolvedValue([lowRevision, highRevision]);
      await expect(service.resolveForRun(baseCtx())).rejects.toBeInstanceOf(ConflictException);
      await expect(
        service.resolveForRuns(
          [{ startedAt: at, productionUnitId: unit1, productionLineId: line1, machineId: machine1, productionProductDefinitionId: product1 }],
          { companyId: companyA, branchId: branchA },
          new Date('2026-08-05T00:00:00.000Z'),
          new Date('2026-08-05T23:59:59.999Z'),
        ),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('does not report ambiguity from lower-rank duplicates', async () => {
      const secondCompany = target({ id: 't-company-2', revision: 5 });
      prisma.productionPerformanceTarget.findMany.mockResolvedValue([companyTarget, secondCompany, machineTarget]);
      const resolved = await service.resolveForRun(baseCtx());
      expect(resolved?.id).toBe(machineTarget.id);
    });
  });

  describe('tenant isolation', () => {
    it('scopes the query and never resolves a candidate from another company', async () => {
      const otherCompany = target({ id: 't-other-company', companyId: companyB, branchId: branchB });
      prisma.productionPerformanceTarget.findMany.mockResolvedValue([otherCompany]);
      const resolved = await service.resolveForRun(baseCtx());
      expect(resolved).toBeNull();
      expect(prisma.productionPerformanceTarget.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ companyId: companyA, branchId: branchA }) }),
      );
    });

    it('scopes the bulk query to the active context', async () => {
      prisma.productionPerformanceTarget.findMany.mockResolvedValue([]);
      await service.resolveForRuns(
        [{ startedAt: at, productionUnitId: unit1, productionLineId: line1, machineId: machine1, productionProductDefinitionId: product1 }],
        { companyId: companyA, branchId: branchA },
        new Date('2026-08-05T00:00:00.000Z'),
        new Date('2026-08-05T23:59:59.999Z'),
      );
      expect(prisma.productionPerformanceTarget.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ companyId: companyA, branchId: branchA }) }),
      );
    });

    it('ignores candidates whose scope dimension does not belong to the run', async () => {
      const otherProduct = target({ id: 't-other-product', scopeType: 'PRODUCT', productionProductDefinitionId: product2 });
      prisma.productionPerformanceTarget.findMany.mockResolvedValue([otherProduct, companyTarget]);
      const resolved = await service.resolveForRun(baseCtx({ productionProductDefinitionId: product1 }));
      expect(resolved?.id).toBe(companyTarget.id);
    });
  });
});
