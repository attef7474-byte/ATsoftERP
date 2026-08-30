import * as fs from 'fs';
import * as path from 'path';

const webRoot = path.resolve(__dirname, '..');
const repoRoot = path.resolve(__dirname, '../../..');
const readWeb = (rel: string) => fs.readFileSync(path.resolve(webRoot, rel), 'utf8');
const readApi = (rel: string) => fs.readFileSync(path.join(repoRoot, rel), 'utf8');
const readLocale = (lang: string, file: string) => fs.readFileSync(path.resolve(webRoot, 'src/lib/i18n/locales', lang, file), 'utf8');

const PAGE = 'src/app/admin/maintenance/cost-centers/page.tsx';
const AR_LOCALE = readLocale('ar', 'maintenance.ts');
const EN_LOCALE = readLocale('en', 'maintenance.ts');
const ADAPTER = 'src/components/f9/lookup-adapters.ts';

const EXPECTED: Record<string, { ar: string; en: string }> = {
  PRODUCTION: { ar: 'إنتاج', en: 'Production' },
  MAINTENANCE: { ar: 'صيانة', en: 'Maintenance' },
  PROJECT: { ar: 'مشروع', en: 'Project' },
  DEVELOPMENT: { ar: 'تطوير', en: 'Development' },
  QUALITY: { ar: 'جودة', en: 'Quality' },
  UTILITIES: { ar: 'المرافق / الخدمات', en: 'Utilities / Services' },
  ADMIN: { ar: 'إداري', en: 'Administrative' },
  OTHER: { ar: 'أخرى', en: 'Other' },
};

function extractCostCenterTypes(src: string): Record<string, string> {
  const m = src.match(/costCenterTypes:\s*\{([\s\S]*?)\n\s*\}/);
  if (!m) return {};
  const out: Record<string, string> = {};
  for (const line of m[1].split(/\r?\n/)) {
    const kv = line.match(/^\s*([A-Z_]+):\s*'([^']*)'/);
    if (kv) out[kv[1]] = kv[2];
  }
  return out;
}

describe('Cost Center edit/save contract', () => {
  describe('L. unchanged edit does not require a reason on the frontend', () => {
    it('computes sensitiveChanged from null-normalized parentId/date/isPrimary equality', () => {
      const page = readWeb(PAGE);
      expect(page).toContain('toInputDate(editItem.effectiveFrom) !== form.effectiveFrom');
      expect(page).toContain('toInputDate(editItem.effectiveTo) !== form.effectiveTo');
      expect(page).toContain('(form.parentId !== (editItem.parentId || \'\'))');
      expect(page).toContain('((form.isPrimary || false) !== (editItem.isPrimary || false))');
    });

    it('only requires a reason when sensitiveChanged is true', () => {
      const page = readWeb(PAGE);
      expect(page).toContain("if (sensitiveChanged && !form.reason.trim()) errors.reason = t('maintenance.reasonRequiredValidation');");
      expect(page).toMatch(/const sensitiveChanged =\s*editItem !== null &&/);
    });

    it('the reason is sent only for sensitive edits when provided', () => {
      const page = readWeb(PAGE);
      expect(page).toContain('if (sensitiveChanged && form.reason) payload.reason = form.reason;');
    });
  });

  describe('M. edit payload preserves null-stored parent and primary state', () => {
    it('sends the current parent and primary on edit so cleared values persist', () => {
      const page = readWeb(PAGE);
      expect(page).toContain("payload.parentId = form.parentId || '';");
      expect(page).toContain('payload.isPrimary = form.isPrimary;');
    });

    it('keeps create payload minimal (no empty parent/primary)', () => {
      const page = readWeb(PAGE);
      expect(page).toContain('if (form.parentId) payload.parentId = form.parentId;');
      expect(page).toContain('if (form.isPrimary) payload.isPrimary = true;');
    });
  });
});

describe('Cost Center type localization', () => {
  describe('Q. all 8 enum values have Arabic labels', () => {
    it('defines every supported type under maintenance.costCenterTypes', () => {
      const types = extractCostCenterTypes(AR_LOCALE);
      for (const type of Object.keys(EXPECTED)) {
        expect(types[type]).toBeTruthy();
      }
    });

    it('maps each type to the exact expected Arabic label', () => {
      const types = extractCostCenterTypes(AR_LOCALE);
      for (const [type, labels] of Object.entries(EXPECTED)) {
        expect(types[type]).toBe(labels.ar);
      }
    });
  });

  describe('R. all 8 enum values have English labels', () => {
    it('defines every supported type with the exact English label', () => {
      const types = extractCostCenterTypes(EN_LOCALE);
      for (const [type, labels] of Object.entries(EXPECTED)) {
        expect(types[type]).toBe(labels.en);
      }
    });
  });

  describe('S. internal enums are never translated in the form state', () => {
    it('the create form initializes the internal type to the raw enum PRODUCTION', () => {
      const page = readWeb(PAGE);
      expect(page).toContain("type: 'PRODUCTION'");
    });

    it('the option value stays the raw enum while only the visible label is localized', () => {
      const page = readWeb(PAGE);
      expect(page).toMatch(/options=\{COST_CENTER_TYPES\.map\(\(type\) => \(\{ value: type, label: typeLabel\(type\) \}\)/);
    });
  });

  describe('T+U. MAINTENANCE visible Greek/Arabic labels', () => {
    it('Arabic visible label is صيانة and English is Maintenance', () => {
      expect(EXPECTED.MAINTENANCE.ar).toBe('صيانة');
      expect(EXPECTED.MAINTENANCE.en).toBe('Maintenance');
    });
  });

  describe('V+W. create and edit forms use the localized label', () => {
    it('the type Select renders a localized label (header and options)', () => {
      const page = readWeb(PAGE);
      expect(page).toContain("label={t('maintenance.type')}");
      expect(page).toContain('options={COST_CENTER_TYPES.map((type) => ({ value: type, label: typeLabel(type) }))}');
    });

    it('the typeLabel helper resolves the i18n key without leaking the raw enum', () => {
      const page = readWeb(PAGE);
      expect(page).toContain('`maintenance.costCenterTypes.${type}`');
      expect(page).toContain('label: typeLabel(type)');
    });
  });

  describe('X+Y. save payload sends the raw enum, never the label', () => {
    it('the create/update payload type is form.type (internal enum)', () => {
      const page = readWeb(PAGE);
      expect(page).toContain('const payload: any = { name: form.name, type: form.type };');
    });

    it('never sends the Arabic or English display label as the type value', () => {
      const page = readWeb(PAGE);
      expect(page).not.toContain('type: labels.');
      expect(page).not.toContain("type: 'صيانة'");
      expect(page).not.toContain("type: 'Maintenance'");
    });
  });

  describe('Z. no supported type produces a generic translation fallback', () => {
    it('every supported type has a non-empty localized label in both locales', () => {
      const ar = extractCostCenterTypes(AR_LOCALE);
      const en = extractCostCenterTypes(EN_LOCALE);
      for (const type of Object.keys(EXPECTED)) {
        expect(ar[type]?.trim().length).toBeGreaterThan(0);
        expect(en[type]?.trim().length).toBeGreaterThan(0);
      }
    });
  });

  describe('AA. no raw supported enum is surfaced in the CostCenter select', () => {
    it('the CostCenter type select label is the localized helper', () => {
      const page = readWeb(PAGE);
      expect(page).toContain('label: typeLabel(type)');
    });

    it('no COST_CENTER_TYPES option uses the raw enum as its label', () => {
      const page = readWeb(PAGE);
      expect(page).not.toContain('COST_CENTER_TYPES.map((type) => ({ value: type, label: type }))');
    });

    it('the grid type column renders the localized label', () => {
      const page = readWeb(PAGE);
      expect(page).toContain("render: (c: CostCenter) => typeLabel(c.type)");
    });

    it('the cost-center F9 result type column renders a localized label', () => {
      const adapter = readWeb(ADAPTER);
      expect(adapter).toContain("costCenterTypeLabel(c.type)");
    });
  });
});