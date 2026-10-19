import * as fs from 'fs';
import * as path from 'path';
import {
  sidebarGroups,
  classifySidebarItem,
  type SidebarGroup,
} from '../src/components/admin/shell/navigation-data';
import { AUTHORITATIVE_PERMISSION_KEYS } from './permission-catalogue-data';

const repoRoot = path.resolve(__dirname, '..', '..', '..');
const webRoot = path.resolve(__dirname, '..');
const read = (rel: string) => fs.readFileSync(path.join(repoRoot, rel), 'utf8');

/** Every declared leaf entry, whether the group uses `items` or nested sections. */
const allEntries = (groups: SidebarGroup[]) =>
  groups.flatMap((g) => [
    ...(g.items ?? []),
    ...(g.children ?? []).flatMap((s) => s.items),
  ]);

function walk(dir: string, acc: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (fs.statSync(full).isDirectory()) walk(full, acc);
    else if (entry.endsWith('.ts')) acc.push(full);
  }
  return acc;
}

/**
 * The permission keys the API can actually enforce, extracted from the source it will
 * ship with: literals passed to `@Permissions(...)`, permission-shaped string constants
 * (controllers increasingly reference `*.constants.ts` objects rather than literals), and
 * the seed definitions under `prisma/seed`.
 *
 * The navigation must never advertise a key the backend cannot grant. This is the
 * inventory half of the contract; the runtime half lives in `isPermissionGranted`.
 */
function apiPermissionKeys(): Set<string> {
  const keys = new Set<string>();
  const shaped = /^[a-z][a-z0-9]*(?:[.-][a-z0-9]+)*:[a-z][a-z0-9.-]+$/;
  for (const dir of [
    path.join(repoRoot, 'apps', 'api', 'src'),
    path.join(repoRoot, 'apps', 'api', 'prisma', 'seed'),
  ]) {
    for (const file of walk(dir)) {
      const source = fs.readFileSync(file, 'utf8');
      for (const decorator of source.matchAll(/@Permissions\(([^)]*)\)/g)) {
        for (const literal of decorator[1].matchAll(/'([^']+)'/g)) keys.add(literal[1]);
      }
      for (const quoted of source.matchAll(/['"]([a-z][a-z0-9]*(?:[.-][a-z0-9]+)*:[a-z][a-z0-9.-]+)['"]/g)) {
        if (shaped.test(quoted[1])) keys.add(quoted[1]);
      }
    }
  }
  return keys;
}

describe('navigation permission inventory coverage', () => {
  const declared = allEntries(sidebarGroups);
  const declaredKeys = [
    ...new Set(
      declared
        .flatMap((e) => [e.permission, ...(e.permissions ?? [])])
        .filter((p): p is string => Boolean(p)),
    ),
  ];
  const catalogue = new Set(AUTHORITATIVE_PERMISSION_KEYS);
  const api = apiPermissionKeys();

  it('covers every sidebar leaf with an explicit access classification', () => {
    expect(declared.length).toBeGreaterThan(0);
    for (const entry of declared) {
      expect(classifySidebarItem(entry)).toMatch(/^(AUTHENTICATED|PERMISSION)$/);
    }
  });

  it('maps every protected entry to a key the backend can enforce or the catalogue defines', () => {
    const unresolved = declaredKeys.filter((key) => !catalogue.has(key) && !api.has(key));
    // unresolvedItems must be 0: a key the API never grants would hide the entry from
    // every non-super-admin operator, which is a worse defect than showing it.
    expect(unresolved).toEqual([]);
  });

  it('never declares a wildcard permission (the guard uses exact Set.has)', () => {
    for (const key of declaredKeys) expect(key).not.toContain('*');
  });

  it('requires roles:read and permissions:read for the Access Control entries', () => {
    const roles = declared.find((e) => e.route === '/admin/access/roles');
    const permissions = declared.find((e) => e.route === '/admin/access/permissions');
    expect(roles?.permission).toBe('roles:read');
    expect(permissions?.permission).toBe('permissions:read');
  });

  it('declares the maintenance spare-part issue permission its API route requires', () => {
    const entry = declared.find((e) => e.route === '/admin/maintenance/spare-part-issues');
    expect(entry?.permission).toBe('maintenance-stock-issue:read');
  });

  it('declares each unique key exactly once per route to avoid ambiguous gating', () => {
    const routes = declared.map((e) => e.route);
    expect(new Set(routes).size).toBe(routes.length);
  });
});
