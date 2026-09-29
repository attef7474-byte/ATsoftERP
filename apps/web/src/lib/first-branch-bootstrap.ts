/**
 * ORG-FIRST-BRANCH-R1: route decision for creating a branch.
 *
 * The normal `POST /branches` path derives the owning company from the active
 * operational context and ignores any submitted companyId. A brand new company
 * has zero branches, so it has no context, so the normal path is unreachable and
 * the company could never obtain its first branch.
 *
 * The dedicated `POST /branches/bootstrap` path exists for exactly that case and
 * is strictly narrower (SUPER_ADMIN, ACTIVE company, zero existing branches).
 * This helper decides which endpoint the branches form must call, and it fails
 * closed: an unknown branch count, a company that already has branches, a
 * non-SUPER_ADMIN caller, or the caller's own active-context company always stay
 * on the normal context-bound path.
 */

export const BRANCH_CREATE_ENDPOINT = '/branches';
export const BRANCH_BOOTSTRAP_ENDPOINT = '/branches/bootstrap';

export type BranchCreateRouteReason =
  | 'superAdminZeroBranchForeignCompany'
  | 'notSuperAdmin'
  | 'noCompanySelected'
  | 'activeContextCompany'
  | 'companyAlreadyHasBranches'
  | 'branchCountUnknown';

export interface BranchCreateRouteDecision {
  useBootstrap: boolean;
  endpoint: typeof BRANCH_CREATE_ENDPOINT | typeof BRANCH_BOOTSTRAP_ENDPOINT;
  reason: BranchCreateRouteReason;
}

export interface BranchCreateRouteInput {
  isSuperAdmin: boolean;
  selectedCompanyId: string;
  activeCompanyId?: string | null;
  selectedCompanyBranchCount?: number | null;
}

export function resolveBranchCreateRoute(input: BranchCreateRouteInput): BranchCreateRouteDecision {
  const normal = (reason: BranchCreateRouteReason): BranchCreateRouteDecision => ({
    useBootstrap: false,
    endpoint: BRANCH_CREATE_ENDPOINT,
    reason,
  });

  if (!input.isSuperAdmin) return normal('notSuperAdmin');
  if (!input.selectedCompanyId) return normal('noCompanySelected');

  // A company that already backs the caller's active context always has a valid
  // context, so it never needs (and must never use) the bootstrap path.
  if (input.activeCompanyId && input.activeCompanyId === input.selectedCompanyId) {
    return normal('activeContextCompany');
  }

  const count = input.selectedCompanyBranchCount;
  if (count === null || count === undefined) return normal('branchCountUnknown');
  if (count > 0) return normal('companyAlreadyHasBranches');

  return {
    useBootstrap: true,
    endpoint: BRANCH_BOOTSTRAP_ENDPOINT,
    reason: 'superAdminZeroBranchForeignCompany',
  };
}
