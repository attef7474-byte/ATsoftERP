import type { I18nContextValue } from './i18n/types';

type TranslateFn = I18nContextValue['t'];

/**
 * R2I-BLOCKER-R2 - maintenance enum label helpers.
 *
 * The maintenance screens were rendering raw database enum values straight into the
 * DOM (for example `MATERIAL`, `APPROVED`, `ON_TRACK` and `LEVEL_1`). In Arabic that
 * produced Latin text inside an RTL page. These helpers map the audited value sets onto
 * localized labels so the value never reaches the UI untranslated.
 *
 * Every helper is pure, takes the translator explicitly (so it stays testable outside
 * React), and never falls back to echoing the raw value: an unrecognised value renders a
 * localized generic label instead of leaking the enum.
 */

/**
 * Canonical ledger cost event types. The set is closed by the database check constraint
 * `operational_cost_transactions_event_type_ck` to exactly these six values (see
 * migration 20260904120000_cost_r2c_external_service_ledger) and mirrors
 * OPERATIONAL_LEDGER_EVENT_TYPES in apps/api .../production-cost.constants.ts.
 */
export const CANONICAL_COST_EVENT_TYPES = [
  'MATERIAL',
  'LABOR',
  'MACHINE',
  'OVERHEAD',
  'DOWNTIME',
  'EXTERNAL_SERVICE',
] as const;

export type CanonicalCostEventType = (typeof CANONICAL_COST_EVENT_TYPES)[number];

/**
 * Explicit map to the canonical `maintenanceWorkflow.cost*` family. A map is used rather
 * than a computed key so a value can never select a key that does not exist, and so all
 * six labels are discoverable from one place.
 */
const COST_EVENT_LABEL_KEYS: Record<CanonicalCostEventType, string> = {
  MATERIAL: 'maintenanceWorkflow.costMaterial',
  LABOR: 'maintenanceWorkflow.costLabor',
  MACHINE: 'maintenanceWorkflow.costMachine',
  OVERHEAD: 'maintenanceWorkflow.costOverhead',
  DOWNTIME: 'maintenanceWorkflow.costDowntime',
  EXTERNAL_SERVICE: 'maintenanceWorkflow.costExternalService',
};

export function isCanonicalCostEventType(value: unknown): value is CanonicalCostEventType {
  return typeof value === 'string' && (CANONICAL_COST_EVENT_TYPES as readonly string[]).includes(value);
}

/**
 * Localized label for a canonical cost event type. An unrecognised value falls back to
 * the existing `maintenanceWorkflow.costOther` label ("Other") rather than the raw value.
 */
export function canonicalCostEventLabel(value: unknown, t: TranslateFn): string {
  if (typeof value !== 'string' || value.length === 0) return '-';
  if (isCanonicalCostEventType(value)) return t(COST_EVENT_LABEL_KEYS[value]);
  return t('maintenanceWorkflow.costOther');
}

/**
 * `MaintenanceRequest.slaStatus` is exactly ON_TRACK|OVERDUE (maintenance-sla.service.ts).
 * The existing UI colours the two states green/red, which the shared StatusBadge does not
 * reproduce (it only highlights ACTIVE), so the label is mapped explicitly here instead of
 * through StatusBadge. The green/red classes on the caller are left untouched.
 */
const SLA_STATUS_LABEL_KEYS: Record<string, string> = {
  ON_TRACK: 'status.ON_TRACK',
  OVERDUE: 'status.OVERDUE',
};

/**
 * Localized label for the maintenance SLA status. An unrecognised value falls back to the
 * generic `maintenance.slaStatus` label rather than the raw value.
 */
export function maintenanceSlaStatusLabel(value: unknown, t: TranslateFn): string {
  if (typeof value !== 'string' || value.length === 0) return '-';
  const key = SLA_STATUS_LABEL_KEYS[value];
  return key ? t(key) : t('maintenance.slaStatus');
}

/**
 * `escalationLevel` is not a closed enum, so it is deliberately kept out of the shared
 * `status` namespace used by StatusBadge. The audited value set is NONE plus
 * LEVEL_1..LEVEL_n, where n comes from the active MaintenanceSlaRule.escalationLevels
 * integer (maintenance-sla.service.ts) and has no application-level bound. The level is
 * therefore rendered through a parameterised label instead of a fixed key set.
 */
const ESCALATION_LEVEL_PATTERN = /^LEVEL_(\d+)$/;

/**
 * Localized label for a maintenance escalation level. Unknown values fall back to the
 * generic `maintenance.escalationLevelUnknown` label so the raw value is never shown.
 */
export function maintenanceEscalationLevelLabel(value: unknown, t: TranslateFn): string {
  if (typeof value !== 'string') return '-';
  const raw = value.trim();
  if (raw.length === 0) return '-';
  if (raw === 'NONE') return t('maintenance.escalationLevelNone');
  const match = ESCALATION_LEVEL_PATTERN.exec(raw);
  if (match) return t('maintenance.escalationLevelNumber', undefined, { level: match[1] });
  return t('maintenance.escalationLevelUnknown');
}
