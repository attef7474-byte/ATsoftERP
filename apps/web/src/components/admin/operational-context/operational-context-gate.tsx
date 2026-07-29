'use client';

import { useAuth, useOperationalContext } from '../../../lib/auth-context';
import { useTranslation } from '../../../lib/i18n/use-translation';
import { ContextSelector } from './context-selector';

export function OperationalContextGate() {
  const { t } = useTranslation();
  const { logout } = useAuth();
  const {
    allowedContexts,
    contextLoading,
    contextSelectionRequired,
    refreshContexts,
  } = useOperationalContext();

  if (contextLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
          <p className="mt-3 text-sm text-gray-600">{t('auth.context.loading')}</p>
        </div>
      </div>
    );
  }

  if (contextSelectionRequired) {
    return (
      <div className="min-h-screen bg-gray-50">
        <ContextSelector open required />
      </div>
    );
  }

  if (allowedContexts.length === 0) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
        <section className="w-full max-w-lg rounded-xl border border-gray-200 bg-white p-6 text-center shadow-sm">
          <svg
            className="mx-auto h-10 w-10 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.8}
              d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 4.5h.008v.008H12V16.5z"
            />
          </svg>
          <h1 className="mt-3 text-lg font-semibold text-gray-900">
            {t('auth.context.unavailableTitle')}
          </h1>
          <p className="mt-2 text-sm text-gray-600">{t('auth.context.unavailableHint')}</p>
          <div className="mt-5 flex justify-center gap-2">
            <button
              type="button"
              onClick={() => void refreshContexts()}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              {t('common.retry')}
            </button>
            <button
              type="button"
              onClick={logout}
              className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              {t('auth.logout')}
            </button>
          </div>
        </section>
      </div>
    );
  }

  return null;
}
