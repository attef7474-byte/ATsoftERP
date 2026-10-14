import {
  deriveAlerts,
  computeAlertEligibility,
  recommendedActionFor,
  severityRank,
  criticalityOf,
  ReliabilityAlertThresholds,
} from './reliability-alert-calculations';
import { ReliabilityRow } from './installed-part-reliability.service';
import { ExpectedLife } from './reliability-calculations';

const DAY = 86_400_000;
const REF = new Date('2026-10-01T00:00:00.000Z');

const NO_THRESHOLDS: ReliabilityAlertThresholds = {
  replacementFrequencyWindowDays: null,
  replacementFrequencyMaxCount: null,
};

const compCritical = (id = 'comp1') => new Map<string, string>([[id, 'CRITICAL']]);
const compNormal = (id = 'comp1') => new Map<string, string>([[id, 'MEDIUM']]);
const noComps = new Map<string, string>();

function expLife(over: Partial<ExpectedLife> = {}): ExpectedLife {
  return {
    configured: true,
    unit: 'DAYS',
    progress: 0.5,
    consumedPercent: 50,
    remainingMs: (100 * DAY) / 2,
    remainingReading: null,
    totalMs: 100 * DAY,
    band: 'NORMAL',
    expectedExpiryDate: new Date('2026-12-01T00:00:00.000Z'),
    expectedExpiryReading: null,
    ...over,
  };
}

function row(over: any = {}): ReliabilityRow {
  const current =
    over.current !== undefined
      ? over.current
      : {
          id: over.installedPartId ?? 'ip1',
          status: 'ACTIVE',
          installedAt: new Date('2026-06-01T00:00:00.000Z'),
          installedQuantity: 1,
          serialNumber: null,
          installedCondition: 'NEW',
          serviceLife: { state: 'OK', ms: 10 * DAY },
          expectedLife: over.expectedLife ?? expLife(),
        };
  return {
    key: 'm1::s1',
    machine: over.machine ?? { id: 'm1', code: 'M-1', name: 'Machine One' },
    productionLine: over.productionLine ?? null,
    machineComponent: over.machineComponent === undefined ? { id: 'comp1', code: 'C-1', name: 'Comp One' } : over.machineComponent,
    sparePart: over.sparePart ?? {
      id: 's1', code: 'SP-1', name: 'Bearing', partNumber: 'B-100', manufacturer: 'ACME', isCritical: false, unit: 'PCS',
    },
    current,
    lastFailureAt: over.lastFailureAt ?? null,
    replacementCount: over.replacementCount ?? 0,
    replacementDates: over.replacementDates ?? [],
    failureEventCount: over.failureEventCount ?? 0,
    prematureFailureCount: over.prematureFailureCount ?? 0,
    repeatedEarlyFailure: over.repeatedEarlyFailure ?? false,
    mtbf: { status: 'INSUFFICIENT_DATA', eventCount: 0, mtbfMs: null, mtbfDays: null, totalServiceMs: 0 },
    mttr: { status: 'INSUFFICIENT_DATA', samples: 0, openRepairs: 0, mttrMs: null, mttrHours: null, laborMs: 0, downtimeMs: 0 },
  };
}

function derive(rows: ReliabilityRow[], opts: Partial<Parameters<typeof deriveAlerts>[1]> = {}) {
  return deriveAlerts(rows, {
    componentCriticalityById: noComps,
    thresholds: NO_THRESHOLDS,
    referenceDate: REF,
    ...opts,
  });
}

describe('reliability-alert-calculations', () => {
  // ── §59 Installed-part life alerts (A1–A7) ────────────────────────────────
  describe('§59 life alerts', () => {
    it('A1 WARNING band → LIFE_APPROACHING_DUE, LOW, INSPECT', () => {
      const alerts = derive([row({ expectedLife: expLife({ band: 'WARNING', progress: 0.85, consumedPercent: 85 }) })]);
      const life = alerts.find((a) => a.alertType === 'LIFE_APPROACHING_DUE');
      expect(life).toBeDefined();
      expect(life!.severity).toBe('LOW');
      expect(life!.recommendedAction).toBe('INSPECT');
    });

    it('A2 DUE band → LIFE_DUE, MEDIUM, REPLACE', () => {
      const alerts = derive([row({ expectedLife: expLife({ band: 'DUE', progress: 0.95, consumedPercent: 95 }) })]);
      const life = alerts.find((a) => a.alertType === 'LIFE_DUE');
      expect(life).toBeDefined();
      expect(life!.severity).toBe('MEDIUM');
      expect(life!.recommendedAction).toBe('REPLACE');
      expect(life!.dueState).toBe('DUE');
    });

    it('A3 EXPIRED band → LIFE_OVERDUE, HIGH, REPLACE', () => {
      const alerts = derive([row({ expectedLife: expLife({ band: 'EXPIRED', progress: 1.2, consumedPercent: 120 }) })]);
      const life = alerts.find((a) => a.alertType === 'LIFE_OVERDUE');
      expect(life).toBeDefined();
      expect(life!.severity).toBe('HIGH');
      expect(life!.recommendedAction).toBe('REPLACE');
    });

    it('A4 NORMAL band → no life alert', () => {
      const alerts = derive([row({ expectedLife: expLife({ band: 'NORMAL', progress: 0.1 }) })]);
      expect(alerts).toHaveLength(0);
    });

    it('A5 unknown expected life → no alert and it is NOT_ELIGIBLE (never a fabricated zero)', () => {
      const rows = [row({ expectedLife: expLife({ configured: false, band: 'UNKNOWN', progress: null, totalMs: null, consumedPercent: null }) })];
      expect(derive(rows)).toHaveLength(0);
      const elig = computeAlertEligibility(rows, NO_THRESHOLDS);
      expect(elig.unknownExpectedLife).toBe(1);
      expect(elig.withExpectedLife).toBe(0);
    });

    it('A6 a terminated instance (no ACTIVE current) never yields a current-life alert', () => {
      const alerts = derive([row({ current: null, expectedLife: expLife({ band: 'EXPIRED' }) })]);
      expect(alerts.find((a) => a.alertType.startsWith('LIFE_'))).toBeUndefined();
    });

    it('A7 a CRITICAL component raises severity by exactly one tier', () => {
      const rows = [row({ expectedLife: expLife({ band: 'DUE' }) })];
      const without = derive(rows, { componentCriticalityById: compNormal() });
      const withCritical = derive(rows, { componentCriticalityById: compCritical() });
      expect(without[0].severity).toBe('MEDIUM');
      expect(withCritical[0].severity).toBe('HIGH');
      expect(withCritical[0].criticalitySource).toBe('COMPONENT_CRITICAL');
    });

    it('A7b LIFE_OVERDUE HIGH + critical spare part → CRITICAL (capped, never beyond)', () => {
      const alerts = derive([row({ sparePart: { id: 's1', code: 'SP-1', name: 'Bearing', partNumber: null, manufacturer: null, isCritical: true, unit: 'PCS' }, expectedLife: expLife({ band: 'EXPIRED' }) })]);
      const life = alerts.find((a) => a.alertType === 'LIFE_OVERDUE')!;
      expect(life.severity).toBe('CRITICAL');
      expect(life.criticalitySource).toBe('SPARE_PART_CRITICAL');
    });
  });

  // ── §60 Repeated premature failure (L1–L7) ────────────────────────────────
  describe('§60 repeated premature failure', () => {
    it('L1 no repeated flag → no repeated alert', () => {
      const alerts = derive([row({ failureEventCount: 1, prematureFailureCount: 1, repeatedEarlyFailure: false, current: null })]);
      expect(alerts.find((a) => a.alertType === 'REPEATED_PREMATURE_FAILURE')).toBeUndefined();
    });

    it('L2 canonical repeated flag → one HIGH DIAGNOSE_REPEATED_FAILURE alert', () => {
      const alerts = derive([row({ failureEventCount: 2, prematureFailureCount: 2, repeatedEarlyFailure: true, current: null })]);
      const rep = alerts.find((a) => a.alertType === 'REPEATED_PREMATURE_FAILURE');
      expect(rep).toBeDefined();
      expect(rep!.severity).toBe('HIGH');
      expect(rep!.recommendedAction).toBe('DIAGNOSE_REPEATED_FAILURE');
    });

    it('L3 repeated + critical component → CRITICAL', () => {
      const alerts = derive(
        [row({ failureEventCount: 2, prematureFailureCount: 2, repeatedEarlyFailure: true, current: null })],
        { componentCriticalityById: compCritical() },
      );
      expect(alerts[0].severity).toBe('CRITICAL');
    });

    it('L4 exactly one repeated alert per (machine, sparePart) population', () => {
      const alerts = derive([row({ failureEventCount: 5, prematureFailureCount: 4, repeatedEarlyFailure: true, current: null })]);
      expect(alerts.filter((a) => a.alertType === 'REPEATED_PREMATURE_FAILURE')).toHaveLength(1);
    });

    it('L5 stable dedupe identity is machine:sparePart:REPEATED_PREMATURE_FAILURE', () => {
      const alerts = derive([row({ failureEventCount: 2, prematureFailureCount: 2, repeatedEarlyFailure: true, current: null })]);
      expect(alerts[0].id).toBe('m1:s1:REPEATED_PREMATURE_FAILURE');
    });

    it('L6 repeated alert carries evidence but invents no recommended date', () => {
      const alerts = derive([row({ failureEventCount: 2, prematureFailureCount: 2, repeatedEarlyFailure: true, current: null, lastFailureAt: new Date('2026-09-20T00:00:00.000Z') })]);
      expect(alerts[0].recommendedDate).toBeNull();
      expect(alerts[0].evidence.basis).toBe('CANONICAL_REPEATED_EARLY_FAILURE');
    });

    it('L7 a repeated population and a life alert coexist for the same row', () => {
      const alerts = derive([row({ repeatedEarlyFailure: true, failureEventCount: 2, prematureFailureCount: 2, expectedLife: expLife({ band: 'DUE' }) })]);
      expect(alerts.find((a) => a.alertType === 'REPEATED_PREMATURE_FAILURE')).toBeDefined();
      expect(alerts.find((a) => a.alertType === 'LIFE_DUE')).toBeDefined();
      expect(new Set(alerts.map((a) => a.id)).size).toBe(alerts.length);
    });
  });

  // ── §61 High replacement frequency (F1–F6) ────────────────────────────────
  describe('§61 high replacement frequency (config-gated)', () => {
    const dates = (n: number, daysAgo: number[]) => daysAgo.map((d) => new Date(REF.getTime() - d * DAY));

    it('F1 no configured threshold → category is NOT_ELIGIBLE, zero alerts', () => {
      const rows = [row({ replacementCount: 9, replacementDates: dates(9, [1, 2, 3, 4, 5, 6, 7, 8, 9]) })];
      expect(derive(rows)).toHaveLength(0);
      const elig = computeAlertEligibility(rows, NO_THRESHOLDS);
      expect(elig.replacementFrequencyThresholdConfigured).toBe(false);
      expect(elig.replacementFrequencyEligible).toBe(0);
    });

    it('F2 configured threshold and count within window > max → MEDIUM CONDITION_CHECK', () => {
      const rows = [row({ replacementCount: 4, replacementDates: dates(4, [1, 5, 10, 20]) })];
      const alerts = derive(rows, { thresholds: { replacementFrequencyWindowDays: 30, replacementFrequencyMaxCount: 3 } });
      const freq = alerts.find((a) => a.alertType === 'HIGH_REPLACEMENT_FREQUENCY');
      expect(freq).toBeDefined();
      expect(freq!.severity).toBe('MEDIUM');
      expect(freq!.recommendedAction).toBe('CONDITION_CHECK');
      expect(freq!.replacementCountInWindow).toBe(4);
    });

    it('F3 count equal to max is NOT an alert (must exceed)', () => {
      const rows = [row({ replacementCount: 3, replacementDates: dates(3, [1, 5, 10]) })];
      const alerts = derive(rows, { thresholds: { replacementFrequencyWindowDays: 30, replacementFrequencyMaxCount: 3 } });
      expect(alerts.find((a) => a.alertType === 'HIGH_REPLACEMENT_FREQUENCY')).toBeUndefined();
    });

    it('F4 replacements outside the window do not count', () => {
      const rows = [row({ replacementCount: 5, replacementDates: dates(5, [1, 2, 40, 50, 60]) })];
      const alerts = derive(rows, { thresholds: { replacementFrequencyWindowDays: 30, replacementFrequencyMaxCount: 3 } });
      expect(alerts.find((a) => a.alertType === 'HIGH_REPLACEMENT_FREQUENCY')).toBeUndefined();
    });

    it('F5 critical spare part raises a HIGH_REPLACEMENT_FREQUENCY alert', () => {
      const rows = [row({ replacementCount: 4, replacementDates: dates(4, [1, 5, 10, 20]), sparePart: { id: 's1', code: 'SP-1', name: 'Bearing', partNumber: null, manufacturer: null, isCritical: true, unit: 'PCS' } })];
      const alerts = derive(rows, { thresholds: { replacementFrequencyWindowDays: 30, replacementFrequencyMaxCount: 3 } });
      expect(alerts.find((a) => a.alertType === 'HIGH_REPLACEMENT_FREQUENCY')!.severity).toBe('HIGH');
    });

    it('F6 evidence records the configured window/max (no invented values)', () => {
      const rows = [row({ replacementCount: 4, replacementDates: dates(4, [1, 5, 10, 20]) })];
      const alerts = derive(rows, { thresholds: { replacementFrequencyWindowDays: 30, replacementFrequencyMaxCount: 3 } });
      const freq = alerts.find((a) => a.alertType === 'HIGH_REPLACEMENT_FREQUENCY')!;
      expect(freq.evidence).toMatchObject({ basis: 'CONFIGURED_REPLACEMENT_FREQUENCY', windowDays: 30, maxCount: 3, replacementCountInWindow: 4 });
    });
  });

  // ── §62 Severity + dedup + purity ─────────────────────────────────────────
  describe('§62 severity, ordering and purity', () => {
    it('R1 alerts are sorted by descending severity, then id', () => {
      const rows = [
        row({ sparePart: { id: 's1', code: 'A', name: 'A', partNumber: null, manufacturer: null, isCritical: false, unit: null }, expectedLife: expLife({ band: 'WARNING' }) }),
        row({ machine: { id: 'm2', code: 'M-2', name: 'M2' }, sparePart: { id: 's2', code: 'B', name: 'B', partNumber: null, manufacturer: null, isCritical: false, unit: null }, expectedLife: expLife({ band: 'EXPIRED' }) }),
        row({ machine: { id: 'm3', code: 'M-3', name: 'M3' }, sparePart: { id: 's3', code: 'C', name: 'C', partNumber: null, manufacturer: null, isCritical: false, unit: null }, expectedLife: expLife({ band: 'DUE' }) }),
      ];
      const alerts = derive(rows);
      expect(alerts.map((a) => a.severity)).toEqual(['HIGH', 'MEDIUM', 'LOW']);
    });

    it('R2 severityRank is monotonic', () => {
      expect(severityRank('LOW')).toBeLessThan(severityRank('MEDIUM'));
      expect(severityRank('MEDIUM')).toBeLessThan(severityRank('HIGH'));
      expect(severityRank('HIGH')).toBeLessThan(severityRank('CRITICAL'));
    });

    it('R3 no fabrication: absent criticality yields NONE and no raise', () => {
      const alerts = derive([row({ expectedLife: expLife({ band: 'DUE' }) })], { componentCriticalityById: noComps });
      expect(alerts[0].criticalitySource).toBe('NONE');
      expect(alerts[0].severity).toBe('MEDIUM');
    });

    it('R4 criticalityOf prefers component CRITICAL over spare-part flag', () => {
      const r = row({ sparePart: { id: 's1', code: 'SP-1', name: 'B', partNumber: null, manufacturer: null, isCritical: true, unit: null } });
      expect(criticalityOf(r, compCritical())).toBe('COMPONENT_CRITICAL');
      expect(criticalityOf(r, compNormal())).toBe('SPARE_PART_CRITICAL');
      expect(criticalityOf(r, noComps)).toBe('SPARE_PART_CRITICAL');
    });

    it('R5 deriveAlerts never mutates the input rows', () => {
      const rows = [row({ repeatedEarlyFailure: true, failureEventCount: 2, prematureFailureCount: 2, replacementCount: 4, replacementDates: [new Date(REF.getTime() - DAY)] })];
      const before = JSON.stringify(rows.map((r) => ({ rc: r.replacementCount, rd: r.replacementDates.length, ref: r.repeatedEarlyFailure })));
      derive(rows, { thresholds: { replacementFrequencyWindowDays: 30, replacementFrequencyMaxCount: 1 } });
      const after = JSON.stringify(rows.map((r) => ({ rc: r.replacementCount, rd: r.replacementDates.length, ref: r.repeatedEarlyFailure })));
      expect(after).toBe(before);
    });

    it('R6 recommendedActionFor maps every alert type', () => {
      expect(recommendedActionFor('LIFE_APPROACHING_DUE')).toBe('INSPECT');
      expect(recommendedActionFor('LIFE_DUE')).toBe('REPLACE');
      expect(recommendedActionFor('LIFE_OVERDUE')).toBe('REPLACE');
      expect(recommendedActionFor('REPEATED_PREMATURE_FAILURE')).toBe('DIAGNOSE_REPEATED_FAILURE');
      expect(recommendedActionFor('HIGH_REPLACEMENT_FREQUENCY')).toBe('CONDITION_CHECK');
    });

    it('R7 eligibility counters are honest per row', () => {
      const rows = [
        row({ expectedLife: expLife({ band: 'DUE' }) }),
        row({ expectedLife: expLife({ configured: false, band: 'UNKNOWN' }) }),
        row({ current: null, failureEventCount: 2, prematureFailureCount: 2, repeatedEarlyFailure: true }),
      ];
      const elig = computeAlertEligibility(rows, NO_THRESHOLDS);
      expect(elig.populations).toBe(3);
      expect(elig.activeInstances).toBe(2);
      expect(elig.withExpectedLife).toBe(1);
      expect(elig.unknownExpectedLife).toBe(1);
      expect(elig.prematureFailurePopulations).toBe(1);
      expect(elig.repeatedFailurePopulations).toBe(1);
    });
  });
});
