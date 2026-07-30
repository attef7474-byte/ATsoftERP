'use client';

import { useCallback } from 'react';
import { useTranslation } from '../../lib/i18n/use-translation';
import { useErrorModal } from './error-modal';
import { normalizeApiError } from '../../lib/error-utils';
import type { ErrorConfig } from '../../lib/error-utils';

export function useApiErrorHandler() {
  const { showError } = useErrorModal();
  const { t } = useTranslation();

  const handleApiError = useCallback(
    (err: unknown, customConfig?: Partial<ErrorConfig>) => {
      const config = normalizeApiError(err, t as (key: string, ns?: string) => string);
      showError({ ...config, ...customConfig });
    },
    [showError, t],
  );

  return handleApiError;
}
