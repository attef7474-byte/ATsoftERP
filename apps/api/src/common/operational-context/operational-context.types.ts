export type OperationalContextSource =
  | 'SUPER_ADMIN'
  | 'EXPLICIT_SCOPE'
  | 'LEGACY_USER_ASSIGNMENT';

export interface OperationalContextSelection {
  companyId: string;
  branchId: string;
  administrationId?: string | null;
  departmentId?: string | null;
}

export interface ActiveOperationalContext {
  contextKey: string;
  scopeId: string | null;
  companyId: string;
  companyName: string;
  companyCode: string;
  branchId: string;
  branchName: string;
  branchCode: string;
  administrationId: string | null;
  administrationName: string | null;
  administrationCode: string | null;
  departmentId: string | null;
  departmentName: string | null;
  departmentCode: string | null;
  isDefault: boolean;
  source: OperationalContextSource;
}

export interface OperationalContextsResult {
  contexts: ActiveOperationalContext[];
  defaultContext: ActiveOperationalContext | null;
}

export interface AuthorizationRole {
  id: string;
  code: string;
  name: string;
}

export interface UserAuthorizationSnapshot {
  roles: AuthorizationRole[];
  permissions: string[];
  isSuperAdmin: boolean;
}

export interface OperationalAccessGrant {
  scopeId: string | null;
  companyId: string;
  branchId: string;
  administrationId: string | null;
  departmentId: string | null;
  isDefault: boolean;
  source: OperationalContextSource;
}

export interface ResolvedOperationalAccess {
  authorization: UserAuthorizationSnapshot;
  contexts: ActiveOperationalContext[];
  defaultContext: ActiveOperationalContext | null;
  grants: OperationalAccessGrant[];
  legacyCompanyId: string | null;
  legacyBranchId: string | null;
  legacyDepartmentId: string | null;
}

export function operationalContextKey(selection: OperationalContextSelection): string {
  return [
    selection.companyId,
    selection.branchId,
    selection.administrationId || '-',
    selection.departmentId || '-',
  ].join(':');
}
