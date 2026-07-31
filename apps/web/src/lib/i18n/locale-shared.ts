import { Locale } from './types';

export const LOCALE_COOKIE_NAME = 'atsoft_locale';

export function normalizeLocale(raw: unknown): Locale {
  if (typeof raw !== 'string') return 'ar';
  const lower = raw.toLowerCase().replace(/-/g, '_');
  if (lower === 'en' || lower.startsWith('en_')) return 'en';
  if (lower === 'ar' || lower.startsWith('ar_')) return 'ar';
  return 'ar';
}

export function parseCookieValue(cookieHeader: string | null | undefined, name: string): string | null {
  if (!cookieHeader) return null;
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = new RegExp(`(?:^|;\\s*)${escaped}=([^;]*)`).exec(cookieHeader);
  return match ? decodeURIComponent(match[1]) : null;
}

export function getClientLocale(): Locale {
  if (typeof window === 'undefined') return 'ar';
  const fromCookie = parseCookieValue(document.cookie, LOCALE_COOKIE_NAME);
  if (fromCookie) return normalizeLocale(fromCookie);
  try {
    const fromStorage = localStorage.getItem('locale');
    if (fromStorage) return normalizeLocale(fromStorage);
  } catch {
    // Storage may be unavailable (private mode); continue to lang attribute.
  }
  if (document.documentElement && document.documentElement.lang) {
    return normalizeLocale(document.documentElement.lang);
  }
  return 'ar';
}
