'use client';
import { useTranslation } from '../../lib/i18n/use-translation';

export function LanguageSwitcher() {
  const { locale, setLocale } = useTranslation();
  return (
    <button
      onClick={() => setLocale(locale === 'en' ? 'ar' : 'en')}
      className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
    >
      {locale === 'en' ? 'العربية' : 'English'}
    </button>
  );
}
