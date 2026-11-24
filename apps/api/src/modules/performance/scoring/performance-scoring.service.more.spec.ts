import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PerformanceScoringService } from './performance-scoring.service';

const D = (v: any) => new Prisma.Decimal(v);
const d = (s: string) => new Date(s);
const ctx: any = { companyId: 'c1', branchId: 'b1' };

describe('PerformanceScoringService - additional Phase 3 gates', () => {
  let prisma: any; let audit: any; let contextService: any; let previewService: any; let productionTargets: any; let svc: PerformanceScoringService;
  beforeEach(() => {
    prisma = {
      performanceKpiDefinition: { findFirst: jest.fn() },
      performanceProfile: { findFirst: jest.fn(), findMany: jest.fn() },
      performanceKpiTarget: { findFirst: jest.fn(), findMany: jest.fn(), create: jest.fn(), update: jest.fn(), count: jest.fn() },
      performanceProfileKpiWeight: { findFirst: jest.fn(), findMany: jest.fn(), create: jest.fn(), update: jest.fn(), count: jest.fn() },
      performanceKpiScoringRule: { findFirst: jest.fn(), findMany: jest.fn(), create: jest.fn(), update: jest.fn(), count: jest.fn() },
      productionPerformanceTarget: { findMany: jest.fn() },
    };
    audit = { logBusiness: jest.fn().mockResolvedValue(undefined) };
    contextService = { resolve: jest.fn() };
    previewService = { preview: jest.fn() };
    productionTargets = { resolveForRun: jest.fn() };
    svc = new PerformanceScoringService(prisma, audit, contextService, previewService, productionTargets);
  });

  it('HISTORICAL_TARGET_RESOLUTION: May resolves 80, August resolves 85', async () => {
    const kpi = { id:'k1', code:'PROD_OEE', direction:'HIGHER_IS_BETTER' };
    prisma.performanceKpiTarget.findMany
      .mockResolvedValueOnce([{ id:'t1', companyId:'c1', kpiDefinitionId:'k1', performanceProfileId:null, branchId:null, productionLineId:null, machineId:null, productionProductDefinitionId:null, departmentId:null, jobTitleId:null, scopeType:'COMPANY', targetValue:D('80'), minimumAcceptableValue:null, maximumExceptionalValue:null, effectiveFrom:d('2026-01-01'), effectiveTo:d('2026-07-01'), revision:1, status:'ACTIVE' }])
      .mockResolvedValueOnce([{ id:'t2', companyId:'c1', kpiDefinitionId:'k1', performanceProfileId:null, branchId:null, productionLineId:null, machineId:null, productionProductDefinitionId:null, departmentId:null, jobTitleId:null, scopeType:'COMPANY', targetValue:D('85'), minimumAcceptableValue:null, maximumExceptionalValue:null, effectiveFrom:d('2026-07-01'), effectiveTo:null, revision:2, status:'ACTIVE' }]);
    const may = await svc.resolveTargetForKpi(kpi, null, ctx, d('2026-05-15'), null);
    const aug = await svc.resolveTargetForKpi(kpi, null, ctx, d('2026-08-15'), null);
    expect(may.status).toBe('RESOLVED');
    expect((may as any).target.targetValue.toString()).toBe('80');
    expect(aug.status).toBe('RESOLVED');
    expect((aug as any).target.targetValue.toString()).toBe('85');
  });

  it('CANONICAL_PRODUCTION_TARGET_REUSE: PROD_OEE reuses canonical ProductionPerformanceTarget with evidence fields', async () => {
    const kpi = { id:'k1', code:'PROD_OEE', direction:'HIGHER_IS_BETTER' };
    prisma.performanceKpiTarget.findMany.mockResolvedValue([]);
    prisma.productionPerformanceTarget.findMany.mockResolvedValue([{ id:'pt1', code:'PPT-1', scopeType:'COMPANY', productionUnitId:null, productionLineId:null, machineId:null, productionProductDefinitionId:null, availabilityTarget:D('90'), performanceTarget:D('90'), qualityTarget:D('90'), oeeTarget:D('85'), effectiveFrom:d('2026-01-01'), effectiveTo:null, revision:3, companyId:'c1', branchId:'b1', status:'APPROVED', deletedAt:null }]);
    const res = await svc.resolveTargetForKpi(kpi, null, ctx, d('2026-06-01'), null);
    expect(res.status).toBe('RESOLVED');
    expect((res as any).target.sourceType).toBe('CANONICAL_PRODUCTION_TARGET');
    expect(res.resolvedTarget).toBe('85');
    expect(res.targetSource).toBe('CANONICAL_PRODUCTION_TARGET');
    expect((res as any).sourceRecord.id).toBe('pt1');
    expect(res.scope).toBe('COMPANY');
    expect(res.revision).toBe(3);
    expect(res.resolutionReason).toMatch(/canonical/i);
  });

  it('WRONG_CONTEXT_TARGET_REJECTED: branch-specific target not applied to other branch context', async () => {
    const kpi = { id:'k1', code:'PROD_OEE', direction:'HIGHER_IS_BETTER' };
    prisma.performanceKpiTarget.findMany.mockResolvedValue([{ id:'t1', companyId:'c1', kpiDefinitionId:'k1', performanceProfileId:null, branchId:'b2', productionLineId:null, machineId:null, productionProductDefinitionId:null, departmentId:null, jobTitleId:null, scopeType:'BRANCH', targetValue:D('90'), minimumAcceptableValue:null, maximumExceptionalValue:null, effectiveFrom:d('2026-01-01'), effectiveTo:null, revision:1, status:'ACTIVE' }]);
    prisma.productionPerformanceTarget.findMany.mockResolvedValue([]);
    const res = await svc.resolveTargetForKpi(kpi, null, ctx, d('2026-06-01'), { organization: { branch: { id: 'b1' }, department: null, jobTitle: null } });
    expect(res.status).toBe('CONFIGURATION_MISSING');
  });

  it('OVERLAP_PROTECTION weight/rule create reject overlap', async () => {
    prisma.performanceProfile.findFirst.mockResolvedValue({ id:'p1', companyId:'c1' });
    prisma.performanceKpiDefinition.findFirst.mockResolvedValue({ id:'k1', companyId:'c1', isActive:true, status:'ACTIVE', measurementUnit:'PCT' });
    prisma.performanceProfileKpiWeight.findFirst.mockResolvedValue({ id:'existing', effectiveFrom:d('2026-01-01'), effectiveTo:null, revision:1, status:'ACTIVE' });
    await expect(svc.createWeight({ performanceProfileId:'p1', kpiDefinitionId:'k1', weightPercent:50, effectiveFrom:'2026-06-01T00:00:00Z' } as any, ctx, 'u1')).rejects.toBeInstanceOf(BadRequestException);

    prisma.performanceKpiScoringRule.findFirst.mockResolvedValue({ id:'existing', effectiveFrom:d('2026-01-01'), effectiveTo:null, revision:1, status:'ACTIVE' });
    await expect(svc.createRule({ kpiDefinitionId:'k1', performanceProfileId:'p1', scoringMode:'LINEAR_TARGET', direction:'HIGHER_IS_BETTER', effectiveFrom:'2026-06-01T00:00:00Z' } as any, ctx, 'u1')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('SCORE_VERSION_TRACEABILITY: simulation KPI includes version fields', async () => {
    const kpi = { id:'k1', code:'PROD_GOOD_OUTPUT', name:'Good', nameAr:null, nameEn:null, domain:'PRODUCTION', measurementUnit:'UNIT', direction:'HIGHER_IS_BETTER', isActive:true, status:'ACTIVE', calculationVersion:7 };
    contextService.resolve.mockResolvedValue({ employee:{id:'e1'}, performanceProfile:{id:'p1', code:'P1', name:'P', nameAr:null, nameEn:null, updatedAt:new Date('2026-01-01') } });
    prisma.performanceProfile.findFirst.mockResolvedValue({ id:'p1', companyId:'c1', code:'P1', name:'P', nameAr:null, nameEn:null });
    const weightRow = { id:'w1', companyId:'c1', performanceProfileId:'p1', kpiDefinitionId:'k1', weightPercent:D('100'), isRequired:true, isInformational:false, effectiveFrom:d('2025-01-01'), effectiveTo:null, revision:2, status:'ACTIVE', kpiDefinition:kpi };
    prisma.performanceProfileKpiWeight.findMany.mockResolvedValue([weightRow]);
    prisma.performanceKpiScoringRule.findFirst.mockResolvedValue({ id:'r1', scoringMode:'CAPPED_RATIO', direction:'HIGHER_IS_BETTER', minScore:D('0'), maxScore:D('100'), targetScore:null, floorValue:null, targetValue:D('100'), ceilingValue:null, bandsJson:null, clampMin:D('0'), clampMax:D('100'), revision:3, effectiveFrom:d('2025-01-01'), effectiveTo:null });
    prisma.performanceKpiScoringRule.findMany.mockResolvedValue([]);
    prisma.performanceKpiTarget.findMany.mockResolvedValue([{ id:'t1', companyId:'c1', kpiDefinitionId:'k1', performanceProfileId:null, branchId:null, productionLineId:null, machineId:null, productionProductDefinitionId:null, departmentId:null, jobTitleId:null, scopeType:'COMPANY', targetValue:D('100'), minimumAcceptableValue:null, maximumExceptionalValue:null, effectiveFrom:d('2025-01-01'), effectiveTo:null, revision:4, status:'ACTIVE' }]);
    prisma.productionPerformanceTarget.findMany.mockResolvedValue([]);
    previewService.preview.mockResolvedValue({ status:'CALCULABLE', rawValue:90, evidenceCount:1, explanation:'ok' });
    const res = await svc.simulate({ operationalPersonId:'e1', dateFrom:'2026-01-01T00:00:00Z', dateTo:'2026-01-31T00:00:00Z' } as any, ctx, 'u1');
    expect(res.kpis[0].versions.kpiCalculationVersion).toBe(7);
    expect(res.kpis[0].versions.scoringRuleVersion).toBe(3);
    expect(res.kpis[0].versions.targetRevision).toBe(4);
    expect(res.kpis[0].versions.weightRevision).toBe(2);
  });

  it('SIMULATION completeness/missingRequiredKpis/configuredWeightCovered when required KPI missing', async () => {
    const kpi = { id:'k1', code:'PROD_GOOD_OUTPUT', name:'Good', nameAr:null, nameEn:null, domain:'PRODUCTION', measurementUnit:'UNIT', direction:'HIGHER_IS_BETTER', isActive:true, status:'ACTIVE', calculationVersion:1 };
    contextService.resolve.mockResolvedValue({ employee:{id:'e1'}, performanceProfile:{id:'p1', code:'P1', name:'P', nameAr:null, nameEn:null, updatedAt:new Date('2026-01-01') } });
    prisma.performanceProfile.findFirst.mockResolvedValue({ id:'p1', companyId:'c1', code:'P1', name:'P', nameAr:null, nameEn:null });
    const weightRow = { id:'w1', companyId:'c1', performanceProfileId:'p1', kpiDefinitionId:'k1', weightPercent:D('100'), isRequired:true, isInformational:false, effectiveFrom:d('2025-01-01'), effectiveTo:null, revision:1, status:'ACTIVE', kpiDefinition:kpi };
    prisma.performanceProfileKpiWeight.findMany.mockResolvedValue([weightRow]);
    prisma.performanceKpiScoringRule.findFirst.mockResolvedValue(null);
    prisma.performanceKpiScoringRule.findMany.mockResolvedValue([]);
    prisma.performanceKpiTarget.findMany.mockResolvedValue([]);
    prisma.productionPerformanceTarget.findMany.mockResolvedValue([]);
    previewService.preview.mockResolvedValue({ status:'CALCULABLE', rawValue:90, evidenceCount:1, explanation:'ok' });
    const res = await svc.simulate({ operationalPersonId:'e1', dateFrom:'2026-01-01T00:00:00Z', dateTo:'2026-01-31T00:00:00Z' } as any, ctx, 'u1');
    expect(res.status).toBe('INCOMPLETE');
    expect(res.provisionalTotal).toBeNull();
    expect(res.missingRequiredKpis.length).toBeGreaterThan(0);
    expect(res).toHaveProperty('configuredWeightCovered');
    expect(res).toHaveProperty('completenessPercent');
  });
});
