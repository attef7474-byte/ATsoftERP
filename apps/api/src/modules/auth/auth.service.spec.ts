import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ActiveContextService } from '../../common/operational-context/active-context.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { PasswordCredentialService } from '../settings/security/password-credential.service';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  let prisma: any;
  let jwtService: { sign: jest.Mock };
  let activeContextService: {
    getAuthorization: jest.Mock;
    getAllowedContexts: jest.Mock;
    validate: jest.Mock;
  };
  let auditService: { logWithClient: jest.Mock; log: jest.Mock };
  let passwordCredentials: {
    verify: jest.Mock;
    assertConfirmation: jest.Mock;
    preparePassword: jest.Mock;
    getPolicy: jest.Mock;
  };
  let service: AuthService;

  const activeUser = (overrides: Record<string, unknown> = {}) => ({
    id: 'user-a',
    email: 'operator@example.test',
    name: 'Operator',
    passwordHash: 'stored-password-hash',
    authVersion: 0,
    status: 'ACTIVE',
    deletedAt: null,
    companyId: 'company-a',
    branchId: 'branch-a',
    departmentId: null,
    phone: null,
    avatar: null,
    lastLoginAt: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    roles: [],
    ...overrides,
  });

  const context = (companyId: string, branchId: string) => ({
    contextKey: [companyId, branchId, '-', '-'].join(':'),
    scopeId: ['scope', companyId, branchId].join('-'),
    companyId,
    companyName: companyId,
    companyCode: companyId,
    branchId,
    branchName: branchId,
    branchCode: branchId,
    administrationId: null,
    administrationName: null,
    administrationCode: null,
    departmentId: null,
    departmentName: null,
    departmentCode: null,
    isDefault: true,
    source: 'EXPLICIT_SCOPE',
  });

  beforeEach(() => {
    prisma = {
      user: {
        findFirst: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      userRole: {
        findMany: jest.fn(),
      },
      $transaction: jest.fn(),
    };
    prisma.$transaction.mockImplementation(async (callback: (tx: any) => Promise<any>) => callback(prisma));
    jwtService = { sign: jest.fn() };
    activeContextService = {
      getAuthorization: jest.fn(),
      getAllowedContexts: jest.fn(),
      validate: jest.fn(),
    };
    auditService = { logWithClient: jest.fn().mockResolvedValue({ id: 'audit-1' }), log: jest.fn().mockResolvedValue({ id: 'audit-2' }) };
    passwordCredentials = {
      verify: jest.fn(),
      assertConfirmation: jest.fn((password: string, confirmation: string) => {
        if (password !== confirmation) throw new BadRequestException();
      }),
      preparePassword: jest.fn().mockResolvedValue({
        passwordHash: 'new-password-hash',
        policy: { minLength: 8 },
      }),
      getPolicy: jest.fn(),
    };
    service = new AuthService(
      prisma as unknown as PrismaService,
      jwtService as unknown as JwtService,
      activeContextService as unknown as ActiveContextService,
      auditService as unknown as AuditService,
      passwordCredentials as unknown as PasswordCredentialService,
    );
    jest.clearAllMocks();
  });

  describe('login', () => {
    it('rejects unknown credentials without comparing or mutating a user', async () => {
      prisma.user.findFirst.mockResolvedValue(null);

      await expect(
        service.login({ email: 'missing@example.test', password: 'Secret123!' }),
      ).rejects.toMatchObject({
        response: { messageKey: 'auth.invalidCredentials' },
      });
      expect(passwordCredentials.verify).not.toHaveBeenCalled();
      expect(prisma.user.update).not.toHaveBeenCalled();
      expect(jwtService.sign).not.toHaveBeenCalled();
    });

    it('rejects inactive users before checking the supplied password', async () => {
      prisma.user.findFirst.mockResolvedValue(
        activeUser({ status: 'INACTIVE' }),
      );

      await expect(
        service.login({
          email: 'operator@example.test',
          password: 'Secret123!',
        }),
      ).rejects.toMatchObject({
        response: { messageKey: 'auth.userInactive' },
      });
      expect(passwordCredentials.verify).not.toHaveBeenCalled();
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('rejects an invalid password without updating last-login state', async () => {
      prisma.user.findFirst.mockResolvedValue(activeUser());
      passwordCredentials.verify.mockResolvedValue(false);

      await expect(
        service.login({
          email: 'operator@example.test',
          password: 'WrongSecret123!',
        }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      expect(prisma.user.update).not.toHaveBeenCalled();
      expect(jwtService.sign).not.toHaveBeenCalled();
    });

    it('updates last-login state and returns a signed token without password data', async () => {
      prisma.user.findFirst.mockResolvedValue(activeUser());
      prisma.user.update.mockResolvedValue(activeUser());
      passwordCredentials.verify.mockResolvedValue(true);
      jwtService.sign.mockReturnValue('signed-jwt');

      const result = await service.login({
        email: 'operator@example.test',
        password: 'Secret123!',
      });

      expect(prisma.user.findFirst).toHaveBeenCalledWith({
        where: {
          email: 'operator@example.test',
          deletedAt: null,
        },
      });
      expect(passwordCredentials.verify).toHaveBeenCalledWith(
        'Secret123!',
        'stored-password-hash',
      );
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-a' },
        data: { lastLoginAt: expect.any(Date) },
      });
      expect(jwtService.sign).toHaveBeenCalledWith({
        sub: 'user-a',
        email: 'operator@example.test',
        authVersion: 0,
      });
      expect(result).toEqual({
        accessToken: 'signed-jwt',
        user: {
          id: 'user-a',
          email: 'operator@example.test',
          name: 'Operator',
        },
      });
      expect(result.user).not.toHaveProperty('passwordHash');
    });
  });

  describe('getProfile', () => {
    it('rejects a missing or inactive profile before resolving authorization', async () => {
      prisma.user.findFirst.mockResolvedValue(null);

      await expect(service.getProfile('missing-user')).rejects.toMatchObject({
        response: { messageKey: 'auth.userNotFound' },
      });
      expect(activeContextService.getAuthorization).not.toHaveBeenCalled();
      expect(activeContextService.getAllowedContexts).not.toHaveBeenCalled();
    });

    it('returns only active role assignments and active permission records', async () => {
      prisma.user.findFirst.mockResolvedValue(
        activeUser({
          roles: [
            {
              role: {
                id: 'role-active',
                code: 'OPERATOR',
                name: 'Operator',
                status: 'ACTIVE',
                deletedAt: null,
                permissions: [
                  {
                    permission: {
                      id: 'permission-active',
                      key: 'dashboard.view',
                      status: 'ACTIVE',
                    },
                  },
                  {
                    permission: {
                      id: 'permission-inactive',
                      key: 'legacy.permission',
                      status: 'INACTIVE',
                    },
                  },
                ],
              },
            },
            {
              role: {
                id: 'role-inactive',
                code: 'OLD_ROLE',
                name: 'Old role',
                status: 'INACTIVE',
                deletedAt: null,
                permissions: [],
              },
            },
          ],
        }),
      );
      const firstContext = context('company-a', 'branch-a');
      const secondContext = context('company-a', 'branch-b');
      activeContextService.getAuthorization.mockResolvedValue({
        roles: [{ id: 'role-active', code: 'OPERATOR', name: 'Operator' }],
        permissions: ['dashboard.view'],
        isSuperAdmin: false,
      });
      activeContextService.getAllowedContexts.mockResolvedValue({
        contexts: [firstContext, secondContext],
        defaultContext: firstContext,
      });

      const result = await service.getProfile('user-a');

      expect(result.roles).toHaveLength(1);
      expect(result.roles[0].role.code).toBe('OPERATOR');
      expect(result.roles[0].role.permissions).toEqual([
        expect.objectContaining({
          permission: expect.objectContaining({
            key: 'dashboard.view',
            status: 'ACTIVE',
          }),
        }),
      ]);
      expect(result.permissions).toEqual(['dashboard.view']);
      expect(result.allowedContexts).toHaveLength(2);
      expect(result.defaultContext).toEqual(firstContext);
      expect(result.currentContextStatus).toBe('SELECTION_REQUIRED');
      expect(activeContextService.getAuthorization).toHaveBeenCalledWith(
        'user-a',
      );
      expect(activeContextService.getAllowedContexts).toHaveBeenCalledWith(
        'user-a',
      );
    });
  });

  describe('authorization and operational context', () => {
    it('deduplicates permissions and reports the SUPER_ADMIN role', async () => {
      prisma.userRole.findMany.mockResolvedValue([
        {
          role: {
            id: 'role-operator',
            code: 'OPERATOR',
            name: 'Operator',
            status: 'ACTIVE',
            deletedAt: null,
            permissions: [
              {
                permission: {
                  key: 'dashboard.view',
                  status: 'ACTIVE',
                },
              },
            ],
          },
        },
        {
          role: {
            id: 'role-super',
            code: 'SUPER_ADMIN',
            name: 'Super admin',
            status: 'ACTIVE',
            deletedAt: null,
            permissions: [
              {
                permission: {
                  key: 'dashboard.view',
                  status: 'ACTIVE',
                },
              },
              {
                permission: {
                  key: 'users:read',
                  status: 'ACTIVE',
                },
              },
            ],
          },
        },
      ]);

      const result = await service.getUserPermissions('user-a');

      expect(prisma.userRole.findMany).toHaveBeenCalledWith({
        where: {
          userId: 'user-a',
          role: { status: 'ACTIVE', deletedAt: null },
        },
        include: {
          role: {
            include: {
              permissions: {
                include: { permission: true },
                where: { permission: { status: 'ACTIVE' } },
              },
            },
          },
        },
      });
      expect(result.permissions).toEqual(['dashboard.view', 'users:read']);
      expect(result.isSuperAdmin).toBe(true);
    });

    it('delegates context validation with the authenticated user and exact tenant selection', async () => {
      const selectedContext = context('company-a', 'branch-a');
      activeContextService.validate.mockResolvedValue(selectedContext);

      const result = await service.validateOperationalContext('user-a', {
        companyId: 'company-a',
        branchId: 'branch-a',
        administrationId: null,
        departmentId: null,
      });

      expect(activeContextService.validate).toHaveBeenCalledWith('user-a', {
        companyId: 'company-a',
        branchId: 'branch-a',
        administrationId: null,
        departmentId: null,
      });
      expect(result).toEqual({ valid: true, context: selectedContext });
    });
  });

  describe('changePassword', () => {
    it('rejects mismatched confirmation without reading or updating the user', async () => {
      await expect(
        service.changePassword('user-a', {
          currentPassword: 'Current123!',
          newPassword: 'NextSecret123!',
          confirmNewPassword: 'Different123!',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.user.findFirst).not.toHaveBeenCalled();
      expect(prisma.user.updateMany).not.toHaveBeenCalled();
    });

    it('hashes and stores a confirmed password only after verifying the current password', async () => {
      prisma.user.findFirst.mockResolvedValue(activeUser());
      passwordCredentials.verify.mockResolvedValue(true);
      prisma.user.updateMany.mockResolvedValue({ count: 1 });

      await expect(
        service.changePassword('user-a', {
          currentPassword: 'Current123!',
          newPassword: 'NextSecret123!',
          confirmNewPassword: 'NextSecret123!',
        }),
      ).resolves.toEqual({
        messageKey: 'auth.passwordChanged',
        message: 'Password changed successfully',
        sessionsRevoked: true,
      });
      expect(passwordCredentials.verify).toHaveBeenCalledWith(
        'Current123!',
        'stored-password-hash',
      );
      expect(passwordCredentials.preparePassword).toHaveBeenCalledWith(
        'NextSecret123!',
        'NextSecret123!',
      );
      expect(prisma.user.updateMany).toHaveBeenCalledWith({
        where: {
          id: 'user-a',
          passwordHash: 'stored-password-hash',
          status: 'ACTIVE',
          deletedAt: null,
        },
        data: {
          passwordHash: 'new-password-hash',
          passwordChangedAt: expect.any(Date),
          authVersion: { increment: 1 },
        },
      });
      expect(auditService.logWithClient).toHaveBeenCalledWith(
        prisma,
        expect.objectContaining({
          userId: 'user-a',
          action: 'PASSWORD_CHANGE',
          entityId: 'user-a',
        }),
      );
    });

    it('rolls back the password change when the required audit event fails', async () => {
      prisma.user.findFirst.mockResolvedValue(activeUser());
      passwordCredentials.verify.mockResolvedValue(true);
      prisma.user.updateMany.mockResolvedValue({ count: 1 });
      auditService.logWithClient.mockRejectedValue(new Error('audit unavailable'));

      await expect(
        service.changePassword('user-a', {
          currentPassword: 'Current123!',
          newPassword: 'NextSecret123!',
          confirmNewPassword: 'NextSecret123!',
        }),
      ).rejects.toThrow('audit unavailable');
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    });
  });

  describe('logout', () => {
    it('does NOT increment authVersion (normal logout is client-side only)', async () => {
      await expect(service.logout('user-a')).resolves.toEqual({
        messageKey: 'auth.loggedOut',
        message: 'Logged out successfully',
      });
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('creates audit record for logout', async () => {
      await service.logout('user-a');
      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'LOGOUT', userId: 'user-a' }),
      );
    });

    it('logout on device A does NOT invalidate device B token', async () => {
      await service.logout('user-a');
      expect(prisma.user.update).not.toHaveBeenCalled();
    });
  });
});
