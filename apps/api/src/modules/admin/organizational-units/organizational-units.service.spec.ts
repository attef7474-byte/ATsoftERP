import { BadRequestException, NotFoundException } from '@nestjs/common';
import { OrganizationalUnitsService } from './organizational-units.service';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { AuditService } from '../../../common/audit/audit.service';
import { NumberingService } from '../../numbering/numbering.service';
import { ActiveOperationalContext } from '../../../common/operational-context/operational-context.types';
import { CurrentUserType } from '../../auth/types/current-user.type';

const ctx: ActiveOperationalContext = {
  contextKey: 'c1:b1:-:-',
  scopeId: 's1',
  companyId: 'c1',
  companyName: 'Company A',
  companyCode: 'A',
  branchId: 'b1',
  branchName: 'HQ',
  branchCode: 'HQ',
  administrationId: null,
  administrationName: null,
  administrationCode: null,
  departmentId: null,
  departmentName: null,
  departmentCode: null,
  isDefault: true,
  source: 'EXPLICIT_SCOPE',
};

const user: CurrentUserType = { id: 'u1', sub: 'u1', email: 'u@a.com', name: 'U' };

const unit = (overrides: Record<string, any> = {}) => ({
  id: 'ou1',
  companyId: 'c1',
  branchId: 'b1',
  parentId: null,
  code: 'OU-1',
  name: 'Production',
  type: 'DEPARTMENT',
  status: 'ACTIVE',
  ...overrides,
});

describe('OrganizationalUnitsService', () => {
  let prisma: any;
  let numbering: any;
  let audit: any;
  let service: OrganizationalUnitsService;

  beforeEach(() => {
    prisma = {
      organizationalUnit: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
      },
    };
    numbering = { generateNumberAtomic: jest.fn().mockResolvedValue('OU-0001') };
    audit = { log: jest.fn().mockResolvedValue(undefined) };
    service = new OrganizationalUnitsService(
      prisma as PrismaService,
      audit as AuditService,
      numbering as NumberingService,
    );
  });

  describe('create', () => {
    it('rejects a parent unit from another company', async () => {
      prisma.organizationalUnit.findUnique.mockResolvedValue({ id: 'pX', companyId: 'c2', branchId: 'b1' });

      const promise = service.create({ name: 'Quality', parentId: 'pX' }, user, ctx);
      await expect(promise).rejects.toThrow(BadRequestException);
      const response = (await promise.catch((e) => e)).getResponse();
      expect(response.errors[0]).toMatchObject({ field: 'parentId', code: 'validation.invalidReference' });
    });

    it('rejects a parent unit from another branch', async () => {
      prisma.organizationalUnit.findUnique.mockResolvedValue({ id: 'pX', companyId: 'c1', branchId: 'b2' });

      const promise = service.create({ name: 'Quality', parentId: 'pX' }, user, ctx);
      await expect(promise).rejects.toThrow(BadRequestException);
      const response = (await promise.catch((e) => e)).getResponse();
      expect(response.errors[0]).toMatchObject({ field: 'parentId', code: 'validation.invalidReference' });
    });

    it('throws a duplicate field error on the code within the branch', async () => {
      prisma.organizationalUnit.findFirst.mockResolvedValue({ id: 'ou9' });

      const promise = service.create({ code: 'OU-1', name: 'Production' }, user, ctx);
      await expect(promise).rejects.toThrow(BadRequestException);
      const response = (await promise.catch((e) => e)).getResponse();
      expect(response.errors[0]).toMatchObject({ field: 'code', code: 'validation.duplicateValue' });
    });

    it('creates a unit in the active context with a generated code and audits it', async () => {
      prisma.organizationalUnit.findUnique.mockResolvedValue(null);
      prisma.organizationalUnit.findFirst.mockResolvedValue(null);
      prisma.organizationalUnit.create.mockResolvedValue(unit({ code: 'OU-0001' }));

      const result = await service.create({ name: 'Production' }, user, ctx);
      expect(numbering.generateNumberAtomic).toHaveBeenCalledWith('ORGANIZATIONAL_UNIT');
      expect(prisma.organizationalUnit.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            companyId: 'c1',
            branchId: 'b1',
            code: 'OU-0001',
            name: 'Production',
            type: 'DEPARTMENT',
            status: 'ACTIVE',
          }),
        }),
      );
      expect(audit.log).toHaveBeenCalledWith('u1', 'CREATE', 'OrganizationalUnit', 'ou1', expect.any(Object));
      expect(result.code).toBe('OU-0001');
    });
  });

  describe('findOne (tenant isolation)', () => {
    it('returns the unit when it belongs to the active context', async () => {
      prisma.organizationalUnit.findUnique.mockResolvedValue(unit());
      const result = await service.findOne('ou1', ctx);
      expect(result.id).toBe('ou1');
    });

    it('throws NotFound when the unit belongs to another company', async () => {
      prisma.organizationalUnit.findUnique.mockResolvedValue(unit({ companyId: 'c2' }));
      const promise = service.findOne('ou1', ctx);
      await expect(promise).rejects.toThrow(NotFoundException);
    });

    it('throws NotFound when the unit belongs to another branch', async () => {
      prisma.organizationalUnit.findUnique.mockResolvedValue(unit({ branchId: 'b2' }));
      const promise = service.findOne('ou1', ctx);
      await expect(promise).rejects.toThrow(NotFoundException);
    });

    it('throws NotFound when the unit is missing', async () => {
      prisma.organizationalUnit.findUnique.mockResolvedValue(null);
      const promise = service.findOne('nope', ctx);
      await expect(promise).rejects.toThrow(NotFoundException);
      const response = (await promise.catch((e) => e)).getResponse();
      expect(response.messageKey).toBe('organization.organizationalUnitNotFound');
    });
  });

  describe('findAll', () => {
    it('always scopes the query to the active company and branch', async () => {
      prisma.organizationalUnit.findMany.mockResolvedValue([]);
      prisma.organizationalUnit.count.mockResolvedValue(0);

      await service.findAll({ page: 1, limit: 10 }, ctx);
      expect(prisma.organizationalUnit.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ companyId: 'c1', branchId: 'b1', deletedAt: null }),
        }),
      );
      expect(prisma.organizationalUnit.count).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ companyId: 'c1', branchId: 'b1' }) }),
      );
    });
  });

  describe('getTree', () => {
    it('always scopes the tree to the active company and branch (no client branch override)', async () => {
      prisma.organizationalUnit.findMany.mockResolvedValue([]);

      await service.getTree(ctx);

      expect(prisma.organizationalUnit.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ companyId: 'c1', branchId: 'b1', deletedAt: null }),
        }),
      );
    });
  });

  describe('update', () => {
    it('blocks moving a unit under its own child (cycle prevention)', async () => {
      prisma.organizationalUnit.findUnique
        .mockResolvedValueOnce(unit()) // findOwned
        .mockResolvedValueOnce(unit({ id: 'child', parentId: 'ou1' })); // validateParent fetch
      prisma.organizationalUnit.findMany.mockResolvedValue([
        unit(),
        { id: 'child', parentId: 'ou1' },
      ]);

      const promise = service.update('ou1', { parentId: 'child' }, user, ctx);
      await expect(promise).rejects.toThrow(BadRequestException);
      const response = (await promise.catch((e) => e)).getResponse();
      expect(response.errors[0]).toMatchObject({ field: 'parentId', code: 'validation.invalidReference' });
    });

    it('rejects moving a unit under itself', async () => {
      prisma.organizationalUnit.findUnique
        .mockResolvedValueOnce(unit())
        .mockResolvedValueOnce(unit());

      const promise = service.update('ou1', { parentId: 'ou1' }, user, ctx);
      await expect(promise).rejects.toThrow(BadRequestException);
      const response = (await promise.catch((e) => e)).getResponse();
      expect(response.errors[0]).toMatchObject({ field: 'parentId', code: 'validation.invalidReference' });
    });

    it('rejects a duplicate code for another unit in the same branch', async () => {
      prisma.organizationalUnit.findUnique
        .mockResolvedValueOnce(unit())
        .mockResolvedValueOnce(null);
      prisma.organizationalUnit.findFirst.mockResolvedValue({ id: 'ou2' });

      const promise = service.update('ou1', { code: 'OU-2' }, user, ctx);
      await expect(promise).rejects.toThrow(BadRequestException);
      const response = (await promise.catch((e) => e)).getResponse();
      expect(response.errors[0]).toMatchObject({ field: 'code', code: 'validation.duplicateValue' });
    });

    it('updates an owned unit and audits it', async () => {
      prisma.organizationalUnit.findUnique
        .mockResolvedValueOnce(unit())
        .mockResolvedValueOnce(null);
      prisma.organizationalUnit.update.mockResolvedValue(unit({ name: 'Renamed' }));

      const result = await service.update('ou1', { name: 'Renamed' }, user, ctx);
      expect(prisma.organizationalUnit.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'ou1' }, data: expect.objectContaining({ name: 'Renamed' }) }),
      );
      expect(audit.log).toHaveBeenCalledWith('u1', 'UPDATE', 'OrganizationalUnit', 'ou1', expect.any(Object));
      expect(result.name).toBe('Renamed');
    });
  });

  describe('remove', () => {
    it('blocks deletion when active children exist', async () => {
      prisma.organizationalUnit.findUnique.mockResolvedValue(unit());
      prisma.organizationalUnit.count.mockResolvedValue(2);

      const promise = service.remove('ou1', user, ctx);
      await expect(promise).rejects.toThrow(BadRequestException);
      const response = (await promise.catch((e) => e)).getResponse();
      expect(response.errors[0]).toMatchObject({ field: 'parentId', code: 'validation.hasChildren' });
    });

    it('soft-deletes an owned leaf unit and audits it', async () => {
      prisma.organizationalUnit.findUnique.mockResolvedValue(unit());
      prisma.organizationalUnit.count.mockResolvedValue(0);
      prisma.organizationalUnit.update.mockResolvedValue(unit());

      const result = await service.remove('ou1', user, ctx);
      expect(result.message).toContain('deleted');
      expect(prisma.organizationalUnit.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'ou1' }, data: expect.objectContaining({ deletedAt: expect.any(Date) }) }),
      );
      expect(audit.log).toHaveBeenCalledWith('u1', 'DELETE', 'OrganizationalUnit', 'ou1', expect.any(Object));
    });

    it('rejects deletion of a unit from another company', async () => {
      prisma.organizationalUnit.findUnique.mockResolvedValue(unit({ companyId: 'c2' }));
      const promise = service.remove('ou1', user, ctx);
      await expect(promise).rejects.toThrow(NotFoundException);
    });
  });
});
