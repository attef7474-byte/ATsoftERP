import * as fs from 'fs';
import * as path from 'path';
import {
  sidebarGroups,
  isSidebarItemVisible,
  classifySidebarItem,
  type SidebarGroup,
} from '../src/components/admin/shell/navigation-data';

const webRoot = path.resolve(__dirname, '..');
const read = (rel: string) => fs.readFileSync(path.join(webRoot, rel), 'utf8');
const exists = (rel: string) => fs.existsSync(path.join(webRoot, rel));

const productionGroup = sidebarGroups.find((g) => g.id === 'production') as SidebarGroup;
const productionItems = productionGroup.items ?? [];

/** Canonical order mandated by the cleanup directive. */
const CANONICAL: Array<{ id: string; route: string; labelKey: string; page: string; permissions: string[] }> = [
  {
    id: 'prd-ws-products',
    route: '/admin/production/product-definitions',
    labelKey: 'production.productsWorkspace',
    page: 'src/app/admin/production/product-definitions/page.tsx',
    permissions: ['production-product:read', 'production-unit:read', 'production-capacity-standard:read'],
  },
  {
    id: 'prd-ws-shifts',
    route: '/admin/production/shifts',
    labelKey: 'production.shiftsWorkspace',
    page: 'src/app/admin/production/shifts/page.tsx',
    permissions: [
      'production-shift:read',
      'production-shift-template:read',
      'production-shift-calendar:read',
      'production-shift-assignment:read',
      'production-operational-assignment:read',
      'shift-handover:read',
    ],
  },
  {
    id: 'prd-ws-planning',
    route: '/admin/production/orders',
    labelKey: 'production.ordersWorkspace',
    page: 'src/app/admin/production/orders/page.tsx',
    permissions: ['production-order:read', 'production-run:read', 'production-measurement-point:read'],
  },
  {
    id: 'prd-ws-materials',
    route: '/admin/production/material-documents',
    labelKey: 'production.materialDocumentsWorkspace',
    page: 'src/app/admin/production/material-documents/page.tsx',
    permissions: [
      'production-material-document:read',
      'production-material-requirement:read',
      'production-finished-goods-receipt:read',
    ],
  },
  {
    id: 'prd-ws-downtime',
    route: '/admin/production/downtime',
    labelKey: 'production.downtimeLossesWorkspace',
    page: 'src/app/admin/production/downtime/page.tsx',
    permissions: ['production-downtime:read', 'production-loss:read', 'production-loss-reason:read'],
  },
  {
    id: 'prd-ws-quality',
    route: '/admin/production/quality/plans',
    labelKey: 'production.qualityWorkspace',
    page: 'src/app/admin/production/quality/plans/page.tsx',
    permissions: ['production-quality-plan:read', 'production-inspection:read', 'production-ncr:read'],
  },
  {
    id: 'prd-ws-cost',
    route: '/admin/production/cost/rates',
    labelKey: 'production.costWorkspace',
    page: 'src/app/admin/production/cost/rates/page.tsx',
    permissions: [
      'production-cost-rate:read',
      'production-cost-snapshot:read',
      'production-cost-transaction:read',
      'production-cost-overhead-allocation:read',
    ],
  },
  {
    id: 'prd-ws-analytics',
    route: '/admin/production/analytics',
    labelKey: 'production.analyticsWorkspace',
    page: 'src/app/admin/production/analytics/page.tsx',
    permissions: ['production-analytics:read', 'production-performance-target:read', 'operational-reliability:read'],
  },
];

/** Legacy routes retired from the sidebar; each must remain a redirect stub. */
const LEGACY_REDIRECTS: Array<{ route: string; page: string; target: string }> = [
  { route: '/admin/production/units', page: 'src/app/admin/production/units/page.tsx', target: '/admin/production/product-definitions?tab=units' },
  { route: '/admin/production/capacity-standards', page: 'src/app/admin/production/capacity-standards/page.tsx', target: '/admin/production/product-definitions?tab=capacity-standards' },
  { route: '/admin/production/shift-templates', page: 'src/app/admin/production/shift-templates/page.tsx', target: '/admin/production/shifts?tab=templates' },
  { route: '/admin/production/shift-calendars', page: 'src/app/admin/production/shift-calendars/page.tsx', target: '/admin/production/shifts?tab=calendars' },
  { route: '/admin/production/shift-assignments', page: 'src/app/admin/production/shift-assignments/page.tsx', target: '/admin/production/shifts?tab=assignments' },
  { route: '/admin/production/operational-assignments', page: 'src/app/admin/production/operational-assignments/page.tsx', target: '/admin/production/shifts?tab=operational-assignments' },
  { route: '/admin/production/shift-handovers', page: 'src/app/admin/production/shift-handovers/page.tsx', target: '/admin/production/shifts?tab=handovers' },
  { route: '/admin/production/runs', page: 'src/app/admin/production/runs/page.tsx', target: '/admin/production/orders?tab=runs' },
  { route: '/admin/production/measurement-points', page: 'src/app/admin/production/measurement-points/page.tsx', target: '/admin/production/orders?tab=measurement-points' },
  { route: '/admin/production/material-requirements', page: 'src/app/admin/production/material-requirements/page.tsx', target: '/admin/production/material-documents?tab=requirements' },
  { route: '/admin/production/finished-goods-receipts', page: 'src/app/admin/production/finished-goods-receipts/page.tsx', target: '/admin/production/material-documents?tab=finished-goods' },
  { route: '/admin/production/losses', page: 'src/app/admin/production/losses/page.tsx', target: '/admin/production/downtime?tab=losses' },
  { route: '/admin/production/loss-reasons', page: 'src/app/admin/production/loss-reasons/page.tsx', target: '/admin/production/downtime?tab=loss-reasons' },
  { route: '/admin/production/quality/inspections', page: 'src/app/admin/production/quality/inspections/page.tsx', target: '/admin/production/quality/plans?tab=inspections' },
  { route: '/admin/production/quality/ncrs', page: 'src/app/admin/production/quality/ncrs/page.tsx', target: '/admin/production/quality/plans?tab=ncrs' },
  { route: '/admin/production/cost/snapshots', page: 'src/app/admin/production/cost/snapshots/page.tsx', target: '/admin/production/cost/rates?tab=snapshots' },
  { route: '/admin/production/cost/transactions', page: 'src/app/admin/production/cost/transactions/page.tsx', target: '/admin/production/cost/rates?tab=transactions' },
  { route: '/admin/production/cost/overhead-allocations', page: 'src/app/admin/production/cost/overhead-allocations/page.tsx', target: '/admin/production/cost/rates?tab=overhead-allocations' },
  { route: '/admin/production/performance-targets', page: 'src/app/admin/production/performance-targets/page.tsx', target: '/admin/production/analytics?tab=performance-targets' },
  { route: '/admin/production/reliability', page: 'src/app/admin/production/reliability/page.tsx', target: '/admin/production/analytics?tab=reliability' },
];

const readKeyPattern = /['"]([a-z][a-z0-9-]*:read)['"]/g;
const readKeysIn = (source: string): string[] => {
  const keys = new Set<string>();
  for (const m of source.matchAll(readKeyPattern)) keys.add(m[1]);
  return [...keys];
};

describe('Production navigation final cleanup', () => {
  it('NAV01 the Production group exists and is a group', () => {
    expect(productionGroup).toBeDefined();
    expect(productionGroup.labelKey).toBe('navigation.production');
  });

  it('NAV02 the Production group uses a flat item list, not nested sections', () => {
    expect(productionGroup.items).toBeDefined();
    expect(productionGroup.children).toBeUndefined();
  });

  it('NAV03 exposes exactly the 8 canonical workspaces', () => {
    expect(productionItems).toHaveLength(8);
  });

  it('NAV04 lists the workspaces in the mandated canonical order', () => {
    expect(productionItems.map((i) => i.route)).toEqual(CANONICAL.map((c) => c.route));
    expect(productionItems.map((i) => i.id)).toEqual(CANONICAL.map((c) => c.id));
  });

  it('NAV05 never repeats a production destination or id', () => {
    const routes = productionItems.map((i) => i.route);
    const ids = productionItems.map((i) => i.id);
    expect(new Set(routes).size).toBe(routes.length);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('NAV06 no legacy screen remains a sidebar destination', () => {
    const routes = new Set(productionItems.map((i) => i.route));
    for (const legacy of LEGACY_REDIRECTS) expect(routes.has(legacy.route)).toBe(false);
  });

  it('NAV07 each workspace declares a non-empty any-of permission set', () => {
    for (const item of productionItems) {
      expect(Array.isArray(item.permissions)).toBe(true);
      expect(item.permissions && item.permissions.length).toBeGreaterThan(0);
      expect(item.permission).toBeUndefined();
    }
  });

  it('NAV08 every declared permission uses the seeded namespace:verb key form', () => {
    for (const item of productionItems) {
      for (const key of item.permissions ?? []) {
        expect(key).toMatch(/^[a-z][a-z0-9-]*:[a-z][a-z0-9-]*$/);
        expect(key).not.toContain('*');
      }
    }
  });

  it('NAV09 every workspace reuses a production.*Workspace label key', () => {
    expect(productionItems.map((i) => i.labelKey)).toEqual(CANONICAL.map((c) => c.labelKey));
    for (const key of productionItems.map((i) => i.labelKey)) {
      expect(key).toMatch(/^production\.[a-zA-Z]+Workspace$/);
    }
  });

  it('NAV10 every workspace is classified as PERMISSION-gated', () => {
    for (const item of productionItems) expect(classifySidebarItem(item)).toBe('PERMISSION');
  });

  it('NAV11 a workspace shows when the operator holds any one of its tab permissions', () => {
    for (const item of productionItems) {
      for (const key of item.permissions ?? []) {
        expect(isSidebarItemVisible(item, [key], false)).toBe(true);
      }
    }
  });

  it('NAV12 a workspace hides when the operator holds none of its permissions', () => {
    for (const item of productionItems) {
      expect(isSidebarItemVisible(item, ['unrelated:read'], false)).toBe(false);
      expect(isSidebarItemVisible(item, [], false)).toBe(false);
    }
  });

  it('NAV13 an unresolved permission payload hides the workspace (deny-by-default)', () => {
    for (const item of productionItems) expect(isSidebarItemVisible(item, null, false)).toBe(false);
  });

  it('NAV14 SUPER_ADMIN sees every workspace', () => {
    for (const item of productionItems) expect(isSidebarItemVisible(item, [], true)).toBe(true);
  });

  it('NAV15 every workspace label key exists in both English and Arabic with a value', () => {
    const en = read('src/lib/i18n/locales/en/production.ts');
    const ar = read('src/lib/i18n/locales/ar/production.ts');
    for (const c of CANONICAL) {
      const short = c.labelKey.slice('production.'.length);
      expect(en).toMatch(new RegExp(`${short}:\\s*'[^']+'`));
      expect(ar).toMatch(new RegExp(`${short}:\\s*'[^']+'`));
    }
  });

  it('NAV16 every workspace label is actually translated (Arabic differs from English)', () => {
    const en = read('src/lib/i18n/locales/en/production.ts');
    const ar = read('src/lib/i18n/locales/ar/production.ts');
    const valueIn = (src: string, short: string) => {
      const m = src.match(new RegExp(`${short}:\\s*'([^']+)'`));
      return m ? m[1] : null;
    };
    for (const c of CANONICAL) {
      const short = c.labelKey.slice('production.'.length);
      const enValue = valueIn(en, short);
      const arValue = valueIn(ar, short);
      expect(enValue).toBeTruthy();
      expect(arValue).toBeTruthy();
      expect(arValue).not.toBe(enValue);
    }
  });

  it('NAV17 the workspace label keys are never raw i18n keys (no dot leaks to the UI)', () => {
    const en = read('src/lib/i18n/locales/en/production.ts');
    for (const c of CANONICAL) {
      const short = c.labelKey.slice('production.'.length);
      const m = en.match(new RegExp(`${short}:\\s*'([^']+)'`));
      expect(m?.[1] ?? '').not.toContain('.');
    }
  });

  it('NAV18 the navigation layer never authorizes by role name', () => {
    const source = read('src/components/admin/shell/navigation-data.ts');
    expect(source).not.toMatch(/role\s*===/);
    expect(source).not.toMatch(/roleName/);
  });

  it('NAV19 the navigation layer supports any-of permission sets', () => {
    const source = read('src/components/admin/shell/navigation-data.ts');
    expect(source).toContain('canAny');
    expect(source).toContain('permissions');
  });

  for (const c of CANONICAL) {
    it(`NAV20:${c.id} the host page gates every tab with a permission map`, () => {
      const source = read(c.page);
      expect(source).toContain('useAuthorizedTabs');
      expect(source).toContain('resolveActiveTab');
      expect(source).toContain('TAB_PERMISSIONS');
      expect(source).toContain('TAB_ORDER');
      const keys = readKeysIn(source);
      expect(new Set(keys)).toEqual(new Set(c.permissions));
    });

    it(`NAV21:${c.id} the host page filters its tab bar by authorization`, () => {
      const source = read(c.page);
      expect(source).toMatch(/\.filter\(\(item\) => isVisible\(item\.id\)\)|visibleTabs\.map\(/);
    });

    it(`NAV22:${c.id} the sidebar permission set matches the host page's tab permissions`, () => {
      const item = productionItems.find((i) => i.id === c.id);
      expect(item).toBeDefined();
      expect(new Set(item?.permissions ?? [])).toEqual(new Set(c.permissions));
    });
  }

  it('NAV23 no canonical workspace is itself a redirect stub (each renders real UI)', () => {
    for (const c of CANONICAL) {
      const source = read(c.page);
      expect(source).toContain('PageHeader');
      expect(source).toContain('<TabPanel');
    }
  });

  it('NAV24 landing selects the first authorized tab, never an unconditional default', () => {
    for (const c of CANONICAL) {
      const source = read(c.page);
      expect(source).toContain('resolveActiveTab');
      expect(source).toContain('visibleTabs');
    }
  });

  it('NAV25 the retired screens are preserved as redirect stubs', () => {
    for (const legacy of LEGACY_REDIRECTS) {
      expect(exists(legacy.page)).toBe(true);
    }
  });

  it('NAV26 every redirect stub targets its canonical workspace root and tab', () => {
    for (const legacy of LEGACY_REDIRECTS) {
      const source = read(legacy.page);
      expect(source).toContain(`router.replace('${legacy.target}')`);
    }
  });

  it('NAV27 every redirect target is a canonical workspace root, never another legacy stub', () => {
    const canonicalRoutes = new Set(CANONICAL.map((c) => c.route));
    const legacyRoutes = new Set(LEGACY_REDIRECTS.map((l) => l.route));
    for (const legacy of LEGACY_REDIRECTS) {
      const target = legacy.target.split('?')[0];
      expect(canonicalRoutes.has(target)).toBe(true);
      expect(legacyRoutes.has(target)).toBe(false);
    }
  });

  it('NAV28 the legacy inventory is exactly the 20 retired screens', () => {
    expect(LEGACY_REDIRECTS).toHaveLength(20);
    expect(new Set(LEGACY_REDIRECTS.map((l) => l.route)).size).toBe(20);
  });

  it('NAV29 every legacy redirect target tab is an authorized tab of its workspace page', () => {
    const byRoute = new Map(CANONICAL.map((c) => [c.route, c]));
    for (const legacy of LEGACY_REDIRECTS) {
      const [target, query] = legacy.target.split('?');
      const workspace = byRoute.get(target);
      expect(workspace).toBeDefined();
      const tab = new URLSearchParams(query).get('tab');
      expect(tab).toBeTruthy();
      const source = read(workspace!.page);
      expect(source).toMatch(new RegExp(`id[:=]\\s*['"]${tab}['"]`));
    }
  });

  it('NAV30 the desktop and mobile navigations still share one filtered dataset', () => {
    for (const file of ['src/components/admin/shell/sidebar.tsx', 'src/components/admin/shell/mobile-menu.tsx']) {
      const source = read(file);
      expect(source).toContain('sidebarGroups');
      expect(source).toContain('filterSidebarGroups');
    }
  });
});
