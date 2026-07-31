import { resolveTranslation, reportMissingTranslationKey, interpolateTranslation } from '../src/lib/i18n/translation-core';
import { Locale } from '../src/lib/i18n/types';

const enData: Partial<Record<string, Record<string, unknown>>> = {
  common: { appName: 'ATsoft ERP', close: 'Close', greeting: 'Hello {name}' },
  auth: { welcomeBack: 'Welcome back', email: 'Email' },
  status: { ACTIVE: 'Active', URGENT: 'Urgent' },
  validation: { required: 'This field is required' },
};

const arData: Partial<Record<string, Record<string, unknown>>> = {
  common: { appName: 'أتسوفت', close: 'إغلاق', greeting: 'مرحباً {name}' },
  auth: { welcomeBack: 'مرحباً بعودتك' },
  status: { ACTIVE: 'نشط', URGENT: 'عاجلة' },
};

function en(key: string, ns?: any, params?: Record<string, string | number>): string {
  return resolveTranslation(enData, 'en', key, ns, params);
}
function ar(key: string, ns?: any, params?: Record<string, string | number>): string {
  return resolveTranslation(arData, 'ar', key, ns, params);
}

describe('resolveTranslation', () => {
  it('resolves bare keys from the common namespace', () => {
    expect(en('common.appName')).toBe('ATsoft ERP');
    expect(en('close')).toBe('Close');
  });

  it('resolves namespaced keys', () => {
    expect(en('auth.welcomeBack')).toBe('Welcome back');
    expect(ar('auth.welcomeBack')).toBe('مرحباً بعودتك');
  });

  it('honors an explicit namespace and strips the matching prefix', () => {
    expect(en('welcomeBack', 'auth')).toBe('Welcome back');
    expect(en('auth.welcomeBack', 'auth')).toBe('Welcome back');
  });

  it('returns a localized fallback instead of the raw key for missing keys', () => {
    expect(en('common.doesNotExist')).toBe('The requested text could not be displayed.');
    expect(ar('common.doesNotExist')).toBe('تعذر عرض النص المطلوب.');
    expect(en('missing.nested.key', 'unknownNs')).toBe('The requested text could not be displayed.');
  });

  it('never returns the raw key', () => {
    const raw = en('this.key.does.not.exist.at.all');
    expect(raw).not.toBe('this.key.does.not.exist.at.all');
  });

  it('interpolates named params', () => {
    expect(en('common.greeting', undefined, { name: 'Ali' })).toBe('Hello Ali');
    expect(ar('common.greeting', undefined, { name: 'علي' })).toBe('مرحباً علي');
  });

  it('HTML-escapes interpolated values', () => {
    expect(en('common.greeting', undefined, { name: '<script>alert(1)</script>' })).toBe(
      'Hello &lt;script&gt;alert(1)&lt;/script&gt;',
    );
  });
});

describe('reportMissingTranslationKey', () => {
  it('reports a missing key once per session and suppresses after that', () => {
    const spy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    reportMissingTranslationKey('en', 'common.missingOnce');
    reportMissingTranslationKey('en', 'common.missingOnce');
    expect(spy).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });

  it('does nothing in production', () => {
    const env = process.env as Record<string, string | undefined>;
    const previous = env.NODE_ENV;
    env.NODE_ENV = 'production';
    const spy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    reportMissingTranslationKey('en', 'common.missingInProd');
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
    env.NODE_ENV = previous;
  });
});

describe('interpolateTranslation', () => {
  it('leaves text without placeholders untouched', () => {
    expect(interpolateTranslation('Plain text', {})).toBe('Plain text');
  });

  it('replaces all occurrences of the named placeholder', () => {
    expect(interpolateTranslation('{a}-{a}', { a: 'x' })).toBe('x-x');
  });

  it('keeps unknown placeholders as-is', () => {
    expect(interpolateTranslation('{a} {b}', { a: 'x' })).toBe('x {b}');
  });
});
