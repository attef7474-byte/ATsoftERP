import { NotFoundException } from '@nestjs/common';
import { JobTitlesService } from './job-titles.service';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { AuditService } from '../../../common/audit/audit.service';
import { ActiveOperationalContext } from '../../../common/operational-context/operational-context.types';

describe('JobTitles Tenant Isolation', () => {
  let prisma: any;
  let auditService: any;
  let service: JobTitlesService;

  const ctxA: ActiveOperationalContext = {
    contextKey: 'company-a:branch-a',
    scopeId: 'branch-a',
    companyId: 'company-a',
    branchId: 'branch-a',
    isDefault: true,
    source: 'EXPLICIT_SCOPE',
  } as ActiveOperationalContext;

  const ctxB: ActiveOperationalContext = {
    contextKey: 'company-b:branch-b',
    scopeId: 'branch-b',
    companyId: 'company-b',
    branchId: 'branch-b',
    isDefault: true,
    source: 'EXPLICIT_SCOPE',
  } as ActiveOperationalContext;

  beforeEach(() => {
    prisma = {
      company: { findFirst: jest.fn().mockResolvedValue({ id: 'company-a' }) },
      jobTitle: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      operationalPersonAssignment: {
        count: jest.fn(),
      },
    };
    auditService = { log: jest.fn() };
    service = new JobTitlesService(prisma as PrismaService, auditService as AuditService);
  });

  describe('findOne tenant isolation', () => {
    it('Company A cannot read Company B JobTitle by ID', async () => {
      prisma.jobTitle.findFirst.mockResolvedValue(null);

      await expect(service.findOne('jobtitle-b', ctxA)).rejects.toThrow(NotFoundException);
      expect(prisma.jobTitle.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'jobtitle-b', companyId: 'company-a', deletedAt: null },
        }),
      );
    });

    it('findOne uses companyId from ctx, not user input', async () => {
      prisma.jobTitle.findFirst.mockResolvedValue({
        id: 'jt1', companyId: 'company-a', code: 'DEV', name: 'Developer',
      });

      const result = await service.findOne('jt1', ctxA);
      expect(result.companyId).toBe('company-a');
    });
  });

  describe('update tenant isolation', () => {
    it('Company A cannot update Company B JobTitle', async () => {
      prisma.jobTitle.findFirst.mockResolvedValue(null);

      await expect(service.update('jobtitle-b', { name: 'Hacked' }, ctxA)).rejects.toThrow(NotFoundException);
    });

    it('Company A cannot change the companyId of a JobTitle via update', async () => {
      const existing = {
        id: 'jt1', companyId: 'company-a', code: 'JT-1', name: 'Technician',
        nameAr: null, nameEn: null, category: 'OPERATIONAL', description: null, isActive: true,
      };
      prisma.jobTitle.findFirst.mockResolvedValue(existing);
      prisma.jobTitle.update.mockResolvedValue({ ...existing, name: 'Updated' });

      await service.update('jt1', { name: 'Updated' }, ctxA, 'user-1');

      const createCall = prisma.jobTitle.update.mock.calls[0][0];
      expect(createCall.data).not.toHaveProperty('companyId');
    });
  });

  describe('remove tenant isolation', () => {
    it('Company A cannot delete Company B JobTitle', async () => {
      prisma.jobTitle.findFirst.mockResolvedValue(null);

      await expect(service.remove('jobtitle-b', ctxA)).rejects.toThrow(NotFoundException);
    });

    it('delete scope is validated through findOne which enforces companyId', async () => {
      prisma.jobTitle.findFirst.mockResolvedValue(null);

      const promise = service.remove('jobtitle-b', ctxA);
      await expect(promise).rejects.toThrow(NotFoundException);
      expect(prisma.jobTitle.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ companyId: 'company-a' }),
        }),
      );
    });
  });

  describe('findAll tenant isolation', () => {
    it('List only returns Company A JobTitles', async () => {
      prisma.jobTitle.findMany.mockResolvedValue([
        { id: 'jt1', companyId: 'company-a', code: 'DEV', name: 'Developer' },
      ]);
      prisma.jobTitle.count.mockResolvedValue(1);

      const result = await service.findAll({ page: 1, limit: 10 }, ctxA);

      expect(prisma.jobTitle.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ companyId: 'company-a' }),
        }),
      );
      expect(result.data).toHaveLength(1);
      expect(result.data[0].companyId).toBe('company-a');
    });

    it('findAll never includes Company B records', async () => {
      prisma.jobTitle.findMany.mockResolvedValue([]);
      prisma.jobTitle.count.mockResolvedValue(0);

      await service.findAll({ page: 1, limit: 10 }, ctxA);

      const findManyCall = prisma.jobTitle.findMany.mock.calls[0][0];
      expect(findManyCall.where.companyId).toBe('company-a');
      expect(findManyCall.where.companyId).not.toBe('company-b');
    });

    it('findAll search filter is scoped to company', async () => {
      prisma.jobTitle.findMany.mockResolvedValue([]);
      prisma.jobTitle.count.mockResolvedValue(0);

      await service.findAll({ search: 'tech' }, ctxA);

      expect(prisma.jobTitle.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            companyId: 'company-a',
            OR: expect.arrayContaining([
              { name: { contains: 'tech' } },
            ]),
          }),
        }),
      );
    });
  });

  describe('create tenant isolation', () => {
    it('Company A creates JobTitle with Company A companyId', async () => {
      prisma.jobTitle.findFirst.mockResolvedValue(null);
      prisma.jobTitle.create.mockResolvedValue({
        id: 'new-jt', companyId: 'company-a', code: 'NEW', name: 'New Title',
      });

      await service.create({ code: 'NEW', name: 'New Title' }, ctxA, 'user-1');

      expect(prisma.jobTitle.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ companyId: 'company-a' }),
        }),
      );
    });

    it('duplicate code check is scoped to the correct company', async () => {
      prisma.jobTitle.findFirst.mockResolvedValue(null);
      prisma.jobTitle.create.mockResolvedValue({
        id: 'new-jt', companyId: 'company-a', code: 'JT-1', name: 'Title',
      });

      await service.create({ code: 'JT-1', name: 'Title' }, ctxA);

      expect(prisma.jobTitle.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ companyId: 'company-a' }),
        }),
      );
    });
  });
});
