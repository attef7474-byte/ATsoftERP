type UnknownRecord = Record<string, unknown>;

export interface UnwrappedApiList<T, TMeta = UnknownRecord> {
  data: T[];
  meta?: TMeta;
  total?: number;
}

const API_ENVELOPE_KEYS = new Set([
  'data',
  'success',
  'message',
  'meta',
  'pagination',
  'statusCode',
  'timestamp',
]);

const READ_ONLY_FIELDS = new Set([
  'id',
  'createdAt',
  'updatedAt',
  'createdBy',
  'updatedBy',
  'createdById',
  'updatedById',
  'deletedAt',
  'deletedBy',
  'deletedById',
  'passwordHash',
  'accessToken',
  'refreshToken',
  'token',
  '_count',
]);

function isRecord(value: unknown): value is UnknownRecord {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isEnvelope(value: UnknownRecord): boolean {
  if (!Object.prototype.hasOwnProperty.call(value, 'data')) return false;
  if (Object.prototype.hasOwnProperty.call(value, 'success')) return true;
  if (Object.prototype.hasOwnProperty.call(value, 'meta')) return true;
  if (Object.prototype.hasOwnProperty.call(value, 'pagination')) return true;

  const keys = Object.keys(value);
  return keys.length > 0 && keys.every((key) => API_ENVELOPE_KEYS.has(key));
}

/**
 * Accepts both raw API entities and response envelopes. Nested envelopes are
 * unwrapped as well so the UI does not need to know whether an interceptor is
 * enabled on a particular API deployment.
 */
export function unwrapApiData<T>(response: unknown): T {
  let current = response;

  for (let depth = 0; depth < 4 && isRecord(current) && isEnvelope(current); depth += 1) {
    current = current.data;
  }

  return current as T;
}

/**
 * Normalizes raw arrays, { data, meta }, { items, pagination }, and nested
 * response envelopes into one paginated-list contract.
 */
export function unwrapApiList<T, TMeta = UnknownRecord>(response: unknown): UnwrappedApiList<T, TMeta> {
  let current = response;
  let meta: TMeta | undefined;
  let total: number | undefined;

  for (let depth = 0; depth < 5; depth += 1) {
    if (Array.isArray(current)) {
      return { data: current as T[], meta, total };
    }

    if (!isRecord(current)) break;

    if (meta === undefined) {
      const candidateMeta = current.meta ?? current.pagination;
      if (isRecord(candidateMeta)) meta = candidateMeta as unknown as TMeta;
    }

    if (total === undefined) {
      const directTotal = safeNumber(current.total, Number.NaN);
      const metaTotal = isRecord(current.meta)
        ? safeNumber(current.meta.total, Number.NaN)
        : Number.NaN;
      const paginationTotal = isRecord(current.pagination)
        ? safeNumber(current.pagination.total, Number.NaN)
        : Number.NaN;
      const candidateTotal = [directTotal, metaTotal, paginationTotal].find(Number.isFinite);
      if (candidateTotal !== undefined) total = candidateTotal;
    }

    const arrayCandidate = current.data ?? current.items ?? current.results ?? current.records;
    if (Array.isArray(arrayCandidate)) {
      return { data: arrayCandidate as T[], meta, total };
    }

    if (isRecord(current.data)) {
      current = current.data;
      continue;
    }

    break;
  }

  return { data: [], meta, total };
}

export function safeString(value: unknown, fallback = ''): string {
  if (value === null || value === undefined) return fallback;
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') {
    return String(value);
  }
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString();
  return fallback;
}

export function safeNumber(value: unknown, fallback = 0): number {
  if (value === null || value === undefined || value === '') return fallback;
  const numberValue = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(numberValue) ? numberValue : fallback;
}

export function safeBoolean(value: unknown, fallback = false): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') {
    if (value === 1) return true;
    if (value === 0) return false;
    return fallback;
  }
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['true', '1', 'yes', 'on'].includes(normalized)) return true;
    if (['false', '0', 'no', 'off'].includes(normalized)) return false;
  }
  return fallback;
}

export function safeDateInput(value: unknown): string {
  if (value === null || value === undefined || value === '') return '';

  const stringValue = safeString(value);
  const datePrefix = /^(\d{4}-\d{2}-\d{2})/.exec(stringValue);
  if (datePrefix) return datePrefix[1];

  const dateValue = value instanceof Date ? value : new Date(stringValue);
  if (Number.isNaN(dateValue.getTime())) return '';
  return dateValue.toISOString().slice(0, 10);
}

export function stripReadOnlyFields<T extends UnknownRecord>(
  payload: T,
  additionalReadOnlyFields: readonly string[] = [],
): Partial<T> {
  const forbidden = new Set([...READ_ONLY_FIELDS, ...additionalReadOnlyFields]);
  const result: UnknownRecord = {};

  Object.entries(payload).forEach(([key, value]) => {
    if (!forbidden.has(key) && !key.startsWith('_')) result[key] = value;
  });

  return result as Partial<T>;
}

export function isNonEmptyId(value: unknown): boolean {
  if (typeof value === 'string') return value.trim().length > 0;
  if (typeof value === 'number') return Number.isFinite(value) && value > 0;
  return false;
}

export function assertRecordId(row: unknown): string {
  if (!isRecord(row) || !isNonEmptyId(row.id)) {
    throw new Error('A valid record identifier is required.');
  }
  return safeString(row.id).trim();
}

export function normalizeFormValue(value: unknown): unknown {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return safeDateInput(value);
  if (Array.isArray(value)) return value.map(normalizeFormValue);
  if (isRecord(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, entryValue]) => [key, normalizeFormValue(entryValue)]),
    );
  }
  return value;
}

export function safeErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim()) return error.message;
  if (isRecord(error) && typeof error.message === 'string' && error.message.trim()) {
    return error.message;
  }
  return fallback;
}
