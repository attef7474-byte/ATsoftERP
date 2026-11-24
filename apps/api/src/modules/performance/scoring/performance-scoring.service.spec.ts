import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PerformanceScoringService } from './performance-scoring.service';

const D = (v: any) => new Prisma.Decimal(v);
const d = (s: string) => new Date(s);

function baseCtx(over: any = {}) { return { companyId: 'c1', branchId: 'b1', ...over }; }

describe('PerformanceScoringService', () => {
  let prisma: any; let audit: any; let contextService: any; let previewService: any; let productionTargets: any; let svc: PerformanceScoringService;
  const ctx = baseCtx();

  beforeEach(() => {
    const emptyMany = () => jest.fn().mockResolvedValue([]);
    prisma = {
      performanceKpiDefinition: { findFirst: jest.fn() },
      performanceProfile: { findFirst: jest.fn(), findMany: emptyMany() },
      performanceKpiTarget: { findFirst: jest.fn(), findMany: emptyMany(), create: jest.fn(), update: jest.fn(), count: jest.fn() },
      performanceProfileKpiWeight: { findFirst: jest.fn(), findMany: emptyMany(), create: jest.fn(), update: jest.fn(), count: jest.fn() },
      performanceKpiScoringRule: { findFirst: jest.fn(), findMany: emptyMany(), create: jest.fn(), update: jest.fn(), count: jest.fn() },
      productionPerformanceTarget: { findMany: emptyMany() },
    };
    audit = { logBusiness: jest.fn().mockResolvedValue(undefined) };
    contextService = { resolve: jest.fn() };
    previewService = { preview: jest.fn() };
    productionTargets = { resolveForRun: jest.fn() };
    svc = new PerformanceScoringService(prisma, audit, contextService, previewService, productionTargets);
  });

  it('WEIGHT_TOTAL_VALIDATION: 100 valid on activate, 99.5/100.5 rejected with rollback, negative/>100 rejected', async () => {
    // create rejects out of range
    prisma.performanceProfile.findFirst.mockResolvedValue({ id: 'p1', companyId: 'c1' });
    prisma.performanceKpiDefinition.findFirst.mockResolvedValue({ id: 'k1', companyId: 'c1', isActive: true, status: 'ACTIVE' });
    prisma.performanceProfileKpiWeight.findFirst.mockResolvedValue(null);
    await expect(svc.createWeight({ performanceProfileId:'p1', kpiDefinitionId:'k1', weightPercent:-1, effectiveFrom:'2026-01-01T00:00:00Z' } as any, ctx, 'u1')).rejects.toBeInstanceOf(BadRequestException);
    await expect(svc.createWeight({ performanceProfileId:'p1', kpiDefinitionId:'k1', weightPercent:101, effectiveFrom:'2026-01-01T00:00:00Z' } as any, ctx, 'u1')).rejects.toBeInstanceOf(BadRequestException);

    // activate with invalid total rolls back to DRAFT
    const existing = { id:'w1', companyId:'c1', performanceProfileId:'p1', kpiDefinitionId:'k1', status:'DRAFT', weightPercent:D('30'), effectiveFrom:d('2026-01-01'), effectiveTo:null };
    prisma.performanceProfileKpiWeight.findFirst
      .mockResolvedValueOnce(existing) // activateWeight load
      .mockResolvedValueOnce(null);    // assertNoOverlap
    prisma.performanceProfileKpiWeight.update
      .mockResolvedValueOnce({ ...existing, status:'ACTIVE' }) // activate
      .mockResolvedValueOnce({ ...existing, status:'DRAFT' }); // rollback
    prisma.performanceProfileKpiWeight.findMany.mockResolvedValue([{ weightPercent:D('30') }, { weightPercent:D('69.5') }]); // total 99.5
    await expect(svc.activateWeight('w1', ctx, 'u1')).rejects.toMatchObject({
      response: { messageKey: 'common.validationFailed', errors: [{ code: 'validation.invalidWeightTotal' }] },
    });
    expect(prisma.performanceProfileKpiWeight.update).toHaveBeenNthCalledWith(1, { where: { id: 'w1' }, data: { status: 'ACTIVE', updatedById: 'u1' } });
    expect(prisma.performanceProfileKpiWeight.update).toHaveBeenNthCalledWith(2, { where: { id: 'w1' }, data: { status: 'DRAFT', updatedById: 'u1' } });
  });

  it('PROFILE_READINESS returns NOT_READY with explicit reasons when missing weight/target/rule/invalid total/overlap', async () => {
    prisma.performanceProfile.findFirst.mockResolvedValue({ id:'p1', companyId:'c1', code:'P1', name:'P', nameAr:null, nameEn:null });
    // no active weights
    prisma.performanceProfileKpiWeight.findMany.mockResolvedValue([]);
    prisma.performanceKpiScoringRule.findMany.mockResolvedValue([]);
    prisma.performanceKpiTarget.findMany.mockResolvedValue([]);
    const r = await svc.profileReadiness('p1', ctx, '2026-06-01T00:00:00Z');
    expect(r.status).toBe('NOT_READY');
    expect(r.issues.some((i:any)=>i.code==='MISSING_WEIGHT')).toBe(true);
  });

  it('OVERLAP_PROTECTION: create target rejects overlapping active/draft in same scope', async () => {
    prisma.performanceKpiDefinition.findFirst.mockResolvedValue({ id:'k1', companyId:'c1', isActive:true, status:'ACTIVE', measurementUnit:'PERCENT' });
    prisma.performanceKpiTarget.findFirst.mockResolvedValue({ id:'existing', effectiveFrom:d('2026-01-01'), effectiveTo:null, revision:1, status:'ACTIVE' }); // overlap check
    await expect(svc.createTarget({ kpiDefinitionId:'k1', scopeType:'COMPANY', targetValue:80, effectiveFrom:'2026-06-01T00:00:00Z' } as any, ctx, 'u1')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('SIMULATION_PREVIEW_ONLY: returns previewOnly/noPersistedEvaluation/label and no persisted evaluation call', async () => {
    contextService.resolve.mockResolvedValue({ employee:{id:'e1'}, performanceProfile:{id:'p1', code:'P1', name:'P', nameAr:null, nameEn:null, updatedAt:new Date('2026-01-01') } });
    // readiness
    prisma.performanceProfile.findFirst.mockResolvedValue({ id:'p1', companyId:'c1', code:'P1', name:'P', nameAr:null, nameEn:null });
    prisma.performanceProfileKpiWeight.findMany.mockResolvedValue([]); // also used by activeWeightsForProfile + readiness
    prisma.performanceKpiScoringRule.findMany.mockResolvedValue([]);
    prisma.performanceKpiTarget.findMany.mockResolvedValue([]);
    prisma.performanceProfile.findMany.mockResolvedValue([]);
    const res = await svc.simulate({ operationalPersonId:'e1', dateFrom:'2026-01-01T00:00:00Z', dateTo:'2026-01-31T00:00:00Z' } as any, ctx, 'u1');
    expect(res.previewOnly).toBe(true);
    expect(res.noPersistedEvaluation).toBe(true);
    expect(res.simulationLabel).toBe('PREVIEW_ONLY_NOT_APPROVED');
    expect(prisma).not.toHaveProperty('employeePerformanceResult');
  });

  it('NO_DATA_SCORING: insufficient/not-applicable/config-missing produce null score and null contribution', async () => {
    // simulate one KPI with INSUFFICIENT_DATA
    const kpi = { id:'k1', code:'PROD_GOOD_OUTPUT', name:'Good', nameAr:null, nameEn:null, domain:'PRODUCTION', measurementUnit:'UNIT', direction:'HIGHER_IS_BETTER', isActive:true, status:'ACTIVE', calculationVersion:1 };
    contextService.resolve.mockResolvedValue({ employee:{id:'e1'}, performanceProfile:{id:'p1', code:'P1', name:'P', nameAr:null, nameEn:null, updatedAt:new Date('2026-01-01') } });
    prisma.performanceProfile.findFirst.mockResolvedValue({ id:'p1', companyId:'c1', code:'P1', name:'P', nameAr:null, nameEn:null });
    // readiness calls activeWeightsForProfile, detectOverlapIssues(check 3 models), resolveTargetForKpi; simulate also calls activeWeightsForProfile, detectPeriodSplit
    const weightRow = { id:'w1', companyId:'c1', performanceProfileId:'p1', kpiDefinitionId:'k1', weightPercent:D('100'), isRequired:true, isInformational:false, effectiveFrom:d('2025-01-01'), effectiveTo:null, revision:1, status:'ACTIVE', kpiDefinition:kpi };
    prisma.performanceProfileKpiWeight.findMany.mockResolvedValue([weightRow]);
    prisma.performanceKpiScoringRule.findMany.mockResolvedValue([]);
    prisma.performanceKpiScoringRule.findFirst.mockResolvedValue(null);
    prisma.performanceKpiTarget.findMany.mockResolvedValue([]);
    prisma.performanceKpiTarget.findFirst.mockResolvedValue(null);
    prisma.productionPerformanceTarget.findMany.mockResolvedValue([]);
    previewService.preview.mockResolvedValue({ status:'INSUFFICIENT_DATA', rawValue:null, evidenceCount:0, explanation:'no data' });
    const res = await svc.simulate({ operationalPersonId:'e1', dateFrom:'2026-01-01T00:00:00Z', dateTo:'2026-01-31T00:00:00Z' } as any, ctx, 'u1');
    expect(res.kpis[0].score).toBeNull();
    expect(res.kpis[0].weightedContribution).toBeNull();
    expect(res.kpis[0].scoreStatus).toBe('INSUFFICIENT_DATA');
  });

  it('INFORMATIONAL_KPI_INFLUENCE=0', async () => {
    const kpi = { id:'k1', code:'INFO_KPI', name:'Info', nameAr:null, nameEn:null, domain:'GENERAL', measurementUnit:'COUNT', direction:'INFORMATIONAL', isActive:true, status:'ACTIVE', calculationVersion:1 };
    contextService.resolve.mockResolvedValue({ employee:{id:'e1'}, performanceProfile:{id:'p1', code:'P1', name:'P', nameAr:null, nameEn:null, updatedAt:new Date('2026-01-01') } });
    prisma.performanceProfile.findFirst.mockResolvedValue({ id:'p1', companyId:'c1', code:'P1', name:'P', nameAr:null, nameEn:null });
    const weightRow = { id:'w1', companyId:'c1', performanceProfileId:'p1', kpiDefinitionId:'k1', weightPercent:D('0'), isRequired:false, isInformational:true, effectiveFrom:d('2025-01-01'), effectiveTo:null, revision:1, status:'ACTIVE', kpiDefinition:kpi };
    prisma.performanceProfileKpiWeight.findMany.mockResolvedValue([weightRow]);
    prisma.performanceKpiScoringRule.findFirst.mockResolvedValue(null);
    prisma.performanceKpiScoringRule.findMany.mockResolvedValue([]);
    prisma.performanceKpiTarget.findMany.mockResolvedValue([]);
    prisma.productionPerformanceTarget.findMany.mockResolvedValue([]);
    previewService.preview.mockResolvedValue({ status:'CALCULABLE', rawValue:10, evidenceCount:1, explanation:'ok' });
    const res = await svc.simulate({ operationalPersonId:'e1', dateFrom:'2026-01-01T00:00:00Z', dateTo:'2026-01-31T00:00:00Z' } as any, ctx, 'u1');
    expect(res.kpis[0].weightedContribution).toBeNull();
    expect(res.kpis[0].score).toBeNull();
  });

  it('CROSS_REVISION_PERIOD_SAFE returns CONFIGURATION_PERIOD_SPLIT_REQUIRED', async () => {
    const kpi = { id:'k1', code:'PROD_GOOD_OUTPUT', name:'Good', nameAr:null, nameEn:null, domain:'PRODUCTION', measurementUnit:'UNIT', direction:'HIGHER_IS_BETTER', isActive:true, status:'ACTIVE', calculationVersion:1 };
    contextService.resolve.mockResolvedValue({ employee:{id:'e1'}, performanceProfile:{id:'p1', code:'P1', name:'P', nameAr:null, nameEn:null, updatedAt:new Date('2026-01-01') } });
    prisma.performanceProfile.findFirst.mockResolvedValue({ id:'p1', companyId:'c1', code:'P1', name:'P', nameAr:null, nameEn:null });
    const weightRow = { id:'w1', companyId:'c1', performanceProfileId:'p1', kpiDefinitionId:'k1', weightPercent:D('100'), isRequired:true, isInformational:false, effectiveFrom:d('2025-01-01'), effectiveTo:null, revision:1, status:'ACTIVE', kpiDefinition:kpi };
    prisma.performanceProfileKpiWeight.findMany.mockResolvedValue([weightRow]);
    prisma.performanceKpiScoringRule.findMany.mockResolvedValue([]);
    prisma.performanceKpiTarget.findMany.mockResolvedValue([{ id:'t2', kpiDefinitionId:'k1', effectiveFrom:d('2026-01-15'), effectiveTo:null, status:'ACTIVE', revision:2 }]);
    const res = await svc.simulate({ operationalPersonId:'e1', dateFrom:'2026-01-01T00:00:00Z', dateTo:'2026-01-31T00:00:00Z' } as any, ctx, 'u1');
    expect(res.status).toBe('CONFIGURATION_PERIOD_SPLIT_REQUIRED');
  });
});
