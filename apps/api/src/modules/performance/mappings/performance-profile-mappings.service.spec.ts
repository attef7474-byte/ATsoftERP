import { BadRequestException } from '@nestjs/common';
import { PerformanceProfileMappingsService } from './performance-profile-mappings.service';

const ctxA: any = { companyId: 'c1', branchId: 'b1', userId: 'u1' };
const ctxB: any = { companyId: 'c2', branchId: 'b1', userId: 'u2' };

describe('PerformanceProfileMappingsService', () => {
  let prisma: any;
  let audit: any;
  let service: PerformanceProfileMappingsService;

  beforeEach(() => {
    prisma = {
      performanceProfile: { findFirst: jest.fn() },
      jobTitle: { findFirst: jest.fn() },
      performanceProfileMapping: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
    };
    audit = { log: jest.fn().mockResolvedValue(undefined) };
    service = new PerformanceProfileMappingsService(prisma, audit);
  });

  it('rejects overlapping active mapping for same job title target', async () => {
    prisma.performanceProfile.findFirst.mockResolvedValue({ id: 'p1', companyId: 'c1' });
    prisma.jobTitle.findFirst.mockResolvedValue({ id: 'jt1', companyId: 'c1' });
    prisma.performanceProfileMapping.findFirst.mockResolvedValue({ id: 'existing' }); // overlap found
    await expect(service.create({
      performanceProfileId: 'p1', targetType: 'JOB_TITLE', jobTitleId: 'jt1',
      effectiveFrom: '2026-01-01T00:00:00.000Z', effectiveTo: '2026-12-31T00:00:00.000Z', isActive: true,
    } as any, ctxA, 'u1')).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.performanceProfileMapping.create).not.toHaveBeenCalled();
  });

  it('creates mapping when no overlap and scopes profile/job lookups to company', async () => {
    prisma.performanceProfile.findFirst.mockResolvedValue({ id: 'p1', companyId: 'c1' });
    prisma.jobTitle.findFirst.mockResolvedValue({ id: 'jt1', companyId: 'c1' });
    prisma.performanceProfileMapping.findFirst.mockResolvedValue(null);
    prisma.performanceProfileMapping.create.mockResolvedValue({ id: 'm1', performanceProfileId: 'p1', targetType: 'JOB_TITLE', jobTitleId: 'jt1' });
    const result = await service.create({
      performanceProfileId: 'p1', targetType: 'JOB_TITLE', jobTitleId: 'jt1',
      effectiveFrom: '2026-01-01T00:00:00.000Z', isActive: true,
    } as any, ctxA, 'u1');
    expect(result.id).toBe('m1');
    expect(prisma.performanceProfile.findFirst).toHaveBeenCalledWith({ where: { id: 'p1', companyId: 'c1', deletedAt: null } });
    expect(prisma.jobTitle.findFirst).toHaveBeenCalledWith({ where: { id: 'jt1', companyId: 'c1', deletedAt: null } });
    expect(prisma.performanceProfileMapping.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ companyId: 'c1', targetType: 'JOB_TITLE', jobTitleId: 'jt1', targetCode: null }),
    }));
  });

  it('rejects job title from another company/tenant context', async () => {
    prisma.performanceProfile.findFirst.mockResolvedValue({ id: 'p1', companyId: 'c2' });
    prisma.jobTitle.findFirst.mockResolvedValue(null); // not in company
    prisma.performanceProfileMapping.findFirst.mockResolvedValue(null);
    await expect(service.create({
      performanceProfileId: 'p1', targetType: 'JOB_TITLE', jobTitleId: 'jt-other',
      effectiveFrom: '2026-01-01T00:00:00.000Z', isActive: true,
    } as any, ctxB, 'u2')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('requires targetCode for MAINTENANCE_ROLE and normalizes it', async () => {
    prisma.performanceProfile.findFirst.mockResolvedValue({ id: 'p1', companyId: 'c1' });
    prisma.performanceProfileMapping.findFirst.mockResolvedValue(null);
    prisma.performanceProfileMapping.create.mockResolvedValue({ id: 'm2', targetType: 'MAINTENANCE_ROLE', targetCode: 'TECHNICIAN' });
    await service.create({
      performanceProfileId: 'p1', targetType: 'MAINTENANCE_ROLE', targetCode: ' technician ',
      effectiveFrom: '2026-01-01T00:00:00.000Z', isActive: true,
    } as any, ctxA, 'u1');
    expect(prisma.performanceProfileMapping.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ targetType: 'MAINTENANCE_ROLE', jobTitleId: null, targetCode: 'TECHNICIAN' }),
    }));
  });

  it('findAll scopes by companyId and deletedAt null', async () => {
    prisma.performanceProfileMapping.findMany.mockResolvedValue([]);
    prisma.performanceProfileMapping.count.mockResolvedValue(0);
    await service.findAll({ page: 1, limit: 20 }, ctxA);
    expect(prisma.performanceProfileMapping.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ companyId: 'c1', deletedAt: null }),
    }));
  });
});
