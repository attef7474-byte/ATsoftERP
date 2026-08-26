import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { UsersService } from './users.service';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { AuditService } from '../../../modules/audit/audit.service';
import { ActiveOperationalContext } from '../../../common/operational-context/operational-context.types';
import { PasswordCredentialService } from '../../settings/security/password-credential.service';

describe('UsersService', () => {
  let prisma: any;
  let audit: any;
  let passwordCredentials: any;
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
    companyId: 'company-a',
    branchId: 'branch-a',
    authVersion: 0,
    roles: [],
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
        updateMany: jest.fn(),
        count: jest.fn(),
      },
      role: { findFirst: jest.fn(), findMany: jest.fn() },
      userRole: { findFirst: jest.fn(), count: jest.fn(), deleteMany: jest.fn(), createMany: jest.fn() },
      department: { findFirst: jest.fn() },
      $transaction: jest.fn(),
    };
    prisma.$transaction.mockImplementation(async (callback: (tx: any) => Promise<any>) => callback(prisma));
    audit = {
      log: jest.fn().mockResolvedValue(undefined),
      logWithClient: jest.fn().mockResolvedValue({ id: 'audit-1' }),
    };
    passwordCredentials = {
      assertConfirmation: jest.fn((password: string, confirmation: string) => {
        if (password !== confirmation) throw new BadRequestException();
      }),
      preparePassword: jest.fn().mockResolvedValue({
        passwordHash: 'next-hash',
        policy: { minLength: 8 },
      }),
    };
    service = new UsersService(
      prisma as PrismaService,
      audit as AuditService,
      passwordCredentials as PasswordCredentialService,
    );
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
      expect(passwordCredentials.preparePassword).toHaveBeenCalledWith(
        'Secret123!',
        'Secret123!',
        { passwordField: 'password', confirmationField: 'password' },
      );
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

  describe('resetPassword', () => {
    const dto = {
      newPassword: 'NextSecret123!',
      confirmNewPassword: 'NextSecret123!',
    };

    it('rejects self-reset before reading or mutating a target', async () => {
      await expect(
        service.resetPassword('actor-1', dto, 'actor-1', ctx),
      ).rejects.toMatchObject({
        response: { messageKey: 'auth.adminResetSelfDenied' },
      });
      expect(prisma.user.findFirst).not.toHaveBeenCalled();
      expect(prisma.user.updateMany).not.toHaveBeenCalled();
    });

    it('rejects confirmation mismatch before reading or mutating a target', async () => {
      await expect(
        service.resetPassword(
          'u1',
          { ...dto, confirmNewPassword: 'Different123!' },
          'actor-1',
          ctx,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.user.findFirst).not.toHaveBeenCalled();
      expect(prisma.user.updateMany).not.toHaveBeenCalled();
    });

    it('treats a cross-tenant target id as not found', async () => {
      prisma.user.findFirst.mockResolvedValue(null);

      await expect(
        service.resetPassword('foreign-user', dto, 'actor-1', ctx),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.user.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            id: 'foreign-user',
            companyId: 'company-a',
            branchId: 'branch-a',
          }),
        }),
      );
      expect(prisma.user.updateMany).not.toHaveBeenCalled();
    });

    it('requires a SUPER_ADMIN actor when the scoped target is SUPER_ADMIN', async () => {
      prisma.user.findFirst.mockResolvedValue(
        user({
          roles: [
            {
              role: {
                code: 'SUPER_ADMIN',
                status: 'ACTIVE',
                deletedAt: null,
              },
            },
          ],
        }),
      );
      prisma.userRole.findFirst.mockResolvedValue(null);

      await expect(
        service.resetPassword('u1', dto, 'actor-1', ctx),
      ).rejects.toMatchObject({
        response: { messageKey: 'auth.privilegedResetRequiresSuperAdmin' },
      });
      expect(prisma.user.updateMany).not.toHaveBeenCalled();
    });

    it('updates exactly the scoped target, revokes sessions, and creates a truthful actor audit atomically', async () => {
      const target = user();
      prisma.user.findFirst
        .mockResolvedValueOnce(target)
        .mockResolvedValueOnce(target);
      prisma.user.updateMany.mockResolvedValue({ count: 1 });

      const result = await service.resetPassword('u1', dto, 'actor-1', ctx);

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(prisma.user.updateMany).toHaveBeenCalledWith({
        where: {
          id: 'u1',
          passwordHash: 'hashed',
          companyId: 'company-a',
          branchId: 'branch-a',
          status: 'ACTIVE',
          deletedAt: null,
        },
        data: {
          passwordHash: 'next-hash',
          passwordChangedAt: expect.any(Date),
          authVersion: { increment: 1 },
        },
      });
      expect(audit.logWithClient).toHaveBeenCalledWith(
        prisma,
        expect.objectContaining({
          userId: 'actor-1',
          action: 'ADMIN_PASSWORD_RESET',
          entityId: 'u1',
          details: expect.objectContaining({
            targetUserId: 'u1',
            companyId: 'company-a',
            branchId: 'branch-a',
            sessionsRevoked: true,
          }),
        }),
      );
      expect(result).toEqual({
        messageKey: 'auth.adminPasswordResetSuccess',
        message: 'Password reset successfully',
        targetUserId: 'u1',
        sessionsRevoked: true,
      });
      expect(result).not.toHaveProperty('password');
      expect(result).not.toHaveProperty('passwordHash');
    });

    it('does not report success when the required audit event fails', async () => {
      const target = user();
      prisma.user.findFirst
        .mockResolvedValueOnce(target)
        .mockResolvedValueOnce(target);
      prisma.user.updateMany.mockResolvedValue({ count: 1 });
      audit.logWithClient.mockRejectedValue(new Error('audit unavailable'));

      await expect(
        service.resetPassword('u1', dto, 'actor-1', ctx),
      ).rejects.toThrow('audit unavailable');
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    });
  });
});
