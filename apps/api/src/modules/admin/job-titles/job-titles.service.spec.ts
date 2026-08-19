import { BadRequestException, NotFoundException } from '@nestjs/common';
import { JobTitlesService } from './job-titles.service';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { AuditService } from '../../../common/audit/audit.service';
import { ActiveOperationalContext } from '../../../common/operational-context/operational-context.types';

describe('JobTitlesService', () => {
  let prisma: any;
  let auditService: any;
  let service: JobTitlesService;
  const ctx: ActiveOperationalContext = {
    contextKey: 'company-a:branch-a',
    scopeId: 'branch-a',
    companyId: 'company-a',
    branchId: 'branch-a',
    isDefault: true,
    source: 'EXPLICIT_SCOPE',
  } as ActiveOperationalContext;

  const jobTitle = (overrides: Record<string, any> = {}) => ({
    id: 'jt1',
    companyId: 'company-a',
    code: 'JT-1',
    name: 'Technician',
    nameAr: null,
    nameEn: null,
    category: 'OPERATIONAL',
    description: null,
    isActive: true,
    ...overrides,
  });

  beforeEach(() => {
    prisma = {
      jobTitle: {
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
      },
      operationalPersonAssignment: {
        count: jest.fn(),
      },
    };
    auditService = { log: jest.fn() };
    service = new JobTitlesService(prisma as PrismaService, auditService as AuditService);
  });

  describe('create', () => {
    it('rejects a duplicate code within the same company', async () => {
      prisma.jobTitle.findFirst.mockResolvedValue({ id: 'existing' });

      const promise = service.create({ code: 'JT-1', name: 'Technician' }, ctx);
      await expect(promise).rejects.toThrow(BadRequestException);
      const response = (await promise.catch((e: any) => e)).getResponse();
      expect(response.errors[0]).toMatchObject({ field: 'code', code: 'validation.duplicateValue' });
      expect(prisma.jobTitle.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { companyId: 'company-a', code: 'JT-1', deletedAt: null } }),
      );
    });

    it('creates a job title with audit log', async () => {
      prisma.jobTitle.findFirst.mockResolvedValue(null);
      prisma.jobTitle.create.mockResolvedValue(jobTitle({ code: 'JT-1' }));

      const result = await service.create({ code: 'JT-1', name: 'Technician' }, ctx, 'user-1');

      expect(prisma.jobTitle.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ companyId: 'company-a', code: 'JT-1', name: 'Technician' }),
        }),
      );
      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'CREATE', entity: 'JobTitle', userId: 'user-1' }),
      );
      expect(result.code).toBe('JT-1');
    });

    it('trims whitespace from code and name', async () => {
      prisma.jobTitle.findFirst.mockResolvedValue(null);
      prisma.jobTitle.create.mockResolvedValue(jobTitle({ code: 'JT-2', name: 'Engineer' }));

      await service.create({ code: '  JT-2  ', name: '  Engineer  ' }, ctx);

      expect(prisma.jobTitle.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ code: 'JT-2', name: 'Engineer' }),
        }),
      );
    });

    it('defaults category to OPERATIONAL and isActive to true', async () => {
      prisma.jobTitle.findFirst.mockResolvedValue(null);
      prisma.jobTitle.create.mockResolvedValue(jobTitle());

      await service.create({ code: 'JT-1', name: 'Technician' }, ctx);

      expect(prisma.jobTitle.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ category: 'OPERATIONAL', isActive: true }),
        }),
      );
    });
  });

  describe('findAll', () => {
    it('returns paginated results with tenant filter', async () => {
      prisma.jobTitle.findMany.mockResolvedValue([jobTitle()]);
      prisma.jobTitle.count.mockResolvedValue(1);

      const result = await service.findAll({ page: 1, limit: 10 }, ctx);

      expect(prisma.jobTitle.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ companyId: 'company-a', deletedAt: null }) }),
      );
      expect(result.meta.total).toBe(1);
      expect(result.meta.totalPages).toBe(1);
      expect(result.data).toHaveLength(1);
    });

    it('applies search filter across name, code, nameAr, nameEn', async () => {
      prisma.jobTitle.findMany.mockResolvedValue([]);
      prisma.jobTitle.count.mockResolvedValue(0);

      await service.findAll({ search: 'tech' }, ctx);

      expect(prisma.jobTitle.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: [
              { name: { contains: 'tech' } },
              { code: { contains: 'tech' } },
              { nameAr: { contains: 'tech' } },
              { nameEn: { contains: 'tech' } },
            ],
          }),
        }),
      );
    });

    it('applies category filter', async () => {
      prisma.jobTitle.findMany.mockResolvedValue([]);
      prisma.jobTitle.count.mockResolvedValue(0);

      await service.findAll({ category: 'MANAGERIAL' }, ctx);

      expect(prisma.jobTitle.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ category: 'MANAGERIAL' }),
        }),
      );
    });
  });

  describe('findOne', () => {
    it('throws NotFoundException when job title is missing', async () => {
      prisma.jobTitle.findFirst.mockResolvedValue(null);

      const promise = service.findOne('nope', ctx);
      await expect(promise).rejects.toThrow(NotFoundException);
      const response = (await promise.catch((e: any) => e)).getResponse();
      expect(response).toEqual({
        messageKey: 'organization.jobTitleNotFound',
        message: 'Job title not found',
      });
    });

    it('returns a job title within the active company', async () => {
      prisma.jobTitle.findFirst.mockResolvedValue(jobTitle());

      const result = await service.findOne('jt1', ctx);
      expect(result.id).toBe('jt1');
      expect(prisma.jobTitle.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'jt1', companyId: 'company-a', deletedAt: null } }),
      );
    });
  });

  describe('update', () => {
    it('rejects a duplicate code for another job title in the same company', async () => {
      prisma.jobTitle.findFirst
        .mockResolvedValueOnce(jobTitle())
        .mockResolvedValueOnce({ id: 'jt2' });

      const promise = service.update('jt1', { code: 'JT-2' }, ctx);
      await expect(promise).rejects.toThrow(BadRequestException);
      const response = (await promise.catch((e: any) => e)).getResponse();
      expect(response.errors[0]).toMatchObject({ field: 'code', code: 'validation.duplicateValue' });
      expect(prisma.jobTitle.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ NOT: { id: 'jt1' } }) }),
      );
    });

    it('updates and returns the job title with audit', async () => {
      prisma.jobTitle.findFirst.mockResolvedValue(jobTitle());
      prisma.jobTitle.update.mockResolvedValue(jobTitle({ name: 'Senior Technician' }));

      const result = await service.update('jt1', { name: 'Senior Technician' }, ctx, 'user-1');

      expect(result.name).toBe('Senior Technician');
      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'UPDATE', entity: 'JobTitle', userId: 'user-1' }),
      );
    });

    it('allows updating code to the same value', async () => {
      prisma.jobTitle.findFirst
        .mockResolvedValueOnce(jobTitle())
        .mockResolvedValueOnce(null);
      prisma.jobTitle.update.mockResolvedValue(jobTitle());

      const result = await service.update('jt1', { code: 'JT-1' }, ctx);

      expect(result.code).toBe('JT-1');
    });
  });

  describe('remove', () => {
    it('rejects deletion when active assignments exist', async () => {
      prisma.jobTitle.findFirst.mockResolvedValue(jobTitle());
      prisma.operationalPersonAssignment.count.mockResolvedValue(2);

      const promise = service.remove('jt1', ctx);
      await expect(promise).rejects.toThrow(BadRequestException);
      const response = (await promise.catch((e: any) => e)).getResponse();
      expect(response.errors[0]).toMatchObject({ field: 'jobTitleId', code: 'validation.hasDependencies' });
    });

    it('soft-deletes a job title with no active assignments', async () => {
      prisma.jobTitle.findFirst.mockResolvedValue(jobTitle());
      prisma.operationalPersonAssignment.count.mockResolvedValue(0);
      prisma.jobTitle.update.mockResolvedValue(jobTitle());

      const result = await service.remove('jt1', ctx, 'user-1');

      expect(prisma.jobTitle.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'jt1' }, data: expect.objectContaining({ deletedAt: expect.any(Date) }) }),
      );
      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'DELETE', entity: 'JobTitle', userId: 'user-1' }),
      );
      expect(result.message).toContain('deleted');
    });
  });
});
