import { BadRequestException, NotFoundException } from '@nestjs/common';
import { BranchesService } from './branches.service';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { NumberingService } from '../../numbering/numbering.service';
import { ActiveOperationalContext } from '../../../common/operational-context/operational-context.types';

describe('BranchesService', () => {
  let prisma: any;
  let numbering: any;
  let service: BranchesService;
  const ctx: ActiveOperationalContext = {
    contextKey: 'company-a:branch-a',
    scopeId: 'branch-a',
    companyId: 'company-a',
    branchId: 'branch-a',
    isDefault: true,
    source: 'EXPLICIT_SCOPE',
  } as ActiveOperationalContext;

  beforeEach(() => {
    prisma = {
      company: { findUnique: jest.fn() },
      branch: {
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

      const promise = service.create({ code: 'BR-1', name: 'Cairo' }, ctx);
      await expect(promise).rejects.toThrow(BadRequestException);
      const response = (await promise.catch((e) => e)).getResponse();
      expect(response).toMatchObject({
        messageKey: 'common.validationFailed',
        errors: [{ field: 'companyId', code: 'validation.invalidReference' }],
      });
      expect(prisma.company.findUnique).toHaveBeenCalledWith({ where: { id: 'company-a' } });
    });

    it('throws a canonical duplicate field error on the code', async () => {
      prisma.company.findUnique.mockResolvedValue({ id: 'company-a' });
      prisma.branch.findFirst.mockResolvedValue({ id: 'b1' });

      const promise = service.create({ code: 'BR-1', name: 'Cairo' }, ctx);
      await expect(promise).rejects.toThrow(BadRequestException);
      const response = (await promise.catch((e) => e)).getResponse();
      expect(response.errors).toEqual([
        expect.objectContaining({ field: 'code', code: 'validation.duplicateValue' }),
      ]);
    });

    it('generates a code when none is provided and scopes the company to the active context', async () => {
      prisma.company.findUnique.mockResolvedValue({ id: 'company-a' });
      prisma.branch.findFirst.mockResolvedValue(null);
      prisma.branch.create.mockResolvedValue({ id: 'b1', code: 'BR-0001' });

      const result = await service.create({ name: 'Cairo' }, ctx);
      expect(numbering.generateNumberAtomic).toHaveBeenCalledWith('BRANCH');
      expect(prisma.branch.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ code: 'BR-0001', companyId: 'company-a' }) }),
      );
      expect(result.id).toBe('b1');
    });
  });

  describe('findOne', () => {
    it('throws a localized NotFoundException when the branch is missing', async () => {
      prisma.branch.findFirst.mockResolvedValue(null);

      const promise = service.findOne('nope', ctx);
      await expect(promise).rejects.toThrow(NotFoundException);
      const response = (await promise.catch((e) => e)).getResponse();
      expect(response).toEqual({
        messageKey: 'organization.branchNotFound',
        message: 'Branch not found',
      });
    });

    it('returns the branch with its company', async () => {
      const branch = { id: 'b1', companyId: 'company-a', company: { id: 'company-a', name: 'Acme' } };
      prisma.branch.findFirst.mockResolvedValue(branch);

      await expect(service.findOne('b1', ctx)).resolves.toEqual(branch);
    });

    it('treats a foreign-company branch as invisible', async () => {
      prisma.branch.findFirst.mockResolvedValue(null);
      await expect(service.findOne('foreign-branch', ctx)).rejects.toThrow(NotFoundException);
      expect(prisma.branch.findFirst).toHaveBeenCalledWith(expect.objectContaining({
        where: { id: 'foreign-branch', companyId: 'company-a', deletedAt: null },
      }));
    });
  });

  describe('update', () => {
    it('rejects a duplicate code while allowing the same record to keep its code', async () => {
      prisma.branch.findFirst
        .mockResolvedValueOnce({ id: 'b1', companyId: 'company-a', code: 'BR-1' })
        .mockResolvedValueOnce({ id: 'b2' });

      const promise = service.update('b1', { code: 'BR-1' }, ctx);
      await expect(promise).rejects.toThrow(BadRequestException);
      const response = (await promise.catch((e) => e)).getResponse();
      expect(response.errors[0]).toMatchObject({ field: 'code', code: 'validation.duplicateValue' });
      expect(prisma.branch.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ NOT: { id: 'b1' } }) }),
      );
    });

    it('never trusts a client-supplied companyId on update', async () => {
      prisma.branch.findFirst.mockResolvedValue({ id: 'b1', companyId: 'company-a' });
      prisma.branch.update.mockResolvedValue({ id: 'b1' });

      await service.update('b1', { companyId: 'evil-company', name: 'Renamed' }, ctx);
      expect(prisma.branch.update).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.not.objectContaining({ companyId: 'evil-company' }),
      }));
    });
  });

  describe('remove', () => {
    it('soft-deletes an existing branch', async () => {
      prisma.branch.findFirst.mockResolvedValue({ id: 'b1' });
      prisma.branch.update.mockResolvedValue({ id: 'b1', deletedAt: expect.any(Date) });

      const result = await service.remove('b1', ctx);
      expect(result.message).toContain('deleted');
      expect(prisma.branch.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'b1' }, data: expect.objectContaining({ deletedAt: expect.any(Date) }) }),
      );
    });

    it('throws NotFoundException for a missing branch', async () => {
      prisma.branch.findFirst.mockResolvedValue(null);
      await expect(service.remove('nope', ctx)).rejects.toThrow(NotFoundException);
    });
  });
});
