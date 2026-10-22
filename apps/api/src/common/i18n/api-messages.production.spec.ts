import { readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';
import { getApiMessage, getApiMessageEntry } from './api-messages';

/**
 * Production message key resolution guard.
 *
 * `getApiMessage()` returns the KEY ITSELF when a key is absent from the API
 * catalog. The API exception filter answers every `messageKey` it receives
 * through that function, so a missing key makes the API echo a raw translation
 * key to the client and the web client loses the precise, localized message.
 *
 * This guard therefore scans the API source for every production message key
 * (static keys and the dynamic `<group>.<action>StateInvalid` / counter error
 * code keys) and requires each one to exist with real English and Arabic text.
 */
const API_SRC = join(__dirname, '..', '..');

function walk(dir: string, acc: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, acc);
    else if (/\.ts$/.test(name) && !/\.spec\.ts$/.test(name)) acc.push(p);
  }
  return acc;
}

const PRODUCTION_KEY = /^production[A-Z.]/;

function collectProductionKeys(): string[] {
  const keys = new Set<string>();
  for (const file of walk(API_SRC)) {
    const src = readFileSync(file, 'utf8');
    for (const m of src.matchAll(/messageKey:\s*'([A-Za-z0-9_.]+)'/g)) {
      if (PRODUCTION_KEY.test(m[1])) keys.add(m[1]);
    }
    for (const m of src.matchAll(/localizedApiError\(\s*'([A-Za-z0-9_.]+)'/g)) {
      if (PRODUCTION_KEY.test(m[1])) keys.add(m[1]);
    }
    // Dynamic keys built at runtime:
    //   `productionRun.${action.toLowerCase()}StateInvalid`
    //   `productionOrder.${action.toLowerCase()}StateInvalid`
    //   `productionMeasurementPoint.${action.toLowerCase()}StateInvalid`
    //   `productionRun.${normalized.errorCode}`
    for (const m of src.matchAll(/messageKey:\s*`(production[A-Za-z.]+)\.\$\{([^}]+)\}`/g)) {
      const group = m[1];
      const expression = m[2];
      if (expression.includes('errorCode')) {
        for (const code of ['counterBackwardsWithoutReset', 'counterRolloverInvalid', 'counterBackwardsWithoutModulus']) {
          keys.add(`${group}.${code}`);
        }
        continue;
      }
      const actionSets: Record<string, string[]> = {
        'productionRun': ['PAUSE', 'RESUME', 'COMPLETE', 'ABORT'],
        'productionOrder': ['CANCEL', 'ARCHIVE', 'CLOSE', 'REOPEN'],
        'productionMeasurementPoint': ['ACTIVATE', 'DEACTIVATE'],
      };
      for (const action of actionSets[group] || []) {
        keys.add(`${group}.${action.toLowerCase()}StateInvalid`);
      }
    }
  }
  return [...keys].sort();
}

const PRODUCTION_KEYS = collectProductionKeys();

describe('Production API message key resolution', () => {
  it('discovers the production message keys raised by the API', () => {
    expect(PRODUCTION_KEYS.length).toBeGreaterThan(100);
    expect(PRODUCTION_KEYS).toContain('productionOrder.notFound');
    expect(PRODUCTION_KEYS).toContain('productionRun.notFound');
  });

  it.each(PRODUCTION_KEYS)('%s exists in the API catalog', (key) => {
    expect(getApiMessageEntry(key)).toBeDefined();
  });

  it.each(PRODUCTION_KEYS)('%s resolves to real English text, never the key', (key) => {
    const en = getApiMessage(key, 'en-US');
    expect(en).not.toBe(key);
    expect(en.trim().length).toBeGreaterThan(0);
  });

  it.each(PRODUCTION_KEYS)('%s resolves to real Arabic text, never the key', (key) => {
    const ar = getApiMessage(key, 'ar');
    expect(ar).not.toBe(key);
    expect(/[\u0600-\u06FF]/.test(ar)).toBe(true);
  });

  it('no production message key is missing from the catalog', () => {
    const unresolved = PRODUCTION_KEYS.filter((key) => !getApiMessageEntry(key));
    expect(unresolved).toEqual([]);
  });

  it('English and Arabic text differ for every production message key', () => {
    const identical = PRODUCTION_KEYS.filter((key) => getApiMessage(key, 'en-US') === getApiMessage(key, 'ar'));
    expect(identical).toEqual([]);
  });

  it('substitutes runtime parameters into localized production messages', () => {
    const en = getApiMessage('productionShiftHandover.shiftNotFound', 'en-US', { shiftId: 'SH-12' });
    const ar = getApiMessage('productionShiftHandover.shiftNotFound', 'ar', { shiftId: 'SH-12' });
    expect(en).toContain('SH-12');
    expect(en).not.toContain('{shiftId}');
    expect(ar).toContain('SH-12');
    expect(ar).not.toContain('{shiftId}');
  });
});
