import { BadRequestException, NotFoundException } from '@nestjs/common';
import { DepartmentsService } from './departments.service';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { NumberingService } from '../../numbering/numbering.service';

describe('DepartmentsService', () => {
  let prisma: any;
  let numbering: any;
  let service: DepartmentsService;

  const department = (overrides: Record<string, any> = {}) => ({
    id: 'd1',
    companyId: 'c1',
    branchId: 'b1',
    administrationId: 'a1',
    parentId: null,
    code: 'DEP-1',
    name: 'Quality',
    ...overrides,
  });

  beforeEach(() => {
    prisma = {
      company: { findUnique: jest.fn() },
      branch: { findUnique: jest.fn() },
      administration: { findUnique: jest.fn() },
      department: {
        findUnique: jest.fn(),
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
      prisma.company.findUnique.mockResolvedValue(null);

      const promise = service.create({ companyId: 'ghost', name: 'Quality' });
      await expect(promise).rejects.toThrow(BadRequestException);
      const response = (await promise.catch((e) => e)).getResponse();
      expect(response.errors[0]).toMatchObject({ field: 'companyId', code: 'validation.invalidReference' });
    });

    it('rejects a branch that does not belong to the selected company', async () => {
      prisma.company.findUnique.mockResolvedValue({ id: 'c1' });
      prisma.branch.findUnique.mockResolvedValue({ id: 'bX', companyId: 'c2' });

      const promise = service.create({ companyId: 'c1', branchId: 'bX', name: 'Quality' });
      await expect(promise).rejects.toThrow(BadRequestException);
      const response = (await promise.catch((e) => e)).getResponse();
      expect(response.errors[0]).toMatchObject({ field: 'branchId', code: 'validation.invalidReference' });
    });

    it('rejects an administration that does not belong to the selected branch', async () => {
      prisma.company.findUnique.mockResolvedValue({ id: 'c1' });
      prisma.branch.findUnique.mockResolvedValue({ id: 'b1', companyId: 'c1' });
      prisma.administration.findUnique.mockResolvedValue({ id: 'aX', branchId: 'b2' });

      const promise = service.create({ companyId: 'c1', branchId: 'b1', administrationId: 'aX', name: 'Quality' });
      await expect(promise).rejects.toThrow(BadRequestException);
      const response = (await promise.catch((e) => e)).getResponse();
      expect(response.errors[0]).toMatchObject({ field: 'administrationId', code: 'validation.invalidReference' });
    });

    it('rejects a parent department from another company', async () => {
      prisma.company.findUnique.mockResolvedValue({ id: 'c1' });
      prisma.department.findUnique.mockResolvedValue({ id: 'pX', companyId: 'c2' });

      const promise = service.create({ companyId: 'c1', parentId: 'pX', name: 'Quality' });
      await expect(promise).rejects.toThrow(BadRequestException);
      const response = (await promise.catch((e) => e)).getResponse();
      expect(response.errors[0]).toMatchObject({ field: 'parentId', code: 'validation.invalidReference' });
    });
  });

  describe('create', () => {
    it('throws a duplicate field error on the code', async () => {
      prisma.company.findUnique.mockResolvedValue({ id: 'c1' });
      prisma.department.findFirst.mockResolvedValue({ id: 'd9' });

      const promise = service.create({ companyId: 'c1', code: 'DEP-1', name: 'Quality' });
      await expect(promise).rejects.toThrow(BadRequestException);
      const response = (await promise.catch((e) => e)).getResponse();
      expect(response.errors[0]).toMatchObject({ field: 'code', code: 'validation.duplicateValue' });
    });

    it('creates the department with a generated code', async () => {
      prisma.company.findUnique.mockResolvedValue({ id: 'c1' });
      prisma.department.findFirst.mockResolvedValue(null);
      prisma.department.create.mockResolvedValue(department({ code: 'DEP-0001' }));

      const result = await service.create({ companyId: 'c1', name: 'Quality' });
      expect(numbering.generateNumberAtomic).toHaveBeenCalledWith('DEPARTMENT');
      expect(prisma.department.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ code: 'DEP-0001' }) }),
      );
      expect(result.code).toBe('DEP-0001');
    });
  });

  describe('findOne', () => {
    it('throws a localized NotFoundException when the department is missing', async () => {
      prisma.department.findUnique.mockResolvedValue(null);

      const promise = service.findOne('nope');
      await expect(promise).rejects.toThrow(NotFoundException);
      const response = (await promise.catch((e) => e)).getResponse();
      expect(response).toEqual({
        messageKey: 'organization.departmentNotFound',
        message: 'Department not found',
      });
    });
  });

  describe('update', () => {
    it('validates merged references against the existing record', async () => {
      prisma.department.findUnique
        .mockResolvedValueOnce(department())
        .mockResolvedValueOnce(null);
      prisma.company.findUnique.mockResolvedValue({ id: 'c1' });
      prisma.branch.findUnique.mockResolvedValue({ id: 'b1', companyId: 'c1' });
      prisma.administration.findUnique.mockResolvedValue({ id: 'a1', branchId: 'b1' });
      prisma.department.update.mockResolvedValue(department({ name: 'Renamed' }));

      const result = await service.update('d1', { name: 'Renamed' });
      expect(prisma.company.findUnique).toHaveBeenCalled();
      expect(prisma.branch.findUnique).toHaveBeenCalled();
      expect(prisma.administration.findUnique).toHaveBeenCalled();
      expect(result.name).toBe('Renamed');
    });

    it('rejects a duplicate code for another department in the same company', async () => {
      prisma.department.findUnique
        .mockResolvedValueOnce(department())
        .mockResolvedValueOnce({ id: 'd2', companyId: 'c1' });
      prisma.company.findUnique.mockResolvedValue({ id: 'c1' });
      prisma.branch.findUnique.mockResolvedValue({ id: 'b1', companyId: 'c1' });
      prisma.administration.findUnique.mockResolvedValue({ id: 'a1', branchId: 'b1' });
      prisma.department.findFirst.mockResolvedValue({ id: 'd2' });

      const promise = service.update('d1', { code: 'DEP-2' });
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
      prisma.department.findUnique.mockResolvedValue(department());
      prisma.department.update.mockResolvedValue(department());

      const result = await service.remove('d1');
      expect(result.message).toContain('deleted');
      expect(prisma.department.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'd1' }, data: expect.objectContaining({ deletedAt: expect.any(Date) }) }),
      );
    });
  });
});
