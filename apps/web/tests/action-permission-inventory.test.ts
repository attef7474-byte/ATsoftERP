import * as fs from 'fs';
import * as path from 'path';
import { AUTHORITATIVE_PERMISSION_KEYS } from './permission-catalogue-data';

const repoRoot = path.resolve(__dirname, '..', '..', '..');
const webSrc = path.join(repoRoot, 'apps', 'web', 'src');

function walk(dir: string, acc: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (fs.statSync(full).isDirectory()) walk(full, acc);
    else if (entry.endsWith('.tsx') || entry.endsWith('.ts')) acc.push(full);
  }
  return acc;
}

const shaped = /^[A-Za-z][A-Za-z0-9._-]*[.:][A-Za-z0-9._:-]+$/;

/** Permission keys the API can enforce, from `@Permissions(...)`, permission-shaped
 * literals, and the seed definitions. Keep this in step with the navigation inventory. */
function apiPermissionKeys(): Set<string> {
  const keys = new Set<string>();
  for (const dir of [
    path.join(repoRoot, 'apps', 'api', 'src'),
    path.join(repoRoot, 'apps', 'api', 'prisma', 'seed'),
  ]) {
    for (const file of walk(dir)) {
      const source = fs.readFileSync(file, 'utf8');
      for (const decorator of source.matchAll(/@Permissions\(([^)]*)\)/g)) {
        for (const literal of decorator[1].matchAll(/'([^']+)'/g)) keys.add(literal[1]);
      }
      for (const quoted of source.matchAll(/['"]([A-Za-z][A-Za-z0-9._-]*[.:][A-Za-z0-9._:-]+)['"]/g)) {
        if (shaped.test(quoted[1])) keys.add(quoted[1]);
      }
    }
  }
  return keys;
}

describe('action permission inventory', () => {
  const declared = new Set<string>();
  const files = walk(webSrc);
  for (const file of files) {
    const source = fs.readFileSync(file, 'utf8');
    // AdminAction/GridAction declarations: `permission: 'roles:update'`
    for (const m of source.matchAll(/\bpermission:\s*'([^']+)'/g)) if (shaped.test(m[1])) declared.add(m[1]);
    // PermissionActionButton and similar props: `permission="roles:update"`
    for (const m of source.matchAll(/\bpermission="([^"]+)"/g)) if (shaped.test(m[1])) declared.add(m[1]);
  }

  const catalogue = new Set(AUTHORITATIVE_PERMISSION_KEYS);
  const api = apiPermissionKeys();

  it('finds the Access Control action contracts already annotated', () => {
    for (const key of ['roles:create', 'roles:update', 'roles:delete']) {
      expect(declared.has(key)).toBe(true);
    }
  });

  it('never declares a wildcard permission', () => {
    for (const key of declared) expect(key).not.toContain('*');
  });

  it('maps every declared action permission to a key the backend can enforce or the catalogue defines', () => {
    const unresolved = [...declared].filter((key) => !catalogue.has(key) && !api.has(key));
    expect(unresolved).toEqual([]);
  });
});
