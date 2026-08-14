import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { UsersService } from './users.service';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { AuditService } from '../../../modules/audit/audit.service';
import { ActiveOperationalContext } from '../../../common/operational-context/operational-context.types';

jest.mock('bcryptjs', () => ({ hash: jest.fn().mockResolvedValue('hashed'), compare: jest.fn() }));
import * as bcrypt from 'bcryptjs';

describe('UsersService', () => {
  let prisma: any;
  let audit: any;
  let service: UsersService;
  const ctx: ActiveOperationalContext = {
    contextKey: 'company-a:branch-a',
    scopeId: 'branch-a',
    companyId: 'company-a',
    branchId: 'branch-a',
    isDefault: true,
    source: 'EXPLICIT_SCOPE',
  } as ActiveOperationalContext;

  const user = (overrides: Record<string, any> = {}) => ({
    id: 'u1',
    email: 'user@example.com',
    name: 'User One',
    passwordHash: 'hashed',
    status: 'ACTIVE',
    deletedAt: null,
    ...overrides,
  });

  beforeEach(() => {
    prisma = {
      user: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
      },
      role: { findFirst: jest.fn(), findMany: jest.fn() },
      userRole: { findFirst: jest.fn(), count: jest.fn(), deleteMany: jest.fn(), createMany: jest.fn() },
      department: { findFirst: jest.fn() },
    };
    audit = { log: jest.fn().mockResolvedValue(undefined) };
    service = new UsersService(prisma as PrismaService, audit as AuditService);
  });

  describe('create', () => {
    it('throws a canonical duplicate field error on the email', async () => {
      prisma.user.findUnique.mockResolvedValue(user());

      const promise = service.create({ email: 'user@example.com', password: 'Secret123!', name: 'User One' }, ctx);
      await expect(promise).rejects.toThrow(BadRequestException);
      const response = (await promise.catch((e) => e)).getResponse();
      expect(response.errors[0]).toMatchObject({ field: 'email', code: 'validation.duplicateValue' });
    });

    it('rejects invalid role references with a field error on roleIds', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.role.findMany.mockResolvedValue([{ id: 'r1' }]);

      const promise = service.create({
        email: 'new@example.com', password: 'Secret123!', name: 'New User', roleIds: ['r1', 'ghost'],
      }, ctx);
      await expect(promise).rejects.toThrow(BadRequestException);
      const response = (await promise.catch((e) => e)).getResponse();
      expect(response.errors[0]).toMatchObject({ field: 'roleIds', code: 'validation.invalidReference' });
    });

    it('rejects a department outside the active context', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.department.findFirst.mockResolvedValue(null);

      const promise = service.create({
        email: 'new@example.com', password: 'Secret123!', name: 'New User', departmentId: 'foreign-dept',
      }, ctx);
      await expect(promise).rejects.toThrow(BadRequestException);
      const response = (await promise.catch((e) => e)).getResponse();
      expect(response.errors[0]).toMatchObject({ field: 'departmentId', code: 'validation.invalidReference' });
      expect(prisma.department.findFirst).toHaveBeenCalledWith(expect.objectContaining({
        where: { id: 'foreign-dept', companyId: 'company-a', branchId: 'branch-a', deletedAt: null },
      }));
    });

    it('creates the user with a hashed password, no password leak, and tenant ownership from ctx', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockImplementation(async ({ data }: any) => user({ email: data.email, passwordHash: data.passwordHash }));

      const result = await service.create({ email: 'new@example.com', password: 'Secret123!', name: 'New User' }, ctx);
      expect(bcrypt.hash).toHaveBeenCalledWith('Secret123!', 10);
      expect(prisma.user.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ companyId: 'company-a', branchId: 'branch-a' }),
      }));
      expect(result).not.toHaveProperty('passwordHash');
      expect(result).not.toHaveProperty('password');
    });
  });

  describe('findOne', () => {
    it('throws a localized NotFoundException when the user is missing', async () => {
      prisma.user.findFirst.mockResolvedValue(null);

      const promise = service.findOne('nope', ctx);
      await expect(promise).rejects.toThrow(NotFoundException);
      const response = (await promise.catch((e) => e)).getResponse();
      expect(response).toEqual({ messageKey: 'organization.userNotFound', message: 'User not found' });
    });

    it('treats a user outside the active context as invisible', async () => {
      prisma.user.findFirst.mockResolvedValue(null);
      await expect(service.findOne('foreign-user', ctx)).rejects.toThrow(NotFoundException);
      expect(prisma.user.findFirst).toHaveBeenCalledWith(expect.objectContaining({
        where: { id: 'foreign-user', companyId: 'company-a', branchId: 'branch-a', deletedAt: null },
      }));
    });
  });

  describe('update', () => {
    it('rejects an email already used by another user', async () => {
      prisma.user.findFirst.mockResolvedValue(user());
      prisma.user.findUnique.mockResolvedValue(user({ id: 'u2', email: 'other@example.com' }));

      const promise = service.update('u1', { email: 'other@example.com' }, ctx);
      await expect(promise).rejects.toThrow(BadRequestException);
      const response = (await promise.catch((e) => e)).getResponse();
      expect(response.errors[0]).toMatchObject({ field: 'email', code: 'validation.duplicateValue' });
    });

    it('throws a localized NotFoundException when the user is missing', async () => {
      prisma.user.findFirst.mockResolvedValue(null);
      await expect(service.update('nope', { name: 'X' }, ctx)).rejects.toThrow(NotFoundException);
    });
  });

  describe('assignRoles', () => {
    it('throws a localized NotFoundException for a missing user', async () => {
      prisma.user.findFirst.mockResolvedValue(null);

      const promise = service.assignRoles('nope', ['r1'], 'actor-1', ctx);
      await expect(promise).rejects.toThrow(NotFoundException);
      const response = (await promise.catch((e) => e)).getResponse();
      expect(response.messageKey).toBe('organization.userNotFound');
    });

    it('forbids removing the last SUPER_ADMIN role from the only administrator', async () => {
      prisma.user.findFirst.mockResolvedValue(user());
      prisma.userRole.findFirst.mockResolvedValue({ id: 'ur1' });
      prisma.role.findFirst.mockResolvedValue({ id: 'r-admin' });
      prisma.role.findMany.mockResolvedValue([{ id: 'r-operator' }]);
      prisma.userRole.count.mockResolvedValue(1);

      const promise = service.assignRoles('u1', ['r-operator'], 'actor-1', ctx);
      await expect(promise).rejects.toThrow(ForbiddenException);
      const response = (await promise.catch((e) => e)).getResponse();
      expect(response).toEqual({ messageKey: 'organization.cannotRemoveLastSuperAdmin', message: expect.any(String) });
    });

    it('allows removing SUPER_ADMIN when another active administrator exists', async () => {
      prisma.user.findFirst
        .mockResolvedValueOnce(user())
        .mockResolvedValueOnce(user({ roles: [] }));
      prisma.userRole.findFirst.mockResolvedValue({ id: 'ur1' });
      prisma.role.findFirst.mockResolvedValue({ id: 'r-admin' });
      prisma.role.findMany.mockResolvedValue([{ id: 'r-operator' }]);
      prisma.userRole.count.mockResolvedValue(2);
      prisma.userRole.deleteMany.mockResolvedValue({ count: 0 });
      prisma.userRole.createMany.mockResolvedValue({ count: 1 });

      const result = await service.assignRoles('u1', ['r-operator'], 'actor-1', ctx);
      expect(result.id).toBe('u1');
      expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ userId: 'actor-1', entity: 'user-roles' }));
    });
  });

  describe('remove', () => {
    it('throws a localized NotFoundException for a missing user', async () => {
      prisma.user.findFirst.mockResolvedValue(null);
      await expect(service.remove('nope', ctx)).rejects.toThrow(NotFoundException);
    });

    it('soft-deletes an existing user', async () => {
      prisma.user.findFirst.mockResolvedValue(user());
      prisma.user.update.mockResolvedValue(user());

      const result = await service.remove('u1', ctx);
      expect(result.message).toContain('deleted');
      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'u1' }, data: expect.objectContaining({ deletedAt: expect.any(Date) }) }),
      );
    });
  });
});
