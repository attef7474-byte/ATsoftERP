import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { RolesService } from './roles.service';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { AuditService } from '../../../common/audit/audit.service';

describe('RolesService', () => {
  let prisma: any;
  let audit: any;
  let service: RolesService;

  const role = (overrides: Record<string, any> = {}) => ({
    id: 'r1',
    code: 'MANAGER',
    name: 'Manager',
    isSystem: false,
    deletedAt: null,
    ...overrides,
  });

  beforeEach(() => {
    prisma = {
      role: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
      },
      permission: { findMany: jest.fn() },
      rolePermission: { deleteMany: jest.fn(), createMany: jest.fn() },
      userRole: { count: jest.fn(), findMany: jest.fn() },
    };
    audit = { log: jest.fn().mockResolvedValue(undefined) };
    service = new RolesService(prisma as PrismaService, audit as AuditService);
  });

  describe('create', () => {
    it('throws a canonical duplicate field error on the code', async () => {
      prisma.role.findUnique.mockResolvedValue(role());

      const promise = service.create({ code: 'MANAGER', name: 'Manager' });
      await expect(promise).rejects.toThrow(BadRequestException);
      const response = (await promise.catch((e) => e)).getResponse();
      expect(response.errors[0]).toMatchObject({ field: 'code', code: 'validation.duplicateValue' });
    });

    it('rejects invalid permission references with a field error on permissionIds', async () => {
      prisma.role.findUnique.mockResolvedValue(null);
      prisma.permission.findMany.mockResolvedValue([{ id: 'p1' }]);

      const promise = service.create({ code: 'OP', name: 'Operator', permissionIds: ['p1', 'p-missing'] });
      await expect(promise).rejects.toThrow(BadRequestException);
      const response = (await promise.catch((e) => e)).getResponse();
      expect(response.errors[0]).toMatchObject({ field: 'permissionIds', code: 'validation.invalidReference' });
    });

    it('creates the role and audits the action when a user id is provided', async () => {
      prisma.role.findUnique.mockResolvedValue(null);
      prisma.role.create.mockResolvedValue(role({ permissions: [] }));

      await service.create({ code: 'OP', name: 'Operator' }, 'u1');
      expect(prisma.role.create).toHaveBeenCalled();
      expect(audit.log).toHaveBeenCalledWith('u1', 'CREATE', 'role', 'r1', expect.anything());
    });
  });

  describe('findOne', () => {
    it('throws a localized NotFoundException when the role is missing', async () => {
      prisma.role.findUnique.mockResolvedValue(null);

      const promise = service.findOne('nope');
      await expect(promise).rejects.toThrow(NotFoundException);
      const response = (await promise.catch((e) => e)).getResponse();
      expect(response).toEqual({ messageKey: 'organization.roleNotFound', message: 'Role not found' });
    });
  });

  describe('update', () => {
    it('forbids modification of the system role', async () => {
      prisma.role.findUnique.mockResolvedValue(role({ isSystem: true }));

      const promise = service.update('r1', { name: 'Renamed' });
      await expect(promise).rejects.toThrow(ForbiddenException);
      const response = (await promise.catch((e) => e)).getResponse();
      expect(response).toEqual({ messageKey: 'organization.systemRoleProtected', message: expect.any(String) });
    });

    it('throws a localized NotFoundException when the role is missing', async () => {
      prisma.role.findUnique.mockResolvedValue(null);

      await expect(service.update('nope', { name: 'X' })).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('forbids deleting the system role', async () => {
      prisma.role.findUnique.mockResolvedValue(role({ isSystem: true }));

      const promise = service.remove('r1');
      await expect(promise).rejects.toThrow(ConflictException);
      const response = (await promise.catch((e) => e)).getResponse();
      expect(response).toEqual({ messageKey: 'organization.systemRoleProtected', message: expect.any(String) });
    });

    it('rejects deletion while users are assigned', async () => {
      prisma.role.findUnique.mockResolvedValue(role());
      prisma.userRole.count.mockResolvedValue(2);

      const promise = service.remove('r1');
      await expect(promise).rejects.toThrow(ConflictException);
      const response = (await promise.catch((e) => e)).getResponse();
      expect(response).toEqual({ messageKey: 'organization.cannotDeleteRoleWithUsers', message: expect.any(String) });
    });
  });

  describe('assignPermissions', () => {
    it('throws a localized NotFoundException for a missing role', async () => {
      prisma.role.findUnique.mockResolvedValue(null);

      const promise = service.assignPermissions('nope', ['p1']);
      await expect(promise).rejects.toThrow(NotFoundException);
      const response = (await promise.catch((e) => e)).getResponse();
      expect(response.messageKey).toBe('organization.roleNotFound');
    });

    it('rejects unknown permission ids', async () => {
      prisma.role.findUnique.mockResolvedValue(role());
      prisma.permission.findMany.mockResolvedValue([{ id: 'p1' }]);

      const promise = service.assignPermissions('r1', ['p1', 'ghost']);
      await expect(promise).rejects.toThrow(BadRequestException);
      const response = (await promise.catch((e) => e)).getResponse();
      expect(response.errors[0]).toMatchObject({ field: 'permissionIds', code: 'validation.invalidReference' });
    });
  });
});
