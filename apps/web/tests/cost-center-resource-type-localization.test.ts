import * as fs from 'fs';
import * as path from 'path';

const webRoot = path.resolve(__dirname, '..');
const read = (rel: string) => fs.readFileSync(path.resolve(webRoot, rel), 'utf8');

const PAGE = 'src/app/admin/maintenance/cost-centers/page.tsx';
const AR_LOCALE = read('src/lib/i18n/locales/ar/maintenance.ts');
const EN_LOCALE = read('src/lib/i18n/locales/en/maintenance.ts');

function extractResourceTypeOptions(src: string): Record<string, string> {
  const m = src.match(/resourceTypeOptions:\s*\{([\s\S]*?)\n\s*\}/);
  if (!m) return {};
  const out: Record<string, string> = {};
  for (const line of m[1].split(/\r?\n/)) {
    const kv = line.match(/^\s*([A-Z_]+):\s*'([^']*)'/);
    if (kv) out[kv[1]] = kv[2];
  }
  return out;
}

describe('Cost Center Resolve dialog resource-type localization', () => {
  describe('L+N. MACHINE/LINE/UNIT Arabic labels', () => {
    it('MACHINE maps to آلة', () => {
      expect(extractResourceTypeOptions(AR_LOCALE).MACHINE).toBe('آلة');
    });
    it('LINE maps to خط إنتاج', () => {
      expect(extractResourceTypeOptions(AR_LOCALE).LINE).toBe('خط إنتاج');
    });
    it('UNIT maps to وحدة', () => {
      expect(extractResourceTypeOptions(AR_LOCALE).UNIT).toBe('وحدة');
    });
  });

  describe('O-Q. MACHINE/LINE/UNIT English labels', () => {
    it('MACHINE maps to Machine', () => {
      expect(extractResourceTypeOptions(EN_LOCALE).MACHINE).toBe('Machine');
    });
    it('LINE maps to Production Line', () => {
      expect(extractResourceTypeOptions(EN_LOCALE).LINE).toBe('Production Line');
    });
    it('UNIT maps to Unit', () => {
      expect(extractResourceTypeOptions(EN_LOCALE).UNIT).toBe('Unit');
    });
  });

  describe('R. internal values remain MACHINE/LINE/UNIT', () => {
    it('the resolve form initializes resourceType to the raw enum MACHINE', () => {
      const page = read(PAGE);
      expect(page).toContain("resourceType: 'MACHINE'");
    });

    it('the RESOURCE_TYPES constant keeps the raw internal values', () => {
      const page = read(PAGE);
      expect(page).toContain("const RESOURCE_TYPES = ['MACHINE', 'LINE', 'UNIT'] as const;");
    });
  });

  describe('S. resolve submit sends the raw enum', () => {
    it('the resolve payload uses resolveForm.resourceType (internal enum)', () => {
      const page = read(PAGE);
      expect(page).toContain('const payload: any = { resourceType: resolveForm.resourceType, referenceDate: resolveForm.referenceDate };');
    });

    it('never sends an Arabic/English label as the resourceType value', () => {
      const page = read(PAGE);
      expect(page).not.toContain("resourceType: 'آلة'");
      expect(page).not.toContain("resourceType: 'Machine'");
    });
  });

  describe('T. no raw enum visible in the Resolve dialog when a translation exists', () => {
    it('the Resolve dialog Select renders the localized label helper', () => {
      const page = read(PAGE);
      expect(page).toContain('options={RESOURCE_TYPES.map((type) => ({ value: type, label: resourceTypeLabel(type) }))}');
    });

    it('the resourceTypeLabel helper resolves the i18n key', () => {
      const page = read(PAGE);
      expect(page).toContain('`maintenance.resourceTypeOptions.${type}`');
      expect(page).toContain('return localized && localized !== key && localized !== fallback ? localized : type;');
    });
  });
});