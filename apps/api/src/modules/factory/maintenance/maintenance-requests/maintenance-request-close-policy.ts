/**
 * R2-H: the canonical request close-policy contract.
 *
 * These constants are the single authority for which maintenance request
 * states are terminal, and for the shape of a close-readiness blocker. The
 * readiness evaluator, the completion transition, the close transition and the
 * read-only close-readiness endpoint all read them from here so that no second
 * close-policy authority can drift.
 *
 * State meanings (R2-B/C/D contract, restated rather than redefined):
 * - OPEN          demand accepted, execution not started
 * - IN_PROGRESS   execution underway
 * - COMPLETED     maintenance execution finished; the record is still open
 *                  for administrative finalisation and may be reopened
 * - CLOSED        administratively and finally closed; immutable
 * - CANCELLED     abandoned; immutable except through the canonical reopen
 *
 * COMPLETED and CLOSED are deliberately distinct and are not collapsed:
 * COMPLETED is an execution fact, CLOSED is an administrative decision.
 */

export const MAINTENANCE_REQUEST_TERMINAL_STATUSES = ['COMPLETED', 'CANCELLED', 'CLOSED'] as const;

export const MAINTENANCE_REQUEST_EXECUTABLE_STATUSES = ['OPEN', 'IN_PROGRESS'] as const;

export const MAINTENANCE_REQUEST_ACTIVE_STATUSES = ['OPEN', 'IN_PROGRESS', 'COMPLETED'] as const;

export const MAINTENANCE_REQUEST_CLOSE_SOURCE_STATUS = 'COMPLETED';

/**
 * A required part in one of these states is still unresolved and blocks
 * request completion. USED and CANCELLED are the resolved states; REJECTED is
 * resolved because the demand was declined and carries no further obligation.
 */
export const UNRESOLVED_REQUIRED_PART_STATUSES = ['DRAFT', 'REQUESTED', 'APPROVED', 'RESERVED'] as const;

export const RESOLVED_REQUIRED_PART_STATUSES = ['USED', 'CANCELLED', 'REJECTED'] as const;

/**
 * A linked work order in one of these states is still active and blocks
 * request completion. DRAFT and PLANNED count as active: planned work is
 * outstanding execution, and silently cascading it from complete() would
 * orphan the execution.
 */
export const ACTIVE_WORK_ORDER_STATUSES = ['DRAFT', 'PLANNED', 'IN_PROGRESS'] as const;

export const OPEN_TASK_STATUSES = ['PENDING', 'IN_PROGRESS'] as const;

export type CloseReadinessBlockerCode =
  | 'OPEN_TASKS'
  | 'UNRESOLVED_REQUIRED_PARTS'
  | 'ACTIVE_WORK_ORDERS'
  | 'MANDATORY_CHECKLIST_PENDING'
  | 'REQUEST_NOT_COMPLETED';

export interface CloseReadinessBlocker {
  code: CloseReadinessBlockerCode;
  count: number;
  messageKey: string;
  params: Record<string, string>;
}

export interface CloseReadiness {
  requestId: string;
  status: string;
  canComplete: boolean;
  canClose: boolean;
  completionBlockers: CloseReadinessBlocker[];
  closeBlockers: CloseReadinessBlocker[];
}

export function isTerminalRequestStatus(status: string): boolean {
  return (MAINTENANCE_REQUEST_TERMINAL_STATUSES as readonly string[]).includes(status);
}

export function isUnresolvedRequiredPartStatus(status: string): boolean {
  return (UNRESOLVED_REQUIRED_PART_STATUSES as readonly string[]).includes(status);
}

export function isActiveWorkOrderStatus(status: string): boolean {
  return (ACTIVE_WORK_ORDER_STATUSES as readonly string[]).includes(status);
}

/**
 * The operator-facing sentence carried alongside the messageKey on a thrown
 * transition error. The frontend renders the localized messageKey string; this
 * text is the API-side fallback and the regression contract for the tests.
 */
export function blockerMessage(code: CloseReadinessBlockerCode, count: number): string {
  switch (code) {
    case 'OPEN_TASKS':
      return `Cannot complete request: ${count} open task(s) are still pending or in progress. Complete all tasks first.`;
    case 'UNRESOLVED_REQUIRED_PARTS':
      return `Cannot complete request: ${count} required part(s) are still unresolved. Resolve all part lines first.`;
    case 'ACTIVE_WORK_ORDERS':
      return `Cannot complete request: ${count} work order(s) are still open. Complete or cancel them first.`;
    case 'MANDATORY_CHECKLIST_PENDING':
      return `Cannot complete request: ${count} mandatory checklist item(s) still pending. Complete all mandatory checklist items first.`;
    case 'REQUEST_NOT_COMPLETED':
      return 'Only COMPLETED requests can be closed';
    default:
      return 'The request has unresolved readiness blockers';
  }
}
