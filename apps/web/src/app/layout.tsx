import type { Metadata } from 'next';
import './globals.css';
import { I18nProvider } from '../lib/i18n/i18n-provider';
import { ToastProvider } from '../components/admin/toast-provider';

export const metadata: Metadata = {
  title: 'ATsoft ERP',
  description: 'Enterprise Resource Planning System',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" dir="ltr" suppressHydrationWarning>
      <body className="bg-gray-50 text-gray-900 antialiased">
        <I18nProvider>
          <ToastProvider>
            {children}
          </ToastProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
