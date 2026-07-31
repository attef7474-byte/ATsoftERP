import { Locale, TranslationNamespace, TranslationParams, TranslationValue } from './types';

export const TRANSLATION_FALLBACKS: Record<Locale, string> = {
  ar: 'تعذر عرض النص المطلوب.',
  en: 'The requested text could not be displayed.',
};

const reportedMissingKeys = new Set<string>();

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function getNestedTranslationValue(
  source: unknown,
  path: string,
): TranslationValue | undefined {
  const value = path.split('.').reduce<unknown>((current, part) => {
    if (!isRecord(current)) return undefined;
    return current[part];
  }, source);
  return typeof value === 'string' || isRecord(value) ? value as TranslationValue : undefined;
}

/**
 * Dev-only diagnostic for missing keys. Reports each key once per session so
 * the console stays readable while still surfacing every missing key.
 */
export function reportMissingTranslationKey(locale: Locale, key: string): void {
  if (typeof process !== 'undefined' && process.env.NODE_ENV === 'production') return;
  const id = `${locale}:${key}`;
  if (reportedMissingKeys.has(id)) return;
  reportedMissingKeys.add(id);
  if (typeof console !== 'undefined' && typeof console.warn === 'function') {
    console.warn(
      `[i18n] Missing translation key "${key}" for locale "${locale}". ` +
      'Add it to both locale files and register the namespace.',
    );
  }
}

/**
 * Named-parameter interpolation: replaces {name} placeholders with the given
 * values. Parameter values are HTML-escaped so dynamic content can never be
 * injected as markup. Callers must never render the result with
 * dangerouslySetInnerHTML.
 */
export function interpolateTranslation(
  template: string,
  params?: TranslationParams,
): string {
  if (!params) return template;
  return template.replace(/\{([a-zA-Z][a-zA-Z0-9_]*)\}/g, (placeholder, name: string) => {
    const raw = params[name];
    if (raw === undefined || raw === null) return placeholder;
    return String(raw)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  });
}

/**
 * Resolves a translation key against a locale dictionary.
 *
 * - Namespace resolution: explicit ns wins; otherwise the key prefix is used;
 *   bare keys fall back to the "common" namespace.
 * - When an explicit ns is given and the key carries the same prefix, the
 *   prefix is stripped so both t('errors.generalError') and
 *   t('errors.generalError', 'errors') resolve.
 * - Missing keys return a localized human-readable fallback text (never the
 *   raw key) and are reported once per session in development.
 */
export function resolveTranslation(
  localeData: Partial<Record<TranslationNamespace, Record<string, unknown>>> | undefined,
  locale: Locale,
  key: string,
  ns?: TranslationNamespace,
  params?: TranslationParams,
): string {
  const dotIndex = key.indexOf('.');
  const explicitNs = ns !== undefined;
  const resolvedNs = ns ?? (dotIndex >= 0 ? key.substring(0, dotIndex) as TranslationNamespace : 'common');
  const nestedPath = explicitNs
    ? (dotIndex >= 0 && key.startsWith(`${resolvedNs}.`) ? key.substring(dotIndex + 1) : key)
    : (dotIndex >= 0 ? key.substring(dotIndex + 1) : key);

  const nsData = localeData?.[resolvedNs];
  const value = nsData !== undefined
    ? getNestedTranslationValue(nsData, nestedPath)
    : undefined;

  if (typeof value === 'string' && value.trim().length > 0) {
    return interpolateTranslation(value, params);
  }

  reportMissingTranslationKey(locale, key);
  return TRANSLATION_FALLBACKS[locale];
}
