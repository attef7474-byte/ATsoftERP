/**
 * Archived organizational context (read-only browsing) client contract.
 *
 * The server is the authority: `x-active-context-mode: archived` requests are
 * validated and then rejected for every non-read operation. This module only
 * mirrors that contract in the UI so mutation controls disappear while an
 * archived context is selected.
 */

export const ARCHIVE_READ_PERMISSION = 'company:readArchive';

export const ARCHIVED_CONTEXT_MODE_HEADER = 'x-active-context-mode';
export const ARCHIVED_CONTEXT_MODE_VALUE = 'archived';

/**
 * Permission actions that never change organizational or business state.
 * Everything not listed here is treated as mutating while browsing an
 * archived context and is therefore dropped from the effective permission
 * snapshot (fail-closed).
 */
import { knownResourceKeys } from './permissions/permission-catalogue';
export const ARCHIVE_READ_ONLY_ACTIONS: ReadonlySet<string> = new Set([
  'read',
  'view',
  'print',
  'export',
  'download',
  'summary',
  'history',
  'executionHistory',
  'readiness',
  'readArchive',
  'activity.view',
  'attachments.view',
  'checklist',
  'checklist.view',
  'workflow',
  'analysis',
  'accountabilityKpis',
  'balances',
  'by-location',
  'by-product',
  'by-warehouse',
  'byMachine',
  'byRequest',
  'calendar',
  'costSummary',
  'current',
  'currentDowntime',
  'dashboard-cards',
  'exceptions',
  'ledger',
  'logSummary',
  'machines',
  'movement-types',
  'movements',
  'myTasks',
  'negative-balances',
  'openRequests',
  'overdue',
  'overdueTasks',
  'partsUsage',
  'permissions-view',
  'settings.appearance.view',
  'users.loginHistory.view',
  'recentActivity',
  'reconciliation',
  'reconciliation-differences',
  'stock-card',
  'top-moving-items',
  'traceability',
  'upcoming',
  'upcomingPM',
]);

/** Actions that are known to change state. Guarded by a test. */
export const ARCHIVE_MUTATING_ACTIONS: ReadonlySet<string> = new Set([
  'create',
  'update',
  'delete',
  'delete-draft',
  'post',
  'approve',
  'reject',
  'cancel',
  'close',
  'close-valuation',
  'archive',
  'reopen',
  'release',
  'plan',
  'start',
  'pause',
  'resume',
  'complete',
  'abort',
  'activate',
  'deactivate',
  'submit',
  'override',
  'recalculate',
  'record',
  'correct',
  'issueParts',
  'transfer',
  'transition',
  'assign',
  'unblock',
  'block',
  'attach',
  'manage',
  'prepare',
  'review',
  'verify',
  'execute',
  'count',
  'enter-line',
  'finalize',
  'freeze',
  'generate',
  'generateAdjustment',
  'generateRequest',
  'invalidate',
  'link',
  'linkMachine',
  'unlinkMachine',
  'reactivate',
  'remove',
  'reportUsed',
  'request',
  'reschedule',
  'reserve',
  'reset-password',
  'resolve',
  'return',
  'reverse',
  'scrap',
  'send',
  'startDowntime',
  'endDowntime',
  'supersede',
  'suspend',
  'updateImage',
  'updateLocation',
  'updateManufacturer',
  'updateStatus',
  'updateWarranty',
  'use',
  'accept',
  'classify',
  'changeType',
  'end',
  'settings.appearance.manage',
  'checklist.manage',
  'createChecklist',
  'createEmergency',
  'generateDueTasks',
  'link-maintenance',
]);

export function getPermissionAction(permissionKey: string): string {
  const lastSep = Math.max(permissionKey.lastIndexOf(':'), permissionKey.lastIndexOf('/'));
  if (lastSep === -1) return permissionKey;
  return permissionKey.slice(lastSep + 1);
}

export function isArchiveReadOnlyPermission(permissionKey: string): boolean {
  return ARCHIVE_READ_ONLY_ACTIONS.has(getPermissionAction(permissionKey));
}

/**
 * Canonical SUPER_ADMIN bypass, projected into its read-only form.
 *
 * Super administrators normally satisfy every `can()` check through the
 * `isSuperAdmin` bypass rather than through explicit keys, so simply disabling
 * the bypass in archived mode would also hide read pages. Instead the bypass is
 * expanded into `<every known resource>:<every read-only action>` keys, which
 * keeps reads working while every mutating check stays false.
 */
export function superAdminArchiveReadPermissions(): string[] {
  return knownResourceKeys().flatMap((resource) =>
    [...ARCHIVE_READ_ONLY_ACTIONS].map((action) => `${resource}:${action}`),
  );
}

/**
 * Effective permissions while browsing an archived context: read-only keys
 * are kept, everything else is dropped. The SUPER_ADMIN bypass is disabled
 * for this projection only (the server still applies its canonical bypass).
 */
export function filterArchivePermissions(permissions: string[]): string[] {
  return permissions.filter(isArchiveReadOnlyPermission);
}

/** Whether this principal may discover archived organizational contexts. */
export function canBrowseArchivedContexts(
  permissions: string[] | null,
  isSuperAdmin: boolean,
): boolean {
  if (isSuperAdmin) return true;
  return Boolean(permissions?.includes(ARCHIVE_READ_PERMISSION));
}
