import { ForbiddenException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import { PermissionsGuard } from './permissions.guard';
import { PrismaService } from '../../../common/prisma/prisma.service';

describe('PermissionsGuard', () => {
  let guard: PermissionsGuard;
  let prisma: { userRole: { findMany: jest.Mock } };

  const activeRole = (code: string, permissionKeys: string[]) => ({
    role: {
      status: 'ACTIVE',
      code,
      permissions: permissionKeys.map((key) => ({
        permission: { status: 'ACTIVE', key },
      })),
    },
  });

  const inactiveRole = (code: string) => ({ role: { status: 'INACTIVE', code, permissions: [] } });

  const makeContext = (user: unknown, handler: () => void, target: object) =>
    ({
      switchToHttp: () => ({ getRequest: () => ({ user }) }),
      getHandler: () => handler,
      getClass: () => target,
    }) as any;

  beforeEach(async () => {
    prisma = { userRole: { findMany: jest.fn() } };
    const moduleRef = await Test.createTestingModule({
      providers: [Reflector, PermissionsGuard, { provide: PrismaService, useValue: prisma }],
    }).compile();
    guard = moduleRef.get(PermissionsGuard);
  });

  it('allows requests when no permissions metadata is defined', async () => {
    const handler = () => undefined;
    const ctx = makeContext({ id: 'u1' }, handler, {});
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
  });

  it('rejects requests without a user', async () => {
    const handler = () => undefined;
    Reflect.defineMetadata('permissions', ['installed-parts:read'], handler);
    const ctx = makeContext(undefined, handler, {});
    await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
  });

  it('allows when the user role has every required permission', async () => {
    const handler = () => undefined;
    Reflect.defineMetadata('permissions', ['installed-parts:read', 'maintenance-request:print'], handler);
    prisma.userRole.findMany.mockResolvedValue([
      activeRole('MAINTENANCE_TECHNICIAN', ['installed-parts:read', 'maintenance-request:print']),
    ]);
    const ctx = makeContext({ id: 'u1' }, handler, {});
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(prisma.userRole.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: 'u1' } }),
    );
  });

  it('denies when a required permission is missing', async () => {
    const handler = () => undefined;
    Reflect.defineMetadata('permissions', ['installed-parts:read'], handler);
    prisma.userRole.findMany.mockResolvedValue([activeRole('MAINTENANCE_TECHNICIAN', [])]);
    const ctx = makeContext({ id: 'u1' }, handler, {});
    await expect(guard.canActivate(ctx)).rejects.toMatchObject({
      response: { messageKey: 'auth.insufficientPermissions' },
    });
  });

  it('denies when the user has a partially matching permission set', async () => {
    const handler = () => undefined;
    Reflect.defineMetadata('permissions', ['maintenance-request:activity.view', 'maintenance-request:attachments.view'], handler);
    prisma.userRole.findMany.mockResolvedValue([
      activeRole('MAINTENANCE_TECHNICIAN', ['maintenance-request:activity.view']),
    ]);
    const ctx = makeContext({ id: 'u1' }, handler, {});
    await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
  });

  it('denies when the only matching role is inactive', async () => {
    const handler = () => undefined;
    Reflect.defineMetadata('permissions', ['installed-parts:read'], handler);
    prisma.userRole.findMany.mockResolvedValue([inactiveRole('MAINTENANCE_TECHNICIAN')]);
    const ctx = makeContext({ id: 'u1' }, handler, {});
    await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
  });

  it('bypasses permission checks for SUPER_ADMIN users without the required keys', async () => {
    const handler = () => undefined;
    Reflect.defineMetadata('permissions', ['installed-parts:read'], handler);
    prisma.userRole.findMany.mockResolvedValue([activeRole('SUPER_ADMIN', [])]);
    const ctx = makeContext({ id: 'u1' }, handler, {});
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
  });

  it('honors only permissions whose permission record is ACTIVE', async () => {
    const handler = () => undefined;
    Reflect.defineMetadata('permissions', ['installed-parts:read'], handler);
    prisma.userRole.findMany.mockResolvedValue([
      {
        role: {
          status: 'ACTIVE',
          code: 'MAINTENANCE_TECHNICIAN',
          permissions: [{ permission: { status: 'INACTIVE', key: 'installed-parts:read' } }],
        },
      },
    ]);
    const ctx = makeContext({ id: 'u1' }, handler, {});
    await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
  });

  it('aggregates keys across all active roles', async () => {
    const handler = () => undefined;
    Reflect.defineMetadata('permissions', ['installed-parts:read', 'maintenance-request:activity.view'], handler);
    prisma.userRole.findMany.mockResolvedValue([
      activeRole('MAINTENANCE_TECHNICIAN', ['installed-parts:read']),
      activeRole('MAINTENANCE_MANAGER', ['maintenance-request:activity.view']),
    ]);
    const ctx = makeContext({ id: 'u1' }, handler, {});
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
  });
});
