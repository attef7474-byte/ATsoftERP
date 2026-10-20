/**
 * Production Planning & Scheduling — deterministic unscheduled reason codes.
 *
 * Stable, i18n-keyed reason codes. The scheduler NEVER returns a generic
 * "scheduling failed"; every unscheduled order carries one or more explicit
 * reasons from this set.
 */
export const PLANNING_REASON_CODES = [
  'NO_ELIGIBLE_RESOURCE',
  'NO_CAPACITY_STANDARD',
  'NO_WORKING_SHIFT',
  'MATERIAL_SHORTAGE',
  'RESOURCE_FULL',
  'INVALID_ORDER_STATE',
  'MISSING_DUE_DATA',
  'CONTEXT_INVALID',
  'AMBIENT_CAPACITY_AMBIGUOUS',
  'INVALID_REFERENCES',
  'UNIT_MISMATCH',
  'HORIZON_EXCEEDED',
] as const;

export type PlanningReasonCode = (typeof PLANNING_REASON_CODES)[number];

/**
 * i18n key for each reason code (Arabic/English dictionaries must both contain
 * these under `production.planning.reason.*`).
 */
export const PLANNING_REASON_I18N_KEYS: Record<PlanningReasonCode, string> = {
  NO_ELIGIBLE_RESOURCE: 'production.planning.reason.noEligibleResource',
  NO_CAPACITY_STANDARD: 'production.planning.reason.noCapacityStandard',
  NO_WORKING_SHIFT: 'production.planning.reason.noWorkingShift',
  MATERIAL_SHORTAGE: 'production.planning.reason.materialShortage',
  RESOURCE_FULL: 'production.planning.reason.resourceFull',
  INVALID_ORDER_STATE: 'production.planning.reason.invalidOrderState',
  MISSING_DUE_DATA: 'production.planning.reason.missingDueData',
  CONTEXT_INVALID: 'production.planning.reason.contextInvalid',
  AMBIENT_CAPACITY_AMBIGUOUS: 'production.planning.reason.ambiguousCapacity',
  INVALID_REFERENCES: 'production.planning.reason.invalidReferences',
  UNIT_MISMATCH: 'production.planning.reason.unitMismatch',
  HORIZON_EXCEEDED: 'production.planning.reason.horizonExceeded',
};

/** Order statuses that the planner may reschedule (editable, not frozen). */
export const PLANNING_EDITABLE_STATUSES: readonly string[] = ['DRAFT', 'PLANNED'];

/**
 * Order statuses that already occupy physical capacity and are hard facts.
 * The scheduler routes around them and never moves them.
 */
export const PLANNING_BLOCKING_ORDER_STATUSES: readonly string[] = ['RELEASED', 'IN_PROGRESS'];

/** Run statuses that occupy physical capacity. */
export const PLANNING_BLOCKING_RUN_STATUSES: readonly string[] = ['READY', 'RUNNING', 'PAUSED'];

/** Material readiness state surfaced to planning. Shortage is a WARNING, not a hard blocker. */
export const PLANNING_MATERIAL_STATES = ['READY', 'SHORTAGE', 'UNKNOWN'] as const;
export type PlanningMaterialState = (typeof PLANNING_MATERIAL_STATES)[number];

/** Safety limit for the planning horizon (days) to avoid planning years of data. */
export const PLANNING_MAX_HORIZON_DAYS = 366;
export const PLANNING_DEFAULT_HORIZON_DAYS = 30;

/** Unit used by the UI to render interval labels. */
export const PLANNING_DURATION_UNIT = 'MINUTE';
