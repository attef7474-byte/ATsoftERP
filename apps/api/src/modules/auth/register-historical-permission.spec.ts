import { ForbiddenException } from '@nestjs/common';
import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * registerHistorical permission policy — authorization pin.
 *
 * `maintenance-task:registerHistorical` is the privileged "register performed work
 * retroactively" key (opposite of live-task execution). The production policy is:
 *   - it must NOT be implied by any execution abilities (task create/start/join/
 *     complete, parts.issue, downtime.close);
 *   - only SUPER_ADMIN (guard bypass) or an explicitly granted role may pass.
 *
 * This spec pins (1) the exact single route/controller binding, (2) the seed
 * declaration, and (3) the guard decision semantics with the same allow/deny
 * behavior the real PermissionsGuard implements. It does not create business data.
 */

const CONTROLLER = join(
  __dirname,
  '..',
  '..',
  'modules',
  'factory',
  'maintenance',
  'maintenance-tasks',
  'maintenance-tasks.controller.ts',
);
const SEED_KEYS = join(
  __dirname,
  '..',
  '..',
  '..',
  'prisma',
  'seed',
  'seed-cmms-permission-keys.ts',
);

const KEY = 'maintenance-task:registerHistorical';

/** Execution abilities a maintenance technician/engineer legitimately holds. */
const EXECUTION_KEYS = [
  'maintenance-task:create',
  'maintenance-task:read',
  'maintenance-task:update',
  'maintenance-task:start',
  'maintenance-task:join',
  'maintenance-task:complete',
  'maintenance-task:cancel',
  'maintenance-task:delete',
  'maintenance-task:assign',
  'maintenance-task:byRequest',
  'maintenance-task:parts.issue',
  'maintenance-task:downtime.close',
];

type RoleRow = {
  code: string;
  status: string;
  permissions: { permission: { key: string; status: string } }[];
};

/** Mirrors PermissionsGuard lines 33-46 exactly. */
function decide(required: string[], roleRows: RoleRow[]): boolean {
  const keys = new Set<string>();
  for (const r of roleRows) {
    if (r.status !== 'ACTIVE') continue;
    if (r.code === 'SUPER_ADMIN') return true;
    for (const rp of r.permissions) {
      if (rp.permission.status === 'ACTIVE') keys.add(rp.permission.key);
    }
  }
  if (!required.every((p) => keys.has(p))) {
    throw new ForbiddenException({ messageKey: 'auth.insufficientPermissions', message: 'Insufficient permissions' });
  }
  return true;
}

function role(code: string, keys: string[], status = 'ACTIVE'): RoleRow {
  return { code, status, permissions: keys.map((key) => ({ permission: { key, status: 'ACTIVE' } })) };
}

function collectRights(required: string, roleRows: RoleRow[]): { allowed: boolean; thrown: boolean } {
  try {
    return { allowed: decide([required], roleRows), thrown: false };
  } catch (e) {
    if (e instanceof ForbiddenException) return { allowed: false, thrown: true };
    throw e;
  }
}

describe('registerHistorical permission policy', () => {
  it('binds the register-historical route to EXACTLY the registerHistorical key, once', () => {
    const source = readFileSync(CONTROLLER, 'utf8');
    const route = source.match(/@Post\('register-historical'\)([\s\S]*?)\n\s*(\w[\w$]*)\s*\(/);
    expect(route).toBeTruthy();
    expect(route![1]).toContain(`@Permissions('${KEY}')`);
    // exactly one enforcement site in this controller
    expect((source.match(/@Permissions\('maintenance-task:registerHistorical'\)/g) || []).length).toBe(1);
    // the route handler delegates to the service method of the same name
    expect(route![2]).toBe('registerHistorical');
  });

  it('declares the key in the maintenance-task seed catalogue for API-side enforcement', () => {
    const seed = readFileSync(SEED_KEYS, 'utf8');
    expect(seed).toContain(`{ key: "${KEY}", module: "maintenance-task", action: "registerHistorical" }`);
  });

  it('a role holding every execution ability BUT registerHistorical is DENIED', () => {
    const technician = role('TECHNICIAN', EXECUTION_KEYS);
    expect(collectRights(KEY, [technician])).toEqual({ allowed: false, thrown: true });
  });

  it('super-admin reaches the route through the role-code bypass', () => {
    expect(collectRights(KEY, [role('SUPER_ADMIN', [])])).toEqual({ allowed: true, thrown: false });
  });

  it('a role explicitly granted the key is ALLOWED', () => {
    expect(collectRights(KEY, [role('MAINTENANCE_AUDITOR', [...EXECUTION_KEYS, KEY])])).toEqual({
      allowed: true,
      thrown: false,
    });
  });

  it('an inactive grant does not resurrect itself', () => {
    const stale = role('INACTIVE_HOLDER', [KEY], 'INACTIVE');
    expect(collectRights(KEY, [stale])).toEqual({ allowed: false, thrown: true });
  });

  it('a disabled permission row does not satisfy the key', () => {
    const holder: RoleRow = {
      code: 'HOLDER',
      status: 'ACTIVE',
      permissions: [{ permission: { key: KEY, status: 'DISABLED' } }],
    };
    expect(collectRights(KEY, [holder])).toEqual({ allowed: false, thrown: true });
  });
});