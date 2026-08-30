import {
  buildPermissionTree,
  getResourceDef,
  getActionDef,
  getResourceLabel,
  getActionLabel,
  getDomainLabel,
  splitPermissionKey,
  PERMISSION_DOMAINS,
  knownResourceKeys,
  isKnownResource,
  getDomainForResource,
} from '../src/lib/permissions/permission-catalogue';
import { AUTHORITATIVE_PERMISSION_KEYS } from './permission-catalogue-data';

const asUnits = (checked = false) =>
  AUTHORITATIVE_PERMISSION_KEYS.map((key, i) => ({ id: 'id_' + i, key, checked }));

describe('permission catalogue completeness (zero-loss rule)', () => {
  it('covers every authoritative permission key with a known resource (no "وحدة أخرى")', () => {
    const unknown: string[] = [];
    for (const key of AUTHORITATIVE_PERMISSION_KEYS) {
      const res = splitPermissionKey(key).resource;
      if (!res || !isKnownResource(res)) unknown.push(key);
    }
    expect(unknown).toEqual([]);
  });

  it('covers every authoritative permission key with a known action (no "إجراء آخر")', () => {
    const unknown: string[] = [];
    for (const key of AUTHORITATIVE_PERMISSION_KEYS) {
      if (!getActionDef(key)) unknown.push(key);
    }
    expect(unknown).toEqual([]);
  });

  it('renders every authoritative key exactly once with no duplicates', () => {
    const tree = buildPermissionTree(asUnits());
    const rendered: string[] = [];
    for (const domain of tree) {
      for (const res of domain.resources) {
        for (const p of res.permissions) rendered.push(p.key);
      }
    }
    expect(rendered.length).toBe(AUTHORITATIVE_PERMISSION_KEYS.length);
    expect(new Set(rendered).size).toBe(AUTHORITATIVE_PERMISSION_KEYS.length);
  });

  it('provides a domain, AR label and EN label for every known resource', () => {
    const domainIds = new Set(PERMISSION_DOMAINS.map((d) => d.id));
    const known = knownResourceKeys();
    expect(known.length).toBeGreaterThan(100);
    for (const res of known) {
      const def = getResourceDef(res + ':read');
      expect(def).toBeTruthy();
      expect(def!.ar).toBeTruthy();
      expect(def!.en).toBeTruthy();
      expect(domainIds.has(getDomainForResource(res))).toBe(true);
    }
  });

  it('domain labels resolve in both languages', () => {
    for (const d of PERMISSION_DOMAINS) {
      expect(getDomainLabel(d.id, 'ar')).toBeTruthy();
      expect(getDomainLabel(d.id, 'en')).toBeTruthy();
    }
  });
});

describe('permission catalogue localization', () => {
  it('does not return the Arabic "وحدة أخرى" fallback for known resources in AR', () => {
    for (const key of AUTHORITATIVE_PERMISSION_KEYS) {
      const label = getResourceLabel(key, 'ar');
      expect(label).not.toBe('وحدة أخرى');
    }
  });

  it('does not return the English "Other Module" fallback for known resources in EN', () => {
    for (const key of AUTHORITATIVE_PERMISSION_KEYS) {
      expect(getResourceLabel(key, 'en')).not.toBe('Other Module');
    }
  });

  it('does not return the Arabic "إجراء آخر" fallback for known actions in AR', () => {
    for (const key of AUTHORITATIVE_PERMISSION_KEYS) {
      expect(getActionLabel(key, 'ar')).not.toBe('إجراء آخر');
    }
  });

  it('resource labels are human-readable and resource-specific across a representative sample', () => {
    const samples = [
      ['machine:create', 'ماكينات'],
      ['maintenance-request:read', 'طلبات'],
      ['inventory.physical-count:post', 'الجرد'],
      ['production-order:release', 'أوامر'],
      ['warehouse:read', 'مستودعات'],
      ['cost-center:update', 'مراكز'],
    ] as const;
    for (const [key, fragment] of samples) {
      expect(getResourceLabel(key, 'ar')).toContain(fragment);
    }
  });

  it('technical permission keys are preserved verbatim in the tree', () => {
    const tree = buildPermissionTree(asUnits());
    const keys = new Set<string>();
    for (const d of tree) for (const r of d.resources) for (const p of r.permissions) keys.add(p.key);
    for (const key of AUTHORITATIVE_PERMISSION_KEYS) {
      expect(keys.has(key)).toBe(true);
    }
  });
});

describe('permission catalogue domain grouping', () => {
  it('groups Maintenance resources under the maintenance domain', () => {
    const tree = buildPermissionTree(asUnits());
    const maintenance = tree.find((d) => d.id === 'maintenance');
    expect(maintenance).toBeTruthy();
    const resources = maintenance!.resources.map((r) => r.key);
    expect(resources).toContain('maintenance-request');
    expect(resources).toContain('maintenance-work-order');
    expect(resources).toContain('downtime-log');
  });

  it('groups Inventory and its noisy sub-resources under the inventory domain', () => {
    const tree = buildPermissionTree(asUnits());
    const inventory = tree.find((d) => d.id === 'inventory');
    expect(inventory).toBeTruthy();
    const resources = inventory!.resources.map((r) => r.key);
    for (const r of [
      'inventory',
      'inventory.physical-count',
      'inventory.stock-adjustment',
      'inventory.opening-balance',
      'inventory.reports',
      'inventory.audit',
      'inventory.governance',
      'inventory.lock',
      'warehouse',
      'product',
    ]) {
      expect(resources).toContain(r);
    }
  });

  it('groups Production resources under the production domain', () => {
    const tree = buildPermissionTree(asUnits());
    const production = tree.find((d) => d.id === 'production');
    expect(production).toBeTruthy();
    const resources = production!.resources.map((r) => r.key);
    expect(resources).toContain('production-order');
    expect(resources).toContain('production-run');
    expect(resources).toContain('production-line');
    expect(resources).toContain('production-shift');
  });

  it('groups Reports.* under the reports domain', () => {
    const tree = buildPermissionTree(asUnits());
    const reports = tree.find((d) => d.id === 'reports');
    expect(reports).toBeTruthy();
    const resources = reports!.resources.map((r) => r.key);
    for (const r of ['reports.maintenance', 'reports.inventory', 'reports.barcodes', 'reports.operations']) {
      expect(resources).toContain(r);
    }
  });

  it('keeps inventory.reports under inventory, not reports, with meaningful resource label', () => {
    const tree = buildPermissionTree(asUnits());
    const inv = tree.find((d) => d.id === 'inventory')!;
    const invReports = inv.resources.find((r) => r.key === 'inventory.reports');
    expect(invReports).toBeTruthy();
    expect(invReports!.ar).toBe('تقارير المخزون');
  });

  it('places organizational-unit under legacy/compat section explicitly', () => {
    const legacy = buildPermissionTree(asUnits()).find((d) => d.id === 'legacy');
    expect(legacy).toBeTruthy();
    const ouResources = legacy!.resources.map((r) => r.key);
    expect(ouResources).toContain('organizational-unit');
  });
});

describe('permission catalogue action labels', () => {
  it('localizes CRUD + common workflow actions in AR and EN', () => {
    expect(getActionLabel('x:create', 'ar')).toBe('إنشاء');
    expect(getActionLabel('x:create', 'en')).toBe('Create');
    expect(getActionLabel('x:approve', 'ar')).toBe('اعتماد');
    expect(getActionLabel('x:reset-password', 'ar')).toBe('إعادة تعيين كلمة المرور');
    expect(getActionLabel('x:reject', 'ar')).toBe('رفض');
  });

  it('normalizes camelCase action suffixes with a human label', () => {
    expect(getActionLabel('machine:updateWarranty', 'ar')).toBe('تحديث الضمان');
    expect(getActionLabel('downtime-log:startDowntime', 'en')).toBe('Start Downtime');
    expect(getActionLabel('production-run:release', 'en')).toBe('Release');
    expect(getActionLabel('maintenance-task:myTasks', 'ar')).toBe('مهامي');
  });

  it('handles dotted compound actions and sub-actions', () => {
    expect(getActionLabel('maintenance-request:activity.view', 'ar')).toBe('عرض النشاط');
    expect(getActionLabel('maintenance-request:checklist.manage', 'en')).toBe('Manage Checklist');
  });

  it('keeps a safe fallback only for genuinely unknown actions', () => {
    expect(getActionLabel('unknown-module:definitely-not-known-action', 'ar')).toBe('إجراء آخر');
    expect(getActionLabel('unknown-module:nonsense', 'en')).toBe('Other Action');
  });
});
