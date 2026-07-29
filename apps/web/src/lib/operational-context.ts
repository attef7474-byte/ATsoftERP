export interface OperationalContextIdentity {
  companyId: string;
  branchId: string | null;
  administrationId: string | null;
  departmentId: string | null;
}

export interface OperationalContext extends OperationalContextIdentity {
  id?: string;
  companyCode?: string | null;
  companyName?: string | null;
  companyNameAr?: string | null;
  companyNameEn?: string | null;
  branchCode?: string | null;
  branchName?: string | null;
  branchNameAr?: string | null;
  branchNameEn?: string | null;
  administrationCode?: string | null;
  administrationName?: string | null;
  administrationNameAr?: string | null;
  administrationNameEn?: string | null;
  departmentCode?: string | null;
  departmentName?: string | null;
  departmentNameAr?: string | null;
  departmentNameEn?: string | null;
  isDefault?: boolean;
}

export interface OperationalContextsResult {
  contexts: OperationalContext[];
  defaultContext: OperationalContext | null;
}

interface StoredOperationalContext {
  version: 1;
  userId: string;
  context: OperationalContextIdentity;
}

type UnknownRecord = Record<string, unknown>;

export const OPERATIONAL_CONTEXT_CHANGED_EVENT = 'atsoft:operational-context-changed';

const ACTIVE_CONTEXT_USER_KEY = 'atsoft.erp.operational-context.current-user';
const ACTIVE_CONTEXT_KEY_PREFIX = 'atsoft.erp.operational-context.user.';

function asRecord(value: unknown): UnknownRecord | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as UnknownRecord
    : null;
}

function stringValue(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return null;
}

function booleanValue(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined;
}

function entityRecord(source: UnknownRecord, key: string): UnknownRecord {
  return asRecord(source[key]) ?? {};
}

function getStorage(): Storage | null {
  return typeof window === 'undefined' ? null : window.localStorage;
}

function getStorageKey(userId: string): string {
  return `${ACTIVE_CONTEXT_KEY_PREFIX}${encodeURIComponent(userId)}`;
}

export function normalizeOperationalContext(value: unknown): OperationalContext | null {
  const source = asRecord(value);
  if (!source) return null;

  const company = entityRecord(source, 'company');
  const branch = entityRecord(source, 'branch');
  const administration = entityRecord(source, 'administration');
  const department = entityRecord(source, 'department');
  const companyId = stringValue(source.companyId, company.id);
  if (!companyId) return null;

  return {
    id: stringValue(source.id) ?? undefined,
    companyId,
    branchId: stringValue(source.branchId, branch.id),
    administrationId: stringValue(source.administrationId, administration.id),
    departmentId: stringValue(source.departmentId, department.id),
    companyCode: stringValue(source.companyCode, company.code),
    companyName: stringValue(source.companyName, company.name),
    companyNameAr: stringValue(source.companyNameAr, company.nameAr, company.arabicName),
    companyNameEn: stringValue(source.companyNameEn, company.nameEn, company.englishName),
    branchCode: stringValue(source.branchCode, branch.code),
    branchName: stringValue(source.branchName, branch.name),
    branchNameAr: stringValue(source.branchNameAr, branch.nameAr, branch.arabicName),
    branchNameEn: stringValue(source.branchNameEn, branch.nameEn, branch.englishName),
    administrationCode: stringValue(source.administrationCode, administration.code),
    administrationName: stringValue(source.administrationName, administration.name),
    administrationNameAr: stringValue(
      source.administrationNameAr,
      administration.nameAr,
      administration.arabicName,
    ),
    administrationNameEn: stringValue(
      source.administrationNameEn,
      administration.nameEn,
      administration.englishName,
    ),
    departmentCode: stringValue(source.departmentCode, department.code),
    departmentName: stringValue(source.departmentName, department.name),
    departmentNameAr: stringValue(source.departmentNameAr, department.nameAr, department.arabicName),
    departmentNameEn: stringValue(source.departmentNameEn, department.nameEn, department.englishName),
    isDefault: booleanValue(source.isDefault),
  };
}

export function normalizeOperationalContextsResponse(value: unknown): OperationalContextsResult {
  const outer = asRecord(value);
  const source = asRecord(outer?.data) ?? outer;
  const rawContexts = Array.isArray(value)
    ? value
    : Array.isArray(source?.contexts)
      ? source.contexts
      : Array.isArray(source?.allowedContexts)
        ? source.allowedContexts
        : [];

  const contexts = rawContexts
    .map(normalizeOperationalContext)
    .filter((context): context is OperationalContext => context !== null);

  const rawDefault = source?.defaultContext ?? source?.activeContext;
  const normalizedDefault = normalizeOperationalContext(rawDefault);
  const defaultContext = normalizedDefault
    ? contexts.find((context) => isSameOperationalContext(context, normalizedDefault)) ?? normalizedDefault
    : contexts.find((context) => context.isDefault) ?? null;

  return { contexts, defaultContext };
}

export function getOperationalContextIdentity(
  context: OperationalContextIdentity,
): OperationalContextIdentity {
  return {
    companyId: context.companyId,
    branchId: context.branchId || null,
    administrationId: context.administrationId || null,
    departmentId: context.departmentId || null,
  };
}

export function getOperationalContextKey(context: OperationalContextIdentity): string {
  const identity = getOperationalContextIdentity(context);
  return [
    identity.companyId,
    identity.branchId ?? '',
    identity.administrationId ?? '',
    identity.departmentId ?? '',
  ].join('|');
}

export function isSameOperationalContext(
  first: OperationalContextIdentity | null | undefined,
  second: OperationalContextIdentity | null | undefined,
): boolean {
  if (!first || !second) return false;
  return getOperationalContextKey(first) === getOperationalContextKey(second);
}

export function findMatchingOperationalContext(
  contexts: OperationalContext[],
  identity: OperationalContextIdentity | null | undefined,
): OperationalContext | null {
  if (!identity) return null;
  return contexts.find((context) => isSameOperationalContext(context, identity)) ?? null;
}

export function setStoredOperationalContext(
  userId: string,
  context: OperationalContextIdentity,
): void {
  const storage = getStorage();
  if (!storage || !userId) return;
  const stored: StoredOperationalContext = {
    version: 1,
    userId,
    context: getOperationalContextIdentity(context),
  };
  storage.setItem(getStorageKey(userId), JSON.stringify(stored));
  storage.setItem(ACTIVE_CONTEXT_USER_KEY, userId);
}

export function getStoredOperationalContext(userId?: string): OperationalContextIdentity | null {
  const storage = getStorage();
  if (!storage) return null;
  const resolvedUserId = userId || storage.getItem(ACTIVE_CONTEXT_USER_KEY);
  if (!resolvedUserId) return null;

  try {
    const raw = storage.getItem(getStorageKey(resolvedUserId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredOperationalContext>;
    const context = normalizeOperationalContext(parsed.context);
    if (parsed.version !== 1 || parsed.userId !== resolvedUserId || !context) return null;
    return getOperationalContextIdentity(context);
  } catch {
    return null;
  }
}

export function clearStoredOperationalContext(userId?: string): void {
  const storage = getStorage();
  if (!storage) return;
  const currentUserId = storage.getItem(ACTIVE_CONTEXT_USER_KEY);
  const resolvedUserId = userId || currentUserId;
  if (resolvedUserId) storage.removeItem(getStorageKey(resolvedUserId));
  if (!userId || currentUserId === userId) storage.removeItem(ACTIVE_CONTEXT_USER_KEY);
}

export function getOperationalContextHeaders(
  context: OperationalContextIdentity | null | undefined = getStoredOperationalContext(),
): Record<string, string> {
  if (!context) return {};
  const headers: Record<string, string> = {
    'x-active-company-id': context.companyId,
  };
  if (context.branchId) headers['x-active-branch-id'] = context.branchId;
  if (context.administrationId) headers['x-active-administration-id'] = context.administrationId;
  if (context.departmentId) headers['x-active-department-id'] = context.departmentId;
  return headers;
}

type ContextEntity = 'company' | 'branch' | 'administration' | 'department';

export function getOperationalContextEntityLabel(
  context: OperationalContext,
  entity: ContextEntity,
  locale: 'ar' | 'en',
): string | null {
  const source = context as unknown as Record<string, string | null | undefined>;
  const localized = locale === 'ar'
    ? source[`${entity}NameAr`]
    : source[`${entity}NameEn`];
  return stringValue(
    localized,
    source[`${entity}Name`],
    source[`${entity}Code`],
  );
}
