import { resolveTranslation } from '../src/lib/i18n/translation-core';
import { normalizeApiError } from '../src/lib/error-utils';
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

const enValidation = flatten((en as any).validation ?? {}, 'validation');
const arValidation = flatten((ar as any).validation ?? {}, 'validation');

const dictionary: Record<string, string> = {
  ...enValidation,
  'errors.badRequest': 'Bad request.',
  'errorDialog.title': 'Error',
};

const t = (key: string): string => dictionary[key] ?? key;

describe('person-assignment leadership department validation', () => {
  it('provides the leadership validation keys in both locales', () => {
    expect(enValidation['validation.leadershipDepartmentRequired']?.trim().length).toBeGreaterThan(0);
    expect(arValidation['validation.leadershipDepartmentRequired']?.trim().length).toBeGreaterThan(0);
    expect(enValidation['validation.leadershipAdministrationRequired']?.trim().length).toBeGreaterThan(0);
    expect(arValidation['validation.leadershipAdministrationRequired']?.trim().length).toBeGreaterThan(0);
  });

  it('keeps the validation key sets synchronized between locales including the new leadership keys', () => {
    expect(Object.keys(enValidation).sort()).toEqual(Object.keys(arValidation).sort());
  });

  it('resolves the leadership department key through resolveTranslation to a real message, not the fallback', () => {
    const enResolved = resolveTranslation(en as any, 'en', 'validation.leadershipDepartmentRequired', 'validation');
    const arResolved = resolveTranslation(ar as any, 'ar', 'validation.leadershipDepartmentRequired', 'validation');
    expect(enResolved).not.toBe('The requested text could not be displayed.');
    expect(arResolved).not.toBe('تعذر عرض النص المطلوب.');
    expect(enResolved.trim().length).toBeGreaterThan(0);
    expect(arResolved.trim().length).toBeGreaterThan(0);
  });

  it('preserves the explicit backend message for known validation codes and never leaks raw code or fallback', () => {
    const err = new Error('HTTP 400') as Error & { status?: number };
    (err as any).response = {
      status: 400,
      data: {
        success: false,
        statusCode: 400,
        message: 'Validation failed',
        errors: [{ field: 'leadershipLevel', code: 'validation.leadershipDepartmentRequired', message: 'SUPERVISOR requires a departmentId' }],
      },
    };
    err.status = 400;
    const config = normalizeApiError(err, t);
    const fieldError = (config.errors ?? [])[0];
    expect(fieldError?.message).toBe('SUPERVISOR requires a departmentId');
    expect(fieldError?.message).not.toBe('The requested text could not be displayed.');
    expect(fieldError?.code).toBe('validation.leadershipDepartmentRequired');
  });

  it('localizes a known validation code when no backend message is sent, instead of the fallback or raw code', () => {
    const err = new Error('HTTP 400') as Error & { status?: number };
    (err as any).response = {
      status: 400,
      data: {
        success: false,
        statusCode: 400,
        message: 'Validation failed',
        errors: [{ field: 'leadershipLevel', code: 'validation.leadershipDepartmentRequired' }],
      },
    };
    err.status = 400;
    const config = normalizeApiError(err, t);
    const fieldError = (config.errors ?? [])[0];
    expect(fieldError?.message).toBe('A department is required for the selected leadership level.');
    expect(fieldError?.message).not.toBe('validation.leadershipDepartmentRequired');
    expect(fieldError?.message).not.toBe('The requested text could not be displayed.');
  });
});