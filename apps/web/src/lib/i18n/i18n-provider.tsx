'use client';
import React, { createContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { Locale, I18nContextValue, TranslationNamespace } from './types';
import en from './locales/en';
import ar from './locales/ar';

const translations = { en, ar };

export const I18nContext = createContext<I18nContextValue | null>(null);

function getNestedValue(obj: any, path: string): string | undefined {
  return path.split('.').reduce((acc, part) => (acc && acc[part] !== undefined ? acc[part] : undefined), obj);
}

function normalizeLocale(raw: unknown): Locale {
  if (typeof raw !== 'string') return 'ar';
  const lower = raw.toLowerCase().replace(/-/g, '_');
  if (lower === 'en' || lower.startsWith('en_')) return 'en';
  if (lower === 'ar' || lower.startsWith('ar_')) return 'ar';
  return 'ar';
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>('ar');

  useEffect(() => {
    const stored = localStorage.getItem('locale');
    setLocaleState(normalizeLocale(stored));
  }, []);

  const setLocale = useCallback((newLocale: Locale) => {
    const safe = normalizeLocale(newLocale);
    setLocaleState(safe);
    localStorage.setItem('locale', safe);
    document.documentElement.lang = safe;
    document.documentElement.dir = safe === 'ar' ? 'rtl' : 'ltr';
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = locale === 'ar' ? 'rtl' : 'ltr';
  }, [locale]);

  const t = useCallback(
    (key: string, ns?: TranslationNamespace): string => {
      const safeLocale = normalizeLocale(locale);
      const localeData = translations[safeLocale];
      if (!localeData) return key;
      const dotIndex = key.indexOf('.');
      const actualNs = ns ?? (dotIndex >= 0 ? key.substring(0, dotIndex) as TranslationNamespace : 'common');
      const actualKey = (dotIndex >= 0 && ns === undefined) ? key.substring(dotIndex + 1) : key;
      const nsData = localeData[actualNs];
      if (!nsData) return key;
      const value = getNestedValue(nsData, actualKey);
      if (typeof value === 'string') return value;
      return key;
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
