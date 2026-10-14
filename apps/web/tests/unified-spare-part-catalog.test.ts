import fs from 'node:fs';
import path from 'node:path';
import en from '../src/lib/i18n/locales/en';
import ar from '../src/lib/i18n/locales/ar';
import { resolveTranslation, TRANSLATION_FALLBACKS } from '../src/lib/i18n/translation-core';

/**
 * UNIFIED SPARE PART CATALOG — focused web tests W1..W16.
 *
 * The unified page (Spare Parts & Machine Applicability) is the single canonical
 * management surface. The legacy Machine Part Lists page is now a read-only history
 * view that points to it. These checks are source-contract assertions because the
 * web jest harness does not compile JSX (jsx: preserve).
 */
const webSrc = path.resolve(__dirname, '../src');
const read = (rel: string) => fs.readFileSync(path.join(webSrc, rel), 'utf8');

const SPARE_PARTS_PAGE = 'app/admin/maintenance/spare-parts/page.tsx';
const MACHINE_PARTS_PAGE = 'app/admin/maintenance/machine-parts/page.tsx';
const MULTI_SELECT = 'components/admin/maintenance/machine-multi-select.tsx';
const NAVIGATION = 'components/admin/shell/navigation-data.ts';

const spareParts = read(SPARE_PARTS_PAGE);
const machineParts = read(MACHINE_PARTS_PAGE);
const multiSelect = read(MULTI_SELECT);
const navigation = read(NAVIGATION);

const count = (haystack: string, needle: string) => haystack.split(needle).length - 1;

describe('unified spare part catalog — page and form', () => {
  it('W1: exposes exactly one primary spare-part management destination, removes the legacy nav entry, and adds the unit master', () => {
    expect(count(navigation, "route: '/admin/maintenance/spare-parts'")).toBe(1);
    expect(navigation).not.toContain('mnt-machine-parts');
    expect(navigation).toContain("{ id: 'inv-units', labelKey: 'navigation.unitsOfMeasure', route: '/admin/inventory/units', permission: 'unit:read' }");
  });

  it('W2: the unified form renders the four reviewed sections in a single modal', () => {
    expect(spareParts).toContain('<Modal');
    expect(spareParts).toContain("t('maintenance.sparePart.section.data')");
    expect(spareParts).toContain("t('maintenance.sparePart.section.technical')");
    expect(spareParts).toContain("t('maintenance.sparePart.section.inventoryLink')");
    expect(spareParts).toContain("t('maintenance.sparePart.section.machines')");
  });

  it('W3: each technical identity field is captured exactly once on the form', () => {
    for (const field of ['manufacturer', 'model', 'partNumber', 'category', 'barcode']) {
      expect(count(spareParts, `Input label={t('maintenance.sparePart.form.${field}')}`)).toBe(1);
    }
  });

  it('W4: description and specification are unified into a single technical field', () => {
    expect(spareParts).toContain("t('maintenance.sparePart.form.technicalDescription')");
    expect(spareParts).toContain('<Textarea value={form.specification}');
    expect(spareParts).not.toContain('<Textarea value={form.description}');
    expect(spareParts).not.toContain("t('maintenance.sparePart.form.specification')");
  });

  it('W5: the unit is a controlled selector fed from the global unit master', () => {
    expect(spareParts).toContain("api.get<{ data: Unit[] }>('/units'");
    expect(spareParts).toContain("value={form.unitId}");
    expect(spareParts).toContain("t('maintenance.sparePart.form.unitHint')");
  });

  it('W6: machine applicability uses the multi-machine selector', () => {
    expect(spareParts).toContain('<MachineMultiSelect');
    expect(spareParts).toContain('value={machineSelections}');
    expect(spareParts).toContain('onChange={setMachineSelections}');
  });

  it('W11: the inventory product is chosen once at the spare-part level via F9', () => {
    expect(count(spareParts, 'adapter={productAdapter}')).toBe(1);
    expect(count(spareParts, '<F9Lookup')).toBe(1);
    expect(spareParts).toContain("t('maintenance.sparePart.form.linkedProduct')");
  });

  it('W12: no per-machine product selector exists anywhere in the applicability UI', () => {
    expect(multiSelect).not.toContain('productId');
    expect(multiSelect).not.toContain('productAdapter');
  });

  it('saves applicability through the single batch endpoint after create/update', () => {
    expect(spareParts).toContain('api.put(`/maintenance/spare-parts/${sparePartId}/machines`, { machineIds: nextIds })');
    expect(spareParts).toContain('api.post<SparePart>(\'/maintenance/spare-parts\'');
  });
});

describe('unified spare part catalog — multi-machine picker behavior contract', () => {
  it('W7: renders human-readable chips (code + name), never raw identifiers', () => {
    expect(multiSelect).toContain('labelOf');
    expect(multiSelect).toContain('m.code');
    expect(multiSelect).toContain('m.name');
    expect(multiSelect).toContain('{labelOf(m)}');
  });

  it('W8: selection is keyed by id so duplicates cannot accumulate', () => {
    expect(multiSelect).toContain('new Map');
    expect(multiSelect).toContain('next.delete(machine.id)');
    expect(multiSelect).toContain('next.set(machine.id');
    expect(multiSelect).toContain('selected.has(m.id)');
  });

  it('W9: editing hydrates the currently linked machines', () => {
    expect(spareParts).toContain('item.machineLinks');
    expect(spareParts).toContain('setMachineSelections');
    expect(spareParts).toContain('setOriginalMachineIds');
  });

  it('W10: removing one chip never clears the others', () => {
    expect(multiSelect).toContain('removeChip');
    expect(multiSelect).toContain('onChange(value.filter((v) => v.id !== id))');
  });

  it('only sends the applicability update when the selection actually changed', () => {
    expect(spareParts).toContain('originalMachineIds');
    expect(spareParts).toContain('const changed = nextIds.length !== originalMachineIds.size');
    expect(spareParts).toContain('if (!changed) return;');
  });
});

describe('unified spare part catalog — permissions and legacy page', () => {
  it('W15: actions are permission-aware and machine management follows update', () => {
    expect(spareParts).toContain("permission: 'spare-part:create'");
    expect(spareParts).toContain("permission: 'spare-part:update'");
    expect(spareParts).toContain("permission: 'spare-part:delete'");
    expect(spareParts).toContain("permission: 'spare-part:activate'");
    expect(spareParts).toContain("permission: 'spare-part:deactivate'");
    expect(spareParts).toContain('const canManageMachines = canUpdate;');
    expect(spareParts).toContain('disabled={!canManageMachines}');
  });

  it('W16: the legacy Machine Part Lists page is read-only and points to the unified page', () => {
    expect(machineParts).toContain('machinePartsLegacyNotice');
    expect(machineParts).toContain('machinePartsLegacyTitle');
    expect(machineParts).toContain('href="/admin/maintenance/spare-parts"');
    expect(machineParts).toContain("t('maintenance.goToSpareParts')");
    expect(machineParts).not.toMatch(/api\.(post|patch|put|delete)\(/);
    expect(machineParts).not.toContain('<Modal');
    expect(machineParts).not.toContain('machine-part:create');
    expect(machineParts).not.toContain('machine-part:update');
    expect(machineParts).not.toContain('machine-part:delete');
  });
});

describe('unified spare part catalog — Arabic RTL and English LTR (W13/W14)', () => {
  const KEYS = [
    'navigation.unitsOfMeasure',
    'inventory.units.title',
    'inventory.units.code',
    'inventory.units.name',
    'inventory.units.nameAr',
    'inventory.units.nameEn',
    'inventory.units.symbol',
    'inventory.units.usage',
    'inventory.units.empty',
    'inventory.units.new',
    'inventory.units.edit',
    'inventory.units.created',
    'inventory.units.updated',
    'inventory.units.confirmActivate',
    'inventory.units.confirmDeactivate',
    'inventory.units.confirmDelete',
    'maintenance.sparePart.form.linkedProduct',
    'maintenance.sparePart.form.linkedMachines',
    'maintenance.sparePart.form.noUnit',
    'maintenance.sparePart.form.unitHint',
    'maintenance.sparePart.form.machinesHint',
    'maintenance.sparePart.form.noMachines',
    'maintenance.sparePart.form.selectMachines',
    'maintenance.sparePart.form.selectedMachinesCount',
    'maintenance.sparePart.form.technicalDescription',
    'maintenance.sparePart.section.data',
    'maintenance.sparePart.section.technical',
    'maintenance.sparePart.section.inventoryLink',
    'maintenance.sparePart.section.machines',
    'maintenance.sparePartsUnifiedTitle',
    'maintenance.machinePartsLegacyTitle',
    'maintenance.machinePartsLegacyNotice',
    'maintenance.goToSpareParts',
  ];

  it('W13: every new key resolves in Arabic (RTL)', () => {
    for (const key of KEYS) {
      const value = resolveTranslation(ar, 'ar', key);
      expect(value).not.toBe(TRANSLATION_FALLBACKS.ar);
      expect(String(value).length).toBeGreaterThan(0);
    }
  });

  it('W14: every new key resolves in English (LTR)', () => {
    for (const key of KEYS) {
      const value = resolveTranslation(en, 'en', key);
      expect(value).not.toBe(TRANSLATION_FALLBACKS.en);
      expect(String(value).length).toBeGreaterThan(0);
    }
  });

  it('the machine-selection count interpolation is present in both locales', () => {
    expect(String(resolveTranslation(en, 'en', 'maintenance.sparePart.form.selectedMachinesCount'))).toContain('{count}');
    expect(String(resolveTranslation(ar, 'ar', 'maintenance.sparePart.form.selectedMachinesCount'))).toContain('{count}');
  });
});
