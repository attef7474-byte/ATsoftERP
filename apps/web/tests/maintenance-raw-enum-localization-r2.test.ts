import * as fs from 'fs';
import * as path from 'path';

import enCommon from '../src/lib/i18n/locales/en/common';
import arCommon from '../src/lib/i18n/locales/ar/common';
import enMaintenance from '../src/lib/i18n/locales/en/maintenance';
import arMaintenance from '../src/lib/i18n/locales/ar/maintenance';
import {
  CANONICAL_COST_EVENT_TYPES,
  canonicalCostEventLabel,
  isCanonicalCostEventType,
  maintenanceEscalationLevelLabel,
  maintenanceSlaStatusLabel,
} from '../src/lib/maintenance-labels';

type Translator = (key: string, ns?: string, params?: Record<string, string | number>) => string;

const ARABIC_RANGE = /[\u0600-\u06FF]/;

function buildTranslator(...catalogs: Array<Record<string, unknown>>): Translator {
  const merged: Record<string, unknown> = Object.assign({}, ...catalogs);
  return (key, _ns, params) => {
    const value = key
      .split('.')
      .reduce<unknown>((node, part) => {
        if (!node || typeof node !== 'object') return undefined;
        return (node as Record<string, unknown>)[part];
      }, merged);
    if (typeof value !== 'string') {
      // Mirrors the real resolver: a missing key must not silently return the key.
      return '';
    }
    if (!params) return value;
    return value.replace(/\{(\w+)\}/g, (whole, name: string) =>
      params[name] === undefined ? whole : String(params[name]),
    );
  };
}

const en = buildTranslator(enCommon, enMaintenance);
const ar = buildTranslator(arCommon, arMaintenance);

const webRoot = path.resolve(__dirname, '..');
const readPage = (relative: string) => fs.readFileSync(path.resolve(webRoot, relative), 'utf8');

/**
 * R2I-BLOCKER-R2 - raw maintenance enum values (MATERIAL, APPROVED, ON_TRACK, LEVEL_n)
 * were rendered straight into the DOM, which produced Latin text inside the Arabic UI.
 */
describe('R2I-BLOCKER-R2 canonical maintenance cost event labels', () => {
  it('covers exactly the six ledger event types enforced by the database', () => {
    expect([...CANONICAL_COST_EVENT_TYPES]).toEqual([
      'MATERIAL',
      'LABOR',
      'MACHINE',
      'OVERHEAD',
      'DOWNTIME',
      'EXTERNAL_SERVICE',
    ]);
  });

  it.each(CANONICAL_COST_EVENT_TYPES)('localizes %s in English', (value) => {
    const label = canonicalCostEventLabel(value, en);
    expect(label).toBeTruthy();
    expect(label).not.toBe(value);
  });

  it.each(CANONICAL_COST_EVENT_TYPES)('localizes %s in Arabic and never returns Latin text', (value) => {
    const label = canonicalCostEventLabel(value, ar);
    expect(label).toBeTruthy();
    expect(label).not.toBe(value);
    expect(label).toMatch(ARABIC_RANGE);
  });

  it('never leaks an unrecognised cost event value', () => {
    expect(canonicalCostEventLabel('SOMETHING_ELSE', en)).toBe('Other');
    expect(canonicalCostEventLabel('SOMETHING_ELSE', ar)).toBe('أخرى');
    expect(canonicalCostEventLabel('SOMETHING_ELSE', en)).not.toContain('SOMETHING_ELSE');
  });

  it('renders a dash for an absent cost event value', () => {
    expect(canonicalCostEventLabel(null, en)).toBe('-');
    expect(canonicalCostEventLabel(undefined, en)).toBe('-');
    expect(canonicalCostEventLabel('', en)).toBe('-');
  });

  it('recognises only the canonical values', () => {
    expect(isCanonicalCostEventType('EXTERNAL_SERVICE')).toBe(true);
    expect(isCanonicalCostEventType('EXTERNAL')).toBe(false);
    expect(isCanonicalCostEventType(null)).toBe(false);
  });
});

describe('R2I-BLOCKER-R2 maintenance SLA status labels', () => {
  it.each(['ON_TRACK', 'OVERDUE'])('localizes %s in English and Arabic', (value) => {
    expect(canonicalCostEventLabel(value, en)).toBeTruthy();
    const enLabel = maintenanceSlaStatusLabel(value, en);
    const arLabel = maintenanceSlaStatusLabel(value, ar);
    expect(enLabel).not.toBe(value);
    expect(arLabel).not.toBe(value);
    expect(arLabel).toMatch(ARABIC_RANGE);
  });

  it('falls back to a localized generic label instead of the raw status', () => {
    expect(maintenanceSlaStatusLabel('PAUSED', en)).toBe('SLA Status');
    expect(maintenanceSlaStatusLabel('PAUSED', en)).not.toContain('PAUSED');
  });

  it('renders a dash for an absent SLA status', () => {
    expect(maintenanceSlaStatusLabel(null, en)).toBe('-');
    expect(maintenanceSlaStatusLabel('', en)).toBe('-');
  });
});

describe('R2I-BLOCKER-R2 maintenance escalation level labels', () => {
  it('localizes the NONE sentinel', () => {
    expect(maintenanceEscalationLevelLabel('NONE', en)).toBe('No escalation');
    expect(maintenanceEscalationLevelLabel('NONE', ar)).toBe('بدون تصعيد');
  });

  it.each(['LEVEL_1', 'LEVEL_2', 'LEVEL_3', 'LEVEL_9'])('interpolates %s in English', (value) => {
    const label = maintenanceEscalationLevelLabel(value, en);
    const level = value.replace('LEVEL_', '');
    expect(label).toBe(`Level ${level}`);
    expect(label).not.toBe(value);
  });

  it.each(['LEVEL_1', 'LEVEL_2', 'LEVEL_3', 'LEVEL_9'])('interpolates %s in Arabic', (value) => {
    const label = maintenanceEscalationLevelLabel(value, ar);
    const level = value.replace('LEVEL_', '');
    expect(label).toBe(`المستوى ${level}`);
    expect(label).toMatch(ARABIC_RANGE);
  });

  it('supports escalation levels beyond any pre-defined key set', () => {
    // escalationLevels is a configurable integer with no application-level bound.
    expect(maintenanceEscalationLevelLabel('LEVEL_42', en)).toBe('Level 42');
    expect(maintenanceEscalationLevelLabel('LEVEL_250', en)).toBe('Level 250');
  });

  it('never leaks an unrecognised escalation level', () => {
    expect(maintenanceEscalationLevelLabel('CRITICAL', en)).toBe('Escalation level');
    expect(maintenanceEscalationLevelLabel('CRITICAL', ar)).toBe('مستوى التصعيد');
    expect(maintenanceEscalationLevelLabel('CRITICAL', en)).not.toContain('CRITICAL');
  });

  it('does not treat a malformed level as a real level', () => {
    expect(maintenanceEscalationLevelLabel('LEVEL_', en)).toBe('Escalation level');
    expect(maintenanceEscalationLevelLabel('LEVEL_ONE', en)).toBe('Escalation level');
    expect(maintenanceEscalationLevelLabel('level_2', en)).toBe('Escalation level');
  });

  it('renders a dash for an absent escalation level', () => {
    expect(maintenanceEscalationLevelLabel(null, en)).toBe('-');
    expect(maintenanceEscalationLevelLabel(undefined, en)).toBe('-');
    expect(maintenanceEscalationLevelLabel('   ', en)).toBe('-');
  });
});

describe('R2I-BLOCKER-R2 locale catalogue parity for the new keys', () => {
  const NEW_KEYS: Array<[string, string]> = [
    ['status', 'ON_TRACK'],
    ['status', 'OVERDUE'],
    ['status', 'REQUESTED'],
    ['status', 'RESERVED'],
    ['status', 'USED'],
    ['maintenanceWorkflow', 'costMachine'],
    ['maintenanceWorkflow', 'costOverhead'],
    ['maintenanceWorkflow', 'costDowntime'],
    ['maintenanceWorkflow', 'costExternalService'],
    ['maintenance', 'escalationLevelNone'],
    ['maintenance', 'escalationLevelNumber'],
    ['maintenance', 'escalationLevelUnknown'],
  ];

  const lookup = (catalog: Record<string, unknown>, ns: string, key: string): string | undefined => {
    const node = catalog[ns];
    if (!node || typeof node !== 'object') return undefined;
    const value = (node as Record<string, unknown>)[key];
    return typeof value === 'string' ? value : undefined;
  };

  const enCatalog = { ...enCommon, ...enMaintenance } as unknown as Record<string, unknown>;
  const arCatalog = { ...arCommon, ...arMaintenance } as unknown as Record<string, unknown>;

  it.each(NEW_KEYS)('defines %s.%s in both locales as a real message', (ns, key) => {
    const enValue = lookup(enCatalog, ns, key);
    const arValue = lookup(arCatalog, ns, key);
    expect(enValue).toBeTruthy();
    expect(enValue).not.toBe(key);
    expect(arValue).toBeTruthy();
    expect(arValue).not.toBe(key);
    expect(arValue).toMatch(ARABIC_RANGE);
  });

  it('defines the escalation placeholder once so interpolation can resolve it', () => {
    expect(lookup(enCatalog, 'maintenance', 'escalationLevelNumber')).toContain('{level}');
    expect(lookup(arCatalog, 'maintenance', 'escalationLevelNumber')).toContain('{level}');
  });
});

describe('R2I-BLOCKER-R2 source invariants (no raw enum rendering)', () => {
  const COST_PAGES = [
    'src/app/admin/maintenance/requests/[id]/cost/page.tsx',
    'src/app/admin/maintenance/work-orders/[id]/page.tsx',
  ];
  const ESCALATION_PAGES = [
    'src/app/admin/maintenance/requests/[id]/page.tsx',
    'src/app/admin/maintenance/dashboard/sla-escalated/page.tsx',
    'src/app/admin/maintenance/dashboard/sla-overdue/page.tsx',
  ];

  it.each(COST_PAGES)('renders the cost breakdown through the label helper in %s', (page) => {
    const src = readPage(page);
    expect(src).not.toMatch(/render: \(b: any\) => b\.key/);
    expect(src).toContain('canonicalCostEventLabel(b.key, t)');
  });

  it.each(ESCALATION_PAGES)('renders SLA and escalation levels through the helpers in %s', (page) => {
    const src = readPage(page);
    expect(src).not.toMatch(/\{\(r as any\)\.escalationLevel\}/);
    expect(src).not.toMatch(/\{\(data as any\)\.slaStatus\}/);
    expect(src).not.toMatch(/\{\(data as any\)\.escalationLevel\}/);
    expect(src).toContain('maintenanceEscalationLevelLabel');
  });

  it('renders required-part status through the canonical partStatusBadge', () => {
    const src = readPage('src/app/admin/maintenance/requests/[id]/page.tsx');
    expect(src).not.toMatch(/part\.status \|\| '-'/);
    expect(src).toContain('{partStatusBadge(part.status)}');
  });
});
