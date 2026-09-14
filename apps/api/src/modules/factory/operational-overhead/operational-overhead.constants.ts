import { COST_PURPOSE_VALUES } from '../../../common/cost-purpose/cost-purpose.constants';

export const OPERATIONAL_OVERHEAD_PERIOD_AUDIT_ENTITY = 'OperationalOverheadPeriod' as const;
export const OPERATIONAL_OVERHEAD_ENTRY_AUDIT_ENTITY = 'OperationalOverheadEntry' as const;

/**
 * COST-R2D-B1 / R3: CLOSED_SERVER_ENUM overhead category vocabulary.
 * Category (WHAT TYPE OF OVERHEAD) is independent of Cost Purpose (WHY).
 * Direct-cost values MUST NOT be legal overhead categories:
 * MATERIAL, LABOR, EXTERNAL_SERVICE, DOWNTIME, MACHINE.
 */
export const OVERHEAD_CATEGORIES = [
  'UTILITIES',
  'RENT',
  'DEPRECIATION',
  'INSURANCE',
  'INDIRECT_LABOR',
  'INDIRECT_MAINTENANCE',
  'FACTORY_SERVICE',
  'ADMIN',
  'OTHER',
] as const;

export type OverheadCategory = (typeof OVERHEAD_CATEGORIES)[number];

export function isOverheadCategory(value: string | null | undefined): value is OverheadCategory {
  return !!value && (OVERHEAD_CATEGORIES as readonly string[]).includes(value);
}

/** Prohibited direct-cost values that must never be used as an overhead category. */
export const OVERHEAD_DIRECT_COST_EXCLUSIONS = [
  'MATERIAL',
  'LABOR',
  'EXTERNAL_SERVICE',
  'DOWNTIME',
  'MACHINE',
] as const;

export const OVERHEAD_PERIOD_STATUSES = ['DRAFT', 'OPEN', 'CLOSED', 'CANCELLED'] as const;
export const OVERHEAD_ENTRY_STATUSES = ['DRAFT', 'FINALIZED'] as const;

/**
 * Suggested default Cost Purpose per category (UI/domain only). The authoritative
 * persisted costPurpose on the source entry is ALWAYS explicit and canonical.
 */
export const OVERHEAD_CATEGORY_DEFAULT_PURPOSE: Record<string, string> = {
  UTILITIES: 'UTILITIES',
  RENT: 'ADMIN',
  DEPRECIATION: 'PRODUCTION',
  INSURANCE: 'ADMIN',
  INDIRECT_LABOR: 'PRODUCTION',
  INDIRECT_MAINTENANCE: 'MAINTENANCE',
  FACTORY_SERVICE: 'PRODUCTION',
  ADMIN: 'ADMIN',
  OTHER: 'OTHER',
};

export const OVERHEAD_PERMISSION_KEYS = {
  periodRead: 'production-cost-overhead-period:read',
  periodCreate: 'production-cost-overhead-period:create',
  periodUpdate: 'production-cost-overhead-period:update',
  periodClose: 'production-cost-overhead-period:close',
  periodDelete: 'production-cost-overhead-period:delete',
  entryRead: 'production-cost-overhead:read',
  entryCreate: 'production-cost-overhead:create',
  entryUpdate: 'production-cost-overhead:update',
  entryFinalize: 'production-cost-overhead:finalize',
  entryDelete: 'production-cost-overhead:delete',
} as const;

export const OVERHEAD_PERIOD_INCLUDE = {} as const;

export const OVERHEAD_ENTRY_INCLUDE = {
  period: { select: { id: true, code: true, periodFrom: true, periodTo: true, status: true } },
  sourceCostCenter: { select: { id: true, code: true, name: true } },
} as const;

export const OPERATIONAL_OVERHEAD_ENTRY_INCLUDE = OVERHEAD_ENTRY_INCLUDE;

export const OVERHEAD_CATEGORIES_ALL = OVERHEAD_CATEGORIES;
export const OVERHEAD_COST_PURPOSES = COST_PURPOSE_VALUES;
