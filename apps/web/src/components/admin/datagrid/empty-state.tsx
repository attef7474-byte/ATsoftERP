'use client';

import React from 'react';
import { useTranslation } from '../../../lib/i18n/use-translation';

export function DataGridErrorState({ error, onRetry }: { error: string; onRetry?: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="text-center py-12">
      <p className="text-red-500 mb-4">{error}</p>
      {onRetry && (
        <button type="button" onClick={onRetry} className="text-blue-600 hover:text-blue-800 text-sm font-medium">
          {t('common.retry')}
        </button>
      )}
    </div>
  );
}

export function DataGridLoadingState({ message }: { message?: string }) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col items-center justify-center py-16">
      <div className="animate-spin h-10 w-10 border-4 border-blue-600 border-t-transparent rounded-full" />
      <p className="mt-4 text-gray-500 text-sm">{message || t('common.loading')}</p>
    </div>
  );
}

export function DataGridEmptyState({ message }: { message?: string }) {
  const { t } = useTranslation();
  return (
    <div className="text-center py-12">
      <p className="text-gray-500">{message || t('common.noData')}</p>
    </div>
  );
}
