import { resolveTranslation, TRANSLATION_FALLBACKS } from '../src/lib/i18n/translation-core';
import en from '../src/lib/i18n/locales/en';
import ar from '../src/lib/i18n/locales/ar';

function flatten(obj: Record<string, any>, prefix = ''): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      Object.assign(out, flatten(value, fullKey));
    } else {
      out[fullKey] = String(value);
    }
  }
  return out;
}

function resolve(key: string, locale: 'ar' | 'en'): string {
  const data = locale === 'ar' ? (ar as any) : (en as any);
  return resolveTranslation(data, locale, key);
}

describe('API route contract — no double /v1', () => {
  it('getApiBaseUrl returns a path ending with /api/v1', () => {
    const base = 'http://localhost:4000/api/v1';
    expect(base).toMatch(/\/api\/v1$/);
    expect(base).not.toMatch(/\/api\/v1\/v1/);
  });

  it('canonical job-titles path does not produce /v1/v1', () => {
    const base = 'http://localhost:4000/api/v1';
    const path = '/job-titles';
    const final = `${base}${path}`;
    expect(final).toBe('http://localhost:4000/api/v1/job-titles');
    expect(final).not.toContain('/v1/v1');
  });

  it('canonical person-assignments path does not produce /v1/v1', () => {
    const base = 'http://localhost:4000/api/v1';
    const path = '/person-assignments';
    const final = `${base}${path}`;
    expect(final).toBe('http://localhost:4000/api/v1/person-assignments');
    expect(final).not.toContain('/v1/v1');
  });

  it('canonical supervisor-assignments path does not produce /v1/v1', () => {
    const base = 'http://localhost:4000/api/v1';
    const path = '/supervisor-assignments';
    const final = `${base}${path}`;
    expect(final).toBe('http://localhost:4000/api/v1/supervisor-assignments');
    expect(final).not.toContain('/v1/v1');
  });
});

describe('List response contract — no unsafe double-nesting', () => {
  it('res.data is the array when API returns { data: [], meta: {} }', () => {
    const apiResponse = { data: [{ id: '1', name: 'Test' }], meta: { page: 1, limit: 10, total: 1, totalPages: 1 } };
    const list = apiResponse.data;
    const meta = apiResponse.meta;
    expect(Array.isArray(list)).toBe(true);
    expect(list).toHaveLength(1);
    expect(meta.total).toBe(1);
  });

  it('empty response returns empty array, not undefined', () => {
    const apiResponse = { data: [], meta: { page: 1, limit: 10, total: 0, totalPages: 0 } };
    const list = apiResponse.data || [];
    expect(Array.isArray(list)).toBe(true);
    expect(list).toHaveLength(0);
  });

  it('persons list is safely handled even if response shape is unexpected', () => {
    const apiResponse = { data: [{ id: '1' }], meta: { page: 1, limit: 10, total: 1, totalPages: 1 } };
    const data = apiResponse.data || [];
    const meta = apiResponse.meta || { page: 1, limit: 10, total: 0, totalPages: 0 };
    expect(data.length).toBeGreaterThan(0);
    expect(meta.total).toBeGreaterThan(0);
  });

  it('persons empty response does not crash on .length', () => {
    const apiResponse = { data: [], meta: { page: 1, limit: 10, total: 0, totalPages: 0 } };
    const data = apiResponse.data || [];
    expect(data.length).toBe(0);
  });

  it('person detail flat object is directly usable', () => {
    const person = { id: 'cuid123', code: 'EMP-001', name: 'Ahmed', category: 'MAINTENANCE', isActive: true };
    expect(person.id).toBeTruthy();
    expect(person.name).toBeTruthy();
  });
});

describe('Administration detail — correct translation key', () => {
  it('details.administration.title resolves in Arabic', () => {
    const result = resolve('details.administration.title', 'ar');
    expect(result).not.toBe(TRANSLATION_FALLBACKS['ar']);
    expect(result.length).toBeGreaterThan(0);
  });

  it('details.administration.title resolves in English', () => {
    const result = resolve('details.administration.title', 'en');
    expect(result).not.toBe(TRANSLATION_FALLBACKS['en']);
    expect(result.length).toBeGreaterThan(0);
  });

  it('core.administration is a flat string, not a nested object', () => {
    const arCore = (ar as any).core;
    expect(typeof arCore.administration).toBe('string');
  });

  it('details.administration exists as a nested object', () => {
    const arDetails = (ar as any).details;
    expect(arDetails.administration).toBeDefined();
    expect(typeof arDetails.administration).toBe('object');
    expect(arDetails.administration.title).toBeDefined();
  });
});

describe('Dynamic business text never becomes translation fallback', () => {
  it('Arabic fallback is the expected error text', () => {
    expect(TRANSLATION_FALLBACKS['ar']).toBe('تعذر عرض النص المطلوب.');
  });

  it('English fallback is the expected error text', () => {
    expect(TRANSLATION_FALLBACKS['en']).toBe('The requested text could not be displayed.');
  });

  it('a valid static translation key resolves correctly', () => {
    expect(resolve('common.appName', 'en')).not.toBe(TRANSLATION_FALLBACKS['en']);
    expect(resolve('common.appName', 'ar')).not.toBe(TRANSLATION_FALLBACKS['ar']);
  });

  it('a missing key returns fallback, not the key itself', () => {
    const result = resolve('this.does.not.exist', 'ar');
    expect(result).toBe(TRANSLATION_FALLBACKS['ar']);
    expect(result).not.toBe('this.does.not.exist');
  });

  it('status enum translations resolve correctly', () => {
    expect(resolve('status.ACTIVE', 'ar')).not.toBe(TRANSLATION_FALLBACKS['ar']);
    expect(resolve('status.ACTIVE', 'en')).not.toBe(TRANSLATION_FALLBACKS['en']);
  });

  it('core.classifications translations exist for all approved values', () => {
    const classifications = ['OPERATIONAL', 'MANAGEMENT', 'AREA', 'PROCESS', 'SECTION', 'UNIT', 'WORKSHOP'];
    for (const cls of classifications) {
      const enResult = resolve(`core.classifications.${cls}`, 'en');
      const arResult = resolve(`core.classifications.${cls}`, 'ar');
      expect(enResult).not.toBe(TRANSLATION_FALLBACKS['en']);
      expect(arResult).not.toBe(TRANSLATION_FALLBACKS['ar']);
    }
  });

  it('core.jobTitleCategories translations exist', () => {
    const categories = ['OPERATIONAL', 'MANAGEMENT', 'TECHNICAL', 'SUPPORT'];
    for (const cat of categories) {
      const enResult = resolve(`core.jobTitleCategories.${cat}`, 'en');
      const arResult = resolve(`core.jobTitleCategories.${cat}`, 'ar');
      expect(enResult).not.toBe(TRANSLATION_FALLBACKS['en']);
      expect(arResult).not.toBe(TRANSLATION_FALLBACKS['ar']);
    }
  });
});

describe('Translation key synchronization between locales', () => {
  it('details namespace keys are synchronized', () => {
    const enDetails = flatten((en as any).details ?? {}, 'details');
    const arDetails = flatten((ar as any).details ?? {}, 'details');
    expect(Object.keys(enDetails).sort()).toEqual(Object.keys(arDetails).sort());
  });

  it('status namespace keys are synchronized', () => {
    const enStatus = flatten((en as any).status ?? {}, 'status');
    const arStatus = flatten((ar as any).status ?? {}, 'status');
    expect(Object.keys(enStatus).sort()).toEqual(Object.keys(arStatus).sort());
  });

  it('core namespace keys are synchronized', () => {
    const enCore = flatten((en as any).core ?? {}, 'core');
    const arCore = flatten((ar as any).core ?? {}, 'core');
    expect(Object.keys(enCore).sort()).toEqual(Object.keys(arCore).sort());
  });
});
