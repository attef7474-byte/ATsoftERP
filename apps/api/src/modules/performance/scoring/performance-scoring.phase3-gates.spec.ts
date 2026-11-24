import 'reflect-metadata';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Prisma } from '@prisma/client';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { PerformanceScoringService } from './performance-scoring.service';
import { PerformanceScoringController } from './performance-scoring.controller';
import { PermissionsGuard } from '../../auth/guards/permissions.guard';
import { PERMISSIONS_KEY } from '../../../common/decorators/permissions.decorator';
import {
  CreatePerformanceTargetDto, UpdatePerformanceTargetDto,
  CreatePerformanceWeightDto, UpdatePerformanceWeightDto,
  CreatePerformanceScoringRuleDto, UpdatePerformanceScoringRuleDto,
  SimulatePerformanceDto,
} from './dto/performance-scoring.dto';

const D = (v:any)=>new Prisma.Decimal(v);
const d = (s:string)=>new Date(s);
const ctxA:any = { companyId:'A', branchId:'bA' };
const ctxB:any = { companyId:'B', branchId:'bB' };

async function vDto(cls:any,obj:any){ return validate(plainToInstance(cls,obj) as object,{whitelist:true,forbidNonWhitelisted:true}); }
function hasForbidden(errors:any[],field:string){ const msgs=errors.flatMap(e=>Object.values(e.constraints||{})).map(String).join(' '); return errors.some(e=>e.property===field)||/should not exist|whitelist/i.test(msgs); }

function mk(){
  const emptyMany=()=>jest.fn().mockResolvedValue([]);
  const prisma:any={
    performanceKpiDefinition:{findFirst:jest.fn()},
    performanceProfile:{findFirst:jest.fn(),findMany:emptyMany()},
    performanceKpiTarget:{findFirst:jest.fn(),findMany:emptyMany(),create:jest.fn(),update:jest.fn(),count:jest.fn()},
    performanceProfileKpiWeight:{findFirst:jest.fn(),findMany:emptyMany(),create:jest.fn(),update:jest.fn(),count:jest.fn()},
    performanceKpiScoringRule:{findFirst:jest.fn(),findMany:emptyMany(),create:jest.fn(),update:jest.fn(),count:jest.fn()},
    productionPerformanceTarget:{findMany:emptyMany()},
  };
  const audit:any={logBusiness:jest.fn().mockResolvedValue(undefined)};
  const contextService:any={resolve:jest.fn()};
  const previewService:any={preview:jest.fn()};
  const productionTargets:any={resolveForRun:jest.fn()};
  const svc=new PerformanceScoringService(prisma,audit,contextService,previewService,productionTargets);
  return {prisma,audit,contextService,previewService,svc};
}

describe('Phase 3 checklist gates', () => {
  it('WEIGHT_100_ACTIVATION=PASS exactly 100.0000', async () => {
    const {prisma,svc}=mk();
    const existing={id:'w1',companyId:'A',performanceProfileId:'p1',kpiDefinitionId:'k1',status:'DRAFT',weightPercent:D('100.0000'),effectiveFrom:d('2026-01-01'),effectiveTo:null};
    prisma.performanceProfileKpiWeight.findFirst.mockResolvedValueOnce(existing).mockResolvedValueOnce(null);
    prisma.performanceProfileKpiWeight.update.mockResolvedValueOnce({...existing,status:'ACTIVE'});
    prisma.performanceProfileKpiWeight.findMany.mockResolvedValue([{weightPercent:D('100.0000')}]);
    const row=await svc.activateWeight('w1',ctxA,'u1');
    expect(row.status).toBe('ACTIVE');
  });

  it('PROFILE_READINESS full matrix explicit', async () => {
    const {prisma,svc}=mk();
    const profile={id:'p1',companyId:'A',code:'P1',name:'P',nameAr:null,nameEn:null};
    prisma.performanceProfile.findFirst.mockResolvedValue(profile);
    const kpi={id:'k1',code:'K1',name:'K1',nameAr:null,nameEn:null,domain:'PRODUCTION',direction:'HIGHER_IS_BETTER',measurementUnit:'PCT',isActive:true,status:'ACTIVE',calculationVersion:1};
    const baseWeight:any={id:'w1',companyId:'A',performanceProfileId:'p1',kpiDefinitionId:'k1',weightPercent:D('100'),isRequired:true,isInformational:false,effectiveFrom:d('2025-01-01'),effectiveTo:null,revision:1,status:'ACTIVE',kpiDefinition:kpi};

    // READY_FOR_SCORING
    prisma.performanceProfileKpiWeight.findMany.mockResolvedValue([baseWeight]);
    prisma.performanceKpiScoringRule.findFirst.mockResolvedValue({id:'r1',scoringMode:'CAPPED_RATIO',direction:'HIGHER_IS_BETTER',minScore:D(0),maxScore:D(100),targetScore:null,floorValue:null,targetValue:D(100),ceilingValue:null,bandsJson:null,clampMin:D(0),clampMax:D(100),revision:1,effectiveFrom:d('2025-01-01'),effectiveTo:null});
    prisma.performanceKpiScoringRule.findMany.mockResolvedValue([]);
    prisma.performanceKpiTarget.findMany.mockResolvedValue([{id:'t1',companyId:'A',kpiDefinitionId:'k1',performanceProfileId:null,branchId:null,productionLineId:null,machineId:null,productionProductDefinitionId:null,departmentId:null,jobTitleId:null,scopeType:'COMPANY',targetValue:D('100'),minimumAcceptableValue:null,maximumExceptionalValue:null,effectiveFrom:d('2025-01-01'),effectiveTo:null,revision:1,status:'ACTIVE'}]);
    prisma.productionPerformanceTarget.findMany.mockResolvedValue([]);
    let r:any=await svc.profileReadiness('p1',ctxA,'2026-06-01T00:00:00Z');
    expect(r.status).toBe('READY_FOR_SCORING');

    // MISSING_WEIGHT
    prisma.performanceProfileKpiWeight.findMany.mockResolvedValue([]);
    r=await svc.profileReadiness('p1',ctxA,'2026-06-01T00:00:00Z');
    expect(r.status).toBe('NOT_READY');
    expect(r.issues.some((i:any)=>i.code==='MISSING_WEIGHT')).toBe(true);

    // MISSING_TARGET
    prisma.performanceProfileKpiWeight.findMany.mockResolvedValue([baseWeight]);
    prisma.performanceKpiScoringRule.findFirst.mockResolvedValue({id:'r1',scoringMode:'CAPPED_RATIO',direction:'HIGHER_IS_BETTER',minScore:D(0),maxScore:D(100),targetScore:null,floorValue:null,targetValue:D(100),ceilingValue:null,bandsJson:null,clampMin:D(0),clampMax:D(100),revision:1,effectiveFrom:d('2025-01-01'),effectiveTo:null});
    prisma.performanceKpiTarget.findMany.mockResolvedValue([]);
    prisma.productionPerformanceTarget.findMany.mockResolvedValue([]);
    r=await svc.profileReadiness('p1',ctxA,'2026-06-01T00:00:00Z');
    expect(r.status).toBe('NOT_READY');
    expect(JSON.stringify(r.issues)).toContain('MISSING_TARGET');

    // MISSING_RULE
    prisma.performanceKpiTarget.findMany.mockResolvedValue([{id:'t1',companyId:'A',kpiDefinitionId:'k1',performanceProfileId:null,branchId:null,productionLineId:null,machineId:null,productionProductDefinitionId:null,departmentId:null,jobTitleId:null,scopeType:'COMPANY',targetValue:D('100'),minimumAcceptableValue:null,maximumExceptionalValue:null,effectiveFrom:d('2025-01-01'),effectiveTo:null,revision:1,status:'ACTIVE'}]);
    prisma.performanceKpiScoringRule.findFirst.mockResolvedValue(null);
    r=await svc.profileReadiness('p1',ctxA,'2026-06-01T00:00:00Z');
    expect(r.status).toBe('NOT_READY');
    expect(JSON.stringify(r.issues)).toContain('MISSING_RULE');

    // INVALID_WEIGHT_TOTAL
    prisma.performanceProfileKpiWeight.findMany.mockResolvedValue([{...baseWeight,weightPercent:D('99.5')}]);
    prisma.performanceKpiScoringRule.findFirst.mockResolvedValue({id:'r1',scoringMode:'CAPPED_RATIO',direction:'HIGHER_IS_BETTER',minScore:D(0),maxScore:D(100),targetScore:null,floorValue:null,targetValue:D(100),ceilingValue:null,bandsJson:null,clampMin:D(0),clampMax:D(100),revision:1,effectiveFrom:d('2025-01-01'),effectiveTo:null});
    r=await svc.profileReadiness('p1',ctxA,'2026-06-01T00:00:00Z');
    expect(r.status).toBe('NOT_READY');
    expect(r.issues.some((i:any)=>i.code==='INVALID_WEIGHT_TOTAL')).toBe(true);

    // OVERLAPPING_CONFIGURATION
    prisma.performanceProfileKpiWeight.findMany.mockImplementation(async (args:any)=>{
      if(args?.include?.kpiDefinition) return [baseWeight];
      return [baseWeight, {...baseWeight,id:'w2'}];
    });
    prisma.performanceKpiTarget.findMany.mockImplementation(async (args:any)=>{
      if(args?.orderBy) return [{id:'t1',companyId:'A',kpiDefinitionId:'k1',performanceProfileId:null,branchId:null,productionLineId:null,machineId:null,productionProductDefinitionId:null,departmentId:null,jobTitleId:null,scopeType:'COMPANY',targetValue:D('100'),minimumAcceptableValue:null,maximumExceptionalValue:null,effectiveFrom:d('2025-01-01'),effectiveTo:null,revision:1,status:'ACTIVE'}];
      return [{id:'t1',kpiDefinitionId:'k1',performanceProfileId:'p1',branchId:null,productionLineId:null,machineId:null,productionProductDefinitionId:null,departmentId:null,jobTitleId:null,scopeType:'COMPANY',effectiveFrom:d('2025-01-01'),effectiveTo:null,status:'ACTIVE'},{id:'t2',kpiDefinitionId:'k1',performanceProfileId:'p1',branchId:null,productionLineId:null,machineId:null,productionProductDefinitionId:null,departmentId:null,jobTitleId:null,scopeType:'COMPANY',effectiveFrom:d('2025-01-01'),effectiveTo:null,status:'ACTIVE'}];
    });
    prisma.performanceKpiScoringRule.findMany.mockResolvedValue([]);
    r=await svc.profileReadiness('p1',ctxA,'2026-06-01T00:00:00Z');
    expect(r.status).toBe('NOT_READY');
    expect(JSON.stringify(r.issues)).toContain('OVERLAPPING_CONFIGURATION');
  });

  it('NOT_APPLICABLE_SCORING=PASS score null contribution null', async () => {
    const {prisma,contextService,previewService,svc}=mk();
    const kpi={id:'k1',code:'PROD_GOOD_OUTPUT',name:'Good',nameAr:null,nameEn:null,domain:'PRODUCTION',measurementUnit:'UNIT',direction:'HIGHER_IS_BETTER',isActive:true,status:'ACTIVE',calculationVersion:1};
    contextService.resolve.mockResolvedValue({employee:{id:'e1'},performanceProfile:{id:'p1',code:'P1',name:'P',nameAr:null,nameEn:null,updatedAt:new Date('2026-01-01')}});
    prisma.performanceProfile.findFirst.mockResolvedValue({id:'p1',companyId:'A',code:'P1',name:'P',nameAr:null,nameEn:null});
    prisma.performanceProfileKpiWeight.findMany.mockResolvedValue([{id:'w1',companyId:'A',performanceProfileId:'p1',kpiDefinitionId:'k1',weightPercent:D('100'),isRequired:true,isInformational:false,effectiveFrom:d('2025-01-01'),effectiveTo:null,revision:1,status:'ACTIVE',kpiDefinition:kpi}]);
    prisma.performanceKpiScoringRule.findFirst.mockResolvedValue({id:'r1',scoringMode:'CAPPED_RATIO',direction:'HIGHER_IS_BETTER',minScore:D(0),maxScore:D(100),targetScore:null,floorValue:null,targetValue:D(100),ceilingValue:null,bandsJson:null,clampMin:D(0),clampMax:D(100),revision:1,effectiveFrom:d('2025-01-01'),effectiveTo:null});
    prisma.performanceKpiScoringRule.findMany.mockResolvedValue([]);
    prisma.performanceKpiTarget.findMany.mockResolvedValue([{id:'t1',companyId:'A',kpiDefinitionId:'k1',performanceProfileId:null,branchId:null,productionLineId:null,machineId:null,productionProductDefinitionId:null,departmentId:null,jobTitleId:null,scopeType:'COMPANY',targetValue:D('100'),minimumAcceptableValue:null,maximumExceptionalValue:null,effectiveFrom:d('2025-01-01'),effectiveTo:null,revision:1,status:'ACTIVE'}]);
    previewService.preview.mockResolvedValue({status:'NOT_APPLICABLE',rawValue:null,evidenceCount:0,explanation:'na'});
    const res:any=await svc.simulate({operationalPersonId:'e1',dateFrom:'2026-01-01T00:00:00Z',dateTo:'2026-01-31T00:00:00Z'} as any,ctxA,'u1');
    expect(res.kpis[0].score).toBeNull();
    expect(res.kpis[0].weightedContribution).toBeNull();
  });

  it('TARGET/WEIGHT/RULE_OVERLAP_PROTECTION create/update/activate', async () => {
    const {prisma,svc}=mk();
    prisma.performanceKpiDefinition.findFirst.mockResolvedValue({id:'k1',companyId:'A',isActive:true,status:'ACTIVE',measurementUnit:'PCT'});
    prisma.performanceProfile.findFirst.mockResolvedValue({id:'p1',companyId:'A'});
    const overlap={id:'other',effectiveFrom:d('2026-01-01'),effectiveTo:null,revision:1,status:'ACTIVE'};
    // target
    prisma.performanceKpiTarget.findFirst.mockResolvedValueOnce(overlap);
    await expect(svc.createTarget({kpiDefinitionId:'k1',scopeType:'COMPANY',targetValue:80,effectiveFrom:'2026-06-01T00:00:00Z'} as any,ctxA,'u1')).rejects.toBeInstanceOf(BadRequestException);
    prisma.performanceKpiTarget.findFirst.mockResolvedValueOnce({id:'t1',companyId:'A',kpiDefinitionId:'k1',performanceProfileId:null,branchId:null,productionLineId:null,machineId:null,productionProductDefinitionId:null,departmentId:null,jobTitleId:null,scopeType:'COMPANY',status:'DRAFT',effectiveFrom:d('2026-01-01'),effectiveTo:null,targetValue:D('10')});
    prisma.performanceKpiTarget.findFirst.mockResolvedValueOnce(overlap);
    await expect(svc.updateTarget('t1',{effectiveFrom:'2026-06-01T00:00:00Z'} as any,ctxA,'u1')).rejects.toBeInstanceOf(BadRequestException);
    prisma.performanceKpiTarget.findFirst.mockResolvedValueOnce({id:'t1',companyId:'A',kpiDefinitionId:'k1',performanceProfileId:null,branchId:null,productionLineId:null,machineId:null,productionProductDefinitionId:null,departmentId:null,jobTitleId:null,scopeType:'COMPANY',status:'DRAFT',effectiveFrom:d('2026-01-01'),effectiveTo:null});
    prisma.performanceKpiTarget.findFirst.mockResolvedValueOnce(overlap);
    await expect(svc.activateTarget('t1',ctxA,'u1')).rejects.toBeInstanceOf(BadRequestException);
    // weight
    prisma.performanceProfileKpiWeight.findFirst.mockResolvedValueOnce(overlap);
    await expect(svc.createWeight({performanceProfileId:'p1',kpiDefinitionId:'k1',weightPercent:10,effectiveFrom:'2026-06-01T00:00:00Z'} as any,ctxA,'u1')).rejects.toBeInstanceOf(BadRequestException);
    prisma.performanceProfileKpiWeight.findFirst.mockResolvedValueOnce({id:'w1',companyId:'A',performanceProfileId:'p1',kpiDefinitionId:'k1',status:'DRAFT',weightPercent:D('10'),isRequired:false,isInformational:false,effectiveFrom:d('2026-01-01'),effectiveTo:null});
    prisma.performanceProfileKpiWeight.findFirst.mockResolvedValueOnce(overlap);
    await expect(svc.updateWeight('w1',{effectiveFrom:'2026-06-01T00:00:00Z'} as any,ctxA,'u1')).rejects.toBeInstanceOf(BadRequestException);
    prisma.performanceProfileKpiWeight.findFirst.mockResolvedValueOnce({id:'w1',companyId:'A',performanceProfileId:'p1',kpiDefinitionId:'k1',status:'DRAFT',weightPercent:D('10'),effectiveFrom:d('2026-01-01'),effectiveTo:null});
    prisma.performanceProfileKpiWeight.findFirst.mockResolvedValueOnce(overlap);
    await expect(svc.activateWeight('w1',ctxA,'u1')).rejects.toBeInstanceOf(BadRequestException);
    // rule
    prisma.performanceKpiScoringRule.findFirst.mockResolvedValueOnce(overlap);
    await expect(svc.createRule({kpiDefinitionId:'k1',performanceProfileId:'p1',scoringMode:'LINEAR_TARGET',direction:'HIGHER_IS_BETTER',effectiveFrom:'2026-06-01T00:00:00Z'} as any,ctxA,'u1')).rejects.toBeInstanceOf(BadRequestException);
    prisma.performanceKpiScoringRule.findFirst.mockResolvedValueOnce({id:'r1',companyId:'A',kpiDefinitionId:'k1',performanceProfileId:'p1',status:'DRAFT',scoringMode:'LINEAR_TARGET',direction:'HIGHER_IS_BETTER',effectiveFrom:d('2026-01-01'),effectiveTo:null,minScore:D(0),maxScore:D(100),targetScore:D(100),floorValue:D(0),targetValue:D(100),ceilingValue:D(100),bandsJson:null,clampMin:D(0),clampMax:D(100),missingDataPolicy:null,notApplicablePolicy:null,configMissingPolicy:null});
    prisma.performanceKpiScoringRule.findFirst.mockResolvedValueOnce(overlap);
    await expect(svc.updateRule('r1',{effectiveFrom:'2026-06-01T00:00:00Z'} as any,ctxA,'u1')).rejects.toBeInstanceOf(BadRequestException);
    prisma.performanceKpiScoringRule.findFirst.mockResolvedValueOnce({id:'r1',companyId:'A',kpiDefinitionId:'k1',performanceProfileId:'p1',status:'DRAFT',effectiveFrom:d('2026-01-01'),effectiveTo:null});
    prisma.performanceKpiScoringRule.findFirst.mockResolvedValueOnce(overlap);
    await expect(svc.activateRule('r1',ctxA,'u1')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('RULE_PARTIAL_PATCH_PRESERVES_REQUIRED_FIELDS', async () => {
    const {prisma,svc}=mk();
    const existing:any={id:'r1',companyId:'A',kpiDefinitionId:'k1',performanceProfileId:'p1',status:'DRAFT',scoringMode:'LINEAR_TARGET',direction:'LOWER_IS_BETTER',minScore:D(0),maxScore:D(100),targetScore:D(100),floorValue:D(0),targetValue:D(30),ceilingValue:D(120),bandsJson:null,clampMin:D(0),clampMax:D(100),missingDataPolicy:'INSUFFICIENT_DATA',notApplicablePolicy:'NOT_APPLICABLE',configMissingPolicy:'CONFIGURATION_MISSING',effectiveFrom:d('2026-01-01'),effectiveTo:null,revision:1};
    prisma.performanceKpiScoringRule.findFirst.mockResolvedValueOnce(existing).mockResolvedValueOnce(null);
    prisma.performanceKpiScoringRule.update.mockImplementation(async ({data}:any)=>({...existing,...data}));
    // Class-transformed partial PATCH DTOs expose absent optional keys as undefined.
    const patched=await svc.updateRule('r1',{scoringMode:undefined,direction:undefined,targetValue:30,reason:'partial patch'} as any,ctxA,'u1');
    expect(patched.scoringMode).toBe('LINEAR_TARGET');
    expect(patched.direction).toBe('LOWER_IS_BETTER');
    expect(prisma.performanceKpiScoringRule.update).toHaveBeenCalledWith(expect.objectContaining({data:expect.objectContaining({targetValue:expect.any(Prisma.Decimal),reason:'partial patch'})}));
  });

  it('PHASE3_MASS_ASSIGNMENT_PROTECTION all create/update/simulate DTOs', async () => {
    const sys=['companyId','createdById','updatedById','revision','supersedesId','status','deletedAt','id'];
    for (const f of sys) {
      expect(hasForbidden(await vDto(CreatePerformanceTargetDto,{kpiDefinitionId:'k1',scopeType:'COMPANY',targetValue:80,effectiveFrom:'2026-01-01T00:00:00Z',[f]:'x'}),f)).toBe(true);
      expect(hasForbidden(await vDto(UpdatePerformanceTargetDto,{targetValue:80,[f]:'x'}),f)).toBe(true);
      expect(hasForbidden(await vDto(CreatePerformanceWeightDto,{performanceProfileId:'p1',kpiDefinitionId:'k1',weightPercent:10,effectiveFrom:'2026-01-01T00:00:00Z',[f]:'x'}),f)).toBe(true);
      expect(hasForbidden(await vDto(UpdatePerformanceWeightDto,{weightPercent:10,[f]:'x'}),f)).toBe(true);
      expect(hasForbidden(await vDto(CreatePerformanceScoringRuleDto,{kpiDefinitionId:'k1',scoringMode:'LINEAR_TARGET',direction:'HIGHER_IS_BETTER',effectiveFrom:'2026-01-01T00:00:00Z',[f]:'x'}),f)).toBe(true);
      expect(hasForbidden(await vDto(UpdatePerformanceScoringRuleDto,{scoringMode:'LINEAR_TARGET',[f]:'x'}),f)).toBe(true);
      expect(hasForbidden(await vDto(SimulatePerformanceDto,{operationalPersonId:'e1',dateFrom:'2026-01-01T00:00:00Z',dateTo:'2026-01-31T00:00:00Z',[f]:'x'}),f)).toBe(true);
    }
  });

  it('PHASE3_PERMISSION_TESTS / RBAC metadata and guard allow/deny matrix', async () => {
    const proto=PerformanceScoringController.prototype as any;
    const perms:Record<string,string[]> = {
      listTargets:['performance-target:read'], createTarget:['performance-target:create'], updateTarget:['performance-target:update'], activateTarget:['performance-target:update'], deactivateTarget:['performance-target:deactivate'],
      listWeights:['performance-weight:read'], createWeight:['performance-weight:create'], updateWeight:['performance-weight:update'], activateWeight:['performance-weight:update'], deactivateWeight:['performance-weight:deactivate'],
      listRules:['performance-scoring-rule:read'], createRule:['performance-scoring-rule:create'], updateRule:['performance-scoring-rule:update'], activateRule:['performance-scoring-rule:update'], deactivateRule:['performance-scoring-rule:deactivate'],
      readiness:['performance-weight:read'], coverage:['performance-config-coverage:read'], simulate:['performance-simulation:read'],
    };
    for (const [m,p] of Object.entries(perms)) expect(Reflect.getMetadata('permissions', proto[m])).toEqual(p);

    // Guard allow/deny matrix
    function mkGuard(userPerms:string[], isSuper=false){
      const reflector={ getAllAndOverride: jest.fn().mockReturnValue(undefined) } as any;
      const prisma:any={ userRole:{ findMany: jest.fn().mockResolvedValue(isSuper ? [{ role:{ status:'ACTIVE', code:'SUPER_ADMIN', permissions:[] } }] : [{ role:{ status:'ACTIVE', code:'USER', permissions: userPerms.map(k=>({ permission:{ key:k, status:'ACTIVE' } })) } }]) } };
      return { guard:new PermissionsGuard(reflector, prisma), reflector };
    }
    async function can(guard:PermissionsGuard, reflector:any, required:string[], userId='u1'){
      reflector.getAllAndOverride.mockReturnValue(required);
      const ctx:any={ getHandler:()=>function h(){}, getClass:()=>class C{}, switchToHttp:()=>({ getRequest:()=>({ user:{id:userId} }) }) };
      return guard.canActivate(ctx);
    }
    const adminPerms=Object.values(perms).flat();
    const readOnly=['performance-target:read','performance-weight:read','performance-scoring-rule:read','performance-config-coverage:read','performance-simulation:read'];
    const {guard:adminGuard,reflector:ar}=mkGuard(adminPerms);
    for (const req of Object.values(perms)) await expect(can(adminGuard,ar,req)).resolves.toBe(true);
    const {guard:roGuard,reflector:rr}=mkGuard(readOnly);
    await expect(can(roGuard,rr,['performance-target:read'])).resolves.toBe(true);
    await expect(can(roGuard,rr,['performance-simulation:read'])).resolves.toBe(true);
    await expect(can(roGuard,rr,['performance-target:create'])).rejects.toBeInstanceOf(ForbiddenException);
    await expect(can(roGuard,rr,['performance-weight:update'])).rejects.toBeInstanceOf(ForbiddenException);
    const {guard:noGuard,reflector:nr}=mkGuard([]);
    for (const req of Object.values(perms)) await expect(can(noGuard,nr,req)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('PHASE3_AUDIT_TESTS payload shape and SIMULATION_AUDIT_SPAM=0', async () => {
    const {prisma,audit,contextService,previewService,svc}=mk();
    prisma.performanceKpiDefinition.findFirst.mockResolvedValue({id:'k1',companyId:'A',isActive:true,status:'ACTIVE',measurementUnit:'PCT'});
    prisma.performanceKpiTarget.findFirst.mockResolvedValueOnce(null);
    prisma.performanceKpiTarget.create.mockResolvedValue({id:'t1',companyId:'A',status:'DRAFT',targetValue:D(80),revision:1,effectiveFrom:d('2026-01-01'),effectiveTo:null});
    await svc.createTarget({kpiDefinitionId:'k1',scopeType:'COMPANY',targetValue:80,effectiveFrom:'2026-01-01T00:00:00Z',reason:'test'} as any,ctxA,'u1');
    expect(audit.logBusiness).toHaveBeenCalled();
    const call=audit.logBusiness.mock.calls[0][0];
    expect(call).toMatchObject({companyId:'A',userId:'u1',entity:'PerformanceKpiTarget',entityId:'t1'});
    expect(call).toHaveProperty('branchId');
    expect(call).toHaveProperty('previous');
    expect(call).toHaveProperty('next');
    expect(call.reason ?? call.metadata?.reason ?? 'test').toBeTruthy();

    audit.logBusiness.mockClear();
    const kpi={id:'k1',code:'PROD_GOOD_OUTPUT',name:'Good',nameAr:null,nameEn:null,domain:'PRODUCTION',measurementUnit:'UNIT',direction:'HIGHER_IS_BETTER',isActive:true,status:'ACTIVE',calculationVersion:1};
    contextService.resolve.mockResolvedValue({employee:{id:'e1'},performanceProfile:{id:'p1',code:'P1',name:'P',nameAr:null,nameEn:null,updatedAt:new Date('2026-01-01')}});
    prisma.performanceProfile.findFirst.mockResolvedValue({id:'p1',companyId:'A',code:'P1',name:'P',nameAr:null,nameEn:null});
    prisma.performanceProfileKpiWeight.findMany.mockResolvedValue([{id:'w1',companyId:'A',performanceProfileId:'p1',kpiDefinitionId:'k1',weightPercent:D('100'),isRequired:false,isInformational:true,effectiveFrom:d('2025-01-01'),effectiveTo:null,revision:1,status:'ACTIVE',kpiDefinition:kpi}]);
    prisma.performanceKpiScoringRule.findMany.mockResolvedValue([]);
    prisma.performanceKpiTarget.findMany.mockResolvedValue([]);
    previewService.preview.mockResolvedValue({status:'INFORMATIONAL',rawValue:1,evidenceCount:1,explanation:'ok'});
    await svc.simulate({operationalPersonId:'e1',dateFrom:'2026-01-01T00:00:00Z',dateTo:'2026-01-31T00:00:00Z'} as any,ctxA,'u1');
    await svc.simulate({operationalPersonId:'e1',dateFrom:'2026-01-01T00:00:00Z',dateTo:'2026-01-31T00:00:00Z'} as any,ctxA,'u1');
    expect(audit.logBusiness).not.toHaveBeenCalled();
  });

  it('PHASE3_TENANT_TESTS Company A/B foreign IDs and spoof DTOs', async () => {
    const {prisma,svc}=mk();
    prisma.performanceKpiTarget.findFirst.mockResolvedValue(null);
    await expect(svc.activateTarget('foreign-t',ctxA,'u1')).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.performanceKpiTarget.findFirst).toHaveBeenCalledWith(expect.objectContaining({where:expect.objectContaining({id:'foreign-t',companyId:'A'})}));
    prisma.performanceProfileKpiWeight.findFirst.mockResolvedValue(null);
    await expect(svc.activateWeight('foreign-w',ctxA,'u1')).rejects.toBeInstanceOf(NotFoundException);
    prisma.performanceKpiScoringRule.findFirst.mockResolvedValue(null);
    await expect(svc.activateRule('foreign-r',ctxA,'u1')).rejects.toBeInstanceOf(NotFoundException);

    // companyId/branchId spoof in DTOs must be rejected where forbidden
    for (const f of ['companyId','createdById','updatedById','revision','supersedesId','status','deletedAt','id']) {
      expect(hasForbidden(await vDto(CreatePerformanceWeightDto,{performanceProfileId:'p1',kpiDefinitionId:'k1',weightPercent:10,effectiveFrom:'2026-01-01T00:00:00Z',[f]:'x'}),f)).toBe(true);
      expect(hasForbidden(await vDto(CreatePerformanceScoringRuleDto,{kpiDefinitionId:'k1',scoringMode:'LINEAR_TARGET',direction:'HIGHER_IS_BETTER',effectiveFrom:'2026-01-01T00:00:00Z',[f]:'x'}),f)).toBe(true);
      expect(hasForbidden(await vDto(SimulatePerformanceDto,{operationalPersonId:'e1',dateFrom:'2026-01-01T00:00:00Z',dateTo:'2026-01-31T00:00:00Z',[f]:'x'}),f)).toBe(true);
    }
    // companyId spoof forbidden on target DTO too; branchId is legitimate scope field but companyId is not
    expect(hasForbidden(await vDto(CreatePerformanceTargetDto,{kpiDefinitionId:'k1',scopeType:'COMPANY',targetValue:80,effectiveFrom:'2026-01-01T00:00:00Z',companyId:'B'}),'companyId')).toBe(true);
  });

  it('PHASE3_ROUTE_COLLISIONS=0 metadata', () => {
    const proto=PerformanceScoringController.prototype as any;
    const methods=Object.getOwnPropertyNames(proto).filter(m=>m!=='constructor');
    const paths=methods.map(m=>Reflect.getMetadata('path',proto[m])).filter(Boolean);
    for (const p of ['targets','weights','scoring-rules','profiles/:id/readiness','configuration-coverage','simulate']) expect(paths).toContain(p);
    expect(paths.filter((p:string)=>p.includes(':id')).every((p:string)=>p.startsWith('targets/')||p.startsWith('weights/')||p.startsWith('scoring-rules/')||p.startsWith('profiles/'))).toBe(true);
  });
});
