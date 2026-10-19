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

export type OrganizationalLevel =
  | 'company'
  | 'branch'
  | 'administration'
  | 'department';

export interface ArchivedOrganizationalAncestor {
  level: OrganizationalLevel;
  id: string;
  code: string;
  name: string;
  deletedAt: string;
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
  /** Archive browsing only. Active contexts never set this flag. */
  isArchived?: boolean;
  /** Archive browsing only. Soft-deleted organizational ancestors of this context. */
  archivedAncestors?: ArchivedOrganizationalAncestor[];
}

export interface ArchivedOperationalContext extends ActiveOperationalContext {
  isArchived: true;
  archivedAncestors: ArchivedOrganizationalAncestor[];
}

export type OperationalContextMode = 'active' | 'archived';

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
