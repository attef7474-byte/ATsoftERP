/**
 * Phase 3 display helpers for spare-part expected life.
 *
 * These helpers only localize values already calculated by the API. They never
 * derive life status, progress or expiry in the browser.
 */

export const EXPECTED_LIFE_UNITS = ['DAYS', 'HOURS', 'CYCLES'] as const;
export type ExpectedLifeUnit = (typeof EXPECTED_LIFE_UNITS)[number];

export const EXPECTED_LIFE_STATUSES = ['UNKNOWN', 'NORMAL', 'WARNING', 'DUE', 'EXPIRED'] as const;
export type ExpectedLifeStatus = (typeof EXPECTED_LIFE_STATUSES)[number];

export type TranslationFn = (key: string) => string;

const UNIT_KEYS: Record<ExpectedLifeUnit, string> = {
  DAYS: 'maintenance.lifeUnitDays',
  HOURS: 'maintenance.lifeUnitHours',
  CYCLES: 'maintenance.lifeUnitCycles',
};

const STATUS_KEYS: Record<ExpectedLifeStatus, string> = {
  UNKNOWN: 'maintenance.lifeStatusUnknown',
  NORMAL: 'maintenance.lifeStatusNormal',
  WARNING: 'maintenance.lifeStatusWarning',
  DUE: 'maintenance.lifeStatusDue',
  EXPIRED: 'maintenance.lifeStatusExpired',
};

export function isExpectedLifeUnit(value: string | null | undefined): value is ExpectedLifeUnit {
  return !!value && (EXPECTED_LIFE_UNITS as readonly string[]).includes(value);
}

export function expectedLifeUnitKey(unit: string | null | undefined): string {
  return isExpectedLifeUnit(unit) ? UNIT_KEYS[unit] : 'maintenance.lifeUnitUnknown';
}

export function expectedLifeStatusKey(status: string | null | undefined): string {
  return status && status in STATUS_KEYS ? STATUS_KEYS[status as ExpectedLifeStatus] : 'maintenance.lifeStatusUnknown';
}

export function formatExpectedLifeUnit(t: TranslationFn, unit: string | null | undefined): string {
  return t(expectedLifeUnitKey(unit));
}

export function formatExpectedLifeValue(
  t: TranslationFn,
  value: number | string | null | undefined,
  unit: string | null | undefined,
): string {
  if (value === null || value === undefined || value === '') return t('maintenance.lifeNotDefined');
  const numeric = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numeric)) return t('maintenance.lifeNotDefined');
  return `${numeric} ${formatExpectedLifeUnit(t, unit)}`;
}

export function lifeSourceKey(isOverridden: boolean | null | undefined): string {
  return isOverridden ? 'maintenance.lifeOverridden' : 'maintenance.lifeInherited';
}

export function readingTypeForUnit(unit: string | null | undefined): 'HOURS' | 'CYCLES' {
  return unit === 'CYCLES' ? 'CYCLES' : 'HOURS';
}

/** Converts an API numeric field to an input value without dropping numeric zero. */
export function expectedLifeFormNumber(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === '') return '';
  return String(value);
}
