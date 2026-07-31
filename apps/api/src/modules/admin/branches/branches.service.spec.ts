import { BadRequestException, NotFoundException } from '@nestjs/common';
import { BranchesService } from './branches.service';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { NumberingService } from '../../numbering/numbering.service';

describe('BranchesService', () => {
  let prisma: any;
  let numbering: any;
  let service: BranchesService;

  beforeEach(() => {
    prisma = {
      company: { findUnique: jest.fn() },
      branch: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
      },
    };
    numbering = { generateNumberAtomic: jest.fn().mockResolvedValue('BR-0001') };
    service = new BranchesService(prisma as PrismaService, numbering as NumberingService);
  });

  describe('create', () => {
    it('throws a canonical field error when the company does not exist', async () => {
      prisma.company.findUnique.mockResolvedValue(null);

      const promise = service.create({ companyId: 'missing', code: 'BR-1', name: 'Cairo' });
      await expect(promise).rejects.toThrow(BadRequestException);
      const response = (await promise.catch((e) => e)).getResponse();
      expect(response).toMatchObject({
        messageKey: 'common.validationFailed',
        errors: [{ field: 'companyId', code: 'validation.invalidReference' }],
      });
    });

    it('throws a canonical duplicate field error on the code', async () => {
      prisma.company.findUnique.mockResolvedValue({ id: 'c1' });
      prisma.branch.findFirst.mockResolvedValue({ id: 'b1' });

      const promise = service.create({ companyId: 'c1', code: 'BR-1', name: 'Cairo' });
      await expect(promise).rejects.toThrow(BadRequestException);
      const response = (await promise.catch((e) => e)).getResponse();
      expect(response.errors).toEqual([
        expect.objectContaining({ field: 'code', code: 'validation.duplicateValue' }),
      ]);
    });

    it('generates a code when none is provided and creates the branch', async () => {
      prisma.company.findUnique.mockResolvedValue({ id: 'c1' });
      prisma.branch.findFirst.mockResolvedValue(null);
      prisma.branch.create.mockResolvedValue({ id: 'b1', code: 'BR-0001' });

      const result = await service.create({ companyId: 'c1', name: 'Cairo' });
      expect(numbering.generateNumberAtomic).toHaveBeenCalledWith('BRANCH');
      expect(prisma.branch.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ code: 'BR-0001' }) }),
      );
      expect(result.id).toBe('b1');
    });
  });

  describe('findOne', () => {
    it('throws a localized NotFoundException when the branch is missing', async () => {
      prisma.branch.findUnique.mockResolvedValue(null);

      const promise = service.findOne('nope');
      await expect(promise).rejects.toThrow(NotFoundException);
      const response = (await promise.catch((e) => e)).getResponse();
      expect(response).toEqual({
        messageKey: 'organization.branchNotFound',
        message: 'Branch not found',
      });
    });

    it('returns the branch with its company', async () => {
      const branch = { id: 'b1', companyId: 'c1', company: { id: 'c1', name: 'Acme' } };
      prisma.branch.findUnique.mockResolvedValue(branch);

      await expect(service.findOne('b1')).resolves.toEqual(branch);
    });
  });

  describe('update', () => {
    it('rejects a duplicate code while allowing the same record to keep its code', async () => {
      prisma.branch.findUnique
        .mockResolvedValueOnce({ id: 'b1', companyId: 'c1', code: 'BR-1' })
        .mockResolvedValueOnce({ id: 'b2' });
      prisma.branch.findFirst.mockResolvedValue({ id: 'b2' });

      const promise = service.update('b1', { code: 'BR-1' });
      await expect(promise).rejects.toThrow(BadRequestException);
      const response = (await promise.catch((e) => e)).getResponse();
      expect(response.errors[0]).toMatchObject({ field: 'code', code: 'validation.duplicateValue' });
      expect(prisma.branch.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ NOT: { id: 'b1' } }) }),
      );
    });

    it('rejects an invalid company reference', async () => {
      prisma.branch.findUnique.mockResolvedValueOnce({ id: 'b1', companyId: 'c1' });
      prisma.company.findUnique.mockResolvedValueOnce(null);

      const promise = service.update('b1', { companyId: 'ghost' });
      await expect(promise).rejects.toThrow(BadRequestException);
      const response = (await promise.catch((e) => e)).getResponse();
      expect(response.errors[0]).toMatchObject({ field: 'companyId', code: 'validation.invalidReference' });
    });
  });

  describe('remove', () => {
    it('soft-deletes an existing branch', async () => {
      prisma.branch.findUnique.mockResolvedValue({ id: 'b1' });
      prisma.branch.update.mockResolvedValue({ id: 'b1', deletedAt: expect.any(Date) });

      const result = await service.remove('b1');
      expect(result.message).toContain('deleted');
      expect(prisma.branch.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'b1' }, data: expect.objectContaining({ deletedAt: expect.any(Date) }) }),
      );
    });

    it('throws NotFoundException for a missing branch', async () => {
      prisma.branch.findUnique.mockResolvedValue(null);
      await expect(service.remove('nope')).rejects.toThrow(NotFoundException);
    });
  });
});
