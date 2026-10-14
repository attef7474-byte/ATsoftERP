/**
 * Reliability Alert derivation.
 *
 * Pure, deterministic, dependency-free. This module NEVER re-derives
 * reliability: it only CONSUMES the canonical `ReliabilityRow` produced by
 * `InstalledPartReliabilityService` (which itself is built on the single
 * `reliability-calculations.ts` authority).
 *
 * Contracts (see .tmp/reliability-preventive-planning/*.md):
 *  - alerts are DERIVED business signals; they never alter historical evidence.
 *  - an alert is never produced from unknown data (NOT_ELIGIBLE instead).
 *  - life alerts use the canonical expected-life band
 *    (NORMAL/WARNING/DUE/EXPIRED) — no new percentage is invented here.
 *  - repeated-premature uses the canonical `repeatedEarlyFailure` flag.
 *  - high-replacement-frequency requires an authoritative configured threshold;
 *    without it the category is NOT_ELIGIBLE.
 *  - severity is derived from evidence and may only be RAISED by canonical
 *    criticality (component CRITICAL or sparePart.isCritical).
 *  - an alert never creates a work order, request, task, or inventory movement.
 */

import { ReliabilityRow } from './installed-part-reliability.service';

export type ReliabilityAlertType =
  | 'LIFE_APPROACHING_DUE'
  | 'LIFE_DUE'
  | 'LIFE_OVERDUE'
  | 'REPEATED_PREMATURE_FAILURE'
  | 'HIGH_REPLACEMENT_FREQUENCY';

export type ReliabilityAlertSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export type ReliabilityRecommendedAction =
  | 'INSPECT'
  | 'REPLACE'
  | 'CONDITION_CHECK'
  | 'DIAGNOSE_REPEATED_FAILURE';

export interface ReliabilityAlertThresholds {
  replacementFrequencyWindowDays: number | null;
  replacementFrequencyMaxCount: number | null;
}

export interface ReliabilityAlert {
  id: string;
  alertType: ReliabilityAlertType;
  severity: ReliabilityAlertSeverity;
  machine: { id: string; code: string; name: string };
  productionLine: { id: string; code: string; name: string } | null;
  machineComponent: { id: string; code: string; name: string } | null;
  sparePart: { id: string; code: string; name: string; partNumber: string | null; isCritical: boolean; unit: string | null };
  installedPartId: string | null;
  installedAt: string | null;
  expectedLifeUnit: string | null;
  expectedLifeValue: number | null;
  consumedPercent: number | null;
  remainingMs: number | null;
  remainingReading: number | null;
  expectedDueAt: string | null;
  dueState: string;
  failureEventCount: number;
  prematureFailureCount: number;
  replacementCount: number;
  replacementCountInWindow: number | null;
  lastFailureAt: string | null;
  recommendedAction: ReliabilityRecommendedAction;
  recommendedDate: string | null;
  criticalitySource: 'COMPONENT_CRITICAL' | 'SPARE_PART_CRITICAL' | 'NONE';
  evidence: Record<string, unknown>;
}

const SEVERITY_RANK: Record<ReliabilityAlertSeverity, number> = { LOW: 0, MEDIUM: 1, HIGH: 2, CRITICAL: 3 };
const SEVERITY_BY_RANK: ReliabilityAlertSeverity[] = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

const BASE_SEVERITY: Record<ReliabilityAlertType, ReliabilityAlertSeverity> = {
  LIFE_APPROACHING_DUE: 'LOW',
  LIFE_DUE: 'MEDIUM',
  LIFE_OVERDUE: 'HIGH',
  REPEATED_PREMATURE_FAILURE: 'HIGH',
  HIGH_REPLACEMENT_FREQUENCY: 'MEDIUM',
};

const RECOMMENDED_ACTION: Record<ReliabilityAlertType, ReliabilityRecommendedAction> = {
  LIFE_APPROACHING_DUE: 'INSPECT',
  LIFE_DUE: 'REPLACE',
  LIFE_OVERDUE: 'REPLACE',
  REPEATED_PREMATURE_FAILURE: 'DIAGNOSE_REPEATED_FAILURE',
  HIGH_REPLACEMENT_FREQUENCY: 'CONDITION_CHECK',
};

export function severityRank(s: ReliabilityAlertSeverity): number {
  return SEVERITY_RANK[s];
}

export function recommendedActionFor(type: ReliabilityAlertType): ReliabilityRecommendedAction {
  return RECOMMENDED_ACTION[type];
}

/**
 * Canonical criticality signal. Component `CRITICAL` OR spare part
 * `isCritical` is the only thing that may raise severity. No fabrication.
 */
export function criticalityOf(
  row: ReliabilityRow,
  componentCriticalityById: Map<string, string>,
): 'COMPONENT_CRITICAL' | 'SPARE_PART_CRITICAL' | 'NONE' {
  if (row.machineComponent && componentCriticalityById.get(row.machineComponent.id) === 'CRITICAL') {
    return 'COMPONENT_CRITICAL';
  }
  if (row.sparePart.isCritical) return 'SPARE_PART_CRITICAL';
  return 'NONE';
}

function raiseSeverity(base: ReliabilityAlertSeverity, critical: boolean): ReliabilityAlertSeverity {
  if (!critical) return base;
  const next = SEVERITY_RANK[base] + 1;
  return SEVERITY_BY_RANK[Math.min(next, SEVERITY_BY_RANK.length - 1)];
}

function lifeAlertTypeForBand(band: string): ReliabilityAlertType | null {
  if (band === 'WARNING') return 'LIFE_APPROACHING_DUE';
  if (band === 'DUE') return 'LIFE_DUE';
  if (band === 'EXPIRED') return 'LIFE_OVERDUE';
  return null;
}

function countWithinWindow(dates: Date[], reference: Date, windowDays: number): number {
  const cutoff = reference.getTime() - windowDays * 86_400_000;
  return dates.filter((d) => d.getTime() >= cutoff && d.getTime() <= reference.getTime()).length;
}

/**
 * Informational configured expected-life total, recovered from the canonical
 * ExpectedLife result without inventing a value:
 *  - DAYS: totalMs is authoritative.
 *  - HOURS/CYCLES: total = remainingReading / (1 - progress) when progress < 1.
 * Returns null when it cannot be recovered (never a fabricated number).
 */
function configuredExpectedLifeValue(el: {
  unit: string | null;
  totalMs: number | null;
  remainingReading: number | null;
  progress: number | null;
}): number | null {
  if (el.unit === 'DAYS' && el.totalMs !== null) return Math.round((el.totalMs / 86_400_000) * 100) / 100;
  if (el.remainingReading !== null && el.progress !== null && el.progress < 1) {
    return Math.round((el.remainingReading / (1 - el.progress)) * 100) / 100;
  }
  return null;
}

export interface DeriveAlertsOptions {
  componentCriticalityById: Map<string, string>;
  thresholds: ReliabilityAlertThresholds;
  referenceDate: Date;
}

/**
 * Derive every alert for a set of canonical reliability rows.
 * The same (installedPart, alertType) never yields more than one alert.
 */
export function deriveAlerts(rows: ReliabilityRow[], opts: DeriveAlertsOptions): ReliabilityAlert[] {
  const out: ReliabilityAlert[] = [];
  for (const row of rows) {
    const criticalitySource = criticalityOf(row, opts.componentCriticalityById);
    const critical = criticalitySource !== 'NONE';

    // ── Life-band alerts (ACTIVE instance with an authoritative expected life) ──
    if (row.current && row.current.expectedLife.configured) {
      const type = lifeAlertTypeForBand(row.current.expectedLife.band);
      if (type) {
        const el = row.current.expectedLife;
        out.push({
          id: `${row.current.id}:${type}`,
          alertType: type,
          severity: raiseSeverity(BASE_SEVERITY[type], critical),
          machine: row.machine,
          productionLine: row.productionLine,
          machineComponent: row.machineComponent,
          sparePart: row.sparePart,
          installedPartId: row.current.id,
          installedAt: row.current.installedAt ? row.current.installedAt.toISOString() : null,
          expectedLifeUnit: el.unit,
          expectedLifeValue: configuredExpectedLifeValue(el),
          consumedPercent: el.consumedPercent,
          remainingMs: el.remainingMs,
          remainingReading: el.remainingReading,
          expectedDueAt: el.expectedExpiryDate ? el.expectedExpiryDate.toISOString() : null,
          dueState: el.band,
          failureEventCount: row.failureEventCount,
          prematureFailureCount: row.prematureFailureCount,
          replacementCount: row.replacementCount,
          replacementCountInWindow: null,
          lastFailureAt: row.lastFailureAt ? row.lastFailureAt.toISOString() : null,
          recommendedAction: RECOMMENDED_ACTION[type],
          recommendedDate: el.expectedExpiryDate ? el.expectedExpiryDate.toISOString() : null,
          criticalitySource,
          evidence: {
            basis: 'CANONICAL_EXPECTED_LIFE_BAND',
            band: el.band,
            consumedPercent: el.consumedPercent,
            remainingMs: el.remainingMs,
            remainingReading: el.remainingReading,
            expectedLifeUnit: el.unit,
            expectedDueAt: el.expectedExpiryDate ? el.expectedExpiryDate.toISOString() : null,
            installedAt: row.current.installedAt ? row.current.installedAt.toISOString() : null,
            criticalitySource,
          },
        });
      }
    }

    // ── Repeated premature failure (canonical population flag) ──
    if (row.repeatedEarlyFailure) {
      const type: ReliabilityAlertType = 'REPEATED_PREMATURE_FAILURE';
      out.push({
        id: `${row.machine.id}:${row.sparePart.id}:${type}`,
        alertType: type,
        severity: raiseSeverity(BASE_SEVERITY[type], critical),
        machine: row.machine,
        productionLine: row.productionLine,
        machineComponent: row.machineComponent,
        sparePart: row.sparePart,
        installedPartId: row.current?.id ?? null,
        installedAt: null,
        expectedLifeUnit: null,
        expectedLifeValue: null,
        consumedPercent: null,
        remainingMs: null,
        remainingReading: null,
        expectedDueAt: null,
        dueState: 'N/A',
        failureEventCount: row.failureEventCount,
        prematureFailureCount: row.prematureFailureCount,
        replacementCount: row.replacementCount,
        replacementCountInWindow: null,
        lastFailureAt: row.lastFailureAt ? row.lastFailureAt.toISOString() : null,
        recommendedAction: RECOMMENDED_ACTION[type],
        recommendedDate: null,
        criticalitySource,
        evidence: {
          basis: 'CANONICAL_REPEATED_EARLY_FAILURE',
          failureEventCount: row.failureEventCount,
          prematureFailureCount: row.prematureFailureCount,
          lastFailureAt: row.lastFailureAt ? row.lastFailureAt.toISOString() : null,
          criticalitySource,
        },
      });
    }

    // ── High replacement frequency (config-gated; never invented) ──
    const { replacementFrequencyWindowDays: win, replacementFrequencyMaxCount: max } = opts.thresholds;
    if (win !== null && max !== null) {
      const inWindow = countWithinWindow(row.replacementDates ?? [], opts.referenceDate, win);
      if (inWindow > max) {
        const type: ReliabilityAlertType = 'HIGH_REPLACEMENT_FREQUENCY';
        out.push({
          id: `${row.machine.id}:${row.sparePart.id}:${type}`,
          alertType: type,
          severity: raiseSeverity(BASE_SEVERITY[type], critical),
          machine: row.machine,
          productionLine: row.productionLine,
          machineComponent: row.machineComponent,
          sparePart: row.sparePart,
          installedPartId: row.current?.id ?? null,
          installedAt: null,
          expectedLifeUnit: null,
          expectedLifeValue: null,
          consumedPercent: null,
          remainingMs: null,
          remainingReading: null,
          expectedDueAt: null,
          dueState: 'N/A',
          failureEventCount: row.failureEventCount,
          prematureFailureCount: row.prematureFailureCount,
          replacementCount: row.replacementCount,
          replacementCountInWindow: inWindow,
          lastFailureAt: row.lastFailureAt ? row.lastFailureAt.toISOString() : null,
          recommendedAction: RECOMMENDED_ACTION[type],
          recommendedDate: null,
          criticalitySource,
          evidence: {
            basis: 'CONFIGURED_REPLACEMENT_FREQUENCY',
            replacementCountInWindow: inWindow,
            windowDays: win,
            maxCount: max,
            criticalitySource,
          },
        });
      }
    }
  }

  out.sort((a, b) => {
    const s = severityRank(b.severity) - severityRank(a.severity);
    if (s !== 0) return s;
    return a.id.localeCompare(b.id);
  });
  return out;
}

export interface AlertEligibility {
  populations: number;
  activeInstances: number;
  withExpectedLife: number;
  unknownExpectedLife: number;
  prematureFailurePopulations: number;
  repeatedFailurePopulations: number;
  replacementFrequencyEligible: number;
  replacementFrequencyThresholdConfigured: boolean;
}

/** Honest eligibility counters so the UI can show why an alert is not shown. */
export function computeAlertEligibility(rows: ReliabilityRow[], thresholds: ReliabilityAlertThresholds): AlertEligibility {
  const activeInstances = rows.filter((r) => r.current).length;
  const withExpectedLife = rows.filter((r) => r.current?.expectedLife.configured && !!lifeAlertTypeForBand(r.current.expectedLife.band)).length;
  const unknownExpectedLife = rows.filter((r) => r.current && !r.current.expectedLife.configured).length;
  const prematureFailurePopulations = rows.filter((r) => r.prematureFailureCount >= 1).length;
  const repeatedFailurePopulations = rows.filter((r) => r.repeatedEarlyFailure).length;
  const thresholdConfigured = thresholds.replacementFrequencyWindowDays !== null && thresholds.replacementFrequencyMaxCount !== null;
  return {
    populations: rows.length,
    activeInstances,
    withExpectedLife,
    unknownExpectedLife,
    prematureFailurePopulations,
    repeatedFailurePopulations,
    replacementFrequencyEligible: thresholdConfigured ? rows.filter((r) => r.replacementCount > 0).length : 0,
    replacementFrequencyThresholdConfigured: thresholdConfigured,
  };
}
