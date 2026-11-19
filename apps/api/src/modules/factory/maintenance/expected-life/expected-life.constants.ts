/**
 * Phase 3 — canonical expected-life vocabulary.
 *
 * These constants are shared by the SparePart catalog default and the
 * MachineInstalledPart instance snapshot. They are the single source of truth
 * for allowed units, statuses, and the warning-threshold range; the DUE
 * threshold remains `DUE_PROGRESS_THRESHOLD` in the installed-parts service.
 */
export const EXPECTED_LIFE_UNITS = ['DAYS', 'HOURS', 'CYCLES'] as const;
export type ExpectedLifeUnit = (typeof EXPECTED_LIFE_UNITS)[number];

export const LIFE_STATUSES = ['UNKNOWN', 'NORMAL', 'WARNING', 'DUE', 'EXPIRED'] as const;

export const DEFAULT_WARNING_THRESHOLD_PERCENT = 80;
export const MIN_WARNING_THRESHOLD_PERCENT = 1;
export const MAX_WARNING_THRESHOLD_PERCENT = 99;
