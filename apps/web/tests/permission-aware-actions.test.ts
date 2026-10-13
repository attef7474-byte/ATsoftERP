import * as fs from 'fs';
import * as path from 'path';
import { isPermissionGranted, canAll, canAny } from '../src/lib/permission-gate';

const webRoot = path.resolve(__dirname, '..');
const read = (rel: string) => fs.readFileSync(path.join(webRoot, rel), 'utf8');

describe('permission gate contract', () => {
  it('shows an unprotected control to every authenticated user', () => {
    expect(isPermissionGranted(undefined, [], false)).toBe(true);
    expect(isPermissionGranted(undefined, null, false)).toBe(true);
    expect(isPermissionGranted(null, [], false)).toBe(true);
  });

  it('denies a protected control while the permission payload is unresolved', () => {
    expect(isPermissionGranted('x:read', null, false)).toBe(false);
  });

  it('grants a protected control only when the exact key is held', () => {
    expect(isPermissionGranted('x:read', ['x:read'], false)).toBe(true);
    expect(isPermissionGranted('x:read', ['X:READ'], false)).toBe(false);
    expect(isPermissionGranted('x:read', ['x:write'], false)).toBe(false);
  });

  it('mirrors the API SUPER_ADMIN bypass', () => {
    expect(isPermissionGranted('x:read', [], true)).toBe(true);
    expect(isPermissionGranted('x:read', null, true)).toBe(true);
  });

  it('canAll requires every key and canAny requires one, deny-by-default while loading', () => {
    expect(canAll(['a:read'], ['a:read', 'b:read'], false)).toBe(false);
    expect(canAll(['a:read', 'b:read'], ['a:read', 'b:read'], false)).toBe(true);
    expect(canAny(['a:read'], ['a:read', 'b:read'], false)).toBe(true);
    expect(canAny([], ['a:read'], false)).toBe(false);
    expect(canAny(null, ['a:read'], false)).toBe(false);
    expect(canAny(null, ['a:read'], true)).toBe(true);
  });
});

describe('action visibility wiring', () => {
  it('AdminAction and GridAction both accept a permission contract', () => {
    expect(read('src/components/admin/admin-action-bar.tsx')).toMatch(/permission\?:\s*string/);
    expect(read('src/components/admin/datagrid/types.ts')).toMatch(/permission\?:\s*string/);
  });

  it('the admin action bar filters actions and hides itself when nothing is visible', () => {
    const shell = read('src/components/admin/shell/admin-shell.tsx');
    expect(shell).toContain('isPermissionGranted');
    expect(shell).toContain('visibleActions');
    expect(shell).toContain('actionBarShown');
    // Never renders the raw unfiltered list nor branches on a role name.
    expect(shell).not.toMatch(/actions\.map\(/);
    expect(shell).not.toMatch(/SUPER_ADMIN|Administrator|E2E_ROLE/);
  });

  it('the data grid filters row actions and drops the empty action column', () => {
    const grid = read('src/components/admin/datagrid/admin-data-grid.tsx');
    expect(grid).toContain('isPermissionGranted');
    expect(grid).toContain('visibleActions');
    expect(grid).toContain('hasActions = visibleActions.length > 0');
    expect(grid).toContain('actions={visibleActions}');
    expect(grid).not.toMatch(/Administrator|E2E_ROLE/);
  });

  it('keeps one reusable gate rather than a second authorization model', () => {
    const gate = read('src/lib/permission-gate.ts');
    expect(gate).toContain('isPermissionGranted');
    const nav = read('src/components/admin/shell/navigation-data.ts');
    expect(nav).toContain('isPermissionGranted');
  });
});
