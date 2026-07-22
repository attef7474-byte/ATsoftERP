export function unwrapApiData<T>(response: unknown): T {
  if (response && typeof response === 'object' && 'data' in response) {
    const wrapper = response as { data: T };
    if (wrapper.data !== undefined && typeof wrapper.data === 'object') {
      return wrapper.data;
    }
  }
  return response as T;
}

export function safeString(value: unknown, fallback = ''): string {
  if (value === null || value === undefined) return fallback;
  return String(value);
}

export function safeNumber(value: unknown, fallback = 0): number {
  if (value === null || value === undefined) return fallback;
  const n = Number(value);
  return Number.isNaN(n) ? fallback : n;
}

export function safeBoolean(value: unknown, fallback = false): boolean {
  if (value === null || value === undefined) return fallback;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') return value === 'true' || value === '1';
  return fallback;
}

export function safeDateInput(value: unknown): string {
  if (!value) return '';
  const d = new Date(String(value));
  if (isNaN(d.getTime())) return '';
  return d.toISOString().split('T')[0];
}

export function stripReadOnlyFields<T extends Record<string, unknown>>(obj: T): Partial<T> {
  const forbidden = new Set([
    'id', 'createdAt', 'updatedAt', 'createdBy', 'updatedBy',
    'deletedAt', 'passwordHash', 'token', 'refreshToken',
    '_count', 'roles',
  ]);
  const result: Partial<T> = {};
  for (const key of Object.keys(obj)) {
    if (!forbidden.has(key) && !key.startsWith('_')) {
      (result as any)[key] = obj[key];
    }
  }
  return result;
}

export async function ensureLoadedBeforeSave(
  detailLoading: boolean,
  formLoaded: boolean,
): Promise<boolean> {
  if (detailLoading) return false;
  if (!formLoaded) return false;
  return true;
}
