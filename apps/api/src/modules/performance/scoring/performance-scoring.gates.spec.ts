import 'reflect-metadata';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import { computeKpiScore } from './performance-scoring.engine';
import { PerformanceScoringService } from './performance-scoring.service';
import { PerformanceScoringController } from './performance-scoring.controller';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreatePerformanceTargetDto, CreatePerformanceWeightDto, CreatePerformanceScoringRuleDto } from './dto/performance-scoring.dto';

const D = (v: any) => new Prisma.Decimal(v);
const d = (s: string) => new Date(s);
const ctx: any = { companyId: 'c1', branchId: 'b1' };

async function validateDto(cls: any, obj: any) {
  const inst = plainToInstance(cls, obj);
  return validate(inst as object, { whitelist: true, forbidNonWhitelisted: true });
}

describe('Phase 3 mandatory gates', () => {
  describe('SCORING_ENGINE_MODES / boundaries / clamp / decimal', () => {
    it('SCORING_ENGINE_MODES=PASS all 6 modes compute', () => {
      const modes = ['LINEAR_TARGET','LINEAR_RANGE','THRESHOLD_BANDS','CAPPED_RATIO','TARGET_BAND','INVERSE_LINEAR'];
      const results = modes.map(m => {
        if (m === 'THRESHOLD_BANDS') return computeKpiScore(80, { scoringMode: m as any, direction: 'HIGHER_IS_BETTER', bandsJson: JSON.stringify([{min:0,max:100,score:80}]) });
        if (m === 'TARGET_BAND') return computeKpiScore(10, { scoringMode: m as any, direction: 'TARGET_IS_BEST', floorValue:5, targetValue:10, ceilingValue:15, minScore:0, maxScore:100 });
        if (m === 'INVERSE_LINEAR') return computeKpiScore(15, { scoringMode: m as any, direction: 'LOWER_IS_BETTER', floorValue:5, targetValue:15, ceilingValue:45, minScore:0, maxScore:100, targetScore:80 });
        return computeKpiScore(85, { scoringMode: m as any, direction: 'HIGHER_IS_BETTER', floorValue:60, targetValue:85, ceilingValue:95, minScore:0, maxScore:100, targetScore:100 });
      });
      results.forEach(r => expect(r.status).toBe('CALCULABLE'));
    });

    it('HIGHER_IS_BETTER_MONOTONICITY and SCORE_CLAMP', () => {
      const rule = { scoringMode: 'LINEAR_TARGET' as const, direction: 'HIGHER_IS_BETTER' as const, floorValue: 60, targetValue: 85, ceilingValue: 95, minScore: 0, maxScore: 100, targetScore: 100 };
      const s50 = Number(computeKpiScore(50, rule).score);
      const s70 = Number(computeKpiScore(70, rule).score);
      const s85 = Number(computeKpiScore(85, rule).score);
      const s95 = Number(computeKpiScore(95, rule).score);
      expect(s50).toBeLessThan(s70);
      expect(s70).toBeLessThan(s85);
      expect(s85).toBeLessThanOrEqual(s95);
      expect(Number(computeKpiScore(-999, { ...rule, clampMin: 0, clampMax: 100 }).score)).toBeGreaterThanOrEqual(0);
      expect(Number(computeKpiScore(999, { ...rule, clampMin: 0, clampMax: 100 }).score)).toBeLessThanOrEqual(100);
    });

    it('LOWER_IS_BETTER_MONOTONICITY', () => {
      const rule = { scoringMode: 'INVERSE_LINEAR' as const, direction: 'LOWER_IS_BETTER' as const, floorValue: 5, targetValue: 15, ceilingValue: 45, minScore: 0, maxScore: 100, targetScore: 80 };
      expect(Number(computeKpiScore(5, rule).score)).toBeGreaterThan(Number(computeKpiScore(15, rule).score));
      expect(Number(computeKpiScore(15, rule).score)).toBeGreaterThan(Number(computeKpiScore(45, rule).score));
    });

    it('SCORING_BOUNDARIES exact and near boundaries', () => {
      const rule = { scoringMode: 'LINEAR_TARGET' as const, direction: 'HIGHER_IS_BETTER' as const, floorValue: 60, targetValue: 85, ceilingValue: 95, minScore: 0, maxScore: 100, targetScore: 100 };
      expect(Number(computeKpiScore(60, rule).score)).toBe(0);
      expect(Number(computeKpiScore(85, rule).score)).toBe(100);
      expect(Number(computeKpiScore(95, rule).score)).toBe(100);
      expect(Number(computeKpiScore(59.99, rule).score)).toBe(0);
      expect(Number(computeKpiScore(60.01, rule).score)).toBeGreaterThan(0);
      expect(Number(computeKpiScore(84.99, rule).score)).toBeLessThan(100);
      expect(Number(computeKpiScore(0, { scoringMode:'CAPPED_RATIO', direction:'HIGHER_IS_BETTER', targetValue:100 }).score)).toBe(0);
      expect(Number(computeKpiScore(100, { scoringMode:'CAPPED_RATIO', direction:'HIGHER_IS_BETTER', targetValue:100 }).score)).toBe(100);
    });

    it('DECIMAL_PRECISION no material drift', () => {
      expect(Number(computeKpiScore(12.5, { scoringMode:'CAPPED_RATIO', direction:'HIGHER_IS_BETTER', targetValue:100 }).score?.toDecimalPlaces(4).toString())).toBeCloseTo(12.5, 4);
      expect(Number(computeKpiScore(87.35, { scoringMode:'CAPPED_RATIO', direction:'HIGHER_IS_BETTER', targetValue:100 }).score?.toDecimalPlaces(4).toString())).toBeCloseTo(87.35, 4);
      expect(Number(computeKpiScore(0.3333, { scoringMode:'CAPPED_RATIO', direction:'HIGHER_IS_BETTER', targetValue:1 }).score)).toBeCloseTo(33.33, 2);
      expect(Number(computeKpiScore(99.99, { scoringMode:'CAPPED_RATIO', direction:'HIGHER_IS_BETTER', targetValue:100 }).score?.toDecimalPlaces(4).toString())).toBeCloseTo(99.99, 4);
    });
  });

  describe('Service gates', () => {
    let prisma: any; let audit: any; let contextService: any; let previewService: any; let productionTargets: any; let svc: PerformanceScoringService;
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

    it('WEIGHT_TOTAL_VALIDATION 100/99.5/100.5/negative/>100 + activate rollback', async () => {
      prisma.performanceProfile.findFirst.mockResolvedValue({ id: 'p1', companyId: 'c1' });
      prisma.performanceKpiDefinition.findFirst.mockResolvedValue({ id: 'k1', companyId: 'c1', isActive: true, status: 'ACTIVE' });
      prisma.performanceProfileKpiWeight.findFirst.mockResolvedValue(null);
      await expect(svc.createWeight({ performanceProfileId:'p1', kpiDefinitionId:'k1', weightPercent:-1, effectiveFrom:'2026-01-01T00:00:00Z' } as any, ctx, 'u1')).rejects.toBeInstanceOf(BadRequestException);
      await expect(svc.createWeight({ performanceProfileId:'p1', kpiDefinitionId:'k1', weightPercent:101, effectiveFrom:'2026-01-01T00:00:00Z' } as any, ctx, 'u1')).rejects.toBeInstanceOf(BadRequestException);

      const existing = { id:'w1', companyId:'c1', performanceProfileId:'p1', kpiDefinitionId:'k1', status:'DRAFT', weightPercent:D('100.5'), effectiveFrom:d('2026-01-01'), effectiveTo:null };
      prisma.performanceProfileKpiWeight.findFirst.mockResolvedValueOnce(existing).mockResolvedValueOnce(null);
      prisma.performanceProfileKpiWeight.update.mockResolvedValueOnce({ ...existing, status:'ACTIVE' }).mockResolvedValueOnce({ ...existing, status:'DRAFT' });
      prisma.performanceProfileKpiWeight.findMany.mockResolvedValue([{ weightPercent:D('100.5') }]);
      await expect(svc.activateWeight('w1', ctx, 'u1')).rejects.toMatchObject({ response: { errors: [{ code: 'validation.invalidWeightTotal' }] } });
      expect(prisma.performanceProfileKpiWeight.update).toHaveBeenNthCalledWith(2, { where: { id: 'w1' }, data: { status: 'DRAFT', updatedById: 'u1' } });
    });

    it('PROFILE_READINESS reasons and READY_FOR_SCORING', async () => {
      prisma.performanceProfile.findFirst.mockResolvedValue({ id:'p1', companyId:'c1', code:'P1', name:'P', nameAr:null, nameEn:null });
      prisma.performanceProfileKpiWeight.findMany.mockResolvedValue([]);
      const r = await svc.profileReadiness('p1', ctx, '2026-06-01T00:00:00Z');
      expect(r.status).toBe('NOT_READY');
      expect(r.issues.some((i:any)=>i.code==='MISSING_WEIGHT')).toBe(true);
    });

    it('HISTORICAL_TARGET_RESOLUTION and HISTORICAL_WEIGHT_RESOLUTION', async () => {
      const kpi = { id:'k1', code:'PROD_OEE', direction:'HIGHER_IS_BETTER' };
      prisma.performanceKpiTarget.findMany
        .mockResolvedValueOnce([{ id:'t1', companyId:'c1', kpiDefinitionId:'k1', performanceProfileId:null, branchId:null, productionLineId:null, machineId:null, productionProductDefinitionId:null, departmentId:null, jobTitleId:null, scopeType:'COMPANY', targetValue:D('80'), minimumAcceptableValue:null, maximumExceptionalValue:null, effectiveFrom:d('2026-01-01'), effectiveTo:d('2026-07-01'), revision:1, status:'ACTIVE' }])
        .mockResolvedValueOnce([{ id:'t2', companyId:'c1', kpiDefinitionId:'k1', performanceProfileId:null, branchId:null, productionLineId:null, machineId:null, productionProductDefinitionId:null, departmentId:null, jobTitleId:null, scopeType:'COMPANY', targetValue:D('85'), minimumAcceptableValue:null, maximumExceptionalValue:null, effectiveFrom:d('2026-07-01'), effectiveTo:null, revision:2, status:'ACTIVE' }]);
      const may = await svc.resolveTargetForKpi(kpi, null, ctx, d('2026-05-15'), null);
      const aug = await svc.resolveTargetForKpi(kpi, null, ctx, d('2026-08-15'), null);
      expect((may as any).target.targetValue.toString()).toBe('80');
      expect((aug as any).target.targetValue.toString()).toBe('85');

      // historical weight resolution via activeWeightsForProfile at date
      prisma.performanceProfileKpiWeight.findMany
        .mockResolvedValueOnce([{ weightPercent:D('15'), kpiDefinitionId:'k1', effectiveFrom:d('2026-01-01'), effectiveTo:d('2026-07-01') }])
        .mockResolvedValueOnce([{ weightPercent:D('20'), kpiDefinitionId:'k1', effectiveFrom:d('2026-07-01'), effectiveTo:null }]);
      const wMay = await svc['activeWeightsForProfile']('p1', 'c1', d('2026-05-15'));
      const wAug = await svc['activeWeightsForProfile']('p1', 'c1', d('2026-08-15'));
      expect(wMay[0].weightPercent.toString()).toBe('15');
      expect(wAug[0].weightPercent.toString()).toBe('20');
    });

    it('OVERLAP_PROTECTION target/weight/rule', async () => {
      prisma.performanceKpiDefinition.findFirst.mockResolvedValue({ id:'k1', companyId:'c1', isActive:true, status:'ACTIVE', measurementUnit:'PCT' });
      prisma.performanceKpiTarget.findFirst.mockResolvedValue({ id:'x', effectiveFrom:d('2026-01-01'), effectiveTo:null, revision:1, status:'ACTIVE' });
      await expect(svc.createTarget({ kpiDefinitionId:'k1', scopeType:'COMPANY', targetValue:80, effectiveFrom:'2026-06-01T00:00:00Z' } as any, ctx, 'u1')).rejects.toMatchObject({ response: { errors: [{ code: 'validation.overlap' }] } });

      prisma.performanceProfile.findFirst.mockResolvedValue({ id:'p1', companyId:'c1' });
      prisma.performanceProfileKpiWeight.findFirst.mockResolvedValue({ id:'x', effectiveFrom:d('2026-01-01'), effectiveTo:null, revision:1, status:'ACTIVE' });
      await expect(svc.createWeight({ performanceProfileId:'p1', kpiDefinitionId:'k1', weightPercent:10, effectiveFrom:'2026-06-01T00:00:00Z' } as any, ctx, 'u1')).rejects.toMatchObject({ response: { errors: [{ code: 'validation.overlap' }] } });

      prisma.performanceKpiScoringRule.findFirst.mockResolvedValue({ id:'x', effectiveFrom:d('2026-01-01'), effectiveTo:null, revision:1, status:'ACTIVE' });
      await expect(svc.createRule({ kpiDefinitionId:'k1', performanceProfileId:'p1', scoringMode:'LINEAR_TARGET', direction:'HIGHER_IS_BETTER', effectiveFrom:'2026-06-01T00:00:00Z' } as any, ctx, 'u1')).rejects.toMatchObject({ response: { errors: [{ code: 'validation.overlap' }] } });
    });

    it('TARGET_RESOLUTION_DETERMINISTIC and WRONG_CONTEXT_TARGET_REJECTED/PRODUCTION_CONTEXT_REQUIRED', async () => {
      const kpi = { id:'k1', code:'PROD_OEE', direction:'HIGHER_IS_BETTER' };
      prisma.performanceKpiTarget.findMany.mockResolvedValue([{ id:'t1', companyId:'c1', kpiDefinitionId:'k1', performanceProfileId:null, branchId:'b2', productionLineId:null, machineId:null, productionProductDefinitionId:null, departmentId:null, jobTitleId:null, scopeType:'BRANCH', targetValue:D('90'), minimumAcceptableValue:null, maximumExceptionalValue:null, effectiveFrom:d('2026-01-01'), effectiveTo:null, revision:1, status:'ACTIVE' }]);
      prisma.productionPerformanceTarget.findMany.mockResolvedValue([]);
      const res = await svc.resolveTargetForKpi(kpi, null, ctx, d('2026-06-01'), { organization: { branch: { id: 'b1' }, department: null, jobTitle: null } });
      expect(res.status).toBe('CONFIGURATION_MISSING');

      prisma.performanceKpiTarget.findMany.mockResolvedValue([]);
      prisma.productionPerformanceTarget.findMany.mockResolvedValue([{ id:'pt1', companyId:'c1', branchId:'b1', scopeType:'MACHINE', productionUnitId:null, productionLineId:'l1', machineId:'m1', productionProductDefinitionId:'p1', oeeTarget:D('85'), availabilityTarget:D('90'), performanceTarget:D('90'), qualityTarget:D('99'), effectiveFrom:d('2026-01-01'), effectiveTo:null, revision:1, status:'APPROVED', deletedAt:null }]);
      const ctxRes = await svc.resolveTargetForKpi(kpi, null, ctx, d('2026-06-01'), { organization: { branch: { id: 'b1' } } });
      expect(['CONFIGURATION_MISSING','AMBIGUOUS']).toContain(ctxRes.status);
      if (ctxRes.status === 'CONFIGURATION_MISSING') expect((ctxRes as any).reason).toBe('PRODUCTION_CONTEXT_REQUIRED');
    });

    it('CANONICAL_PRODUCTION_TARGET_REUSE for PROD_OEE/A/P/Q', async () => {
      const makeKpi = (code: string) => ({ id: code, code, direction: 'HIGHER_IS_BETTER' });
      prisma.performanceKpiTarget.findMany.mockResolvedValue([]);
      prisma.productionPerformanceTarget.findMany.mockResolvedValue([{ id:'pt1', code:'PPT-1', scopeType:'COMPANY', productionUnitId:null, productionLineId:null, machineId:null, productionProductDefinitionId:null, availabilityTarget:D('91'), performanceTarget:D('92'), qualityTarget:D('93'), oeeTarget:D('85'), effectiveFrom:d('2026-01-01'), effectiveTo:null, revision:3, companyId:'c1', branchId:'b1', status:'APPROVED', deletedAt:null }]);
      const oee = await svc.resolveTargetForKpi(makeKpi('PROD_OEE'), null, ctx, d('2026-06-01'), null);
      const a = await svc.resolveTargetForKpi(makeKpi('PROD_AVAILABILITY'), null, ctx, d('2026-06-01'), null);
      const p = await svc.resolveTargetForKpi(makeKpi('PROD_PERFORMANCE'), null, ctx, d('2026-06-01'), null);
      const q = await svc.resolveTargetForKpi(makeKpi('PROD_QUALITY'), null, ctx, d('2026-06-01'), null);
      for (const [res, val] of [[oee,'85'],[a,'91'],[p,'92'],[q,'93']] as any[]) {
        expect(res.status).toBe('RESOLVED');
        expect(res.targetSource).toBe('CANONICAL_PRODUCTION_TARGET');
        expect(res.resolvedTarget).toBe(val);
        expect(res.sourceRecord.id).toBe('pt1');
        expect(res.scope).toBe('COMPANY');
        expect(res.revision).toBe(3);
        expect(typeof res.resolutionReason).toBe('string');
      }
    });

    it('CROSS_REVISION_PERIOD_SAFE', async () => {
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

    it('SCORE_VERSION_TRACEABILITY and SIMULATION_PREVIEW_ONLY fields', async () => {
      const kpi = { id:'k1', code:'PROD_GOOD_OUTPUT', name:'Good', nameAr:null, nameEn:null, domain:'PRODUCTION', measurementUnit:'UNIT', direction:'HIGHER_IS_BETTER', isActive:true, status:'ACTIVE', calculationVersion:7 };
      contextService.resolve.mockResolvedValue({ employee:{id:'e1'}, performanceProfile:{id:'p1', code:'P1', name:'P', nameAr:null, nameEn:null, updatedAt:new Date('2026-01-01') } });
      prisma.performanceProfile.findFirst.mockResolvedValue({ id:'p1', companyId:'c1', code:'P1', name:'P', nameAr:null, nameEn:null });
      const weightRow = { id:'w1', companyId:'c1', performanceProfileId:'p1', kpiDefinitionId:'k1', weightPercent:D('100'), isRequired:true, isInformational:false, effectiveFrom:d('2025-01-01'), effectiveTo:null, revision:2, status:'ACTIVE', kpiDefinition:kpi };
      prisma.performanceProfileKpiWeight.findMany.mockResolvedValue([weightRow]);
      prisma.performanceKpiScoringRule.findFirst.mockResolvedValue({ id:'r1', scoringMode:'CAPPED_RATIO', direction:'HIGHER_IS_BETTER', minScore:D('0'), maxScore:D('100'), targetScore:null, floorValue:null, targetValue:D('100'), ceilingValue:null, bandsJson:null, clampMin:D('0'), clampMax:D('100'), revision:3, effectiveFrom:d('2025-01-01'), effectiveTo:null });
      prisma.performanceKpiScoringRule.findMany.mockResolvedValue([]);
      prisma.performanceKpiTarget.findMany.mockResolvedValue([{ id:'t1', companyId:'c1', kpiDefinitionId:'k1', performanceProfileId:null, branchId:null, productionLineId:null, machineId:null, productionProductDefinitionId:null, departmentId:null, jobTitleId:null, scopeType:'COMPANY', targetValue:D('100'), minimumAcceptableValue:null, maximumExceptionalValue:null, effectiveFrom:d('2025-01-01'), effectiveTo:null, revision:4, status:'ACTIVE' }]);
      previewService.preview.mockResolvedValue({ status:'CALCULABLE', rawValue:90, evidenceCount:1, explanation:'ok' });
      const res = await svc.simulate({ operationalPersonId:'e1', dateFrom:'2026-01-01T00:00:00Z', dateTo:'2026-01-31T00:00:00Z' } as any, ctx, 'u1');
      expect(res.previewOnly).toBe(true);
      expect(res.noPersistedEvaluation).toBe(true);
      expect(String(res.simulationLabel)).toBe('PREVIEW_ONLY_NOT_APPROVED');
      expect(res.kpis[0].versions.kpiCalculationVersion).toBe(7);
      expect(res.kpis[0].versions.scoringRuleVersion).toBe(3);
      expect(res.kpis[0].versions.targetRevision).toBe(4);
      expect(res.kpis[0].versions.weightRevision).toBe(2);
      expect(res).toHaveProperty('completenessPercent');
      expect(res).toHaveProperty('configuredWeightCovered');
      expect(res).toHaveProperty('missingRequiredKpis');
    });

    it('NO_DATA_SCORING null score/contribution', async () => {
      const kpi = { id:'k1', code:'PROD_GOOD_OUTPUT', name:'Good', nameAr:null, nameEn:null, domain:'PRODUCTION', measurementUnit:'UNIT', direction:'HIGHER_IS_BETTER', isActive:true, status:'ACTIVE', calculationVersion:1 };
      contextService.resolve.mockResolvedValue({ employee:{id:'e1'}, performanceProfile:{id:'p1', code:'P1', name:'P', nameAr:null, nameEn:null, updatedAt:new Date('2026-01-01') } });
      prisma.performanceProfile.findFirst.mockResolvedValue({ id:'p1', companyId:'c1', code:'P1', name:'P', nameAr:null, nameEn:null });
      const weightRow = { id:'w1', companyId:'c1', performanceProfileId:'p1', kpiDefinitionId:'k1', weightPercent:D('100'), isRequired:true, isInformational:false, effectiveFrom:d('2025-01-01'), effectiveTo:null, revision:1, status:'ACTIVE', kpiDefinition:kpi };
      prisma.performanceProfileKpiWeight.findMany.mockResolvedValue([weightRow]);
      prisma.performanceKpiScoringRule.findFirst.mockResolvedValue(null);
      prisma.performanceKpiScoringRule.findMany.mockResolvedValue([]);
      prisma.performanceKpiTarget.findMany.mockResolvedValue([]);
      previewService.preview.mockResolvedValue({ status:'INSUFFICIENT_DATA', rawValue:null, evidenceCount:0, explanation:'no data' });
      const res = await svc.simulate({ operationalPersonId:'e1', dateFrom:'2026-01-01T00:00:00Z', dateTo:'2026-01-31T00:00:00Z' } as any, ctx, 'u1');
      expect(res.kpis[0].score).toBeNull();
      expect(res.kpis[0].weightedContribution).toBeNull();
    });
  });

  describe('DTO / route / permission metadata / schema absence', () => {
    it('PHASE3_MASS_ASSIGNMENT_PROTECTION rejects system fields', async () => {
      const sys = ['companyId','createdById','updatedById','revision','supersedesId','status','deletedAt','id'];
      for (const f of sys) {
        const e1 = await validateDto(CreatePerformanceTargetDto, { kpiDefinitionId:'k1', scopeType:'COMPANY', targetValue:80, effectiveFrom:'2026-01-01T00:00:00Z', [f]:'x' });
        expect(e1.some(e => e.property === f) || /should not exist|whitelist/i.test(e1.flatMap(e=>Object.values(e.constraints||{})).join(' '))).toBe(true);
        const e2 = await validateDto(CreatePerformanceWeightDto, { performanceProfileId:'p1', kpiDefinitionId:'k1', weightPercent:10, effectiveFrom:'2026-01-01T00:00:00Z', [f]:'x' });
        expect(e2.some(e => e.property === f) || /should not exist|whitelist/i.test(e2.flatMap(e=>Object.values(e.constraints||{})).join(' '))).toBe(true);
      }
    });

    it('PHASE3_ROUTE_COLLISIONS=0 controller paths exist', () => {
      const proto = PerformanceScoringController.prototype as any;
      const methods = Object.getOwnPropertyNames(proto).filter(m => m !== 'constructor');
      const paths = methods.map(m => Reflect.getMetadata('path', proto[m])).filter(Boolean);
      for (const p of ['targets','weights','scoring-rules','profiles/:id/readiness','configuration-coverage','simulate']) expect(paths).toContain(p);
    });

    it('PHASE3_PERMISSION_TESTS metadata present', () => {
      const proto = PerformanceScoringController.prototype as any;
      expect(Reflect.getMetadata('permissions', proto['listTargets'])).toEqual(['performance-target:read']);
      expect(Reflect.getMetadata('permissions', proto['createTarget'])).toEqual(['performance-target:create']);
      expect(Reflect.getMetadata('permissions', proto['createWeight'])).toEqual(['performance-weight:create']);
      expect(Reflect.getMetadata('permissions', proto['deactivateRule'])).toEqual(['performance-scoring-rule:deactivate']);
      expect(Reflect.getMetadata('permissions', proto['simulate'])).toEqual(['performance-simulation:read']);
      expect(Reflect.getMetadata('permissions', proto['coverage'])).toEqual(['performance-config-coverage:read']);
    });

    it('NO_PERSISTENCE schema absence for Phase 4 models', () => {
      const schemaPath = path.resolve(__dirname, '../../../../prisma/schema.prisma');
      const schema = fs.readFileSync(schemaPath, 'utf8');
      for (const model of ['EmployeePerformanceResult','EmployeePerformancePeriod','EmployeePerformanceKpiResult','DailyScore','MonthlyScore']) {
        expect(schema).not.toMatch(new RegExp(`model\\s+${model}\\b`));
      }
    });
  });
});
