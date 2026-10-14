/**
 * Installed-part reliability calculations.
 *
 * Pure, deterministic, dependency-free functions. This is the single source of
 * truth for the part-level reliability formulas so the same math is never
 * duplicated across services or React components.
 *
 * Contracts (see .tmp/installed-part-reliability/*.md):
 *  - service life is derived from canonical `installedAt`/`removedAt` only.
 *  - expected life is authoritative ONLY from the instance's configured fields.
 *  - a FAILURE event requires explicit evidence (status FAILED or a linked
 *    classified downtime log); a replacement is NEVER assumed to be a failure.
 *  - MTBF requires at least two failure events.
 *  - MTTR uses ELAPSED EXECUTION time; labor and downtime stay separate.
 */

import { computeExpectedLifeState, DUE_PROGRESS_THRESHOLD } from '../installed-parts-replacement/installed-parts-replacement.service';

export const MS_PER_HOUR = 3_600_000;
export const MS_PER_DAY = 86_400_000;

export type ValueState = 'OK' | 'UNKNOWN' | 'INVALID';

export interface DurationValue {
  state: ValueState;
  ms: number | null;
}

export interface LifeCycleInstance {
  status: string;
  installedAt: Date | null;
  removedAt: Date | null;
  expectedLifeValue: number | null;
  expectedLifeUnit: string | null;
  lifeStartDate: Date | null;
  lifeStartReading: number | null;
  currentReading: number | null;
  warningThresholdPercent: number | null;
}

export type LifeBand = 'UNKNOWN' | 'NORMAL' | 'WARNING' | 'DUE' | 'EXPIRED';

export interface ExpectedLife {
  configured: boolean;
  unit: string | null;
  progress: number | null;
  consumedPercent: number | null;
  remainingMs: number | null;
  remainingReading: number | null;
  totalMs: number | null;
  band: LifeBand;
  expectedExpiryDate: Date | null;
  expectedExpiryReading: number | null;
}

const round2 = (n: number): number => Math.round(n * 100) / 100;

function bandFor(progress: number, warningThresholdPercent: number | null): LifeBand {
  const warning = (warningThresholdPercent ?? 80) / 100;
  if (progress >= 1) return 'EXPIRED';
  if (progress >= DUE_PROGRESS_THRESHOLD) return 'DUE';
  if (progress >= warning) return 'WARNING';
  return 'NORMAL';
}

/**
 * Actual service life. ACTIVE parts run to `now`; terminated parts run to
 * `removedAt`. A missing `installedAt`, or a terminated part without `removedAt`,
 * is UNKNOWN. A negative interval is INVALID (never a fake zero).
 */
export function computeServiceLifeMs(part: LifeCycleInstance, now: Date): DurationValue {
  if (!part.installedAt) return { state: 'UNKNOWN', ms: null };
  const start = part.installedAt.getTime();
  let end: number;
  if (part.status === 'ACTIVE') {
    end = now.getTime();
  } else if (part.removedAt) {
    end = part.removedAt.getTime();
  } else {
    return { state: 'UNKNOWN', ms: null };
  }
  const ms = end - start;
  if (!Number.isFinite(ms) || ms < 0) return { state: 'INVALID', ms: null };
  return { state: 'OK', ms };
}

const UNCONFIGURED = (unit: string | null): ExpectedLife => ({
  configured: false,
  unit,
  progress: null,
  consumedPercent: null,
  remainingMs: null,
  remainingReading: null,
  totalMs: null,
  band: 'UNKNOWN',
  expectedExpiryDate: null,
  expectedExpiryReading: null,
});

/**
 * Expected life ONLY when the instance carries an authoritative configuration
 * (`expectedLifeValue > 0` with a valid unit and start basis). Otherwise
 * EXPECTED_LIFE_UNKNOWN — never a fabricated default (no 30/90/180/365).
 */
export function computeExpectedLife(part: LifeCycleInstance, now: Date): ExpectedLife {
  const unit = part.expectedLifeUnit;
  const total = part.expectedLifeValue;
  if (!unit || !total || total <= 0) return UNCONFIGURED(unit ?? null);

  if (unit === 'DAYS') {
    if (!part.lifeStartDate) return { ...UNCONFIGURED(unit), configured: true };
    const totalMs = total * MS_PER_DAY;
    const elapsedMs = now.getTime() - part.lifeStartDate.getTime();
    const progress = totalMs > 0 ? elapsedMs / totalMs : 0;
    return {
      configured: true,
      unit,
      progress,
      consumedPercent: round2(progress * 100),
      remainingMs: totalMs - elapsedMs,
      remainingReading: null,
      totalMs,
      band: bandFor(progress, part.warningThresholdPercent),
      expectedExpiryDate: new Date(part.lifeStartDate.getTime() + totalMs),
      expectedExpiryReading: null,
    };
  }

  if (unit === 'HOURS' || unit === 'CYCLES') {
    if (part.lifeStartReading === null || part.lifeStartReading === undefined
      || part.currentReading === null || part.currentReading === undefined) {
      return { ...UNCONFIGURED(unit), configured: true };
    }
    const elapsed = part.currentReading - part.lifeStartReading;
    const progress = elapsed / total;
    return {
      configured: true,
      unit,
      progress,
      consumedPercent: round2(progress * 100),
      remainingMs: null,
      remainingReading: total - elapsed,
      totalMs: null,
      band: bandFor(progress, part.warningThresholdPercent),
      expectedExpiryDate: null,
      expectedExpiryReading: part.lifeStartReading + total,
    };
  }

  return UNCONFIGURED(unit);
}

export type TerminationClass = 'FAILURE' | 'NON_FAILURE';

/**
 * A termination is a FAILURE only with explicit evidence: the instance was
 * explicitly marked FAILED, or it is linked to a classified downtime log
 * (non-empty failureCategory). A replacement is never inferred to be a failure.
 */
export function classifyTermination(input: {
  status: string;
  linkedFailureCategories: Array<string | null | undefined>;
}): TerminationClass {
  if (input.status === 'FAILED') return 'FAILURE';
  const hasClassified = input.linkedFailureCategories.some(
    (c) => typeof c === 'string' && c.trim() !== '',
  );
  return hasClassified ? 'FAILURE' : 'NON_FAILURE';
}

export type PrematureClass = 'YES' | 'NO' | 'UNKNOWN';

/**
 * Premature failure requires BOTH a proven failure AND an authoritative
 * expected life. A preventive/planned replacement is never premature.
 */
export function classifyPremature(input: {
  classification: TerminationClass;
  serviceLife: DurationValue;
  expected: ExpectedLife;
}): PrematureClass {
  if (input.classification !== 'FAILURE') return 'NO';
  if (!input.expected.configured || input.expected.progress === null) return 'UNKNOWN';
  if (input.serviceLife.state !== 'OK' || input.serviceLife.ms === null) return 'UNKNOWN';
  if (input.expected.unit === 'DAYS' && input.expected.totalMs !== null) {
    return input.serviceLife.ms < input.expected.totalMs ? 'YES' : 'NO';
  }
  // HOURS/CYCLES expected life is a reading quantity, not a time quantity,
  // so it cannot be compared to a wall-clock service life.
  return 'UNKNOWN';
}

export interface MtbfResult {
  status: 'OK' | 'INSUFFICIENT_DATA';
  eventCount: number;
  mtbfMs: number | null;
  mtbfDays: number | null;
  totalServiceMs: number;
}

/**
 * MTBF over a failure population (machine + spare part). Requires at least two
 * evidence-backed failure events; the mean of their actual service lives.
 */
export function computeMtbf(failureServiceLivesMs: number[]): MtbfResult {
  const valid = failureServiceLivesMs.filter((ms) => Number.isFinite(ms) && ms >= 0);
  const totalServiceMs = valid.reduce((a, b) => a + b, 0);
  if (valid.length < 2) {
    return { status: 'INSUFFICIENT_DATA', eventCount: valid.length, mtbfMs: null, mtbfDays: null, totalServiceMs };
  }
  const mtbfMs = totalServiceMs / valid.length;
  return {
    status: 'OK',
    eventCount: valid.length,
    mtbfMs,
    mtbfDays: round2(mtbfMs / MS_PER_DAY),
    totalServiceMs,
  };
}

export interface MttrResult {
  status: 'OK' | 'INSUFFICIENT_DATA';
  samples: number;
  openRepairs: number;
  mttrMs: number | null;
  mttrHours: number | null;
  laborMs: number;
  downtimeMs: number;
}

/**
 * MTTR from ELAPSED EXECUTION repair intervals. Labor and downtime are carried
 * separately and are never folded into the MTTR value. Open repairs are counted,
 * not averaged.
 */
export function computeMttr(
  repairDurationsMs: number[],
  opts: { laborMs?: number; downtimeMs?: number; openRepairs?: number } = {},
): MttrResult {
  const valid = repairDurationsMs.filter((ms) => Number.isFinite(ms) && ms >= 0);
  const base = {
    samples: valid.length,
    openRepairs: opts.openRepairs ?? 0,
    laborMs: opts.laborMs ?? 0,
    downtimeMs: opts.downtimeMs ?? 0,
  };
  if (valid.length === 0) {
    return { status: 'INSUFFICIENT_DATA', mttrMs: null, mttrHours: null, ...base };
  }
  const mttrMs = valid.reduce((a, b) => a + b, 0) / valid.length;
  return { status: 'OK', mttrMs, mttrHours: round2(mttrMs / MS_PER_HOUR), ...base };
}

/**
 * Repeated early failure analytic flag. Never triggers a workflow.
 */
export function isRepeatedEarlyFailure(failureEventCount: number, prematureCount: number): boolean {
  return failureEventCount >= 2 && prematureCount >= 2;
}

export { computeExpectedLifeState };
