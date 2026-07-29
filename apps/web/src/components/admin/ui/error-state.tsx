'use client';

import { useTranslation } from '../../../lib/i18n/use-translation';

export function ErrorState({ message, onRetry }: { message?: string; onRetry?: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="text-center py-16">
      <p className="text-red-500 mb-4">{message || t('common.errorOccurred')}</p>
      {onRetry && (
        <button onClick={onRetry} className="text-blue-600 hover:text-blue-800 text-sm font-medium">
          {t('common.retry')}
        </button>
      )}
    </div>
  );
}
