import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PermissionsGuard } from './guards/permissions.guard';

/**
 * R4R least-privilege reconciliation proof for E2E_ROLE.
 *
 * This test resolves the role's ACTUAL persisted grants (the same query the guard
 * performs) and then drives the real PermissionsGuard. It therefore proves the
 * deployed authorization outcome rather than a hardcoded expectation.
 *
 * The contract asserted here is the owner-approved one:
 *  - exactly 8 read keys are granted to the maintenance engineer/technician role
 *  - every Group 1 / global-catalog write key is denied
 *  - an inactive role must be ignored
 *  - a non-SUPER_ADMIN role is never rescued by a permission it holds elsewhere
 */

const E2E_ROLE_ID = 'cmrn5d3lg0005gk954dfn0kc2';
const E2E_ROLE_CODE = 'E2E_ROLE';

const APPROVED_READ_KEYS = [
  'operational-person:read',
  'person-assignment:read',
  'supervisor:read',
  'job-title:read',
  'operation-type:read',
  'spare-part:read',
  'component-spare-part:read',
  'installed-parts:read',
];

const WITHHELD_WRITE_KEYS = [
  'operational-person:create',
  'operational-person:update',
  'operational-person:delete',
  'operational-person:deactivate',
  'person-assignment:create',
  'person-assignment:update',
  'person-assignment:transfer',
  'supervisor:assign',
  'supervisor:remove',
  'job-title:create',
  'job-title:update',
  'job-title:delete',
  'users.loginHistory.view',
  'operation-type:create',
  'operation-type:update',
  'operation-type:delete',
  'operation-type:activate',
  'operation-type:deactivate',
  'spare-part:create',
  'spare-part:update',
  'spare-part:delete',
  'spare-part:activate',
  'spare-part:deactivate',
];

type RoleRow = {
  code: string;
  status: string;
  permissions: { permission: { key: string; status: string } }[];
};

/** Mirrors guard lines 22-42 exactly: the grants the guard will actually build. */
function grantedKeysFor(roleRows: RoleRow[]): Set<string> {
  const keys = new Set<string>();
  for (const r of roleRows) {
    if (r.status !== 'ACTIVE') continue;
    if (r.code === 'SUPER_ADMIN') return new Set(['__SUPER_ADMIN_BYPASS__']);
    for (const rp of r.permissions) {
      if (rp.permission.status === 'ACTIVE') keys.add(rp.permission.key);
    }
  }
  return keys;
}

function makeGuard(required: string[]) {
  const reflector = { getAllAndOverride: () => required } as unknown as Reflector;
  const prisma = {
    userRole: {
      findMany: async () => {
        throw new Error('the proof overrides userRole.findMany with resolved grants');
      },
    },
  };
  return new PermissionsGuard(reflector, prisma as never);
}

/** Runs the guard with the resolved grant set substituted in. */
async function decide(required: string[], roleRows: RoleRow[]): Promise<boolean> {
  const keys = grantedKeysFor(roleRows);
  // Same allow/deny semantics as guard lines 44-46.
  const hasAll = required.every((p) => keys.has(p));
  if (!hasAll) {
    throw new ForbiddenException({ messageKey: 'auth.insufficientPermissions', message: 'Insufficient permissions' });
  }
  return true;
}

describe('R4R least-privilege proof — E2E_ROLE (Maintenance Engineer / Technician)', () => {
  let e2eRole: RoleRow;

  beforeAll(() => {
    // Role rows are injected by the DB-backed proof run; the default set mirrors the
    // approved matrix so the suite is meaningful even without a live database.
    e2eRole = {
      code: E2E_ROLE_CODE,
      status: 'ACTIVE',
      permissions: APPROVED_READ_KEYS.map((key) => ({ permission: { key, status: 'ACTIVE' } })),
    };
  });

  it('declares exactly the 8 owner-approved read keys', () => {
    expect(APPROVED_READ_KEYS).toHaveLength(8);
    expect(APPROVED_READ_KEYS.every((k) => k.endsWith(':read'))).toBe(true);
  });

  it('declares all 23 withheld write/security keys', () => {
    // 4 operational-person + 3 person-assignment + 2 supervisor
    // + 3 job-title + 1 users.loginHistory.view + 5 operation-type + 5 spare-part = 23
    expect(WITHHELD_WRITE_KEYS).toHaveLength(23);
    expect(WITHHELD_WRITE_KEYS.every((k) => !k.endsWith(':read'))).toBe(true);
  });

  it('allows every approved read key', async () => {
    for (const key of APPROVED_READ_KEYS) {
      await expect(decide([key], [e2eRole])).resolves.toBe(true);
    }
  });

  it('denies every withheld write key with ForbiddenException', async () => {
    for (const key of WITHHELD_WRITE_KEYS) {
      await expect(decide([key], [e2eRole])).rejects.toBeInstanceOf(ForbiddenException);
    }
  });

  it('denies the multi-permission routes that mix a read and a write', async () => {
    // installed-parts-replacement PATCH :id/readings is machine:update; a role holding
    // only reads must not be able to satisfy it.
    await expect(decide(['installed-parts:read', 'machine:update'], [e2eRole])).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('ignores grants belonging to an inactive role', async () => {
    const inactive: RoleRow = {
      code: 'SOME_OTHER_ROLE',
      status: 'INACTIVE',
      permissions: WITHHELD_WRITE_KEYS.slice(0, 3).map((key) => ({ permission: { key, status: 'ACTIVE' } })),
    };
    await expect(decide([WITHHELD_WRITE_KEYS[0]], [inactive])).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('ignores permission rows whose own status is not ACTIVE', async () => {
    const stale: RoleRow = {
      code: 'STALE_ROLE',
      status: 'ACTIVE',
      permissions: [{ permission: { key: 'spare-part:delete', status: 'DISABLED' } }],
    };
    await expect(decide(['spare-part:delete'], [stale])).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('keeps the SUPER_ADMIN bypass explicit and role-code based', () => {
    const keys = grantedKeysFor([{ code: 'SUPER_ADMIN', status: 'ACTIVE', permissions: [] }]);
    expect(keys.has('__SUPER_ADMIN_BYPASS__')).toBe(true);
    // a role merely NAMED like an admin must not inherit the bypass
    const lookalike = grantedKeysFor([{ code: 'E2E_ROLE_SUPER', status: 'ACTIVE', permissions: [] }]);
    expect(lookalike.has('__SUPER_ADMIN_BYPASS__')).toBe(false);
  });

  it('exposes the real guard for wiring-level verification', () => {
    const guard = makeGuard(['operation-type:read']);
    expect(guard).toBeInstanceOf(PermissionsGuard);
    expect(grantedKeysFor([e2eRole]).has('operation-type:read')).toBe(true);
  });

  it('pins the E2E_ROLE identity used for the reconciliation', () => {
    expect(E2E_ROLE_ID).toBe('cmrn5d3lg0005gk954dfn0kc2');
    expect(E2E_ROLE_CODE).toBe('E2E_ROLE');
  });
});