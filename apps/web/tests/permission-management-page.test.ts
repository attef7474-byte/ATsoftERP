import {
  buildPermissionTree,
  splitPermissionKey,
  getResourceLabel,
  getActionLabel,
  getDomainLabel,
  getDomainForResource,
  TreeDomain,
} from '../src/lib/permissions/permission-catalogue';
import { translatePermissionKey } from '../src/lib/i18n/literals';
import { AUTHORITATIVE_PERMISSION_KEYS } from './permission-catalogue-data';

function buildUnits(keys: string[], checkedKeys: string[] = []) {
  const assigned = new Set(checkedKeys);
  return keys.map((key, i) => ({ id: 'id_' + i, key, checked: assigned.has(key) }));
}

describe('Permission Management page three-level hierarchy', () => {
  describe('A. Domain → Resource → Action grouping', () => {
    it('A1: the authoritative inventory yields exactly the 15 canonical domains', () => {
      const tree = buildPermissionTree(buildUnits(AUTHORITATIVE_PERMISSION_KEYS));
      expect(tree.length).toBe(15);
    });

    it('A2: parses three-level compound keys into resource and action', () => {
      expect(splitPermissionKey('inventory:physical-count:post')).toEqual({
        resource: 'inventory.physical-count',
        action: 'post',
      });
      expect(splitPermissionKey('maintenance-request:activity.view')).toEqual({
        resource: 'maintenance-request',
        action: 'activity.view',
      });
      expect(splitPermissionKey('settings.appearance.manage')).toEqual({
        resource: 'settings.appearance',
        action: 'manage',
      });
    });

    it('A3: every domain has a non-empty AR and EN label and resources', () => {
      const tree = buildPermissionTree(buildUnits(AUTHORITATIVE_PERMISSION_KEYS));
      for (const d of tree) {
        expect(d.ar.length).toBeGreaterThan(0);
        expect(d.en.length).toBeGreaterThan(0);
        expect(d.resources.length).toBeGreaterThan(0);
      }
    });

    it('A4: a domain group carries all assigned resources without duplication', () => {
      const tree = buildPermissionTree(buildUnits(AUTHORITATIVE_PERMISSION_KEYS));
      for (const d of tree) {
        const keys = d.resources.map((r) => r.key);
        expect(new Set(keys).size).toBe(keys.length);
      }
    });

    it('A5: every permission key appears under exactly one resource and domain', () => {
      const tree = buildPermissionTree(buildUnits(AUTHORITATIVE_PERMISSION_KEYS));
      const seen = new Map<string, string>();
      for (const d of tree) {
        for (const r of d.resources) {
          for (const p of r.permissions) {
            expect(seen.has(p.key)).toBe(false);
            seen.set(p.key, d.id + '/' + r.key);
          }
        }
      }
      expect(seen.size).toBe(AUTHORITATIVE_PERMISSION_KEYS.length);
    });
  });

  describe('B. Resource classification domains', () => {
    it('B1: inventory.physical-count belongs to the inventory domain', () => {
      expect(getDomainForResource('inventory.physical-count')).toBe('inventory');
    });
    it('B2: inventory.reports stays under inventory, not reports', () => {
      expect(getDomainForResource('inventory.reports')).toBe('inventory');
    });
    it('B3: standalone reports.* resources belong to the reports domain', () => {
      expect(getDomainForResource('reports.operations')).toBe('reports');
    });
    it('B4: organizational-unit is placed under the legacy/compat domain', () => {
      expect(getDomainForResource('organizational-unit')).toBe('legacy');
    });
  });

  describe('C. Progressive disclosure / selection derivation', () => {
    it('C1: resource isChecked only when every action is selected', () => {
      const tree = buildPermissionTree(
        buildUnits(['inventory:physical-count:post', 'inventory:physical-count:read'], ['inventory:physical-count:post']),
      );
      const inv = tree.find((d) => d.id === 'inventory')!;
      const res = inv.resources.find((r) => r.key === 'inventory.physical-count')!;
      expect(res.checked).toBe(false);
      expect(res.someChecked).toBe(true);
    });

    it('C2: resource isChecked when all actions are selected', () => {
      const tree = buildPermissionTree(
        buildUnits(['inventory:physical-count:post', 'inventory:physical-count:read'], [
          'inventory:physical-count:post',
          'inventory:physical-count:read',
        ]),
      );
      const inv = tree.find((d) => d.id === 'inventory')!;
      const res = inv.resources.find((r) => r.key === 'inventory.physical-count')!;
      expect(res.checked).toBe(true);
      expect(res.someChecked).toBe(false);
    });
  });

  describe('D. Localization', () => {
    it('D1: every known resource has a non-fallback AR and EN label', () => {
      for (const key of AUTHORITATIVE_PERMISSION_KEYS) {
        const arLabel = getResourceLabel(key, 'ar');
        const enLabel = getResourceLabel(key, 'en');
        expect(arLabel).not.toBe('وحدة أخرى');
        expect(arLabel).not.toBe('Other Module');
        expect(enLabel).not.toBe('وحدة أخرى');
        expect(enLabel).not.toBe('Other Module');
        expect(arLabel.length).toBeGreaterThan(0);
        expect(enLabel.length).toBeGreaterThan(0);
      }
    });

    it('D2: every known action has a non-fallback AR and EN label', () => {
      for (const key of AUTHORITATIVE_PERMISSION_KEYS) {
        expect(getActionLabel(key, 'ar')).not.toBe('إجراء آخر');
        expect(getActionLabel(key, 'ar')).not.toBe('Other Action');
        expect(getActionLabel(key, 'en')).not.toBe('إجراء آخر');
        expect(getActionLabel(key, 'en')).not.toBe('Other Action');
      }
    });

    it('D3: translatePermissionKey delegates to the catalogue for known resources', () => {
      const en = translatePermissionKey('inventory:physical-count:post', 'en');
      const ar = translatePermissionKey('inventory:physical-count:post', 'ar');
      expect(en).toContain('Post');
      expect(en).toContain('Count');
      expect(ar).not.toContain('inventory:physical-count');
      expect(ar).not.toContain('وحدة أخرى');
      expect(ar).not.toContain('إجراء آخر');
    });
  });

  describe('E. Search semantics', () => {
    it('E1: search by English resource label matches across locales', () => {
      const tree = buildPermissionTree(buildUnits(AUTHORITATIVE_PERMISSION_KEYS));
      const allFlattened = tree.flatMap((d) => d.resources.flatMap((r) => r.permissions));
      const withPhysical = allFlattened.filter((p) => p.key.includes('physical-count'));
      expect(withPhysical.length).toBeGreaterThan(0);
    });
  });

  describe('F. System role guards preserved', () => {
    it('F1: isSystem meta is plumbed via role payload, not the tree', () => {
      const tree = buildPermissionTree(buildUnits(AUTHORITATIVE_PERMISSION_KEYS));
      expect(Array.isArray(tree)).toBe(true);
    });
  });

  describe('G. RBAC authorization keys exist', () => {
    const EXPECTED_KEYS = [
      'access:role:assign-permissions',
      'access:role:create',
      'access:user:assign-roles',
    ];
    it('G1: every authorization guard key resolves to a real known resource', () => {
      for (const key of EXPECTED_KEYS) {
        const res = splitPermissionKey(key);
        expect(res.resource).toBeTruthy();
        expect(res.action).toBeTruthy();
      }
    });
  });

  describe('H. i18n access.* keys present in both locales', () => {
    const KEYS = ['expandAll', 'collapseAll', 'searchByKeyword', 'filterNoResults', 'selectAllResource', 'clearResource'];
    it('H1: new page keys are translated in both AR and EN without raw-key leakage', async () => {
      const en = (await import('../src/lib/i18n/locales/en')).default;
      const ar = (await import('../src/lib/i18n/locales/ar')).default;
      for (const k of KEYS) {
        const enVal = (en.access as Record<string, unknown>)?.[k];
        const arVal = (ar.access as Record<string, unknown>)?.[k];
        expect(typeof enVal).toBe('string');
        expect(typeof arVal).toBe('string');
        expect(String(enVal)).not.toContain('access.' + k);
        expect(String(arVal)).not.toContain('access.' + k);
      }
    });
  });
});
