import * as fs from 'fs';
import * as path from 'path';

const webRoot = path.resolve(__dirname, '..');
const readLocaleFile = (lang: 'en' | 'ar', file: string) =>
  fs.readFileSync(path.resolve(webRoot, 'src/lib/i18n/locales', lang, file), 'utf8');

function extractValidationKeys(src: string): Record<string, string> {
  const match = src.match(/validation:\s*\{([\s\S]*?)\n\s*\}/);
  if (!match) return {};
  const out: Record<string, string> = {};
  for (const line of match[1].split(/\r?\n/)) {
    const kv = line.match(/^\s*([A-Za-z][\w]*):\s*'([^']*)'/);
    if (kv) out[kv[1]] = kv[2];
  }
  return out;
}

const GUARD_CODE = 'workOrderStartRequiresInProgressRequest';
const EN_VALIDATION = readLocaleFile('en', 'validation.ts');
const AR_VALIDATION = readLocaleFile('ar', 'validation.ts');

describe('R2-C work-order start guard localization', () => {
  describe('guard code is registered in both locales (no fallback text)', () => {
    it('defines the key under the validation namespace in EN', () => {
      const keys = extractValidationKeys(EN_VALIDATION);
      expect(keys[GUARD_CODE]).toBeTruthy();
    });

    it('defines the key under the validation namespace in AR', () => {
      const keys = extractValidationKeys(AR_VALIDATION);
      expect(keys[GUARD_CODE]).toBeTruthy();
    });

    it('resolves to a real human message, never the raw code, in EN', () => {
      const keys = extractValidationKeys(EN_VALIDATION);
      expect(keys[GUARD_CODE]).not.toBe(GUARD_CODE);
    });

    it('resolves to a real human message, never the raw code, in AR', () => {
      const keys = extractValidationKeys(AR_VALIDATION);
      expect(keys[GUARD_CODE]).not.toBe(GUARD_CODE);
    });
  });
});