import { getOperationalContextHeaders } from './operational-context';

export const getApiBaseUrl = (): string => {
  return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';
};

export interface ApiHeaderOptions {
  headers?: HeadersInit;
  includeJsonContentType?: boolean;
  skipOperationalContext?: boolean;
}

export interface RequestOptions {
  params?: Record<string, string | number | boolean | null | undefined>;
  signal?: AbortSignal;
  headers?: HeadersInit;
  skipOperationalContext?: boolean;
}

export function getApiRequestHeaders(options: ApiHeaderOptions = {}): Headers {
  const headers = new Headers(options.headers);
  if (options.includeJsonContentType !== false && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('accessToken');
    if (token && !headers.has('Authorization')) {
      headers.set('Authorization', `Bearer ${token}`);
    }
    if (!options.skipOperationalContext) {
      Object.entries(getOperationalContextHeaders()).forEach(([name, value]) => {
        if (!headers.has(name)) headers.set(name, value);
      });
    }
  }

  return headers;
}

async function handleResponse<T>(response: Response): Promise<T> {
  const contentType = response.headers.get('content-type');
  if (!contentType || !contentType.includes('application/json')) {
    const text = await response.text().catch(() => '');
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    return text as unknown as T;
  }

  const json = await response.json();

  if (!response.ok) {
    const message = Array.isArray(json.message)
      ? json.message[0]
      : json.message || `HTTP ${response.status}`;
    const error = new Error(message) as Error & {
      status?: number;
      code?: number | string;
      messageKey?: string;
      details?: unknown;
    };
    error.status = response.status;
    error.code = json.code ?? response.status;
    error.messageKey = json.messageKey;
    error.details = json.details;
    throw error;
  }

  return json as T;
}

function buildUrl(
  base: string,
  params?: Record<string, string | number | boolean | null | undefined>,
): string {
  if (!params) return base;
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== '' && value !== null) {
      searchParams.set(key, String(value));
    }
  });
  const qs = searchParams.toString();
  return qs ? `${base}?${qs}` : base;
}

function isFormDataBody(body: unknown): body is FormData {
  return typeof FormData !== 'undefined' && body instanceof FormData;
}

function requestHeaders(options: RequestOptions | undefined, isFormData = false): Headers {
  return getApiRequestHeaders({
    headers: options?.headers,
    includeJsonContentType: !isFormData,
    skipOperationalContext: options?.skipOperationalContext,
  });
}

function requestBody(body: unknown): BodyInit | undefined {
  if (body === undefined || body === null) return undefined;
  return isFormDataBody(body) ? body : JSON.stringify(body);
}

export const api = {
  get: async <T>(path: string, options?: RequestOptions): Promise<T> => {
    const url = buildUrl(`${getApiBaseUrl()}${path}`, options?.params);
    const res = await fetch(url, {
      method: 'GET',
      headers: requestHeaders(options),
      signal: options?.signal,
    });
    return handleResponse<T>(res);
  },

  post: async <T>(path: string, body?: unknown, options?: RequestOptions): Promise<T> => {
    const url = buildUrl(`${getApiBaseUrl()}${path}`, options?.params);
    const isFormData = isFormDataBody(body);
    const res = await fetch(url, {
      method: 'POST',
      headers: requestHeaders(options, isFormData),
      body: requestBody(body),
      signal: options?.signal,
    });
    return handleResponse<T>(res);
  },

  patch: async <T>(path: string, body?: unknown, options?: RequestOptions): Promise<T> => {
    const url = buildUrl(`${getApiBaseUrl()}${path}`, options?.params);
    const isFormData = isFormDataBody(body);
    const res = await fetch(url, {
      method: 'PATCH',
      headers: requestHeaders(options, isFormData),
      body: requestBody(body),
      signal: options?.signal,
    });
    return handleResponse<T>(res);
  },

  delete: async <T>(path: string, options?: RequestOptions): Promise<T> => {
    const url = buildUrl(`${getApiBaseUrl()}${path}`, options?.params);
    const res = await fetch(url, {
      method: 'DELETE',
      headers: requestHeaders(options),
      signal: options?.signal,
    });
    return handleResponse<T>(res);
  },

  put: async <T>(path: string, body?: unknown, options?: RequestOptions): Promise<T> => {
    const url = buildUrl(`${getApiBaseUrl()}${path}`, options?.params);
    const isFormData = isFormDataBody(body);
    const res = await fetch(url, {
      method: 'PUT',
      headers: requestHeaders(options, isFormData),
      body: requestBody(body),
      signal: options?.signal,
    });
    return handleResponse<T>(res);
  },
};
