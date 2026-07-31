import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { AdministrationsService } from './administrations.service';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { NumberingService } from '../../numbering/numbering.service';

describe('AdministrationsService', () => {
  let prisma: any;
  let numbering: any;
  let service: AdministrationsService;

  beforeEach(() => {
    prisma = {
      branch: { findUnique: jest.fn() },
      administration: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
      },
      department: { count: jest.fn() },
    };
    numbering = { generateNumberAtomic: jest.fn().mockResolvedValue('ADM-0001') };
    service = new AdministrationsService(prisma as PrismaService, numbering as NumberingService);
  });

  describe('create', () => {
    it('throws a canonical field error when the branch does not exist', async () => {
      prisma.branch.findUnique.mockResolvedValue(null);

      const promise = service.create({ branchId: 'missing', code: 'ADM-1', name: 'Finance' });
      await expect(promise).rejects.toThrow(BadRequestException);
      const response = (await promise.catch((e) => e)).getResponse();
      expect(response.errors).toEqual([
        expect.objectContaining({ field: 'branchId', code: 'validation.invalidReference' }),
      ]);
    });

    it('throws a canonical duplicate field error on the code', async () => {
      prisma.branch.findUnique.mockResolvedValue({ id: 'b1' });
      prisma.administration.findFirst.mockResolvedValue({ id: 'a1' });

      const promise = service.create({ branchId: 'b1', code: 'ADM-1', name: 'Finance' });
      await expect(promise).rejects.toThrow(BadRequestException);
      const response = (await promise.catch((e) => e)).getResponse();
      expect(response.errors[0]).toMatchObject({ field: 'code', code: 'validation.duplicateValue' });
    });

    it('generates a code when none is provided', async () => {
      prisma.branch.findUnique.mockResolvedValue({ id: 'b1' });
      prisma.administration.findFirst.mockResolvedValue(null);
      prisma.administration.create.mockResolvedValue({ id: 'a1', code: 'ADM-0001' });

      await service.create({ branchId: 'b1', name: 'Finance' });
      expect(numbering.generateNumberAtomic).toHaveBeenCalledWith('ADMINISTRATION');
    });
  });

  describe('findOne', () => {
    it('throws a localized NotFoundException when the administration is missing', async () => {
      prisma.administration.findUnique.mockResolvedValue(null);

      const promise = service.findOne('nope');
      await expect(promise).rejects.toThrow(NotFoundException);
      const response = (await promise.catch((e) => e)).getResponse();
      expect(response).toEqual({
        messageKey: 'organization.administrationNotFound',
        message: 'Administration not found',
      });
    });
  });

  describe('update', () => {
    it('rejects an invalid branch reference', async () => {
      prisma.administration.findUnique.mockResolvedValue({ id: 'a1', branchId: 'b1', code: 'ADM-1' });
      prisma.branch.findUnique.mockResolvedValue(null);

      const promise = service.update('a1', { branchId: 'ghost' });
      await expect(promise).rejects.toThrow(BadRequestException);
      const response = (await promise.catch((e) => e)).getResponse();
      expect(response.errors[0]).toMatchObject({ field: 'branchId', code: 'validation.invalidReference' });
    });

    it('rejects a duplicate code within the same branch', async () => {
      prisma.administration.findUnique.mockResolvedValue({ id: 'a1', branchId: 'b1', code: 'ADM-1' });
      prisma.administration.findFirst.mockResolvedValue({ id: 'a2' });

      const promise = service.update('a1', { code: 'ADM-1' });
      await expect(promise).rejects.toThrow(BadRequestException);
      const response = (await promise.catch((e) => e)).getResponse();
      expect(response.errors[0]).toMatchObject({ field: 'code', code: 'validation.duplicateValue' });
    });
  });

  describe('remove', () => {
    it('throws a ConflictException when the administration still has departments', async () => {
      prisma.administration.findUnique.mockResolvedValue({ id: 'a1' });
      prisma.department.count.mockResolvedValue(3);

      const promise = service.remove('a1');
      await expect(promise).rejects.toThrow(ConflictException);
      const response = (await promise.catch((e) => e)).getResponse();
      expect(response).toEqual({
        messageKey: 'organization.cannotDeleteAdministrationWithDepartments',
        message: expect.stringContaining('departments'),
      });
    });

    it('soft-deletes an administration without departments', async () => {
      prisma.administration.findUnique.mockResolvedValue({ id: 'a1' });
      prisma.department.count.mockResolvedValue(0);
      prisma.administration.update.mockResolvedValue({ id: 'a1' });

      const result = await service.remove('a1');
      expect(result.message).toContain('deleted');
      expect(prisma.administration.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'a1' } }),
      );
    });
  });
});
