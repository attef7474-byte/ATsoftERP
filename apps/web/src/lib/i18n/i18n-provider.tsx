'use client';
import React, { createContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { Locale, I18nContextValue, TranslationNamespace, TranslationParams } from './types';
import { resolveTranslation, reportMissingTranslationKey } from './translation-core';
import { LOCALE_COOKIE_NAME, normalizeLocale, parseCookieValue } from './locale-shared';
import en from './locales/en';
import ar from './locales/ar';

const translations = { en, ar };

export const I18nContext = createContext<I18nContextValue | null>(null);

export { LOCALE_COOKIE_NAME, normalizeLocale };

function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  return parseCookieValue(document.cookie, name);
}

function setCookie(name: string, value: string, maxAgeDays: number): void {
  if (typeof document === 'undefined') return;
  const maxAge = maxAgeDays * 24 * 60 * 60;
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${maxAge}; SameSite=Lax`;
}

export function getStoredLocale(): Locale {
  if (typeof document !== 'undefined') {
    const fromCookie = getCookie(LOCALE_COOKIE_NAME);
    if (fromCookie) return normalizeLocale(fromCookie);
    const fromStorage = localStorage.getItem('locale');
    if (fromStorage) return normalizeLocale(fromStorage);
  }
  return 'ar';
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>('ar');

  useEffect(() => {
    setLocaleState(getStoredLocale());
  }, []);

  const setLocale = useCallback((newLocale: Locale) => {
    const safe = normalizeLocale(newLocale);
    setLocaleState(safe);
    setCookie(LOCALE_COOKIE_NAME, safe, 365);
    try {
      localStorage.setItem('locale', safe);
    } catch {
      // Storage may be unavailable (private mode); cookie still applies.
    }
    document.documentElement.lang = safe;
    document.documentElement.dir = safe === 'ar' ? 'rtl' : 'ltr';
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = locale === 'ar' ? 'rtl' : 'ltr';
  }, [locale]);

  const t = useCallback(
    (key: string, ns?: TranslationNamespace, params?: TranslationParams): string => {
      const safeLocale = normalizeLocale(locale);
      const localeData = translations[safeLocale] as Partial<Record<TranslationNamespace, Record<string, unknown>>>;
      return resolveTranslation(localeData, safeLocale, key, ns, params);
    },
    [locale],
  );

  const value: I18nContextValue = {
    locale,
    setLocale,
    t,
    dir: locale === 'ar' ? 'rtl' : 'ltr',
  };

  return React.createElement(I18nContext.Provider, { value }, children);
}

export { reportMissingTranslationKey };
