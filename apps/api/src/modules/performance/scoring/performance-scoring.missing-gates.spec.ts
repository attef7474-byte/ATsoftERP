import 'reflect-metadata';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Prisma } from '@prisma/client';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { PerformanceScoringService } from './performance-scoring.service';
import { PerformanceScoringController } from './performance-scoring.controller';
import {
  CreatePerformanceTargetDto, UpdatePerformanceTargetDto,
  CreatePerformanceWeightDto, UpdatePerformanceWeightDto,
  CreatePerformanceScoringRuleDto, UpdatePerformanceScoringRuleDto,
  SimulatePerformanceDto,
} from './dto/performance-scoring.dto';
import { ActiveContextInterceptor } from '../../../common/operational-context/active-context.interceptor';
import { ActiveContextService } from '../../../common/operational-context/active-context.service';
import { ARCHIVED_CONTEXT_MODE_HEADER, ARCHIVED_CONTEXT_MODE_VALUE, ARCHIVE_READ_PERMISSION } from '../../../common/operational-context/archive-context.constants';

const D = (v: any) => new Prisma.Decimal(v);
const d = (s: string) => new Date(s);
const ctx: any = { companyId: 'c1', branchId: 'b1' };

async function vDto(cls: any, obj: any) {
  const inst = plainToInstance(cls, obj);
  return validate(inst as object, { whitelist: true, forbidNonWhitelisted: true });
}
function hasForbidden(errors: any[], field: string) {
  const msgs = errors.flatMap(e => Object.values(e.constraints || {})).map(String).join(' ');
  return errors.some(e => e.property === field) || /should not exist|whitelist/i.test(msgs);
}

function mkService() {
  const emptyMany = () => jest.fn().mockResolvedValue([]);
  const prisma: any = {
    performanceKpiDefinition: { findFirst: jest.fn() },
    performanceProfile: { findFirst: jest.fn(), findMany: emptyMany() },
    performanceKpiTarget: { findFirst: jest.fn(), findMany: emptyMany(), create: jest.fn(), update: jest.fn(), count: jest.fn() },
    performanceProfileKpiWeight: { findFirst: jest.fn(), findMany: emptyMany(), create: jest.fn(), update: jest.fn(), count: jest.fn() },
    performanceKpiScoringRule: { findFirst: jest.fn(), findMany: emptyMany(), create: jest.fn(), update: jest.fn(), count: jest.fn() },
    productionPerformanceTarget: { findMany: emptyMany() },
  };
  const audit: any = { logBusiness: jest.fn().mockResolvedValue(undefined) };
  const contextService: any = { resolve: jest.fn() };
  const previewService: any = { preview: jest.fn() };
  const productionTargets: any = { resolveForRun: jest.fn() };
  const svc = new PerformanceScoringService(prisma, audit, contextService, previewService, productionTargets);
  return { prisma, audit, contextService, previewService, svc };
}

describe('Phase 3 missing gates', () => {
  it('WEIGHT_100_ACTIVATION=PASS: exactly 100.0000 activates', async () => {
    const { prisma, svc } = mkService();
    const existing = { id:'w1', companyId:'c1', performanceProfileId:'p1', kpiDefinitionId:'k1', status:'DRAFT', weightPercent:D('100'), effectiveFrom:d('2026-01-01'), effectiveTo:null };
    prisma.performanceProfileKpiWeight.findFirst.mockResolvedValueOnce(existing).mockResolvedValueOnce(null);
    prisma.performanceProfileKpiWeight.update.mockResolvedValueOnce({ ...existing, status:'ACTIVE' });
    prisma.performanceProfileKpiWeight.findMany.mockResolvedValue([{ weightPercent:D('100.0000') }]);
    const row = await svc.activateWeight('w1', ctx, 'u1');
    expect(row.status).toBe('ACTIVE');
  });

  it('PROFILE_READINESS full matrix', async () => {
    const { prisma, svc } = mkService();
    prisma.performanceProfile.findFirst.mockResolvedValue({ id:'p1', companyId:'c1', code:'P1', name:'P', nameAr:null, nameEn:null });
    // MISSING_WEIGHT
    prisma.performanceProfileKpiWeight.findMany.mockResolvedValue([]);
    let r = await svc.profileReadiness('p1', ctx, '2026-06-01T00:00:00Z');
    expect(r.status).toBe('NOT_READY');
    expect(r.issues.some((i:any)=>i.code==='MISSING_WEIGHT')).toBe(true);

    // MISSING_TARGET / MISSING_RULE / INVALID_WEIGHT_TOTAL / OVERLAPPING_CONFIGURATION via controlled active weight
    const kpi = { id:'k1', code:'K1', name:'K1', nameAr:null, nameEn:null, domain:'PRODUCTION', direction:'HIGHER_IS_BETTER', measurementUnit:'PCT', isActive:true, status:'ACTIVE', calculationVersion:1 };
    const weightRow = { id:'w1', companyId:'c1', performanceProfileId:'p1', kpiDefinitionId:'k1', weightPercent:D('30'), isRequired:true, isInformational:false, effectiveFrom:d('2025-01-01'), effectiveTo:null, revision:1, status:'ACTIVE', kpiDefinition:kpi };
    prisma.performanceProfileKpiWeight.findMany.mockImplementation(async (args:any) => {
      if (args?.where?.kpiDefinitionId === undefined && args?.include?.kpiDefinition) return [weightRow];
      // detectOverlapIssues may call with different shape
      if (args?.where?.performanceProfileId === 'p1' && !args?.include) return [weightRow, { ...weightRow, id:'w2' }]; // overlap
      return [weightRow];
    });
    prisma.performanceKpiScoringRule.findFirst.mockResolvedValue(null);
    prisma.performanceKpiScoringRule.findMany.mockImplementation(async (args:any) => {
      if (args?.where?.OR) return [ { id:'r1', kpiDefinitionId:'k1', performanceProfileId:'p1', effectiveFrom:d('2025-01-01'), effectiveTo:null, status:'ACTIVE' }, { id:'r2', kpiDefinitionId:'k1', performanceProfileId:'p1', effectiveFrom:d('2025-01-01'), effectiveTo:null, status:'ACTIVE' } ];
      return [];
    });
    prisma.performanceKpiTarget.findMany.mockImplementation(async (args:any) => {
      // resolveTargetForKpi call
      if (args?.where?.kpiDefinitionId === 'k1' && args?.orderBy) return [];
      // overlap check
      return [{ id:'t1', kpiDefinitionId:'k1', performanceProfileId:'p1', branchId:null, productionLineId:null, machineId:null, productionProductDefinitionId:null, departmentId:null, jobTitleId:null, scopeType:'COMPANY', effectiveFrom:d('2025-01-01'), effectiveTo:null, status:'ACTIVE' }, { id:'t2', kpiDefinitionId:'k1', performanceProfileId:'p1', branchId:null, productionLineId:null, machineId:null, productionProductDefinitionId:null, departmentId:null, jobTitleId:null, scopeType:'COMPANY', effectiveFrom:d('2025-01-01'), effectiveTo:null, status:'ACTIVE' }];
    });
    prisma.performanceKpiTarget.findFirst.mockResolvedValue(null);
    prisma.productionPerformanceTarget.findMany.mockResolvedValue([]);
    r = await svc.profileReadiness('p1', ctx, '2026-06-01T00:00:00Z');
    const codes = new Set((r.issues||[]).map((i:any)=>i.code).concat((r.issues||[]).flatMap((i:any)=>i.issues||[])));
    expect(r.status).toBe('NOT_READY');
    expect(codes.has('INVALID_WEIGHT_TOTAL') || (r.issues||[]).some((i:any)=>i.code==='INVALID_WEIGHT_TOTAL')).toBe(true);
    expect((r.issues||[]).some((i:any)=>i.code==='OVERLAPPING_CONFIGURATION') || codes.has('OVERLAPPING_CONFIGURATION')).toBe(true);
    // MISSING_TARGET / MISSING_RULE appear as issue entries
    expect(JSON.stringify(r.issues)).toMatch(/MISSING_TARGET|MISSING_RULE/);
  });

  it('NOT_APPLICABLE_SCORING=PASS: score null contribution null', async () => {
    const { prisma, contextService, previewService, svc } = mkService();
    const kpi = { id:'k1', code:'PROD_GOOD_OUTPUT', name:'Good', nameAr:null, nameEn:null, domain:'PRODUCTION', measurementUnit:'UNIT', direction:'HIGHER_IS_BETTER', isActive:true, status:'ACTIVE', calculationVersion:1 };
    contextService.resolve.mockResolvedValue({ employee:{id:'e1'}, performanceProfile:{id:'p1', code:'P1', name:'P', nameAr:null, nameEn:null, updatedAt:new Date('2026-01-01') } });
    prisma.performanceProfile.findFirst.mockResolvedValue({ id:'p1', companyId:'c1', code:'P1', name:'P', nameAr:null, nameEn:null });
    const weightRow = { id:'w1', companyId:'c1', performanceProfileId:'p1', kpiDefinitionId:'k1', weightPercent:D('100'), isRequired:true, isInformational:false, effectiveFrom:d('2025-01-01'), effectiveTo:null, revision:1, status:'ACTIVE', kpiDefinition:kpi };
    prisma.performanceProfileKpiWeight.findMany.mockResolvedValue([weightRow]);
    prisma.performanceKpiScoringRule.findFirst.mockResolvedValue({ id:'r1', scoringMode:'CAPPED_RATIO', direction:'HIGHER_IS_BETTER', minScore:D('0'), maxScore:D('100'), targetScore:null, floorValue:null, targetValue:D('100'), ceilingValue:null, bandsJson:null, clampMin:D('0'), clampMax:D('100'), revision:1, effectiveFrom:d('2025-01-01'), effectiveTo:null });
    prisma.performanceKpiScoringRule.findMany.mockResolvedValue([]);
    prisma.performanceKpiTarget.findMany.mockResolvedValue([{ id:'t1', companyId:'c1', kpiDefinitionId:'k1', performanceProfileId:null, branchId:null, productionLineId:null, machineId:null, productionProductDefinitionId:null, departmentId:null, jobTitleId:null, scopeType:'COMPANY', targetValue:D('100'), minimumAcceptableValue:null, maximumExceptionalValue:null, effectiveFrom:d('2025-01-01'), effectiveTo:null, revision:1, status:'ACTIVE' }]);
    previewService.preview.mockResolvedValue({ status:'NOT_APPLICABLE', rawValue:null, evidenceCount:0, explanation:'na' });
    const res = await svc.simulate({ operationalPersonId:'e1', dateFrom:'2026-01-01T00:00:00Z', dateTo:'2026-01-31T00:00:00Z' } as any, ctx, 'u1');
    expect(res.kpis[0].score).toBeNull();
    expect(res.kpis[0].weightedContribution).toBeNull();
  });

  it('OVERLAP create/update/activate for target/weight/rule', async () => {
    const { prisma, svc } = mkService();
    prisma.performanceKpiDefinition.findFirst.mockResolvedValue({ id:'k1', companyId:'c1', isActive:true, status:'ACTIVE', measurementUnit:'PCT' });
    prisma.performanceProfile.findFirst.mockResolvedValue({ id:'p1', companyId:'c1' });
    const overlap = { id:'other', effectiveFrom:d('2026-01-01'), effectiveTo:null, revision:1, status:'ACTIVE' };

    // target create
    prisma.performanceKpiTarget.findFirst.mockResolvedValueOnce(overlap);
    await expect(svc.createTarget({ kpiDefinitionId:'k1', scopeType:'COMPANY', targetValue:80, effectiveFrom:'2026-06-01T00:00:00Z' } as any, ctx, 'u1')).rejects.toBeInstanceOf(BadRequestException);
    // target update
    prisma.performanceKpiTarget.findFirst.mockResolvedValueOnce({ id:'t1', companyId:'c1', kpiDefinitionId:'k1', performanceProfileId:null, branchId:null, productionLineId:null, machineId:null, productionProductDefinitionId:null, departmentId:null, jobTitleId:null, scopeType:'COMPANY', status:'DRAFT', effectiveFrom:d('2026-01-01'), effectiveTo:null, targetValue:D('10') });
    prisma.performanceKpiTarget.findFirst.mockResolvedValueOnce(overlap);
    await expect(svc.updateTarget('t1', { effectiveFrom:'2026-06-01T00:00:00Z' } as any, ctx, 'u1')).rejects.toBeInstanceOf(BadRequestException);
    // target activate
    prisma.performanceKpiTarget.findFirst.mockResolvedValueOnce({ id:'t1', companyId:'c1', kpiDefinitionId:'k1', performanceProfileId:null, branchId:null, productionLineId:null, machineId:null, productionProductDefinitionId:null, departmentId:null, jobTitleId:null, scopeType:'COMPANY', status:'DRAFT', effectiveFrom:d('2026-01-01'), effectiveTo:null });
    prisma.performanceKpiTarget.findFirst.mockResolvedValueOnce(overlap);
    await expect(svc.activateTarget('t1', ctx, 'u1')).rejects.toBeInstanceOf(BadRequestException);

    // weight create
    prisma.performanceProfileKpiWeight.findFirst.mockResolvedValueOnce(overlap);
    await expect(svc.createWeight({ performanceProfileId:'p1', kpiDefinitionId:'k1', weightPercent:10, effectiveFrom:'2026-06-01T00:00:00Z' } as any, ctx, 'u1')).rejects.toBeInstanceOf(BadRequestException);
    // weight update
    prisma.performanceProfileKpiWeight.findFirst.mockResolvedValueOnce({ id:'w1', companyId:'c1', performanceProfileId:'p1', kpiDefinitionId:'k1', status:'DRAFT', weightPercent:D('10'), isRequired:false, isInformational:false, effectiveFrom:d('2026-01-01'), effectiveTo:null });
    prisma.performanceProfileKpiWeight.findFirst.mockResolvedValueOnce(overlap);
    await expect(svc.updateWeight('w1', { effectiveFrom:'2026-06-01T00:00:00Z' } as any, ctx, 'u1')).rejects.toBeInstanceOf(BadRequestException);
    // weight activate
    prisma.performanceProfileKpiWeight.findFirst.mockResolvedValueOnce({ id:'w1', companyId:'c1', performanceProfileId:'p1', kpiDefinitionId:'k1', status:'DRAFT', weightPercent:D('10'), effectiveFrom:d('2026-01-01'), effectiveTo:null });
    prisma.performanceProfileKpiWeight.findFirst.mockResolvedValueOnce(overlap);
    await expect(svc.activateWeight('w1', ctx, 'u1')).rejects.toBeInstanceOf(BadRequestException);

    // rule create
    prisma.performanceKpiScoringRule.findFirst.mockResolvedValueOnce(overlap);
    await expect(svc.createRule({ kpiDefinitionId:'k1', performanceProfileId:'p1', scoringMode:'LINEAR_TARGET', direction:'HIGHER_IS_BETTER', effectiveFrom:'2026-06-01T00:00:00Z' } as any, ctx, 'u1')).rejects.toBeInstanceOf(BadRequestException);
    // rule update
    prisma.performanceKpiScoringRule.findFirst.mockResolvedValueOnce({ id:'r1', companyId:'c1', kpiDefinitionId:'k1', performanceProfileId:'p1', status:'DRAFT', scoringMode:'LINEAR_TARGET', direction:'HIGHER_IS_BETTER', effectiveFrom:d('2026-01-01'), effectiveTo:null, minScore:D(0), maxScore:D(100), targetScore:D(100), floorValue:D(0), targetValue:D(100), ceilingValue:D(100), bandsJson:null, clampMin:D(0), clampMax:D(100), missingDataPolicy:null, notApplicablePolicy:null, configMissingPolicy:null });
    prisma.performanceKpiScoringRule.findFirst.mockResolvedValueOnce(overlap);
    await expect(svc.updateRule('r1', { effectiveFrom:'2026-06-01T00:00:00Z' } as any, ctx, 'u1')).rejects.toBeInstanceOf(BadRequestException);
    // rule activate
    prisma.performanceKpiScoringRule.findFirst.mockResolvedValueOnce({ id:'r1', companyId:'c1', kpiDefinitionId:'k1', performanceProfileId:'p1', status:'DRAFT', effectiveFrom:d('2026-01-01'), effectiveTo:null });
    prisma.performanceKpiScoringRule.findFirst.mockResolvedValueOnce(overlap);
    await expect(svc.activateRule('r1', ctx, 'u1')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('PHASE3_MASS_ASSIGNMENT_PROTECTION create/update/simulate DTOs', async () => {
    const sys = ['companyId','createdById','updatedById','revision','supersedesId','status','deletedAt','id'];
    for (const f of sys) {
      expect(hasForbidden(await vDto(CreatePerformanceTargetDto, { kpiDefinitionId:'k1', scopeType:'COMPANY', targetValue:80, effectiveFrom:'2026-01-01T00:00:00Z', [f]:'x' }), f)).toBe(true);
      expect(hasForbidden(await vDto(UpdatePerformanceTargetDto, { targetValue:80, [f]:'x' }), f)).toBe(true);
      expect(hasForbidden(await vDto(CreatePerformanceWeightDto, { performanceProfileId:'p1', kpiDefinitionId:'k1', weightPercent:10, effectiveFrom:'2026-01-01T00:00:00Z', [f]:'x' }), f)).toBe(true);
      expect(hasForbidden(await vDto(UpdatePerformanceWeightDto, { weightPercent:10, [f]:'x' }), f)).toBe(true);
      expect(hasForbidden(await vDto(CreatePerformanceScoringRuleDto, { kpiDefinitionId:'k1', scoringMode:'LINEAR_TARGET', direction:'HIGHER_IS_BETTER', effectiveFrom:'2026-01-01T00:00:00Z', [f]:'x' }), f)).toBe(true);
      expect(hasForbidden(await vDto(UpdatePerformanceScoringRuleDto, { scoringMode:'LINEAR_TARGET', [f]:'x' }), f)).toBe(true);
      expect(hasForbidden(await vDto(SimulatePerformanceDto, { operationalPersonId:'e1', dateFrom:'2026-01-01T00:00:00Z', dateTo:'2026-01-31T00:00:00Z', [f]:'x' }), f)).toBe(true);
    }
  });

  it('PHASE3_AUDIT_TESTS logBusiness shape and SIMULATION_AUDIT_SPAM=0', async () => {
    const { prisma, audit, contextService, previewService, svc } = mkService();
    prisma.performanceKpiDefinition.findFirst.mockResolvedValue({ id:'k1', companyId:'c1', isActive:true, status:'ACTIVE', measurementUnit:'PCT' });
    prisma.performanceKpiTarget.findFirst.mockResolvedValueOnce(null); // no overlap create
    prisma.performanceKpiTarget.create.mockResolvedValue({ id:'t1', companyId:'c1', status:'DRAFT', targetValue:D(80), revision:1, effectiveFrom:d('2026-01-01'), effectiveTo:null });
    await svc.createTarget({ kpiDefinitionId:'k1', scopeType:'COMPANY', targetValue:80, effectiveFrom:'2026-01-01T00:00:00Z', reason:'test' } as any, ctx, 'u1');
    expect(audit.logBusiness).toHaveBeenCalled();
    const call = audit.logBusiness.mock.calls[0][0];
    expect(call).toMatchObject({ companyId:'c1', userId:'u1', entity:'PerformanceKpiTarget', entityId:'t1' });
    expect(call).toHaveProperty('branchId');
    expect(call).toHaveProperty('previous');
    expect(call).toHaveProperty('next');

    audit.logBusiness.mockClear();
    // simulation should not audit-spam
    const kpi = { id:'k1', code:'PROD_GOOD_OUTPUT', name:'Good', nameAr:null, nameEn:null, domain:'PRODUCTION', measurementUnit:'UNIT', direction:'HIGHER_IS_BETTER', isActive:true, status:'ACTIVE', calculationVersion:1 };
    contextService.resolve.mockResolvedValue({ employee:{id:'e1'}, performanceProfile:{id:'p1', code:'P1', name:'P', nameAr:null, nameEn:null, updatedAt:new Date('2026-01-01') } });
    prisma.performanceProfile.findFirst.mockResolvedValue({ id:'p1', companyId:'c1', code:'P1', name:'P', nameAr:null, nameEn:null });
    prisma.performanceProfileKpiWeight.findMany.mockResolvedValue([{ id:'w1', companyId:'c1', performanceProfileId:'p1', kpiDefinitionId:'k1', weightPercent:D('100'), isRequired:false, isInformational:true, effectiveFrom:d('2025-01-01'), effectiveTo:null, revision:1, status:'ACTIVE', kpiDefinition:kpi }]);
    prisma.performanceKpiScoringRule.findMany.mockResolvedValue([]);
    prisma.performanceKpiTarget.findMany.mockResolvedValue([]);
    previewService.preview.mockResolvedValue({ status:'INFORMATIONAL', rawValue:1, evidenceCount:1, explanation:'ok' });
    await svc.simulate({ operationalPersonId:'e1', dateFrom:'2026-01-01T00:00:00Z', dateTo:'2026-01-31T00:00:00Z' } as any, ctx, 'u1');
    expect(audit.logBusiness).not.toHaveBeenCalled();
  });

  it('PHASE3_TENANT_TESTS company scoping and foreign IDs rejected/not found', async () => {
    const { prisma, svc } = mkService();
    prisma.performanceKpiTarget.findFirst.mockResolvedValue(null);
    await expect(svc.activateTarget('foreign', { companyId:'c1', branchId:'b1' } as any, 'u1')).rejects.toBeInstanceOf(require('@nestjs/common').NotFoundException);
    expect(prisma.performanceKpiTarget.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ id:'foreign', companyId:'c1' }) }));

    prisma.performanceProfileKpiWeight.findFirst.mockResolvedValue(null);
    await expect(svc.activateWeight('foreign', { companyId:'c1', branchId:'b1' } as any, 'u1')).rejects.toBeInstanceOf(require('@nestjs/common').NotFoundException);

    prisma.performanceKpiScoringRule.findFirst.mockResolvedValue(null);
    await expect(svc.activateRule('foreign', { companyId:'c1', branchId:'b1' } as any, 'u1')).rejects.toBeInstanceOf(require('@nestjs/common').NotFoundException);
  });

  it('ARCHIVED_CONTEXT_WRITE_PROTECTION mutation rejected in archived mode', async () => {
    const reflector = { getAllAndOverride: jest.fn().mockReturnValue(undefined) } as unknown as Reflector;
    const service = {
      validate: jest.fn(),
      validateArchived: jest.fn().mockResolvedValue({ context: { isArchived: true }, authorization: { roles: [], permissions: [ARCHIVE_READ_PERMISSION], isSuperAdmin: false } }),
      assertRequestMatches: jest.fn(),
    } as unknown as ActiveContextService;
    const interceptor = new ActiveContextInterceptor(reflector, service);
    for (const method of ['POST','PATCH','DELETE']) {
      const request: any = { method, headers: { 'x-active-company-id':'c1', 'x-active-branch-id':'b1', [ARCHIVED_CONTEXT_MODE_HEADER]: ARCHIVED_CONTEXT_MODE_VALUE }, user: { id:'u1' }, body:{}, query:{} };
      const ctxExec: any = { getType: () => 'http', getHandler: () => function h(){}, getClass: () => class C{}, switchToHttp: () => ({ getRequest: () => request }) };
      const next: any = { handle: jest.fn() };
      await expect(interceptor.intercept(ctxExec, next)).rejects.toBeInstanceOf(ForbiddenException);
      expect(next.handle).not.toHaveBeenCalled();
    }
  });

  it('PHASE3_ROUTE_COLLISIONS=0 and RBAC metadata matrix present', () => {
    const proto = PerformanceScoringController.prototype as any;
    const methods = Object.getOwnPropertyNames(proto).filter(m => m !== 'constructor');
    const paths = methods.map(m => Reflect.getMetadata('path', proto[m])).filter(Boolean);
    for (const p of ['targets','weights','scoring-rules','profiles/:id/readiness','configuration-coverage','simulate']) expect(paths).toContain(p);
    // no dynamic capture conflicts on same base
    expect(paths.filter((p:string)=>p.includes(':id')).every((p:string)=>p.startsWith('targets/')||p.startsWith('weights/')||p.startsWith('scoring-rules/')||p.startsWith('profiles/'))).toBe(true);

    const perms: Record<string,string[]> = {
      listTargets:['performance-target:read'], createTarget:['performance-target:create'], updateTarget:['performance-target:update'], activateTarget:['performance-target:update'], deactivateTarget:['performance-target:deactivate'],
      listWeights:['performance-weight:read'], createWeight:['performance-weight:create'], updateWeight:['performance-weight:update'], activateWeight:['performance-weight:update'], deactivateWeight:['performance-weight:deactivate'],
      listRules:['performance-scoring-rule:read'], createRule:['performance-scoring-rule:create'], updateRule:['performance-scoring-rule:update'], activateRule:['performance-scoring-rule:update'], deactivateRule:['performance-scoring-rule:deactivate'],
      readiness:['performance-weight:read'], coverage:['performance-config-coverage:read'], simulate:['performance-simulation:read'],
    };
    for (const [m, p] of Object.entries(perms)) expect(Reflect.getMetadata('permissions', proto[m])).toEqual(p);
  });
});
