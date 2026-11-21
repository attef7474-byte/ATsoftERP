import { existsSync, readdirSync, readFileSync, statSync } from 'fs';
import { basename, dirname, join, resolve } from 'path';
import { PHASE6_GOVERNANCE_PERMISSION_KEYS } from '../../../prisma/seed/seed-phase6-governance-permission-keys';

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
 * `KNOWN_UNSEEDED_LEGACY_KEYS` was an explicit, reviewed inventory of pre-existing
 * debt. Phase 6 reconciled every one of those keys into the canonical seed catalogue
 * (see `seed-phase6-governance-permission-keys.ts`), so the allowlist is now EMPTY and
 * this contract is a zero-tolerance hard gate: any enforced key the seed does not
 * declare fails the build. Keeping the empty set (instead of deleting the mechanism)
 * makes reintroducing debt an explicit, reviewable edit to this file.
 */

const SEED_DIR = join(__dirname, '..', '..', '..', 'prisma', 'seed');
const API_SRC = join(__dirname, '..', '..');

/**
 * Accepted unseeded legacy keys.
 *
 * Phase 6 eliminated all 61 former entries by seeding them canonically in
 * `prisma/seed/seed-phase6-governance-permission-keys.ts`. The set is intentionally
 * retained but EMPTY: any future enforced-but-unseeded key can no longer be hidden
 * here without an explicit, reviewed edit to this file.
 *
 * Earlier repairs for the `machines:*` typo, `users.loginHistory.view`, and
 * `products:*` are pinned by dedicated tests below and must never be re-added here.
 */
const KNOWN_UNSEEDED_LEGACY_KEYS = new Set<string>([]);

const PERMISSION_KEY_SHAPE = /^[a-zA-Z][a-zA-Z0-9_-]*[:.][a-zA-Z][a-zA-Z0-9_.:-]*$/;

function addPermissionKeyLiterals(source: string, keys: Set<string>, skipObjectPropertyValues: boolean): void {
  // Shape 1: object literals `{ key: "reports.operations:export", ... }`.
  for (const match of source.matchAll(/key:\s*['"]([^'"]+)['"]/g)) keys.add(match[1]);

  // Shape 2: bare string arrays and imported constants objects.
  for (const match of source.matchAll(/['"]([a-zA-Z][a-zA-Z0-9_-]*[:.][a-zA-Z][a-zA-Z0-9_.:-]*)['"]/g)) {
    const value = match[1];
    if (!PERMISSION_KEY_SHAPE.test(value)) continue;
    if (skipObjectPropertyValues) {
      // In seed files an object property value is not a permission declaration. Without
      // this check `{ key: "maintenance-request:attachments.view", action: "attachments.view" }`
      // would wrongly register a bare `attachments.view` key declared nowhere. Imported
      // constants modules intentionally declare keys as object properties, so they are
      // scanned without this exclusion.
      const before = source.slice(Math.max(0, match.index! - 12), match.index!);
      if (/\w+:\s*$/.test(before)) continue;
    }
    keys.add(value);
  }
}

function resolveImportedModule(specifier: string, fromFile: string): string | null {
  if (!specifier.startsWith('.')) return null;
  const base = resolve(dirname(fromFile), specifier);
  for (const candidate of [`${base}.ts`, join(base, 'index.ts')]) {
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

function collectSeededPermissionKeys(): Set<string> {
  const keys = new Set<string>();
  const scannedImports = new Set<string>();

  /**
   * Seeds declare keys either as literals in `prisma/seed/*.ts`, or through imported
   * `*constants*` / `*permission*` modules. Following the real import graph (including
   * transitive imports) is necessary: `reports.operations:export` is declared in
   * `src/modules/reports/operations-reports.constants.ts` and imported by
   * `seed-operations-reports-permission-keys.ts`. A literal-only seed scan would call
   * that enforced key unseeded even though the running seed grants it.
   */
  const scanImportedPermissionModules = (fromFile: string): void => {
    const source = readFileSync(fromFile, 'utf8');
    for (const match of source.matchAll(/from\s+['"]([^'"]+)['"]/g)) {
      const resolved = resolveImportedModule(match[1], fromFile);
      if (!resolved || scannedImports.has(resolved)) continue;
      if (!/(constants|permission)/i.test(basename(resolved))) continue;
      scannedImports.add(resolved);
      addPermissionKeyLiterals(readFileSync(resolved, 'utf8'), keys, false);
      scanImportedPermissionModules(resolved);
    }
  };

  for (const file of readdirSync(SEED_DIR)) {
    if (!file.endsWith('.ts')) continue;
    const seedFile = join(SEED_DIR, file);
    const source = readFileSync(seedFile, 'utf8');
    addPermissionKeyLiterals(source, keys, true);
    scanImportedPermissionModules(seedFile);
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

  it('keeps the known-unseeded allowlist empty (zero-tolerance hard gate)', () => {
    // Phase 6 reconciled every former debt entry. Any allowlist entry would now mask
    // a permanently-denied route, and any key that is no longer enforced would hide a
    // renamed route, so both conditions are asserted for the (empty) set.
    expect(KNOWN_UNSEEDED_LEGACY_KEYS.size).toBe(0);
    const stale = [...KNOWN_UNSEEDED_LEGACY_KEYS].filter(
      (key) => seeded.has(key) || !enforced.has(key),
    );
    expect(
      `Stale entries in KNOWN_UNSEEDED_LEGACY_KEYS (now seeded, or no longer enforced): [${stale.join(' | ')}]`,
    ).toBe('Stale entries in KNOWN_UNSEEDED_LEGACY_KEYS (now seeded, or no longer enforced): []');
  });

  it('seeds and wires all 61 Phase 6 reconciled governance keys', () => {
    // Guards against emptying the allowlist without actually declaring the keys, and
    // against declaring them in a standalone file that seed.ts never imports.
    expect(PHASE6_GOVERNANCE_PERMISSION_KEYS).toHaveLength(61);
    expect(new Set(PHASE6_GOVERNANCE_PERMISSION_KEYS).size).toBe(61);
    for (const key of PHASE6_GOVERNANCE_PERMISSION_KEYS) {
      expect(seeded.has(key)).toBe(true);
      expect(enforced.has(key)).toBe(true);
    }
    const seedSource = readFileSync(join(SEED_DIR, 'seed.ts'), 'utf8');
    expect(seedSource).toContain('PHASE6_GOVERNANCE_PERMISSIONS');
    expect(seedSource).toMatch(/\.\.\.PHASE6_GOVERNANCE_PERMISSIONS/);
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

  it('seeds the canonical plural products:* keys enforced by the product controllers', () => {
    // Direct regression pin for the product permission-catalog gap. ProductsController and
    // ProductCategoriesController enforce the plural `products:*` family, so it must be
    // declared, while the unused singular `product:*` matrix keys remain seeded.
    expect(seeded.has('products:read')).toBe(true);
    expect(seeded.has('products:create')).toBe(true);
    expect(seeded.has('products:update')).toBe(true);
    expect(seeded.has('products:delete')).toBe(true);
    for (const [key] of enforced) {
      if (key.startsWith('products:')) expect(seeded.has(key)).toBe(true);
    }
  });

  it('follows seed imports of permission constants modules', () => {
    // Regression pin for the parser gap: these keys are declared in imported constants
    // modules, not as literals in `prisma/seed/*.ts`. Missing them would either fail the
    // zero-tolerance gate for a genuinely seeded key or hide a real seed omission.
    for (const key of ['reports.operations:export', 'operational-cost-center:read']) {
      expect(seeded.has(key)).toBe(true);
    }
    // Only the operations key is enforced through a literal @Permissions decorator;
    // the cost-center key is enforced through an imported constants reference.
    expect(enforced.has('reports.operations:export')).toBe(true);
    const seedFiles = readdirSync(SEED_DIR).filter((file) => file.endsWith('.ts'));
    expect(seedFiles.some((file) => readFileSync(join(SEED_DIR, file), 'utf8').includes('OPERATIONS_REPORT_PERMISSIONS'))).toBe(true);
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