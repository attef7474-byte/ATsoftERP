import {
  sidebarGroups,
  isSidebarItemVisible,
  filterSidebarGroups,
  SidebarGroup,
} from '../src/components/admin/shell/navigation-data';
import * as fs from 'fs';
import * as path from 'path';

const webRoot = path.resolve(__dirname, '..');
const read = (rel: string) => fs.readFileSync(path.join(webRoot, rel), 'utf8');

const group = (overrides: Partial<SidebarGroup>): SidebarGroup =>
  ({ id: 'g', labelKey: 'navigation.dashboard', icon: 'dashboard', ...overrides } as SidebarGroup);

/** Every declared leaf entry, whether the group uses `items` or nested sections. */
const allEntries = (groups: SidebarGroup[]) =>
  groups.flatMap((g) => [
    ...(g.items ?? []),
    ...(g.children ?? []).flatMap((s) => s.items),
  ]);

/**
 * R4R — navigation must not advertise a module the operator cannot reach.
 *
 * The API already enforces permissions on every route, so the missing menu guard was a
 * presentation defect rather than a security hole: an operator without
 * `maintenance-stock-issue:read` was still shown a Spare Part Issue link and only
 * discovered the denial after clicking it. Every entry therefore declares the
 * permission its API route requires, and both navigations render the filtered tree.
 *
 * The filter MUST match the API guard exactly. `PermissionsGuard` compares seeded keys
 * with `Set.has` (case-sensitive, exact), and `/auth/me/permissions` returns
 * `rp.permission.key` verbatim. A case-insensitive menu filter would advertise modules
 * the API then denies, which is the defect this work removes.
 */
describe('navigation permission filtering', () => {
  it('the Spare Part Issue entry declares the permission its API route requires', () => {
    const entry = allEntries(sidebarGroups).find((c) => c.route === '/admin/maintenance/spare-part-issues');
    expect(entry).toBeDefined();
    expect(entry?.permission).toBe('maintenance-stock-issue:read');
  });

  it('every declared navigation permission uses the seeded namespace:verb key form', () => {
    const declared = [
      ...sidebarGroups.map((g) => g.permission),
      ...allEntries(sidebarGroups).map((e) => e.permission),
    ].filter((p): p is string => Boolean(p));

    expect(declared.length).toBeGreaterThan(0);
    for (const permission of declared) {
      // Seeded keys look like `spare-part:read` and `reports.operations:read`.
      expect(permission).toMatch(/^[a-z0-9.-]+:[a-z0-9-]+$/);
      // A wildcard can never satisfy the guard's exact Set.has comparison, so it must
      // not be used as a menu hint.
      expect(permission).not.toContain('*');
    }
  });

  it('hides an entry when the permission is absent from the granted set', () => {
    const groups = [group({ route: '/x', permission: 'x:read' })];
    expect(filterSidebarGroups(groups, [], false)).toHaveLength(0);
  });

  it('shows an entry when the permission is granted', () => {
    const groups = [group({ route: '/x', permission: 'x:read' })];
    expect(filterSidebarGroups(groups, ['x:read'], false)).toHaveLength(1);
  });

  it('SUPER_ADMIN sees every declared entry even without an explicit grant', () => {
    const groups = [group({ route: '/x', permission: 'x:read' })];
    expect(filterSidebarGroups(groups, [], true)).toHaveLength(1);
  });

  it('an unresolved permission payload renders the full menu instead of hiding everything', () => {
    const groups = [group({ route: '/x', permission: 'x:read' })];
    expect(filterSidebarGroups(groups, null, false)).toHaveLength(1);
  });

  it('an entry with no declared permission stays visible, preserving existing behaviour', () => {
    const groups = [group({ route: '/x' })];
    expect(filterSidebarGroups(groups, [], false)).toHaveLength(1);
  });

  it('drops a section and a group that end up with no visible item', () => {
    const groups = [
      group({
        children: [
          { id: 's1', labelKey: 'a', items: [{ id: 'i1', labelKey: 'a1', route: '/a', permission: 'a:read' }] },
          { id: 's2', labelKey: 'b', items: [{ id: 'i2', labelKey: 'b1', route: '/b', permission: 'b:read' }] },
        ],
      }),
    ];
    expect(filterSidebarGroups(groups, [], false)).toHaveLength(0);
    const partial = filterSidebarGroups(groups, ['a:read'], false);
    expect(partial).toHaveLength(1);
    expect(partial[0].children).toHaveLength(1);
  });

  it('matches permissions case-sensitively, exactly like the API guard', () => {
    // A case-insensitive match here would advertise a module PermissionsGuard denies.
    const groups = [group({ route: '/x', permission: 'x:read' })];
    expect(filterSidebarGroups(groups, ['X:READ'], false)).toHaveLength(0);
    expect(filterSidebarGroups(groups, ['x:read'], false)).toHaveLength(1);
  });

  it('never filters on a raw permission count or role name', () => {
    for (const file of ['src/components/admin/shell/sidebar.tsx', 'src/components/admin/shell/mobile-menu.tsx']) {
      const source = read(file);
      expect(source).toContain('filterSidebarGroups');
      expect(source).not.toMatch(/sidebarGroups\.map/);
      expect(source).not.toMatch(/sidebarGroups\.flatMap/);
      expect(source).not.toContain('SUPER_ADMIN');
    }
  });

  it('both navigations read the authenticated permission set and the super-admin flag', () => {
    for (const file of ['src/components/admin/shell/sidebar.tsx', 'src/components/admin/shell/mobile-menu.tsx']) {
      const source = read(file);
      expect(source).toContain('useAuth');
      expect(source).toContain('isSuperAdmin');
      expect(source).toContain('permissions');
    }
  });

  it('the standalone Spare Part Issue route resolves to a real page', () => {
    expect(
      fs.existsSync(path.join(webRoot, 'src/app/admin/maintenance/spare-part-issues/page.tsx')),
    ).toBe(true);
  });

  it('the unified R4R modules keep their owner-approved routes instead of new ones', () => {
    // R4R unifies the COMPETING UIs onto one page per module. It deliberately does not
    // rename URLs: `maintenance-module-terminology` and
    // `organizational-unit-retirement` pin these route paths and their approved labels,
    // so the unified page is built at the existing approved route and the redundant
    // sibling pages redirect to it.
    const routes = allEntries(sidebarGroups).map((e) => e.route);
    for (const route of [
      '/admin/core/persons',
      '/admin/maintenance/machine-categories',
      '/admin/maintenance/machine-parts',
      '/admin/maintenance/spare-parts',
      '/admin/maintenance/spare-part-issues',
    ]) {
      expect(routes).toContain(route);
    }
    for (const removed of ['/admin/employees', '/admin/maintenance/category-operations', '/admin/maintenance/parts-catalog']) {
      expect(routes).not.toContain(removed);
    }
  });

  it('the maintenance request page reads canonical issue history but never issues stock', () => {
    // The issue desk owns the mutation. The request form may display the immutable
    // history of the requirements it owns, but it must not post an issue itself.
    const requestPage = read('src/app/admin/maintenance/requests/[id]/page.tsx');
    expect(requestPage).toContain('/spare-part-issues/${lineId}/movements');
    const mutations = requestPage.match(/api\.(post|put|patch|delete)\s*(<[^>]*>)?\(\s*[`'"]\/spare-part-issues/g);
    expect(mutations).toBeNull();
    expect(requestPage).not.toContain('sparePartIssue.confirmIssue');
    expect(requestPage).not.toContain('sparePartIssue.issueModalTitle');
  });
});