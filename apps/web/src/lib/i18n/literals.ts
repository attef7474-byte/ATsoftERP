import { Locale } from './types';
import en from './locales/en';
import ar from './locales/ar';

const allTranslations = { en, ar };

export function translateStatus(status: string, locale: Locale): string {
  const translations = allTranslations[locale];
  const statusKey = status?.toUpperCase();
  const statusMap = translations.status as Record<string, string>;
  if (statusMap && statusMap[statusKey]) {
    return statusMap[statusKey];
  }
  if (statusMap && statusMap[status]) {
    return statusMap[status];
  }
  return status || '-';
}

export function translateEnum(value: string, locale: Locale, ns?: string): string {
  const translations = allTranslations[locale];
  if (ns && (translations as any)[ns]) {
    const nsData = (translations as any)[ns] as Record<string, string>;
    if (nsData[value]) return nsData[value];
  }
  const statusMap = translations.status as Record<string, string>;
  if (statusMap[value]) return statusMap[value];
  return value || '-';
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
