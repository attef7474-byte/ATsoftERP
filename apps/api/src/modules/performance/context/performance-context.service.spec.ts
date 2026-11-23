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
});
