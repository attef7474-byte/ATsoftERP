/**
 * R2-F — the repair-order action matrix offered by the admin UI.
 *
 * This file is the single source of truth for what the UI offers. The backend
 * (`repair-orders.service.ts` -> ALLOWED_TRANSITIONS) stays authoritative: this
 * module is a mirror of it, and `repair-order-actions.test.ts` parses the real
 * backend map and fails if the two ever drift.
 *
 * Icons are intentionally not stored here so this module stays free of JSX and
 * can be imported directly by tests; the page maps `icon` to the shared
 * `Action*Icon` components.
 */

export type RepairPermission = 'manage' | 'complete' | 'scrap';

export interface RepairActionDef {
  key: string;
  /** Exact backend route segment under `POST /maintenance/repair-orders/:id/`. */
  route: string;
  labelKey: string;
  permission: RepairPermission;
  /** Source states the backend matrix accepts for this action. */
  statuses: string[];
  icon: 'start' | 'complete' | 'cancel' | 'delete';
  /** Actions without input run behind a plain confirmation instead of the evidence form. */
  needsInput: boolean;
  danger?: boolean;
}

export const REPAIR_ACTIONS: RepairActionDef[] = [
  { key: 'open', route: 'open', labelKey: 'maintenance.openRepairOrder', permission: 'manage', statuses: ['DRAFT'], icon: 'start', needsInput: false },
  { key: 'startInspection', route: 'start-inspection', labelKey: 'maintenance.startInspection', permission: 'manage', statuses: ['OPEN'], icon: 'start', needsInput: false },
  { key: 'recordInspection', route: 'inspection-result', labelKey: 'maintenance.recordInspectionResult', permission: 'manage', statuses: ['IN_INSPECTION'], icon: 'complete', needsInput: true },
  { key: 'startRepair', route: 'start-repair', labelKey: 'maintenance.startRepair', permission: 'manage', statuses: ['APPROVED_FOR_REPAIR', 'UNDER_TEST'], icon: 'start', needsInput: false },
  { key: 'waitForParts', route: 'wait-for-parts', labelKey: 'maintenance.waitForParts', permission: 'manage', statuses: ['UNDER_REPAIR'], icon: 'cancel', needsInput: true },
  { key: 'resumeFromPartsWait', route: 'resume-from-parts-wait', labelKey: 'maintenance.resumeFromPartsWait', permission: 'manage', statuses: ['WAITING_PARTS'], icon: 'start', needsInput: false },
  { key: 'startTest', route: 'start-test', labelKey: 'maintenance.startTest', permission: 'manage', statuses: ['UNDER_REPAIR'], icon: 'start', needsInput: false },
  { key: 'completeServiceable', route: 'complete-serviceable', labelKey: 'maintenance.completeServiceable', permission: 'complete', statuses: ['UNDER_TEST'], icon: 'complete', needsInput: true },
  { key: 'completePartial', route: 'complete-partial', labelKey: 'maintenance.completePartial', permission: 'complete', statuses: ['UNDER_TEST'], icon: 'complete', needsInput: true },
  { key: 'completeNotRepairable', route: 'complete-not-repairable', labelKey: 'maintenance.completeNotRepairable', permission: 'complete', statuses: ['UNDER_TEST'], icon: 'delete', needsInput: true },
  { key: 'scrap', route: 'scrap', labelKey: 'maintenance.scrap', permission: 'scrap', statuses: ['INSPECTION_FAILED', 'UNDER_REPAIR'], icon: 'delete', needsInput: true, danger: true },
  { key: 'cancel', route: 'cancel', labelKey: 'maintenance.cancelRepair', permission: 'manage', statuses: ['DRAFT', 'OPEN', 'INSPECTION_FAILED', 'APPROVED_FOR_REPAIR', 'UNDER_REPAIR', 'WAITING_PARTS'], icon: 'cancel', needsInput: true, danger: true },
];
