/**
 * Canonical Cost Purpose ("WHY") dimension.
 *
 * Accepted Domain Contract: Cost Purpose (WHY) is independent of
 *   - Cost Object (WHAT — Machine/Line/Department)
 *   - Cost Center (WHERE — CostCenter.type classification)
 *   - OperationType (operational master data)
 *
 * A single atomic transaction/line carries exactly ONE Cost Purpose (no
 * allocation/splitting). Values below are the canonical system set; each maps
 * to a real source workflow. They are distinct from the legacy
 * MaintenanceRequestRequiredPart.costOwnerType values (which are deprecated and
 * never normalized nor aggregated).
 */
export const COST_PURPOSE_VALUES = [
  'MAINTENANCE',
  'PRODUCTION',
  'QUALITY',
  'PROJECT',
  'UTILITIES',
  'ADMIN',
  'DEVELOPMENT',
  'OTHER',
] as const;

export type CostPurpose = (typeof COST_PURPOSE_VALUES)[number];

/** Default Cost Purpose applied automatically to Maintenance material/part issues. */
export const MAINTENANCE_COST_PURPOSE = 'MAINTENANCE' as const;

/** Default Cost Purpose applied automatically to Production material issue/consumption. */
export const PRODUCTION_COST_PURPOSE = 'PRODUCTION' as const;

/**
 * Canonical cross-module RBAC permission controlling the ability to override the
 * automatically supplied default Cost Purpose on a transaction/line. NOT granted
 * to every user who can issue stock.
 */
export const COST_PURPOSE_OVERRIDE_PERMISSION = 'cost-purpose:override' as const;

export function isCostPurpose(value: string | null | undefined): value is CostPurpose {
  return !!value && (COST_PURPOSE_VALUES as readonly string[]).includes(value);
}
