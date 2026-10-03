import en from '../src/lib/i18n/locales/en';
import ar from '../src/lib/i18n/locales/ar';
import { getResourceLabel, isKnownResource } from '../src/lib/permissions/permission-catalogue';
import { getUnifiedSearchRegistry } from '../src/components/f9/adapter-registry';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Owner-approved maintenance UI terminology (final).
 *
 * The approved module names are binding for navigation, page titles, breadcrumbs,
 * F9/search module labels, dashboard shortcuts and the permission-catalogue module
 * labels. Entity routes and permission keys must stay mapped to the same entities.
 */
type Locale = 'ar' | 'en';

interface ApprovedModule {
  entity: string;
  permissionKey: string;
  route: string;
  navigationKey: string;
  maintenanceKey: string;
  ar: string;
  en: string;
}

const APPROVED_MODULES: ApprovedModule[] = [
  {
    entity: 'Machine',
    permissionKey: 'machine',
    route: '/admin/maintenance/machines',
    navigationKey: 'machines',
    maintenanceKey: 'machines',
    ar: 'الآلات والمعدات',
    en: 'Machines & Equipment',
  },
  {
    entity: 'MachineCategory',
    permissionKey: 'machine-category',
    route: '/admin/maintenance/machine-categories',
    navigationKey: 'machineCategories',
    maintenanceKey: 'machineCategories',
    ar: 'تصنيفات الآلات',
    en: 'Machine Categories',
  },
  {
    entity: 'MachineComponent',
    permissionKey: 'machine-component',
    route: '/admin/maintenance/machine-components',
    navigationKey: 'machineComponents',
    maintenanceKey: 'machineComponents',
    ar: 'أجزاء ووحدات الآلات',
    en: 'Machine Components & Assemblies',
  },
  {
    entity: 'MachinePart',
    permissionKey: 'machine-part',
    route: '/admin/maintenance/machine-parts',
    navigationKey: 'machineParts',
    maintenanceKey: 'machineParts',
    ar: 'قوائم قطع الآلات',
    en: 'Machine Part Lists',
  },
  {
    entity: 'SparePart',
    permissionKey: 'spare-part',
    route: '/admin/maintenance/spare-parts',
    navigationKey: 'spareParts',
    maintenanceKey: 'spareParts',
    ar: 'أصناف قطع الغيار',
    en: 'Spare Part Items',
  },
  {
    entity: 'MachineInstalledPart',
    permissionKey: 'installed-parts',
    route: '/admin/installed-parts',
    navigationKey: 'installedParts',
    maintenanceKey: 'installedParts',
    ar: 'القطع المركبة وحالتها',
    en: 'Installed Parts & Condition',
  },
];

const RETIRED_ARABIC_TITLES = [
  'الماكينات',
  'تصنيفات الماكينات',
  'مكونات الماكينات',
  'مكونات الماكينة',
  'قطع غيار الماكينات',
  'قطع الغيار الاحتياطية',
  'قطع الماكينات',
  'القطع المثبتة',
];

function read(source: Record<string, unknown>, path: string): string {
  const value = path.split('.').reduce<unknown>((acc, part) => {
    if (!acc || typeof acc !== 'object') return undefined;
    return (acc as Record<string, unknown>)[part];
  }, source);
  return value as string;
}

const dictionaries: Record<Locale, Record<string, unknown>> = {
  ar: ar as unknown as Record<string, unknown>,
  en: en as unknown as Record<string, unknown>,
};

/**
 * The shared breadcrumb lives in a .tsx module, which the web jest harness does not
 * compile (jsx: preserve), so its route->labelKey mapping is verified from source.
 */
const readSource = (relative: string) => fs.readFileSync(path.resolve(__dirname, '../src', relative), 'utf8');

/**
 * The shared breadcrumb and sidebar data live in modules that reach .tsx files, which
 * the web jest harness does not compile (jsx: preserve), so their route->labelKey
 * mappings are verified from source instead of by import.
 */
const breadcrumbSource = readSource('components/admin/shell/breadcrumb.tsx');
const navigationSource = readSource('components/admin/shell/navigation-data.ts');

/** Only the list-page label map, not the separate detail-page map. */
const breadcrumbListMap = breadcrumbSource.slice(breadcrumbSource.indexOf('const mapping: Record<string, string>'));

function labelKeyFor(source: string, labelKey: string, route: string): string | undefined {
  const label = labelKey.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const target = route.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const found = source.match(new RegExp(`labelKey:\\s*'${label}'[^\\n]*?route:\\s*'${target}'`));
  if (found) return found[0].match(/labelKey:\s*'([^']+)'/)?.[1];
  return source.match(new RegExp(`route:\\s*'${target}'[^\\n]*?labelKey:\\s*'([^']+)'`))?.[1];
}

function breadcrumbKeyFor(route: string): string | undefined {
  const segment = (route.split('/').filter(Boolean).pop() as string).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return breadcrumbListMap.match(new RegExp(`'?${segment}'?\\s*:\\s*'([^']+)'`))?.[1];
}

const approvedFor = (locale: Locale) => (m: ApprovedModule) => m[locale];

describe('maintenance module terminology (owner-approved)', () => {
  it('preserves the approved module order and entity mapping', () => {
    expect(APPROVED_MODULES.map((m) => m.entity)).toEqual([
      'Machine',
      'MachineCategory',
      'MachineComponent',
      'MachinePart',
      'SparePart',
      'MachineInstalledPart',
    ]);
    for (const m of APPROVED_MODULES) {
      expect(m.route).toBeTruthy();
      expect(isKnownResource(m.permissionKey)).toBe(true);
    }
  });

  for (const locale of ['ar', 'en'] as Locale[]) {
    describe(`${locale} locale`, () => {
      it('resolves the approved name in the navigation namespace', () => {
        for (const m of APPROVED_MODULES) {
          expect(read(dictionaries[locale], `navigation.${m.navigationKey}`)).toBe(approvedFor(locale)(m));
        }
      });

      it('resolves the approved name in the maintenance namespace used by page titles and F9/search', () => {
        for (const m of APPROVED_MODULES) {
          expect(read(dictionaries[locale], `maintenance.${m.maintenanceKey}`)).toBe(approvedFor(locale)(m));
        }
      });

      it('resolves the approved name in the shared breadcrumb label for every module route', () => {
        for (const m of APPROVED_MODULES) {
          const key = breadcrumbKeyFor(m.route);
          expect(key).toBeTruthy();
          expect(read(dictionaries[locale], key as string)).toBe(approvedFor(locale)(m));
        }
      });

      it('resolves the approved name in the permission catalogue module label', () => {
        for (const m of APPROVED_MODULES) {
          expect(getResourceLabel(`${m.permissionKey}:read`, locale)).toBe(approvedFor(locale)(m));
        }
      });

      it('uses the approved name as the sidebar label for every module destination', () => {
        for (const m of APPROVED_MODULES) {
          const labelKey = labelKeyFor(navigationSource, `navigation.${m.navigationKey}`, m.route);
          expect(labelKey).toBeTruthy();
          expect(read(dictionaries[locale], labelKey as string)).toBe(approvedFor(locale)(m));
        }
      });
    });
  }

  it('resolves the approved name for the five F9/unified-search module adapters', () => {
    const expected: Array<[string, ApprovedModule]> = [
      ['maintenance.machines', APPROVED_MODULES[0]],
      ['maintenance.machineCategories', APPROVED_MODULES[1]],
      ['maintenance.machineComponents', APPROVED_MODULES[2]],
      ['maintenance.machineParts', APPROVED_MODULES[3]],
      ['maintenance.spareParts', APPROVED_MODULES[4]],
    ];
    const registry = getUnifiedSearchRegistry();
    for (const [labelKey, m] of expected) {
      expect(registry.some((a) => a.labelKey === labelKey)).toBe(true);
      expect(read(dictionaries.en, labelKey)).toBe(m.en);
      expect(read(dictionaries.ar, labelKey)).toBe(m.ar);
    }
  });

  it('resolves the approved names on the dashboard shortcut cards', () => {
    expect(read(dictionaries.en, 'dashboard.machines')).toBe('Machines & Equipment');
    expect(read(dictionaries.ar, 'dashboard.machines')).toBe('الآلات والمعدات');
    expect(read(dictionaries.en, 'dashboard.machineCategories')).toBe('Machine Categories');
    expect(read(dictionaries.ar, 'dashboard.machineCategories')).toBe('تصنيفات الآلات');
  });

  it('keeps Arabic and English module terminology synchronized across every module label surface', () => {
    for (const m of APPROVED_MODULES) {
      const surfaces = [
        `navigation.${m.navigationKey}`,
        `maintenance.${m.maintenanceKey}`,
      ];
      for (const key of surfaces) {
        expect(read(dictionaries.ar, key)).toBe(m.ar);
        expect(read(dictionaries.en, key)).toBe(m.en);
      }
    }
  });

  it('no longer exposes any retired Arabic module title on the module label surfaces', () => {
    for (const m of APPROVED_MODULES) {
      for (const key of [`navigation.${m.navigationKey}`, `maintenance.${m.maintenanceKey}`]) {
        const value = read(dictionaries.ar, key) as string;
        expect(RETIRED_ARABIC_TITLES).not.toContain(value);
      }
    }
  });

  it('keeps the general warehouses module name and the spare-part warehouse type label untouched', () => {
    expect(read(dictionaries.ar, 'navigation.warehouses')).toBe('المستودعات');
    expect(read(dictionaries.en, 'navigation.warehouses')).toBe('Warehouses');
    expect(read(dictionaries.ar, 'inventory.warehouseTypeSparePart')).toBe('قطع غيار');
    expect(read(dictionaries.en, 'inventory.warehouseTypeSparePart')).toBe('Spare Parts');
  });

  it('does not invent a dedicated spare-parts warehouse route or label', () => {
    expect(read(dictionaries.ar, 'navigation.sparePartsWarehouse')).toBeUndefined();
    expect(read(dictionaries.en, 'navigation.sparePartsWarehouse')).toBeUndefined();
    const routes = [...navigationSource.matchAll(/route:\s*'([^']+)'/g)].map((m) => m[1]);
    expect(routes.filter((r) => /spare-part.*warehouse|warehouse.*spare-part/i.test(r))).toEqual([]);
  });
});