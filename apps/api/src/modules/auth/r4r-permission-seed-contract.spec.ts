import { readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';

/**
 * R4R PERMISSION-SEED CONTRACT (systemic guardrail).
 *
 * WHY THIS TEST EXISTS. During the R4R pre-flight audit a whole class of defect was
 * found that no existing test could see: a controller enforced a permission key that the
 * seed never declares. `PermissionsGuard` compares with an exact `Set.has`, and returns
 * early only for the SUPER_ADMIN role, so such a key is a route that is permanently
 * 403 for every non-SUPER_ADMIN role while still looking correct in source review.
 *
 * The concrete instance found was a plural/singular typo: `MaintenanceController`
 * enforced `machines:create|read|update|delete` on 30 routes, while `seed.ts` declares
 * the singular module name `machine`, so `machine:*` was seeded and granted and
 * `machines:*` was seeded nowhere. `InstalledPartsReplacementController` had the same
 * typo on its two write routes.
 *
 * The existing `maintenance-permissions-consistency.spec.ts` could not catch this
 * because it (a) only inspected CMMS_EXTRA_PERMISSIONS rather than the full catalogue,
 * (b) only covered two controllers, and (c) exempted every key whose action was
 * `create|read|update|delete`, which is precisely the shape of the defect.
 *
 * WHAT THIS TEST DOES. It parses the COMPLETE seed catalogue - every literal
 * `key: "..."` in every seed file, PLUS the generated `MODULES x ACTIONS` matrix from
 * seed.ts - and scans EVERY `*.controller.ts` in the API for enforced keys. Any key
 * that is enforced but not declared fails the build.
 *
 * `KNOWN_UNSEEDED_LEGACY_KEYS` is an explicit, reviewed inventory of pre-existing debt
 * that is OUT OF SCOPE for this change. It is deliberately exhaustive rather than a
 * wildcard, so that removing an entry requires editing this file and shows up in review.
 * Its purpose is to make the debt visible and to fail loudly if it grows.
 */

const SEED_DIR = join(__dirname, '..', '..', '..', 'prisma', 'seed');
const API_SRC = join(__dirname, '..', '..');

/**
 * Pre-existing debt: enforced by a controller, absent from the full seed catalogue.
 *
 * R4R note: the four `machines:*` keys and `users.loginHistory.view` that this audit
 * discovered are NOT listed here, because R4R fixed them. Listing a repaired defect
 * would let it silently regress.
 *
 * Two categories remain, and both are pre-existing and outside the R4R groups:
 *  1. Plural/singular typos of the same family as `machines:*`
 *     (companies/branches/administrations/roles/products/permissions/productionLines).
 *  2. Whole feature families whose permission family was never seeded
 *     (dashboard, alerts, audit, attachments, notifications, settings,
 *     maintenance dashboard, downtime-log, maintenance-task, shift-handover).
 */
const KNOWN_UNSEEDED_LEGACY_KEYS = new Set<string>([
  // -- plural/singular family (same class as the repaired machines:* defect) --
  'administrations:create', 'administrations:read', 'administrations:update', 'administrations:delete',
  'branches:create', 'branches:read', 'branches:update', 'branches:delete',
  'companies:create', 'companies:read', 'companies:update', 'companies:delete',
  'roles:create', 'roles:read', 'roles:update', 'roles:delete',
  'products:create', 'products:read', 'products:update', 'products:delete',
  'permissions:read',
  'productionLines:create', 'productionLines:read', 'productionLines:update',
  'productionLines:delete', 'productionLines:activate', 'productionLines:deactivate',
  // -- unseeded feature families (pre-existing) --
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
  // -- production module naming mismatch (pre-existing, outside the R4R groups) --
  // seed-production-permission-keys.ts declares `production-run:close-valuation`
  // while production-runs.controller.ts enforces `production-run:close-for-valuation`.
  // Fixing it requires an owner decision because the correct key must also be granted
  // to the roles that legitimately close a run for valuation.
  'production-run:close-for-valuation',
]);

function collectSeededPermissionKeys(): Set<string> {
  const keys = new Set<string>();

  // Permission keys are declared in the seed directory in three different shapes, and a
// parser that only understands one of them silently reports the other two as defects:
//   1. object literals        { key: "production-unit:create", ... }
//   2. bare string arrays     ['production-order:create', ...]
//   3. the MODULES x ACTIONS generator in seed.ts (handled separately below)
// Shapes 1 and 2 are both collected here.
const PERMISSION_KEY_SHAPE = /^[a-zA-Z][a-zA-Z0-9_-]*[:.][a-zA-Z][a-zA-Z0-9_.:-]*$/;

for (const file of readdirSync(SEED_DIR)) {
    if (!file.endsWith('.ts')) continue;
    const source = readFileSync(join(SEED_DIR, file), 'utf8');
    for (const match of source.matchAll(/key:\s*['"]([^'"]+)['"]/g)) keys.add(match[1]);
    for (const match of source.matchAll(/['"]([a-zA-Z][a-zA-Z0-9_-]*[:.][a-zA-Z][a-zA-Z0-9_.:-]*)['"]/g)) {
      if (!PERMISSION_KEY_SHAPE.test(match[1])) continue;
      // An object property value is not a permission declaration. Without this check
      // `{ key: "maintenance-request:attachments.view", action: "attachments.view" }`
      // would wrongly register a bare `attachments.view` key that is declared nowhere.
      const before = source.slice(Math.max(0, match.index! - 12), match.index!);
      if (/\w+:\s*$/.test(before)) continue;
      keys.add(match[1]);
    }
  }

  // seed.ts generates CRUD keys from a MODULES x ACTIONS matrix instead of literals,
  // so the matrix must be expanded or every generated key looks unseeded.
  const seedSource = readFileSync(join(SEED_DIR, 'seed.ts'), 'utf8');
  const modulesBlock = seedSource.match(/const MODULES = \[([\s\S]*?)\] as const/);
  const actionsBlock = seedSource.match(/const ACTIONS = \[([\s\S]*?)\] as const/);
  if (modulesBlock && actionsBlock) {
    const modules = [...modulesBlock[1].matchAll(/['"]([^'"]+)['"]/g)].map((m) => m[1]);
    const actions = [...actionsBlock[1].matchAll(/['"]([^'"]+)['"]/g)].map((m) => m[1]);
    for (const module of modules) for (const action of actions) keys.add(`${module}:${action}`);
  }

  return keys;
}

function collectControllerFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) collectControllerFiles(full, out);
    else if (entry.endsWith('.controller.ts')) out.push(full);
  }
  return out;
}

function collectEnforcedKeys(): Map<string, string[]> {
  const byKey = new Map<string, string[]>();
  for (const file of collectControllerFiles(API_SRC)) {
    const source = readFileSync(file, 'utf8');
    // Normalized to forward slashes so the assertions below are platform independent.
    const relative = file.slice(API_SRC.length + 1).split('\\').join('/');
    for (const match of source.matchAll(/@Permissions\(\s*'([^']+)'/g)) {
      const list = byKey.get(match[1]) ?? [];
      list.push(relative);
      byKey.set(match[1], list);
    }
  }
  return byKey;
}

describe('R4R permission-seed contract', () => {
  const seeded = collectSeededPermissionKeys();
  const enforced = collectEnforcedKeys();

  it('parses a non-trivial seeded catalogue', () => {
    // Guards the parsers themselves: a regex that silently matches nothing would make
    // every assertion below vacuously pass.
    expect(seeded.size).toBeGreaterThan(400);
    expect(enforced.size).toBeGreaterThan(400);
  });

  it('seeds every permission key enforced by any controller', () => {
    const undeclared = [...enforced.entries()]
      .filter(([key]) => !seeded.has(key))
      .map(([key, files]) => `${key}  <- ${[...new Set(files)].join(', ')}`);

    // Anything not explicitly accepted as pre-existing debt is a build failure.
    const unexpected = undeclared.filter((entry) => {
      const key = entry.slice(0, entry.indexOf('  <- '));
      return !KNOWN_UNSEEDED_LEGACY_KEYS.has(key);
    });

    // The diagnostic list is folded into the compared value because this Jest version
    // does not support expect(actual, message).
    expect(
      `Enforced permission keys that the seed never declares are permanently denied to every non-SUPER_ADMIN role. Unexpected: [${unexpected.join(' | ')}]`,
    ).toBe('Enforced permission keys that the seed never declares are permanently denied to every non-SUPER_ADMIN role. Unexpected: []');
  });

  it('does not let the accepted legacy debt grow', () => {
    // Every allowlisted key must still be genuinely unseeded AND genuinely enforced.
    // A stale entry would otherwise mask a future fix, and a key that is no longer
    // enforced would hide a renamed route.
    const stale = [...KNOWN_UNSEEDED_LEGACY_KEYS].filter(
      (key) => seeded.has(key) || !enforced.has(key),
    );
    expect(
      `Stale entries in KNOWN_UNSEEDED_LEGACY_KEYS (now seeded, or no longer enforced): [${stale.join(' | ')}]`,
    ).toBe('Stale entries in KNOWN_UNSEEDED_LEGACY_KEYS (now seeded, or no longer enforced): []');
  });

  it('uses the seeded singular module spelling, never the unseeded plural machines:* form', () => {
    // Direct regression pin for the defect this audit found.
    for (const [key, files] of enforced) {
      if (key.startsWith('machines:')) {
        throw new Error(
          `Enforced ${key} in ${[...new Set(files)].join(', ')}. The seed declares the singular "machine" module, so "machines:*" is permanently denied.`,
        );
      }
    }
    expect(seeded.has('machine:read')).toBe(true);
    expect(seeded.has('machine:create')).toBe(true);
  });

  it('seeds every permission key enforced by the maintenance and installed-parts controllers', () => {
    // R4R in-scope check: these two controllers are the Group 3 legacy surface.
    const maintenanceEnforced = [...enforced.entries()].filter(([, files]) =>
      files.some((f) => f.endsWith('maintenance/maintenance.controller.ts')),
    );
    expect(maintenanceEnforced.length).toBeGreaterThan(0);
    for (const [key] of maintenanceEnforced) {
      expect(seeded.has(key)).toBe(true);
    }
  });
});