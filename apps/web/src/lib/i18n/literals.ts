import { Locale } from './types';
import en from './locales/en';
import ar from './locales/ar';

const allTranslations = { en, ar };

function getNestedValue(source: unknown, path: string): string | undefined {
  const value = path.split('.').reduce<unknown>((current, part) => {
    if (!current || typeof current !== 'object') return undefined;
    return (current as Record<string, unknown>)[part];
  }, source);
  return typeof value === 'string' ? value : undefined;
}

function toCamelCase(value: string): string {
  return value
    .toLowerCase()
    .replace(/[_\s-]+(.)?/g, (_, char: string | undefined) => char ? char.toUpperCase() : '');
}

function translateFromNamespaces(value: string, locale: Locale, namespaces: string[]): string | undefined {
  const translations = allTranslations[locale] as Record<string, unknown>;
  const candidates = Array.from(new Set([
    value,
    value.toUpperCase(),
    value.toLowerCase(),
    toCamelCase(value),
  ]));

  for (const namespace of namespaces) {
    const namespaceData = translations[namespace];
    for (const candidate of candidates) {
      const translated = getNestedValue(namespaceData, candidate);
      if (translated) return translated;
    }
  }
  return undefined;
}

function humanize(value: string): string {
  return value
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export function translateStatus(status: string, locale: Locale): string {
  if (!status) return '-';
  return translateFromNamespaces(status, locale, ['status']) || humanize(status);
}

export function translateEnum(value: string, locale: Locale, ns?: string): string {
  if (!value) return '-';
  const namespaces = ns
    ? [ns, 'status', 'actions']
    : ['status', 'actions', 'maintenance', 'inventoryCounting', 'inventory', 'barcodes'];
  return translateFromNamespaces(value, locale, namespaces) || humanize(value);
}

export function translateAuditAction(value: string, locale: Locale): string {
  if (!value) return '-';
  return translateFromNamespaces(value, locale, ['actions', 'status']) || humanize(value);
}

export function translateMaintenanceType(value: string, locale: Locale): string {
  return translateEnum(value, locale, 'maintenance');
}

export function translatePriority(value: string, locale: Locale): string {
  return translateStatus(value, locale);
}

export function translateBarcodeType(value: string, locale: Locale): string {
  return translateEnum(value, locale, 'barcodes');
}

export function translateEntityType(value: string, locale: Locale): string {
  if (!value) return '-';
  return translateFromNamespaces(value, locale, ['status', 'barcodes', 'maintenance', 'inventory']) || humanize(value);
}

export function translateUnit(value: string, locale: Locale): string {
  if (!value) return '';
  if (value === '%') return value;
  return translateFromNamespaces(value, locale, ['common']) || humanize(value);
}

export function translateMovementType(value: string, locale: Locale): string {
  if (!value) return '-';
  return translateFromNamespaces(value, locale, ['status', 'inventoryCounting', 'inventory']) || humanize(value);
}

export function formatDate(date: string | Date | null | undefined, locale: Locale): string {
  if (!date) return '-';
  try {
    return new Date(date).toLocaleDateString(locale === 'ar' ? 'ar-SA' : 'en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return '-';
  }
}

export function formatDateTime(date: string | Date | null | undefined, locale: Locale): string {
  if (!date) return '-';
  try {
    return new Date(date).toLocaleString(locale === 'ar' ? 'ar-SA' : 'en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '-';
  }
}
