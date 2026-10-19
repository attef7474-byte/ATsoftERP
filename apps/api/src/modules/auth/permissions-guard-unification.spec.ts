import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PermissionsGuard } from './guards/permissions.guard';
import { PERMISSIONS_KEY } from '../../common/decorators/permissions.decorator';
import { PrismaService } from '../../common/prisma/prisma.service';
import { PermissionCheckService } from '../../common/rbac/permission-check.service';
import { assertUserPermissions } from '../../common/permissions/assert-user-permissions';
import { ActiveContextInterceptor } from '../../common/operational-context/active-context.interceptor';
import { ActiveContextService } from '../../common/operational-context/active-context.service';
import {
  ARCHIVED_CONTEXT_MODE_HEADER,
  ARCHIVED_CONTEXT_MODE_VALUE,
} from '../../common/operational-context/archive-context.constants';

/**
 * Focused authorization-guard contract suite (G01–G20).
 *
 * Proves the single canonical `PermissionsGuard` contract after unification:
 * metadata key, ALL semantics, SUPER_ADMIN bypass, structured 403, 401/403
 * separation, deny-by-default, delegation parity, and archive separation
 * (archive mutation denial is owned by ActiveContextInterceptor, NOT the guard).
 */

type Role = { status: string; code: string; permissionKeys: Array<{ key: string; status: string }> };

function role(code: string, perms: Array<[string, string]> = [], status = 'ACTIVE'): Role {
  return { status, code, permissionKeys: perms.map(([key, s]) => ({ key, status: s })) };
}

function userRolesOf(roles: Role[]) {
  return roles.map((r) => ({
    role: {
      status: r.status,
      code: r.code,
      permissions: r.permissionKeys.map((p) => ({ permission: { key: p.key, status: p.status } })),
    },
  }));
}

function makeGuard(roles: Role[]) {
  const prisma = { userRole: { findMany: jest.fn().mockResolvedValue(userRolesOf(roles)) } };
  const guard = new PermissionsGuard(new Reflector(), prisma as unknown as PrismaService);
  return { guard, prisma };
}

function contextWith(user: unknown, metadataKeys?: string[], target: object = {}) {
  const handler = function handler() {};
  if (metadataKeys) Reflect.defineMetadata(PERMISSIONS_KEY, metadataKeys, handler);
  return {
    switchToHttp: () => ({ getRequest: () => ({ user, method: 'GET', headers: {} }) }),
    getHandler: () => handler,
    getClass: () => target,
  } as unknown as ExecutionContext;
}

async function responseOf(promise: Promise<unknown>): Promise<Record<string, unknown>> {
  try {
    await promise;
  } catch (error) {
    expect(error).toBeInstanceOf(ForbiddenException);
    const res = (error as ForbiddenException).getResponse();
    return (typeof res === 'string' ? { message: res } : (res as Record<string, unknown>));
  }
  throw new Error('expected the request to be rejected');
}

describe('PermissionsGuard unification contract (G01–G20)', () => {
  it('G01 denies when there is no authenticated user (403, not fail-open)', async () => {
    const { guard } = makeGuard([]);
    const res = await responseOf(guard.canActivate(contextWith(undefined, ['products:read'])));
    expect(res.messageKey).toBe('auth.noUserFound');
  });

  it('G02 allows an authenticated user holding the required permission', async () => {
    const { guard, prisma } = makeGuard([role('EDITOR', [['products:read', 'ACTIVE']])]);
    await expect(guard.canActivate(contextWith({ id: 'u2' }, ['products:read']))).resolves.toBe(true);
    expect(prisma.userRole.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: 'u2' } }));
  });

  it('G03 denies an authenticated user missing the permission (structured 403)', async () => {
    const { guard } = makeGuard([role('VIEWER', [])]);
    const res = await responseOf(guard.canActivate(contextWith({ id: 'u1' }, ['products:create'])));
    expect(res.messageKey).toBe('auth.insufficientPermissions');
  });

  it('G04 bypasses permission checks for an ACTIVE SUPER_ADMIN role', async () => {
    const { guard } = makeGuard([role('SUPER_ADMIN', [])]);
    await expect(guard.canActivate(contextWith({ id: 'admin' }, ['products:delete']))).resolves.toBe(true);
  });

  it('G05 does NOT bypass for a non-SUPER_ADMIN role', async () => {
    const { guard } = makeGuard([role('ADMIN', [['products:read', 'ACTIVE']])]);
    const res = await responseOf(guard.canActivate(contextWith({ id: 'u1' }, ['products:delete'])));
    expect(res.messageKey).toBe('auth.insufficientPermissions');
  });

  it('G06 enforces a single required permission met by its exact key', async () => {
    const { guard } = makeGuard([role('R', [['inventory:update', 'ACTIVE']])]);
    await expect(guard.canActivate(contextWith({ id: 'u1' }, ['inventory:update']))).resolves.toBe(true);
  });

  it('G07 requires ALL declared permissions (no ANY-of, no wildcard inheritance)', async () => {
    const { guard } = makeGuard([role('R', [['machines:read', 'ACTIVE']])]);
    const res = await responseOf(guard.canActivate(contextWith({ id: 'u1' }, ['machines:read', 'machines:update'])));
    expect(res.messageKey).toBe('auth.insufficientPermissions');
    const { guard: g2 } = makeGuard([role('R', [['inventory:update', 'ACTIVE'], ['inventory:*', 'ACTIVE']])]);
    const res2 = await responseOf(g2.canActivate(contextWith({ id: 'u1' }, ['inventory-valuation:activate'])));
    expect(res2.messageKey).toBe('auth.insufficientPermissions');
  });

  it('G08 allows (defers) when no permission metadata is declared', async () => {
    const { guard } = makeGuard([]);
    await expect(guard.canActivate(contextWith({ id: 'u1' }))).resolves.toBe(true);
  });

  it('G09/G10 returns a structured ForbiddenException with message + messageKey (403 contract)', async () => {
    const { guard } = makeGuard([role('VIEWER', [])]);
    const res = await responseOf(guard.canActivate(contextWith({ id: 'u1' }, ['products:read'])));
    expect(res.messageKey).toBe('auth.insufficientPermissions');
    expect(res.message).toBe('Insufficient permissions');
  });

  it('G11 preserves the 401-vs-403 distinction (guard always yields 403, never 401)', async () => {
    const { guard } = makeGuard([role('VIEWER', [])]);
    try {
      await guard.canActivate(contextWith({ id: 'u1' }, ['products:read']));
      throw new Error('expected rejection');
    } catch (error) {
      expect(error).toBeInstanceOf(ForbiddenException);
      expect((error as ForbiddenException).getStatus()).toBe(403);
    }
  });

  it('G17/G23 delegates the same decision as PermissionCheckService (one evaluation path)', async () => {
    const roles = [role('R', [['products:read', 'ACTIVE'], ['products:update', 'ACTIVE']])];
    const prisma = { userRole: { findMany: jest.fn().mockResolvedValue(userRolesOf(roles)) } };
    const guard = new PermissionsGuard(new Reflector(), prisma as unknown as PrismaService);
    const svc = new PermissionCheckService(prisma as unknown as PrismaService);
    expect(await guard.canActivate(contextWith({ id: 'u1' }, ['products:update']))).toBe(true);
    expect(await svc.hasAll('u1', ['products:update'])).toBe(true);
    expect(await svc.hasAll('u1', ['products:delete'])).toBe(false);
  });

  it('G18 propagates a thrown service error without fail-open', async () => {
    const prisma = { userRole: { findMany: jest.fn().mockRejectedValue(new Error('db down')) } };
    const guard = new PermissionsGuard(new Reflector(), prisma as unknown as PrismaService);
    await expect(guard.canActivate(contextWith({ id: 'u1' }, ['products:read']))).rejects.toThrow('db down');
  });

  it('G19 denies when the matching role is INACTIVE or the permission is INACTIVE (deny-by-default)', async () => {
    const { guard } = makeGuard([role('R', [['products:read', 'ACTIVE']], 'INACTIVE')]);
    await expect(guard.canActivate(contextWith({ id: 'u1' }, ['products:read']))).rejects.toThrow(ForbiddenException);
    const { guard: g2 } = makeGuard([role('R', [['products:read', 'INACTIVE']])]);
    await expect(g2.canActivate(contextWith({ id: 'u1' }, ['products:read']))).rejects.toThrow(ForbiddenException);
  });

  it('G20 uses the shared PERMISSIONS_KEY metadata contract (same key as decorators)', () => {
    expect(PERMISSIONS_KEY).toBe('permissions');
  });

  it('G16 keeps tenant/context out of the guard (guard performs no tenant validation)', () => {
    const src = PermissionsGuard.prototype.canActivate.toString();
    expect(src).not.toMatch(/companyId|branchId|invalidRelationship/);
  });
});

/**
 * G12–G15 / G26 — Archive read-only governance is owned by ActiveContextInterceptor,
 * NOT by PermissionsGuard. These prove the separation the unification must preserve.
 */
describe('Archive governance separation after guard unification (G12–G15)', () => {
  function interceptorFor(request: Record<string, unknown>, archiveResult: unknown) {
    const reflector = { getAllAndOverride: jest.fn(() => undefined) } as unknown as Reflector;
    const service = {
      validate: jest.fn(),
      validateArchived: jest.fn().mockResolvedValue(archiveResult),
      assertRequestMatches: jest.fn().mockResolvedValue(undefined),
    };
    return {
      interceptor: new ActiveContextInterceptor(reflector, service as unknown as ActiveContextService),
      executionContext: {
        getType: () => 'http',
        getHandler: () => function h() {},
        getClass: () => class C {},
        switchToHttp: () => ({ getRequest: () => request }),
      } as unknown as ExecutionContext,
      next: { handle: jest.fn().mockReturnValue('handled') },
    };
  }

  const archivedCtx = { contextKey: 'c:b:-:-', isArchived: true, archivedAncestors: [] };
  const authz = (isSuperAdmin: boolean, permissions: string[]) => ({
    context: archivedCtx,
    authorization: { roles: [], permissions, isSuperAdmin },
  });

  const archiveHeaders = () => ({
    [ARCHIVED_CONTEXT_MODE_HEADER]: ARCHIVED_CONTEXT_MODE_VALUE,
    'x-active-company-id': 'company_1',
    'x-active-branch-id': 'branch_1',
  });

  it('G12 allows an archive-capable reader to GET in archived mode', async () => {
    const request = { method: 'GET', headers: archiveHeaders(), user: { id: 'u' }, body: {}, query: {} };
    const { interceptor, executionContext, next } = interceptorFor(request, authz(false, ['company:readArchive']));
    await expect(interceptor.intercept(executionContext, next as never)).resolves.toBe('handled');
  });

  it('G13 denies an archived read without the archive read permission', async () => {
    const request = { method: 'GET', headers: archiveHeaders(), user: { id: 'u' }, body: {}, query: {} };
    const { interceptor, executionContext, next } = interceptorFor(request, authz(false, []));
    await expect(interceptor.intercept(executionContext, next as never)).rejects.toThrow(ForbiddenException);
  });

  it('G14 denies an archived MUTATION (POST) for a non-super-admin', async () => {
    const request = { method: 'POST', headers: archiveHeaders(), user: { id: 'u' }, body: {}, query: {} };
    const { interceptor, executionContext, next } = interceptorFor(request, authz(false, ['company:readArchive']));
    await expect(interceptor.intercept(executionContext, next as never)).rejects.toThrow(ForbiddenException);
  });

  it('G15 denies an archived MUTATION (POST) even for a SUPER_ADMIN (archive read-only)', async () => {
    const request = { method: 'POST', headers: archiveHeaders(), user: { id: 'admin' }, body: {}, query: {} };
    const { interceptor, executionContext, next } = interceptorFor(request, authz(true, []));
    await expect(interceptor.intercept(executionContext, next as never)).rejects.toThrow(ForbiddenException);
  });

  it('G15b confirms PermissionsGuard does not implement archive logic (separation preserved)', () => {
    const src = PermissionsGuard.prototype.canActivate.toString();
    expect(src).not.toMatch(/archive|readOnly/i);
  });
});

/**
 * G17b — assertUserPermissions (in-transaction secondary check) uses the same
 * canonical 403 contract as the guard.
 */
describe('assertUserPermissions contract parity (G17b)', () => {
  it('throws the same messageKey for a missing permission', async () => {
    const client = { userRole: { findMany: jest.fn().mockResolvedValue([]) } };
    await expect(assertUserPermissions(client, 'u1', ['products:read'])).rejects.toMatchObject({
      response: { messageKey: 'auth.insufficientPermissions' },
    });
  });

  it('short-circuits for an ACTIVE SUPER_ADMIN role', async () => {
    const client = {
      userRole: { findMany: jest.fn().mockResolvedValue(userRolesOf([role('SUPER_ADMIN', [])])) },
    };
    await expect(assertUserPermissions(client, 'admin', ['products:delete'])).resolves.toBeUndefined();
  });
});
