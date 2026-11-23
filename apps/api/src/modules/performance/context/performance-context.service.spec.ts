import { NotFoundException } from '@nestjs/common';
import { PerformanceContextService } from './performance-context.service';

const ctxA: any = { companyId: 'c1', branchId: 'b1', userId: 'u1' };

describe('PerformanceContextService', () => {
  let prisma: any;
  let service: PerformanceContextService;

  beforeEach(() => {
    prisma = {
      operationalPerson: { findFirst: jest.fn() },
      operationalPersonAssignment: { findMany: jest.fn() },
      maintenancePersonnel: { findFirst: jest.fn() },
      machineResponsibilityAssignment: { findMany: jest.fn() },
      productionShiftAssignment: { findFirst: jest.fn() },
      performanceProfileMapping: { findFirst: jest.fn() },
    };
    service = new PerformanceContextService(prisma);
  });

  const person = { id: 'op1', code: 'EMP001', name: 'Ahmed', category: 'MAINTENANCE', isActive: true };
  const assignment = {
    id: 'a1', assignmentType: 'PRIMARY', leadershipLevel: 'NONE', effectiveFrom: new Date('2026-01-01'), effectiveTo: null,
    jobTitleId: 'jt1', personnelId: 'op1',
    department: { id: 'd1', code: 'DEP1', name: 'Maintenance' },
    jobTitle: { id: 'jt1', code: 'JT1', name: 'Maintenance Engineer', nameAr: 'مهندس صيانة', nameEn: 'Maintenance Engineer' },
    branch: { id: 'b1', code: 'HQ', name: 'HQ' },
    company: { id: 'c1', code: 'C1', name: 'Company 1' },
    supervisorAssignments: [],
  };

  it('returns 404 when person has no current assignment in active context (tenant isolation)', async () => {
    prisma.operationalPerson.findFirst.mockResolvedValue(person);
    prisma.operationalPersonAssignment.findMany.mockResolvedValue([]); // no assignment in ctx
    await expect(service.resolve('op1', ctxA, '2026-06-01T00:00:00.000Z')).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.operationalPersonAssignment.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ personnelId: 'op1', companyId: 'c1', branchId: 'b1', deletedAt: null, status: 'ACTIVE' }),
    }));
  });

  it('resolves profile by JOB_TITLE first, then maintenance role, then operational category', async () => {
    prisma.operationalPerson.findFirst.mockResolvedValue(person);
    prisma.operationalPersonAssignment.findMany.mockResolvedValue([assignment]);
    prisma.maintenancePersonnel.findFirst.mockResolvedValue({ id: 'mp1', role: 'TECHNICIAN', specialty: 'MECH', isActive: true });
    prisma.machineResponsibilityAssignment.findMany.mockResolvedValue([]);
    prisma.productionShiftAssignment.findFirst.mockResolvedValue(null);
    const jobMapping = { id: 'm-job', targetType: 'JOB_TITLE', effectiveFrom: new Date('2026-01-01'), effectiveTo: null, priority: 100, performanceProfile: { id: 'pp1', code: 'ME_ENG', name: 'Maintenance Engineer', nameAr: null, nameEn: null, category: 'MAINTENANCE', isActive: true } };
    prisma.performanceProfileMapping.findFirst.mockResolvedValueOnce(jobMapping); // JOB_TITLE hit
    const result = await service.resolve('op1', ctxA, '2026-06-01T00:00:00.000Z');
    expect(result.performanceProfile?.code).toBe('ME_ENG');
    expect(result.performanceProfile?.source.targetType).toBe('JOB_TITLE');
    expect(prisma.performanceProfileMapping.findFirst).toHaveBeenCalledTimes(1);
  });

  it('falls back to MAINTENANCE_ROLE when no job-title mapping exists', async () => {
    prisma.operationalPerson.findFirst.mockResolvedValue(person);
    prisma.operationalPersonAssignment.findMany.mockResolvedValue([{ ...assignment, jobTitleId: null, jobTitle: null }]);
    prisma.maintenancePersonnel.findFirst.mockResolvedValue({ id: 'mp1', role: 'TECHNICIAN', specialty: 'MECH', isActive: true });
    prisma.machineResponsibilityAssignment.findMany.mockResolvedValue([]);
    prisma.productionShiftAssignment.findFirst.mockResolvedValue(null);
    // jobTitleId is null so JOB_TITLE lookup is skipped; MAINTENANCE_ROLE is queried first
    prisma.performanceProfileMapping.findFirst.mockResolvedValueOnce({
      id: 'm-role', targetType: 'MAINTENANCE_ROLE', effectiveFrom: new Date('2026-01-01'), effectiveTo: null, priority: 100,
      performanceProfile: { id: 'pp2', code: 'ME_TECH', name: 'Tech', nameAr: null, nameEn: null, category: 'MAINTENANCE', isActive: true },
    });
    const result = await service.resolve('op1', ctxA, '2026-06-01T00:00:00.000Z');
    expect(result.performanceProfile?.code).toBe('ME_TECH');
    expect(result.performanceProfile?.source.targetType).toBe('MAINTENANCE_ROLE');
  });

  it('returns unassigned profile when no mapping matches', async () => {
    prisma.operationalPerson.findFirst.mockResolvedValue(person);
    prisma.operationalPersonAssignment.findMany.mockResolvedValue([assignment]);
    prisma.maintenancePersonnel.findFirst.mockResolvedValue(null);
    prisma.machineResponsibilityAssignment.findMany.mockResolvedValue([]);
    prisma.productionShiftAssignment.findFirst.mockResolvedValue(null);
    prisma.performanceProfileMapping.findFirst.mockResolvedValue(null);
    const result = await service.resolve('op1', ctxA, '2026-06-01T00:00:00.000Z');
    expect(result.performanceProfile).toBeNull();
    expect(result.organization.jobTitle?.code).toBe('JT1');
  });

  it('does not resolve an inactive profile for current effectiveAt', async () => {
    prisma.operationalPerson.findFirst.mockResolvedValue(person);
    prisma.operationalPersonAssignment.findMany.mockResolvedValue([assignment]);
    prisma.maintenancePersonnel.findFirst.mockResolvedValue(null);
    prisma.machineResponsibilityAssignment.findMany.mockResolvedValue([]);
    prisma.productionShiftAssignment.findFirst.mockResolvedValue(null);
    prisma.performanceProfileMapping.findFirst.mockResolvedValue({
      id: 'm1', targetType: 'JOB_TITLE', effectiveFrom: new Date('2020-01-01'), effectiveTo: null, priority: 100,
      performanceProfile: { id: 'pp1', code: 'OLD', name: 'Old', nameAr: null, nameEn: null, category: 'GENERAL', isActive: false },
    });
    const result = await service.resolve('op1', ctxA); // now/current
    expect(result.performanceProfile).toBeNull();
  });

  it('resolves historical performance profile change over time (Jan-Jun operator, Jul onward supervisor) with boundary', async () => {
    const janJun = {
      id: 'm-op', targetType: 'JOB_TITLE', effectiveFrom: new Date('2026-01-01T00:00:00.000Z'), effectiveTo: new Date('2026-07-01T00:00:00.000Z'), priority: 100,
      performanceProfile: { id: 'pp-op', code: 'PRODUCTION_OPERATOR', name: 'Production Operator', nameAr: null, nameEn: null, category: 'PRODUCTION', isActive: true },
    };
    const julOnward = {
      id: 'm-sup', targetType: 'JOB_TITLE', effectiveFrom: new Date('2026-07-01T00:00:00.000Z'), effectiveTo: null, priority: 100,
      performanceProfile: { id: 'pp-sup', code: 'LINE_SUPERVISOR', name: 'Line Supervisor', nameAr: null, nameEn: null, category: 'SUPERVISION', isActive: true },
    };
    // Resolve by effectiveAt against the repo convention: effectiveFrom <= effectiveAt AND (effectiveTo null OR effectiveTo > effectiveAt)
    prisma.performanceProfileMapping.findFirst.mockImplementation(async (args: any) => {
      const at: Date = args?.where?.effectiveFrom?.lte;
      if (!(at instanceof Date)) return null;
      const inWindow = (m: any) => m.effectiveFrom <= at && (m.effectiveTo == null || m.effectiveTo > at);
      if (inWindow(julOnward)) return julOnward;
      if (inWindow(janJun)) return janJun;
      return null;
    });

    const resolveAt = async (at: string) => {
      prisma.operationalPerson.findFirst.mockResolvedValueOnce({ ...person, category: 'PRODUCTION' });
      prisma.operationalPersonAssignment.findMany.mockResolvedValueOnce([assignment]);
      prisma.maintenancePersonnel.findFirst.mockResolvedValueOnce(null);
      prisma.machineResponsibilityAssignment.findMany.mockResolvedValueOnce([]);
      prisma.productionShiftAssignment.findFirst.mockResolvedValueOnce(null);
      return service.resolve('op1', ctxA, at);
    };

    const may = await resolveAt('2026-05-01T00:00:00.000Z');
    expect(may.performanceProfile?.code).toBe('PRODUCTION_OPERATOR');

    const aug = await resolveAt('2026-08-01T00:00:00.000Z');
    expect(aug.performanceProfile?.code).toBe('LINE_SUPERVISOR');

    // Boundary per convention: effectiveTo is exclusive, effectiveFrom is inclusive.
    const boundary = await resolveAt('2026-07-01T00:00:00.000Z');
    expect(boundary.performanceProfile?.code).toBe('LINE_SUPERVISOR');

    const beforeBoundary = await resolveAt('2026-06-30T23:59:59.999Z');
    expect(beforeBoundary.performanceProfile?.code).toBe('PRODUCTION_OPERATOR');
  });
});
