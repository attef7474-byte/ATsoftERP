import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import './globals.css';
import { I18nProvider } from '../lib/i18n/i18n-provider';
import { ToastProvider } from '../components/admin/toast-provider';
import { ErrorModalProvider } from '../components/admin/error-modal';
import { AuthProvider } from '../lib/auth-context';
import { LOCALE_COOKIE_NAME, normalizeLocale } from '../lib/i18n/locale-shared';

export const metadata: Metadata = {
  title: 'ATsoft ERP',
  description: 'Enterprise Resource Planning System',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const locale = normalizeLocale(cookieStore.get(LOCALE_COOKIE_NAME)?.value);
  const dir = locale === 'ar' ? 'rtl' : 'ltr';
  return (
    <html lang={locale} dir={dir} suppressHydrationWarning>
      <body className="bg-gray-50 text-gray-900 antialiased">
        <I18nProvider>
          <ToastProvider>
            <ErrorModalProvider>
              <AuthProvider>
                {children}
              </AuthProvider>
            </ErrorModalProvider>
          </ToastProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
