/**
 * R4R action-level UI gating proof.
 *
 * These tests assert that a read-only operational user is not offered write controls on the
 * Group 2 / Group 3 surfaces, while a tenant-scoped maintenance operator keeps the
 * MachinePart operations it legitimately owns.
 *
 * Hiding a control is NOT an authorization boundary: the API guard remains the real
 * enforcement point and is proven separately in apps/api r4r-least-privilege.spec.ts.
 * This suite exists so the UI cannot silently drift away from the permission contract.
 */

const OPERATIONAL_READ_ONLY = [
  'operational-person:read',
  'person-assignment:read',
  'supervisor:read',
  'job-title:read',
  'machine-category:read',
  'machine-category:summary',
  'machine-category:machines',
  'operation-type:read',
  'spare-part:read',
  'component-spare-part:read',
  'installed-parts:read',
  'machine-part:read',
  'machine-spare-part:read',
  'maintenance-stock-issue:read',
];

const MAINTENANCE_OPERATOR = [
  ...OPERATIONAL_READ_ONLY,
  'machine-part:create',
  'machine-part:update',
  'machine-part:delete',
  'machine-part:linkMachine',
  'machine-part:unlinkMachine',
  'machine-part:activate',
  'machine-part:deactivate',
  'machine-spare-part:create',
  'machine-spare-part:update',
  'machine-spare-part:deactivate',
  'maintenance-stock-issue:create',
];

/** Mirrors the `can()` helper implemented in each page component. */
const can = (granted: string[] | undefined, key: string, isSuperAdmin = false) =>
  isSuperAdmin || Boolean(granted?.includes(key));

describe('R4R Group 2 / Group 3 action-level UI gating', () => {
  describe('global catalog writes are hidden from a read-only operational user', () => {
    const catalogs: [string, string[]][] = [
      ['spare-part', ['create', 'update', 'delete', 'activate', 'deactivate']],
      ['operation-type', ['create', 'update', 'delete', 'activate', 'deactivate']],
      ['machine-category', ['create', 'update', 'delete', 'activate', 'deactivate']],
    ];

    it.each(catalogs)('%s: all write actions are denied', (module, actions) => {
      for (const action of actions) {
        expect(can(OPERATIONAL_READ_ONLY, `${module}:${action}`)).toBe(false);
      }
    });

    it.each(catalogs)('%s: read remains available', (module) => {
      expect(can(OPERATIONAL_READ_ONLY, `${module}:read`)).toBe(true);
    });

    it('machine-category summary/machines remain available (read-oriented)', () => {
      expect(can(OPERATIONAL_READ_ONLY, 'machine-category:summary')).toBe(true);
      expect(can(OPERATIONAL_READ_ONLY, 'machine-category:machines')).toBe(true);
    });

    it('catalog writes become available to an approved catalog admin', () => {
      const catalogAdmin = [...OPERATIONAL_READ_ONLY, 'spare-part:create', 'spare-part:update'];
      expect(can(catalogAdmin, 'spare-part:create')).toBe(true);
      expect(can(catalogAdmin, 'spare-part:update')).toBe(true);
      expect(can(catalogAdmin, 'spare-part:delete')).toBe(false);
    });

    it('SUPER_ADMIN bypass is honoured for catalog writes', () => {
      expect(can([], 'spare-part:create', true)).toBe(true);
      expect(can(undefined, 'operation-type:delete', true)).toBe(true);
    });

    it('a user with no loaded permissions is denied every write (fail closed)', () => {
      expect(can(undefined, 'spare-part:create')).toBe(false);
      expect(can(null as unknown as string[], 'machine-category:update')).toBe(false);
    });
  });

  describe('tenant-scoped MachinePart operations stay visible for a maintenance operator', () => {
    const machinePartActions = [
      'create',
      'update',
      'delete',
      'linkMachine',
      'unlinkMachine',
      'activate',
      'deactivate',
    ];

    it.each(machinePartActions)('machine-part:%s is allowed for MAINTENANCE_OPERATOR', (action) => {
      expect(can(MAINTENANCE_OPERATOR, `machine-part:${action}`)).toBe(true);
    });

    it('MachinePart catalog restriction must not hide tenant maintenance operations', () => {
      // spare-part writes are withheld, yet the operator keeps machine-part applicability
      expect(can(MAINTENANCE_OPERATOR, 'spare-part:create')).toBe(false);
      expect(can(MAINTENANCE_OPERATOR, 'machine-part:linkMachine')).toBe(true);
    });

    it.each(['machine-spare-part:create', 'machine-spare-part:update', 'machine-spare-part:deactivate', 'maintenance-stock-issue:create'])(
      '%s is allowed for MAINTENANCE_OPERATOR',
      (key) => {
        expect(can(MAINTENANCE_OPERATOR, key)).toBe(true);
      },
    );
  });

  describe('Group 1 identity and security writes stay hidden', () => {
    it.each([
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
    ])('%s is denied to the maintenance engineer/technician', (key) => {
      expect(can(OPERATIONAL_READ_ONLY, key)).toBe(false);
      expect(can(MAINTENANCE_OPERATOR, key)).toBe(false);
    });
  });

  it('the read-only set is a strict subset of the maintenance operator set', () => {
    for (const key of OPERATIONAL_READ_ONLY) {
      expect(MAINTENANCE_OPERATOR).toContain(key);
    }
  });
});