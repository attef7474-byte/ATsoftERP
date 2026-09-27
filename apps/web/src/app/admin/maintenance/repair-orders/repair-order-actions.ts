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
 *
 * R2-G — `statuses` and `route` remain for that parity test, but they are NO
 * LONGER what decides whether a button appears. The backend publishes the
 * available actions per order (`/workflow`, and `availableActionKeys` on list
 * rows) and the UI renders exactly those. `statuses` is kept as a cross-check,
 * and `repair-order-workflow-parity.test.ts` fails if the UI ever offers an
 * action the backend did not publish for that status. Availability therefore has
 * exactly one authority: the backend.
 */

export type RepairPermission = 'manage' | 'complete' | 'scrap';

/** Which evidence form an action renders, if any. */
export type RepairFormKind =
  | 'none'
  | 'inspection'
  | 'reason'
  | 'cancel'
  | 'serviceable'
  | 'partial'
  | 'notRepairable'
  | 'scrap';

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
  /** The evidence form to render; `'none'` means a plain confirmation. */
  formKind: RepairFormKind;
  danger?: boolean;
}

export const REPAIR_ACTIONS: RepairActionDef[] = [
  { key: 'open', route: 'open', labelKey: 'maintenance.openRepairOrder', permission: 'manage', statuses: ['DRAFT'], icon: 'start', needsInput: false, formKind: 'none' },
  { key: 'startInspection', route: 'start-inspection', labelKey: 'maintenance.startInspection', permission: 'manage', statuses: ['OPEN'], icon: 'start', needsInput: false, formKind: 'none' },
  { key: 'recordInspection', route: 'inspection-result', labelKey: 'maintenance.recordInspectionResult', permission: 'manage', statuses: ['IN_INSPECTION'], icon: 'complete', needsInput: true, formKind: 'inspection' },
  { key: 'startRepair', route: 'start-repair', labelKey: 'maintenance.startRepair', permission: 'manage', statuses: ['APPROVED_FOR_REPAIR', 'UNDER_TEST'], icon: 'start', needsInput: false, formKind: 'none' },
  { key: 'waitForParts', route: 'wait-for-parts', labelKey: 'maintenance.waitForParts', permission: 'manage', statuses: ['UNDER_REPAIR'], icon: 'cancel', needsInput: true, formKind: 'reason' },
  { key: 'resumeFromPartsWait', route: 'resume-from-parts-wait', labelKey: 'maintenance.resumeFromPartsWait', permission: 'manage', statuses: ['WAITING_PARTS'], icon: 'start', needsInput: false, formKind: 'none' },
  { key: 'startTest', route: 'start-test', labelKey: 'maintenance.startTest', permission: 'manage', statuses: ['UNDER_REPAIR'], icon: 'start', needsInput: false, formKind: 'none' },
  { key: 'completeServiceable', route: 'complete-serviceable', labelKey: 'maintenance.completeServiceable', permission: 'complete', statuses: ['UNDER_TEST'], icon: 'complete', needsInput: true, formKind: 'serviceable' },
  { key: 'completePartial', route: 'complete-partial', labelKey: 'maintenance.completePartial', permission: 'complete', statuses: ['UNDER_TEST'], icon: 'complete', needsInput: true, formKind: 'partial' },
  { key: 'completeNotRepairable', route: 'complete-not-repairable', labelKey: 'maintenance.completeNotRepairable', permission: 'complete', statuses: ['UNDER_TEST'], icon: 'delete', needsInput: true, formKind: 'notRepairable', danger: true },
  { key: 'scrap', route: 'scrap', labelKey: 'maintenance.scrap', permission: 'scrap', statuses: ['INSPECTION_FAILED', 'UNDER_REPAIR'], icon: 'delete', needsInput: true, formKind: 'scrap', danger: true },
  { key: 'cancel', route: 'cancel', labelKey: 'maintenance.cancelRepair', permission: 'manage', statuses: ['DRAFT', 'OPEN', 'INSPECTION_FAILED', 'APPROVED_FOR_REPAIR', 'UNDER_REPAIR', 'WAITING_PARTS'], icon: 'cancel', needsInput: true, formKind: 'cancel', danger: true },
];

export const REPAIR_ACTION_BY_KEY: Record<string, RepairActionDef> = Object.fromEntries(
    REPAIR_ACTIONS.map((action) => [action.key, action]),
);

/** Permission resource for the repair-order module, matching the backend guards. */
export const REPAIR_PERMISSION_RESOURCE = 'repair-orders';

/**
 * Resolve the full seeded permission key an action requires.
 *
 * `can()` matches exact seeded keys, so the shorthand verb must never be passed
 * to it directly: only `repair-orders:manage`, `repair-orders:complete` and
 * `repair-orders:scrap` exist on the backend guards.
 */
export function repairActionPermissionKey(permission: RepairPermission): string {
    return `${REPAIR_PERMISSION_RESOURCE}:${permission}`;
}

/** Whether the signed-in user holds the seeded permission an action requires. */
export function canRunRepairAction(
    granted: readonly string[] | null | undefined,
    action: RepairActionDef,
): boolean {
    return Boolean(granted?.includes(repairActionPermissionKey(action.permission)));
}

/** A published backend action, as the API describes it. */
export interface PublishedRepairAction {
    key: string;
    /** The full seeded permission key the backend enforces for this action. */
    permission?: string;
}

/** Every seeded permission key this module's actions can require. */
export function allRepairPermissionKeys(): string[] {
    return [...new Set(REPAIR_ACTIONS.map((action) => repairActionPermissionKey(action.permission)))];
}

/**
 * The permission set an action check should run against.
 *
 * A super administrator is not filtered by the seeded list, matching how every
 * other admin surface in this app resolves permissions; without this a
 * super administrator would silently lose every action.
 */
export function effectiveRepairPermissions(
    granted: readonly string[] | null | undefined,
    isSuperAdmin: boolean | undefined,
): readonly string[] {
    return isSuperAdmin ? allRepairPermissionKeys() : granted ?? [];
}

/**
 * Narrow backend-published actions to those the signed-in user may press.
 *
 * Both the list grid and the detail workspace apply this exact rule, so an
 * action the server did not publish can never be offered, and a published
 * action the user lacks the seeded permission for stays hidden.
 */
export function offerableRepairActions<T extends PublishedRepairAction>(
    published: readonly T[],
    granted: readonly string[] | null | undefined,
): T[] {
    return published.filter((action) => {
        const def = repairActionDef(action.key);
        if (!def) return false;
        // The backend publishes the full seeded key; the resolver is only the
        // fallback so a shorthand verb can never reach an exact-match check.
        const required = action.permission || repairActionPermissionKey(def.permission);
        return Boolean(granted?.includes(required));
    });
}

/**
 * Whether a repairable queue row may start a repair order.
 *
 * Two rules, both from the removed-part source identity:
 *  - a replacement that already has a repair order must not be duplicated;
 *  - a row is only actionable once the exact stock-in movement resolved a
 *    return warehouse, so no operator can invent a source.
 */
export function repairableRowCanCreate(row: {
    existingRepairOrder?: unknown;
    exactReturnSource?: unknown;
}): boolean {
    return !row.existingRepairOrder && Boolean(row.exactReturnSource);
}

export function repairActionDef(key: string): RepairActionDef | undefined {
  return REPAIR_ACTION_BY_KEY[key];
}

/* ── Form state and payload building ───────────────────────────────────────
 *
 * One function turns form state into the exact request body, so the quantity
 * arithmetic and the mandatory-field rules are unit-testable without rendering
 * anything, and the detail page and the list can never build different bodies
 * for the same action.
 */

export interface RepairFormState {
  outcome: string;
  inspectionResult: string;
  failureDescription: string;
  repairedQuantity: string;
  scrappedQuantity: string;
  notRepairableQuantity: string;
  targetCondition: string;
  reason: string;
  notes: string;
  testResult: string;
  testNotes: string;
  repairDescription: string;
}

export const EMPTY_REPAIR_FORM: RepairFormState = {
  outcome: 'REPAIRABLE',
  inspectionResult: '',
  failureDescription: '',
  repairedQuantity: '',
  scrappedQuantity: '',
  notRepairableQuantity: '',
  targetCondition: 'USED_SERVICEABLE',
  reason: '',
  notes: '',
  testResult: '',
  testNotes: '',
  repairDescription: '',
};

export type RepairFormResult =
  | { ok: true; payload: Record<string, unknown> }
  | { ok: false; fieldErrors: Record<string, string> };

/** Error keys resolved through `t()` by the caller. */
export const REPAIR_FORM_ERRORS = {
  required: 'validation.required',
  positiveQuantity: 'maintenance.repairQuantityMustBePositive',
  exceedsRemaining: 'maintenance.repairQuantityExceedsRemaining',
  outcomeInvalid: 'maintenance.repairInspectionOutcomeInvalid',
  targetConditionInvalid: 'maintenance.repairTargetConditionInvalid',
} as const;

function parseQuantity(raw: string): number | null {
  const text = String(raw ?? '').trim();
  if (text === '') return null;
  const value = Number(text);
  if (!Number.isFinite(value)) return null;
  return value;
}

/**
 * Build the request body for one lifecycle action.
 *
 * `remaining` is the order's authoritative `remainingQuantity`. It is checked
 * here so the operator gets an immediate, field-level reason instead of a
 * backend 400; the backend re-checks the same bound, so this never replaces
 * server authority — it only spares a pointless round trip.
 */
export function buildRepairPayload(
  actionKey: string,
  form: RepairFormState,
  remaining: number,
): RepairFormResult {
  const errors: Record<string, string> = {};
  const notes = form.notes.trim();
  const withNotes = (payload: Record<string, unknown>) =>
    notes ? { ...payload, notes } : payload;

  const boundedQuantity = (raw: string, field: string): number | null => {
    const value = parseQuantity(raw);
    if (value === null || value <= 0) {
      errors[field] = REPAIR_FORM_ERRORS.required;
      return null;
    }
    if (value > remaining) {
      errors[field] = REPAIR_FORM_ERRORS.exceedsRemaining;
      return null;
    }
    return value;
  };

  switch (actionKey) {
    case 'recordInspection': {
      if (form.outcome !== 'REPAIRABLE' && form.outcome !== 'NOT_REPAIRABLE') {
        errors.outcome = REPAIR_FORM_ERRORS.outcomeInvalid;
      }
      if (!form.inspectionResult.trim()) {
        errors.inspectionResult = REPAIR_FORM_ERRORS.required;
      }
      if (form.outcome === 'NOT_REPAIRABLE' && !form.failureDescription.trim()) {
        errors.failureDescription = REPAIR_FORM_ERRORS.required;
      }
      if (Object.keys(errors).length) return { ok: false, fieldErrors: errors };
      return {
        ok: true,
        payload: withNotes({
          outcome: form.outcome,
          inspectionResult: form.inspectionResult.trim(),
          ...(form.failureDescription.trim() ? { failureDescription: form.failureDescription.trim() } : {}),
        }),
      };
    }
    case 'waitForParts': {
      if (!form.reason.trim()) errors.reason = REPAIR_FORM_ERRORS.required;
      if (Object.keys(errors).length) return { ok: false, fieldErrors: errors };
      return { ok: true, payload: withNotes({ reason: form.reason.trim() }) };
    }
    case 'cancel': {
      if (!form.reason.trim()) errors.reason = REPAIR_FORM_ERRORS.required;
      if (Object.keys(errors).length) return { ok: false, fieldErrors: errors };
      return { ok: true, payload: withNotes({ reason: form.reason.trim() }) };
    }
    case 'completeServiceable': {
      const repaired = boundedQuantity(form.repairedQuantity, 'repairedQuantity');
      if (repaired === null) return { ok: false, fieldErrors: errors };
      if (form.targetCondition !== 'USED_SERVICEABLE' && form.targetCondition !== 'USED_REPAIRABLE') {
        errors.targetCondition = REPAIR_FORM_ERRORS.targetConditionInvalid;
      }
      if (Object.keys(errors).length) return { ok: false, fieldErrors: errors };
      return {
        ok: true,
        payload: withNotes({
          repairedQuantity: repaired,
          targetCondition: form.targetCondition,
          ...(form.repairDescription.trim() ? { repairDescription: form.repairDescription.trim() } : {}),
          ...(form.testResult.trim() ? { testResult: form.testResult.trim() } : {}),
          ...(form.testNotes.trim() ? { testNotes: form.testNotes.trim() } : {}),
        }),
      };
    }
    case 'completePartial': {
      // The DTO requires a strictly positive repaired quantity, so a
      // scrapped-only partial is not a valid request.
      const repaired = boundedQuantity(form.repairedQuantity, 'repairedQuantity');
      const scrapped = parseQuantity(form.scrappedQuantity);
      if (scrapped !== null && scrapped < 0) {
        errors.scrappedQuantity = REPAIR_FORM_ERRORS.positiveQuantity;
      }
      if (repaired === null) return { ok: false, fieldErrors: errors };
      if (Object.keys(errors).length) return { ok: false, fieldErrors: errors };
      const scrappedValue = Math.max(scrapped ?? 0, 0);
      if (repaired + scrappedValue > remaining) {
        errors.repairedQuantity = REPAIR_FORM_ERRORS.exceedsRemaining;
        errors.scrappedQuantity = REPAIR_FORM_ERRORS.exceedsRemaining;
        return { ok: false, fieldErrors: errors };
      }
      if (form.targetCondition !== 'USED_SERVICEABLE' && form.targetCondition !== 'USED_REPAIRABLE') {
        errors.targetCondition = REPAIR_FORM_ERRORS.targetConditionInvalid;
      }
      if (Object.keys(errors).length) return { ok: false, fieldErrors: errors };
      return {
        ok: true,
        payload: withNotes({
          repairedQuantity: repaired,
          scrappedQuantity: scrappedValue,
          targetCondition: form.targetCondition,
        }),
      };
    }
    case 'completeNotRepairable': {
      const quantity = boundedQuantity(form.notRepairableQuantity, 'notRepairableQuantity');
      if (quantity === null) return { ok: false, fieldErrors: errors };
      if (!form.reason.trim()) errors.reason = REPAIR_FORM_ERRORS.required;
      if (Object.keys(errors).length) return { ok: false, fieldErrors: errors };
      return { ok: true, payload: withNotes({ notRepairableQuantity: quantity, reason: form.reason.trim() }) };
    }
    case 'scrap': {
      const quantity = boundedQuantity(form.scrappedQuantity, 'scrappedQuantity');
      if (quantity === null) return { ok: false, fieldErrors: errors };
      return {
        ok: true,
        payload: withNotes({
          scrappedQuantity: quantity,
          ...(form.reason.trim() ? { reason: form.reason.trim() } : {}),
        }),
      };
    }
    default:
      return { ok: true, payload: withNotes({}) };
  }
}
