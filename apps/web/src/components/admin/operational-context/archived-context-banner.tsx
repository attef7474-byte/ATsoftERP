'use client';

import { useOperationalContext } from '../../../lib/auth-context';
import { useTranslation } from '../../../lib/i18n/use-translation';

/**
 * Persistent, unmissable indicator shown while an archived organizational
 * context is selected: archive browsing is read-only and the active context
 * stays exactly what it was.
 */
export function ArchivedContextBanner() {
  const { t, dir } = useTranslation();
  const { isArchivedContext, archivedContext, exitArchiveMode } = useOperationalContext();

  if (!isArchivedContext || !archivedContext) return null;

  const parts = [
    archivedContext.companyName || archivedContext.companyCode,
    archivedContext.branchName || archivedContext.branchCode,
    archivedContext.administrationName,
    archivedContext.departmentName,
  ].filter(Boolean);

  return (
    <div
      dir={dir}
      role="status"
      aria-live="polite"
      className="border-b border-amber-400 bg-amber-100 px-4 py-3 sm:px-6"
      data-testid="archived-context-banner"
    >
      <div className="flex flex-wrap items-start gap-3">
        <svg
          className="mt-0.5 h-5 w-5 shrink-0 text-amber-700"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"
          />
        </svg>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-amber-950">
            {t('auth.context.bannerTitle')}
          </p>
          <p className="mt-0.5 text-xs text-amber-900">
            {t('auth.context.bannerBody')}
          </p>
          <p className="mt-1 truncate text-xs text-amber-800">{parts.join(' / ')}</p>
        </div>
        <button
          type="button"
          onClick={() => void exitArchiveMode({ reload: true })}
          className="shrink-0 rounded-md border border-amber-400 bg-white px-3 py-1.5 text-xs font-medium text-amber-900 hover:bg-amber-50"
        >
          {t('auth.context.exitArchived')}
        </button>
      </div>
    </div>
  );
}
