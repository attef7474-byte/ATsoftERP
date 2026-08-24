import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { DepartmentsService } from './departments.service';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { NumberingService } from '../../numbering/numbering.service';
import { ActiveOperationalContext } from '../../../common/operational-context/operational-context.types';

describe('DepartmentsService', () => {
  let prisma: any;
  let numbering: any;
  let service: DepartmentsService;
  const ctx: ActiveOperationalContext = {
    contextKey: 'company-a:branch-a',
    scopeId: 'branch-a',
    companyId: 'company-a',
    branchId: 'branch-a',
    isDefault: true,
    source: 'EXPLICIT_SCOPE',
  } as ActiveOperationalContext;

  const department = (overrides: Record<string, any> = {}) => ({
    id: 'd1',
    companyId: 'company-a',
    branchId: 'branch-a',
    administrationId: 'a1',
    parentId: null,
    code: 'DEP-1',
    name: 'Quality',
    ...overrides,
  });

  beforeEach(() => {
    prisma = {
      company: { findFirst: jest.fn() },
      branch: { findFirst: jest.fn() },
      administration: { findFirst: jest.fn() },
      department: {
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
      },
    };
    numbering = { generateNumberAtomic: jest.fn().mockResolvedValue('DEP-0001') };
    service = new DepartmentsService(prisma as PrismaService, numbering as NumberingService);
  });

  describe('reference validation chain', () => {
    it('rejects a missing company on create', async () => {
      prisma.company.findFirst.mockResolvedValue(null);

      const promise = service.create({ name: 'Quality' }, ctx);
      await expect(promise).rejects.toThrow(BadRequestException);
      const response = (await promise.catch((e) => e)).getResponse();
      expect(response.errors[0]).toMatchObject({ field: 'companyId', code: 'validation.invalidReference' });
      expect(prisma.company.findFirst).toHaveBeenCalledWith(expect.objectContaining({
        where: { id: 'company-a', deletedAt: null },
      }));
    });

    it('rejects a branch outside the active company on create', async () => {
      prisma.company.findFirst.mockResolvedValue({ id: 'company-a' });
      prisma.branch.findFirst.mockResolvedValue(null);

      const promise = service.create({ name: 'Quality' }, ctx);
      await expect(promise).rejects.toThrow(BadRequestException);
      const response = (await promise.catch((e) => e)).getResponse();
      expect(response.errors[0]).toMatchObject({ field: 'branchId', code: 'validation.invalidReference' });
      expect(prisma.branch.findFirst).toHaveBeenCalledWith(expect.objectContaining({
        where: { id: 'branch-a', companyId: 'company-a', deletedAt: null },
      }));
    });

    it('rejects an administration outside the active branch on create', async () => {
      prisma.company.findFirst.mockResolvedValue({ id: 'company-a' });
      prisma.branch.findFirst.mockResolvedValue({ id: 'branch-a', companyId: 'company-a' });
      prisma.administration.findFirst.mockResolvedValue(null);

      const promise = service.create({ administrationId: 'aX', name: 'Quality' }, ctx);
      await expect(promise).rejects.toThrow(BadRequestException);
      const response = (await promise.catch((e) => e)).getResponse();
      expect(response.errors[0]).toMatchObject({ field: 'administrationId', code: 'validation.invalidReference' });
      expect(prisma.administration.findFirst).toHaveBeenCalledWith(expect.objectContaining({
        where: { id: 'aX', branchId: 'branch-a', deletedAt: null },
      }));
    });

    it('rejects a parent department outside the active context on create', async () => {
      prisma.company.findFirst.mockResolvedValue({ id: 'company-a' });
      prisma.branch.findFirst.mockResolvedValue({ id: 'branch-a', companyId: 'company-a' });
      prisma.department.findFirst.mockResolvedValue(null);

      const promise = service.create({ parentId: 'pX', name: 'Quality' }, ctx);
      await expect(promise).rejects.toThrow(BadRequestException);
      const response = (await promise.catch((e) => e)).getResponse();
      expect(response.errors[0]).toMatchObject({ field: 'parentId', code: 'validation.invalidReference' });
      expect(prisma.department.findFirst).toHaveBeenCalledWith(expect.objectContaining({
        where: { id: 'pX', companyId: 'company-a', branchId: 'branch-a', deletedAt: null },
      }));
    });
  });

  describe('create', () => {
    it('throws a ConflictException on duplicate code (P2002)', async () => {
      prisma.company.findFirst.mockResolvedValue({ id: 'company-a' });
      prisma.branch.findFirst.mockResolvedValue({ id: 'branch-a', companyId: 'company-a' });
      const p2002Error = Object.assign(new Error('Unique constraint failed'), { code: 'P2002' });
      prisma.department.create.mockRejectedValue(p2002Error);

      const promise = service.create({ code: 'DEP-1', name: 'Quality' }, ctx);
      await expect(promise).rejects.toThrow(ConflictException);
      const response = (await promise.catch((e) => e)).getResponse();
      expect(response.errors[0]).toMatchObject({ field: 'code', code: 'validation.duplicateValue' });
    });

    it('creates the department with a generated code in the active context', async () => {
      prisma.company.findFirst.mockResolvedValue({ id: 'company-a' });
      prisma.branch.findFirst.mockResolvedValue({ id: 'branch-a', companyId: 'company-a' });
      prisma.department.findFirst.mockResolvedValue(null);
      prisma.department.create.mockResolvedValue(department({ code: 'DEP-0001' }));

      const result = await service.create({ name: 'Quality' }, ctx);
      expect(numbering.generateNumberAtomic).toHaveBeenCalledWith('DEPARTMENT');
      expect(prisma.department.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ code: 'DEP-0001', companyId: 'company-a', branchId: 'branch-a' }),
        }),
      );
      expect(result.code).toBe('DEP-0001');
    });
  });

  describe('findOne', () => {
    it('throws a localized NotFoundException when the department is missing', async () => {
      prisma.department.findFirst.mockResolvedValue(null);

      const promise = service.findOne('nope', ctx);
      await expect(promise).rejects.toThrow(NotFoundException);
      const response = (await promise.catch((e) => e)).getResponse();
      expect(response).toEqual({
        messageKey: 'organization.departmentNotFound',
        message: 'Department not found',
      });
    });

    it('treats a department outside the active context as invisible', async () => {
      prisma.department.findFirst.mockResolvedValue(null);
      await expect(service.findOne('foreign-dept', ctx)).rejects.toThrow(NotFoundException);
      expect(prisma.department.findFirst).toHaveBeenCalledWith(expect.objectContaining({
        where: { id: 'foreign-dept', companyId: 'company-a', branchId: 'branch-a', deletedAt: null },
      }));
    });
  });

  describe('update', () => {
    it('validates merged references against the active context', async () => {
      prisma.department.findFirst.mockResolvedValueOnce(department());
      prisma.company.findFirst.mockResolvedValue({ id: 'company-a' });
      prisma.branch.findFirst.mockResolvedValue({ id: 'branch-a', companyId: 'company-a' });
      prisma.administration.findFirst.mockResolvedValue({ id: 'a1', branchId: 'branch-a' });
      prisma.department.update.mockResolvedValue(department({ name: 'Renamed' }));

      const result = await service.update('d1', { name: 'Renamed' }, ctx);
      expect(prisma.company.findFirst).toHaveBeenCalled();
      expect(prisma.branch.findFirst).toHaveBeenCalled();
      expect(prisma.administration.findFirst).toHaveBeenCalled();
      expect(result.name).toBe('Renamed');
    });

    it('rejects a duplicate code for another department in the same company', async () => {
      prisma.department.findFirst
        .mockResolvedValueOnce(department())
        .mockResolvedValueOnce({ id: 'd2' });
      prisma.company.findFirst.mockResolvedValue({ id: 'company-a' });
      prisma.branch.findFirst.mockResolvedValue({ id: 'branch-a', companyId: 'company-a' });
      prisma.administration.findFirst.mockResolvedValue({ id: 'a1', branchId: 'branch-a' });

      const promise = service.update('d1', { code: 'DEP-2' }, ctx);
      await expect(promise).rejects.toThrow(BadRequestException);
      const response = (await promise.catch((e) => e)).getResponse();
      expect(response.errors[0]).toMatchObject({ field: 'code', code: 'validation.duplicateValue' });
      expect(prisma.department.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ NOT: { id: 'd1' } }) }),
      );
    });
  });

  describe('remove', () => {
    it('soft-deletes an existing department', async () => {
      prisma.department.findFirst.mockResolvedValue(department());
      prisma.department.update.mockResolvedValue(department());

      const result = await service.remove('d1', ctx);
      expect(result.message).toContain('deleted');
      expect(prisma.department.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'd1' }, data: expect.objectContaining({ deletedAt: expect.any(Date) }) }),
      );
    });
  });
});
