'use client';

export interface ErrorConfig {
  title?: string;
  message: string;
  detail?: string;
  onRetry?: () => void;
  messageKey?: string;
}

export interface ApiErrorResponse {
  message?: string;
  messageKey?: string;
  details?: string | Record<string, unknown>;
  statusCode?: number;
  error?: string;
}

export function normalizeApiError(err: unknown, t: (key: string, ns?: string) => string): ErrorConfig {
  if (!err) {
    return { message: t('errors.generalError', 'errors') };
  }

  const axiosErr = err as { response?: { data?: ApiErrorResponse }; message?: string; status?: number };

  if (axiosErr.response?.data) {
    const data = axiosErr.response.data;
    const messageKey = data.messageKey;
    const fallbackMessage = data.message || t('errors.serverError', 'errors');

    if (messageKey) {
      const localized = t(messageKey);
      if (localized && localized !== messageKey) {
        return {
          messageKey,
          message: localized,
          detail: data.details ? (typeof data.details === 'string' ? data.details : JSON.stringify(data.details, null, 2)) : undefined,
        };
      }
    }

    return {
      message: fallbackMessage,
      detail: data.details ? (typeof data.details === 'string' ? data.details : JSON.stringify(data.details, null, 2)) : undefined,
    };
  }

  if (axiosErr.message) {
    if (axiosErr.message === 'Network Error' || axiosErr.message.includes('fetch')) {
      return { message: t('errors.networkError', 'errors') };
    }
    return { message: axiosErr.message };
  }

  return { message: t('errors.generalError', 'errors') };
}
