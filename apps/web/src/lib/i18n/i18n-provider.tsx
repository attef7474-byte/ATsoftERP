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

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>('en');

  useEffect(() => {
    const stored = localStorage.getItem('locale') as Locale | null;
    if (stored === 'en' || stored === 'ar') {
      setLocaleState(stored);
    }
  }, []);

  const setLocale = useCallback((newLocale: Locale) => {
    setLocaleState(newLocale);
    localStorage.setItem('locale', newLocale);
    document.documentElement.lang = newLocale;
    document.documentElement.dir = newLocale === 'ar' ? 'rtl' : 'ltr';
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = locale === 'ar' ? 'rtl' : 'ltr';
  }, [locale]);

  const t = useCallback(
    (key: string, ns: TranslationNamespace = 'common'): string => {
      const localeData = translations[locale];
      const nsData = localeData[ns];
      if (!nsData) return key;
      const value = getNestedValue(nsData, key);
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
