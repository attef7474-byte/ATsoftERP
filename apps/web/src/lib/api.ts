const getBaseUrl = (): string => {
  return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';
};

const getAuthHeaders = (): Record<string, string> => {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('accessToken');
    if (token) headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
};

interface RequestOptions {
  params?: Record<string, string | number | undefined>;
  signal?: AbortSignal;
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
    const message = Array.isArray(json.message) ? json.message[0] : json.message || `HTTP ${response.status}`;
    const error: any = new Error(message);
    error.status = response.status;
    error.code = response.status;
    throw error;
  }

  return json as T;
}

function buildUrl(base: string, params?: Record<string, string | number | undefined>): string {
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

export const api = {
  get: async <T>(path: string, options?: RequestOptions): Promise<T> => {
    const url = buildUrl(`${getBaseUrl()}${path}`, options?.params);
    const res = await fetch(url, {
      method: 'GET',
      headers: getAuthHeaders(),
      signal: options?.signal,
    });
    return handleResponse<T>(res);
  },

  post: async <T>(path: string, body?: unknown, options?: RequestOptions): Promise<T> => {
    const url = buildUrl(`${getBaseUrl()}${path}`, options?.params);
    const res = await fetch(url, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: body ? JSON.stringify(body) : undefined,
      signal: options?.signal,
    });
    return handleResponse<T>(res);
  },

  patch: async <T>(path: string, body?: unknown, options?: RequestOptions): Promise<T> => {
    const url = buildUrl(`${getBaseUrl()}${path}`, options?.params);
    const res = await fetch(url, {
      method: 'PATCH',
      headers: getAuthHeaders(),
      body: body ? JSON.stringify(body) : undefined,
      signal: options?.signal,
    });
    return handleResponse<T>(res);
  },

  delete: async <T>(path: string, options?: RequestOptions): Promise<T> => {
    const url = buildUrl(`${getBaseUrl()}${path}`, options?.params);
    const res = await fetch(url, {
      method: 'DELETE',
      headers: getAuthHeaders(),
      signal: options?.signal,
    });
    return handleResponse<T>(res);
  },

  put: async <T>(path: string, body?: unknown, options?: RequestOptions): Promise<T> => {
    const url = buildUrl(`${getBaseUrl()}${path}`, options?.params);
    const res = await fetch(url, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: body ? JSON.stringify(body) : undefined,
      signal: options?.signal,
    });
    return handleResponse<T>(res);
  },
};
