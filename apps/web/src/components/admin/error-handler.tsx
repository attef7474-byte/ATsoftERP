'use client';

import { useCallback } from 'react';
import { useTranslation } from '../../lib/i18n/use-translation';
import { useErrorModal } from './error-modal';
import { normalizeApiError } from '../../lib/error-utils';
import type { ErrorConfig } from '../../lib/error-utils';

type ErrorHandlerOptions = Partial<ErrorConfig> & { dialog?: boolean };

export function useApiErrorHandler() {
  const { showError } = useErrorModal();
  const { t } = useTranslation();

  const handleApiError = useCallback(
    (err: unknown, options?: ErrorHandlerOptions): ErrorConfig => {
      const config = normalizeApiError(err, t as (key: string, ns?: string) => string);
      const merged: ErrorConfig = { ...config, ...options };
      if (options?.dialog !== false) showError(merged);
      return merged;
    },
    [showError, t],
  );

  return handleApiError;
}
