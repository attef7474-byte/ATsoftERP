import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { AdministrationsService } from './administrations.service';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { NumberingService } from '../../numbering/numbering.service';
import { ActiveOperationalContext } from '../../../common/operational-context/operational-context.types';

describe('AdministrationsService', () => {
  let prisma: any;
  let numbering: any;
  let service: AdministrationsService;
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
      branch: { findFirst: jest.fn() },
      administration: {
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
    it('throws a canonical field error when the branch does not exist in the active context', async () => {
      prisma.branch.findFirst.mockResolvedValue(null);

      const promise = service.create({ code: 'ADM-1', name: 'Finance' }, ctx);
      await expect(promise).rejects.toThrow(BadRequestException);
      const response = (await promise.catch((e) => e)).getResponse();
      expect(response.errors).toEqual([
        expect.objectContaining({ field: 'branchId', code: 'validation.invalidReference' }),
      ]);
      expect(prisma.branch.findFirst).toHaveBeenCalledWith(expect.objectContaining({
        where: { id: 'branch-a', companyId: 'company-a', deletedAt: null },
      }));
    });

    it('throws a canonical duplicate field error on the code', async () => {
      prisma.branch.findFirst.mockResolvedValue({ id: 'branch-a' });
      prisma.administration.findFirst.mockResolvedValue({ id: 'a1' });

      const promise = service.create({ code: 'ADM-1', name: 'Finance' }, ctx);
      await expect(promise).rejects.toThrow(BadRequestException);
      const response = (await promise.catch((e) => e)).getResponse();
      expect(response.errors[0]).toMatchObject({ field: 'code', code: 'validation.duplicateValue' });
    });

    it('generates a code when none is provided and scopes the branch to the active context', async () => {
      prisma.branch.findFirst.mockResolvedValue({ id: 'branch-a' });
      prisma.administration.findFirst.mockResolvedValue(null);
      prisma.administration.create.mockResolvedValue({ id: 'a1', code: 'ADM-0001' });

      await service.create({ name: 'Finance' }, ctx);
      expect(numbering.generateNumberAtomic).toHaveBeenCalledWith('ADMINISTRATION');
      expect(prisma.administration.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ branchId: 'branch-a' }),
      }));
    });
  });

  describe('findOne', () => {
    it('throws a localized NotFoundException when the administration is missing', async () => {
      prisma.administration.findFirst.mockResolvedValue(null);

      const promise = service.findOne('nope', ctx);
      await expect(promise).rejects.toThrow(NotFoundException);
      const response = (await promise.catch((e) => e)).getResponse();
      expect(response).toEqual({
        messageKey: 'organization.administrationNotFound',
        message: 'Administration not found',
      });
    });

    it('treats a foreign-company administration as invisible', async () => {
      prisma.administration.findFirst.mockResolvedValue(null);
      await expect(service.findOne('foreign-admin', ctx)).rejects.toThrow(NotFoundException);
      expect(prisma.administration.findFirst).toHaveBeenCalledWith(expect.objectContaining({
        where: { id: 'foreign-admin', branchId: 'branch-a', branch: { companyId: 'company-a' }, deletedAt: null },
      }));
    });
  });

  describe('update', () => {
    it('rejects a duplicate code within the same branch', async () => {
      prisma.administration.findFirst
        .mockResolvedValueOnce({ id: 'a1', branchId: 'branch-a', code: 'ADM-1' })
        .mockResolvedValueOnce({ id: 'a2' });

      const promise = service.update('a1', { code: 'ADM-1' }, ctx);
      await expect(promise).rejects.toThrow(BadRequestException);
      const response = (await promise.catch((e) => e)).getResponse();
      expect(response.errors[0]).toMatchObject({ field: 'code', code: 'validation.duplicateValue' });
    });

    it('never trusts a client-supplied branchId on update', async () => {
      prisma.administration.findFirst.mockResolvedValue({ id: 'a1', branchId: 'branch-a', code: 'ADM-1' });
      prisma.administration.update.mockResolvedValue({ id: 'a1' });

      await service.update('a1', { branchId: 'evil-branch', name: 'Renamed' }, ctx);
      expect(prisma.administration.update).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.not.objectContaining({ branchId: 'evil-branch' }),
      }));
    });
  });

  describe('remove', () => {
    it('throws a ConflictException when the administration still has departments', async () => {
      prisma.administration.findFirst.mockResolvedValue({ id: 'a1' });
      prisma.department.count.mockResolvedValue(3);

      const promise = service.remove('a1', ctx);
      await expect(promise).rejects.toThrow(ConflictException);
      const response = (await promise.catch((e) => e)).getResponse();
      expect(response).toEqual({
        messageKey: 'organization.cannotDeleteAdministrationWithDepartments',
        message: expect.stringContaining('departments'),
      });
    });

    it('soft-deletes an administration without departments', async () => {
      prisma.administration.findFirst.mockResolvedValue({ id: 'a1' });
      prisma.department.count.mockResolvedValue(0);
      prisma.administration.update.mockResolvedValue({ id: 'a1' });

      const result = await service.remove('a1', ctx);
      expect(result.message).toContain('deleted');
      expect(prisma.administration.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'a1' } }),
      );
    });
  });
});
