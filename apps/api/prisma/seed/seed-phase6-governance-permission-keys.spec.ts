import { readFileSync } from 'fs';
import { join } from 'path';
import {
  PHASE6_GOVERNANCE_PERMISSION_KEYS,
  PHASE6_GOVERNANCE_PERMISSIONS,
} from './seed-phase6-governance-permission-keys';

/**
 * The 61 keys formerly carried as `KNOWN_UNSEEDED_LEGACY_KEYS` in
 * src/modules/auth/r4r-permission-seed-contract.spec.ts. Pinning the exact set here
 * keeps the Phase 6 reconciliation exhaustive and makes accidental removal visible.
 */
const FORMERLY_UNSEEDED_KEYS = [
  'administrations:create', 'administrations:read', 'administrations:update', 'administrations:delete',
  'branches:create', 'branches:read', 'branches:update', 'branches:delete',
  'companies:create', 'companies:read', 'companies:update', 'companies:delete',
  'roles:create', 'roles:read', 'roles:update', 'roles:delete',
  'permissions:read',
  'productionLines:create', 'productionLines:read', 'productionLines:update',
  'productionLines:delete', 'productionLines:activate', 'productionLines:deactivate',
  'alerts.view',
  'attachments.view', 'attachments.create', 'attachments.update', 'attachments.delete', 'attachments.download',
  'audit:read',
  'dashboard.view', 'dashboard.operations.view',
  'notifications:read', 'notifications:delete', 'notifications:dispatch', 'notifications:mark-read',
  'settings:read', 'settings:create', 'settings:update',
  'settings.language.view', 'settings.language.manage',
  'settings.security.view', 'settings.security.manage',
  'settings.notifications.view', 'settings.notifications.manage',
  'maintenance-schedule:history.view',
  'maintenance-task:myTasks.view', 'maintenance-task:overdue.view',
  'maintenance.dashboard.view', 'maintenance.dashboard.openRequests.view',
  'maintenance.dashboard.overdue.view', 'maintenance.dashboard.critical.view',
  'maintenance.dashboard.currentDowntime.view',
  'maintenance.dashboard.machinesUnderMaintenance.view',
  'maintenance.dashboard.accountabilityKpis.view', 'maintenance.dashboard.costKpis.view',
  'maintenance.dashboard.slaOverdue.view', 'maintenance.dashboard.slaEscalated.view',
  'maintenance.dashboard.upcomingPreventive.view',
  'maintenance.dashboard.recentGeneratedPreventive.view',
  'maintenance.dashboard.recentEmergency.view',
];

describe('Phase 6 governance permission keys', () => {
  it('contains exactly the 61 formerly unseeded legacy keys', () => {
    expect(FORMERLY_UNSEEDED_KEYS).toHaveLength(61);
    expect([...PHASE6_GOVERNANCE_PERMISSION_KEYS].sort()).toEqual([...FORMERLY_UNSEEDED_KEYS].sort());
  });

  it('has no duplicate keys', () => {
    expect(new Set(PHASE6_GOVERNANCE_PERMISSION_KEYS).size).toBe(PHASE6_GOVERNANCE_PERMISSION_KEYS.length);
  });

  it('derives module and action from the last separator so dotted namespaces are preserved', () => {
    expect(PHASE6_GOVERNANCE_PERMISSIONS).toHaveLength(PHASE6_GOVERNANCE_PERMISSION_KEYS.length);
    for (const record of PHASE6_GOVERNANCE_PERMISSIONS) {
      const separator = record.key.lastIndexOf(':') >= 0 ? ':' : '.';
      const index = record.key.lastIndexOf(separator);
      expect(record).toEqual({
        key: record.key,
        module: record.key.slice(0, index),
        action: record.key.slice(index + 1),
      });
    }
    expect(PHASE6_GOVERNANCE_PERMISSIONS.find((p) => p.key === 'maintenance.dashboard.view')).toEqual({
      key: 'maintenance.dashboard.view',
      module: 'maintenance.dashboard',
      action: 'view',
    });
    expect(PHASE6_GOVERNANCE_PERMISSIONS.find((p) => p.key === 'productionLines:activate')).toEqual({
      key: 'productionLines:activate',
      module: 'productionLines',
      action: 'activate',
    });
  });

  it('is imported and spread into seed.ts extraPermissions for SUPER_ADMIN grant-all', () => {
    const seedSource = readFileSync(join(__dirname, 'seed.ts'), 'utf8');
    expect(seedSource).toMatch(/import\s*\{[^}]*PHASE6_GOVERNANCE_PERMISSIONS[^}]*\}\s*from\s*["']\.\/seed-phase6-governance-permission-keys["']/);
    const extraPermissionsBlock = seedSource.slice(
      seedSource.indexOf('const extraPermissions = ['),
      seedSource.indexOf('for (const p of extraPermissions)'),
    );
    expect(extraPermissionsBlock).toContain('...PHASE6_GOVERNANCE_PERMISSIONS');
  });
});
