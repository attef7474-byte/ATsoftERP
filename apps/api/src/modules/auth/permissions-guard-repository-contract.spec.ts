import { readdirSync, readFileSync, statSync } from 'fs';
import { join, relative } from 'path';

/**
 * Repository contract: exactly ONE real `PermissionsGuard` implementation must
 * exist in the API source tree, and no source file may import the removed
 * `common/guards/permissions.guard` path.
 *
 * Source-only scan. Ignores comments, spec/test files, and re-export shims so that
 * a future regression that reintroduces a second real implementation fails this test.
 */

const SRC_DIR = join(__dirname, '..', '..');
const CANONICAL_GUARD = join('modules', 'auth', 'guards', 'permissions.guard.ts');
const REMOVED_DUPLICATE = 'common/guards/permissions.guard';

function listSourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) out.push(...listSourceFiles(full));
    else if (entry.endsWith('.ts')) out.push(full);
  }
  return out;
}

/** Strips line and block comments so commented-out code is not counted. */
function stripComments(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

describe('PermissionsGuard repository contract', () => {
  const files = listSourceFiles(SRC_DIR).map((abs) => ({
    rel: relative(SRC_DIR, abs).replace(/\\/g, '/'),
    text: readFileSync(abs, 'utf8'),
  }));

  it('has exactly ONE real PermissionsGuard class implementation in source (excluding tests)', () => {
    const definitions = files.filter(
      ({ rel, text }) => !rel.endsWith('.spec.ts') && /class\s+PermissionsGuard\s+implements\s+CanActivate/.test(stripComments(text)),
    );
    expect(definitions.map((d) => d.rel)).toEqual([CANONICAL_GUARD.replace(/\\/g, '/')]);
    expect(definitions).toHaveLength(1);
  });

  it('no source file imports the removed duplicate guard path', () => {
    const offenders = files
      .filter(({ text }) => /from\s+['"][^'"]*common\/guards\/permissions\.guard['"]/.test(stripComments(text)))
      .map((f) => f.rel);
    expect(offenders).toEqual([]);
  });

  it('the removed duplicate guard file does not exist', () => {
    expect(files.some(({ rel }) => rel === `${REMOVED_DUPLICATE}.ts`)).toBe(false);
  });

  it('all PermissionsGuard imports resolve to the canonical auth/guards path', () => {
    const path = require('path') as typeof import('path');
    const importers = files.filter(
      ({ rel, text }) =>
        rel.endsWith('.ts') &&
        !rel.endsWith('.spec.ts') &&
        /from\s+['"][^'"]*permissions\.guard['"]/.test(stripComments(text)),
    );
    for (const { rel, text } of importers) {
      const match = stripComments(text).match(/from\s+['"]([^'"]*permissions\.guard)['"]/);
      expect(match).not.toBeNull();
      const resolved = path
        .relative(SRC_DIR, path.resolve(SRC_DIR, path.dirname(rel), `${match?.[1]}.ts`))
        .replace(/\\/g, '/');
      expect(resolved).toBe(CANONICAL_GUARD.replace(/\\/g, '/'));
    }
    expect(importers.length).toBeGreaterThan(0);
  });

  it('the canonical guard reads the shared PERMISSIONS_KEY constant (no magic string)', () => {
    const canonical = files.find(({ rel }) => rel === CANONICAL_GUARD.replace(/\\/g, '/'));
    expect(canonical).toBeDefined();
    const text = stripComments(canonical?.text ?? '');
    expect(text).toMatch(/import\s*\{[^}]*PERMISSIONS_KEY[^}]*\}/);
    expect(text).toMatch(/getAllAndOverride<string\[\]>\(PERMISSIONS_KEY/);
    expect(text).not.toMatch(/getAllAndOverride<string\[\]>\('permissions'/);
  });
});
