'use client';

export interface ApiFieldError {
  field?: string;
  code?: string;
  message?: string;
  params?: Record<string, unknown>;
}

export interface ErrorConfig {
  title?: string;
  message: string;
  detail?: string;
  onRetry?: () => void;
  messageKey?: string;
  requestId?: string;
  errors?: ApiFieldError[];
}

interface CanonicalErrorBody {
  success?: boolean;
  statusCode?: number;
  message?: string | string[];
  messageKey?: string;
  errors?: ApiFieldError[] | string[];
  requestId?: string;
  details?: string | Record<string, unknown>;
  error?: string;
}

const STATUS_FALLBACKS: Record<number, string> = {
  400: 'errors.badRequest',
  401: 'errors.unauthorized',
  403: 'errors.forbidden',
  404: 'errors.notFound',
  409: 'errors.conflict',
  413: 'errors.tooLarge',
  422: 'errors.validationFailed',
  429: 'errors.tooManyRequests',
  500: 'errors.serverError',
};

function extractCanonicalBody(err: unknown): CanonicalErrorBody | undefined {
  const candidate = err as {
    response?: { data?: unknown; status?: number };
    status?: number;
    statusCode?: number;
    statusText?: string;
    message?: string;
    code?: string | number;
    messageKey?: string;
    errors?: ApiFieldError[] | string[];
    details?: unknown;
    name?: string;
  };

  if (candidate.response?.data && typeof candidate.response.data === 'object') {
    return candidate.response.data as CanonicalErrorBody;
  }

  const looksCanonical =
    candidate.status !== undefined &&
    (candidate.statusCode !== undefined ||
      candidate.messageKey !== undefined ||
      candidate.errors !== undefined ||
      Array.isArray(candidate.message));
  if (looksCanonical) {
    return candidate as CanonicalErrorBody;
  }
  return undefined;
}

function firstMessage(body: CanonicalErrorBody | undefined): string | undefined {
  if (!body) return undefined;
  if (Array.isArray(body.message)) return body.message[0];
  if (typeof body.message === 'string') return body.message;
  return undefined;
}

function detailFromBody(body: CanonicalErrorBody | undefined): string | undefined {
  if (!body?.details) return undefined;
  if (typeof body.details === 'string') return body.details;
  return JSON.stringify(body.details, null, 2);
}

export function normalizeApiError(err: unknown, t: (key: string, ns?: string) => string): ErrorConfig {
  const config: ErrorConfig = { message: t('errors.generalError', 'errors') };

  if (!err) return config;

  const candidate = err as {
    response?: { data?: unknown; status?: number };
    status?: number;
    statusText?: string;
    message?: string;
    code?: string | number;
    messageKey?: string;
    details?: unknown;
    name?: string;
  };

  const body = extractCanonicalBody(err);
  const status = candidate.response?.status ?? candidate.status;

  if (body) {
    if (body.requestId) config.requestId = body.requestId;

    const fieldErrors = Array.isArray(body.errors) ? body.errors : undefined;
    if (fieldErrors) {
      config.errors = fieldErrors.map((entry) => {
        if (typeof entry === 'string') {
          const localized = t(entry, 'validation');
          return { code: entry, message: localized === entry ? undefined : localized };
        }
        if (entry && typeof entry === 'object') {
          const { field, code, message, params } = entry as ApiFieldError;
          const localized = code ? t(code, 'validation') : undefined;
          const resolved = message && message !== code ? message : localized && localized !== code ? localized : undefined;
          return { field, code, message: resolved, params };
        }
        return { message: String(entry) };
      });
    }

    if (body.messageKey) {
      config.messageKey = body.messageKey;
      const serverMessage = firstMessage(body);
      const webLocalized = t(body.messageKey);
      if (serverMessage && serverMessage !== body.messageKey) {
        config.message = serverMessage;
      } else if (webLocalized && webLocalized !== body.messageKey) {
        config.message = webLocalized;
      } else if (status !== undefined && STATUS_FALLBACKS[status]) {
        config.message = t(STATUS_FALLBACKS[status], 'errors');
      } else {
        config.message = t('errors.generalError', 'errors');
      }
      config.title = t('errorDialog.title', 'errorDialog');
      const detail = detailFromBody(body);
      if (detail) config.detail = detail;
      return config;
    }

    const fallback = status !== undefined ? STATUS_FALLBACKS[status] : undefined;
    const fromMessage = firstMessage(body);
    config.message = fromMessage || (fallback ? t(fallback, 'errors') : t('errors.generalError', 'errors'));
    config.messageKey = body.messageKey;
    const detail = detailFromBody(body);
    if (detail) config.detail = detail;
    return config;
  }

  if (candidate.name === 'AbortError' || candidate.message === 'timeout' || /aborted/i.test(candidate.message || '')) {
    config.message = t('errors.networkError', 'errors');
    return config;
  }

  const rawMessage = candidate.message || '';
  if (!rawMessage || rawMessage === 'Network Error' || /failed to fetch|fetch failed|load failed|networkerror/i.test(rawMessage)) {
    config.message = t('errors.networkError', 'errors');
    return config;
  }

  const fallback = status !== undefined ? STATUS_FALLBACKS[status] : undefined;
  if (fallback) {
    config.message = t(fallback, 'errors');
  } else if (/^HTTP \d{3}/.test(rawMessage)) {
    config.message = t('errors.serverError', 'errors');
    config.detail = rawMessage;
  } else {
    config.message = rawMessage;
  }
  if (candidate.messageKey) config.messageKey = candidate.messageKey;

  return config;
}
