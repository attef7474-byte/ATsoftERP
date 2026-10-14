import {
  computeServiceLifeMs,
  computeExpectedLife,
  classifyTermination,
  classifyPremature,
  computeMtbf,
  computeMttr,
  isRepeatedEarlyFailure,
  LifeCycleInstance,
} from './reliability-calculations';

const now = new Date('2026-10-01T00:00:00.000Z');

const base = (over: Partial<LifeCycleInstance> = {}): LifeCycleInstance => ({
  status: 'ACTIVE',
  installedAt: new Date('2026-09-01T00:00:00.000Z'),
  removedAt: null,
  expectedLifeValue: null,
  expectedLifeUnit: null,
  lifeStartDate: null,
  lifeStartReading: null,
  currentReading: null,
  warningThresholdPercent: 80,
  ...over,
});

describe('computeServiceLifeMs', () => {
  it('A1: ACTIVE part service life runs from installedAt to now', () => {
    const r = computeServiceLifeMs(base(), now);
    expect(r.state).toBe('OK');
    expect(r.ms).toBe(30 * 86_400_000);
  });

  it('A2: terminated part service life runs installedAt -> removedAt', () => {
    const r = computeServiceLifeMs(
      base({ status: 'REMOVED', removedAt: new Date('2026-09-11T00:00:00.000Z') }),
      now,
    );
    expect(r.state).toBe('OK');
    expect(r.ms).toBe(10 * 86_400_000);
  });

  it('A3: missing installedAt is UNKNOWN, never a fake zero', () => {
    const r = computeServiceLifeMs(base({ installedAt: null }), now);
    expect(r).toEqual({ state: 'UNKNOWN', ms: null });
  });

  it('A4: terminated part without removedAt is UNKNOWN', () => {
    const r = computeServiceLifeMs(base({ status: 'REMOVED', removedAt: null }), now);
    expect(r.state).toBe('UNKNOWN');
  });

  it('A5: negative interval is INVALID', () => {
    const r = computeServiceLifeMs(
      base({ installedAt: new Date('2026-10-05T00:00:00.000Z') }),
      now,
    );
    expect(r.state).toBe('INVALID');
    expect(r.ms).toBeNull();
  });
});

describe('computeExpectedLife', () => {
  it('is UNKNOWN when the instance carries no authoritative configuration', () => {
    const r = computeExpectedLife(base(), now);
    expect(r.configured).toBe(false);
    expect(r.band).toBe('UNKNOWN');
  });

  it('DAYS: computes progress, band and expiry from lifeStartDate', () => {
    const r = computeExpectedLife(
      base({ expectedLifeValue: 100, expectedLifeUnit: 'DAYS', lifeStartDate: new Date('2026-09-21T00:00:00.000Z') }),
      now,
    );
    expect(r.configured).toBe(true);
    expect(r.progress).toBeCloseTo(0.1, 5);
    expect(r.band).toBe('NORMAL');
    expect(r.expectedExpiryDate?.toISOString()).toBe('2026-12-30T00:00:00.000Z');
  });

  it('DAYS: reports EXPIRED past the expected end', () => {
    const r = computeExpectedLife(
      base({ expectedLifeValue: 10, expectedLifeUnit: 'DAYS', lifeStartDate: new Date('2026-09-01T00:00:00.000Z') }),
      now,
    );
    expect(r.band).toBe('EXPIRED');
    expect(r.remainingMs).toBeLessThan(0);
  });

  it('HOURS: uses readings, not wall-clock time', () => {
    const r = computeExpectedLife(
      base({ expectedLifeValue: 1000, expectedLifeUnit: 'HOURS', lifeStartReading: 0, currentReading: 950 }),
      now,
    );
    expect(r.configured).toBe(true);
    expect(r.band).toBe('DUE');
    expect(r.remainingReading).toBe(50);
    expect(r.remainingMs).toBeNull();
  });

  it('HOURS: configured but UNKNOWN band when readings are missing', () => {
    const r = computeExpectedLife(
      base({ expectedLifeValue: 1000, expectedLifeUnit: 'HOURS' }),
      now,
    );
    expect(r.configured).toBe(true);
    expect(r.band).toBe('UNKNOWN');
  });

  it('never invents a default lifetime for a non-positive value', () => {
    const r = computeExpectedLife(
      base({ expectedLifeValue: 0, expectedLifeUnit: 'DAYS', lifeStartDate: now }),
      now,
    );
    expect(r.configured).toBe(false);
    expect(r.band).toBe('UNKNOWN');
  });
});

describe('classifyTermination', () => {
  it('F1: explicit FAILED status is a failure', () => {
    expect(classifyTermination({ status: 'FAILED', linkedFailureCategories: [] })).toBe('FAILURE');
  });

  it('F2: a linked classified downtime log is a failure', () => {
    expect(classifyTermination({ status: 'REMOVED', linkedFailureCategories: ['MECHANICAL'] })).toBe('FAILURE');
  });

  it('F3: replacement with no failure evidence is NOT a failure', () => {
    expect(classifyTermination({ status: 'REPLACED', linkedFailureCategories: [] })).toBe('NON_FAILURE');
  });

  it('F4: blank/null failure categories do not create a failure', () => {
    expect(classifyTermination({ status: 'REMOVED', linkedFailureCategories: [null, '   ', undefined] })).toBe('NON_FAILURE');
  });
});

describe('classifyPremature', () => {
  it('E1: never premature without a proven failure', () => {
    expect(
      classifyPremature({
        classification: 'NON_FAILURE',
        serviceLife: { state: 'OK', ms: 1 },
        expected: computeExpectedLife(base({ expectedLifeValue: 100, expectedLifeUnit: 'DAYS', lifeStartDate: now }), now),
      }),
    ).toBe('NO');
  });

  it('E2: UNKNOWN when there is no authoritative expected life', () => {
    expect(
      classifyPremature({
        classification: 'FAILURE',
        serviceLife: { state: 'OK', ms: 1 },
        expected: computeExpectedLife(base(), now),
      }),
    ).toBe('UNKNOWN');
  });

  it('E3: YES when a failure occurs before the DAYS expected life', () => {
    const expected = computeExpectedLife(
      base({ expectedLifeValue: 100, expectedLifeUnit: 'DAYS', lifeStartDate: new Date('2026-01-01T00:00:00.000Z') }),
      now,
    );
    // failed after 10 days, expected 100 days
    expect(
      classifyPremature({
        classification: 'FAILURE',
        serviceLife: { state: 'OK', ms: 10 * 86_400_000 },
        expected,
      }),
    ).toBe('YES');
  });

  it('E4: HOURS/CYCLES expected life cannot prove prematurity', () => {
    const expected = computeExpectedLife(
      base({ expectedLifeValue: 1000, expectedLifeUnit: 'HOURS', lifeStartReading: 0, currentReading: 1000 }),
      now,
    );
    expect(
      classifyPremature({
        classification: 'FAILURE',
        serviceLife: { state: 'OK', ms: 10 * 86_400_000 },
        expected,
      }),
    ).toBe('UNKNOWN');
  });
});

describe('computeMtbf', () => {
  it('M1: INSUFFICIENT_DATA with fewer than two failure events', () => {
    const r = computeMtbf([86_400_000]);
    expect(r.status).toBe('INSUFFICIENT_DATA');
    expect(r.mtbfMs).toBeNull();
    expect(r.eventCount).toBe(1);
  });

  it('M2: mean of the failure lives with two or more events', () => {
    const r = computeMtbf([10 * 86_400_000, 20 * 86_400_000]);
    expect(r.status).toBe('OK');
    expect(r.mtbfDays).toBe(15);
    expect(r.eventCount).toBe(2);
  });
});

describe('computeMttr', () => {
  it('T1: INSUFFICIENT_DATA with no completed repair intervals', () => {
    const r = computeMttr([], { laborMs: 5000, downtimeMs: 9000, openRepairs: 1 });
    expect(r.status).toBe('INSUFFICIENT_DATA');
    expect(r.mttrMs).toBeNull();
    expect(r.laborMs).toBe(5000);
    expect(r.downtimeMs).toBe(9000);
    expect(r.openRepairs).toBe(1);
  });

  it('T2: means the elapsed execution intervals and keeps labor/downtime separate', () => {
    const r = computeMttr([3_600_000, 1_800_000], { laborMs: 3_000_000, downtimeMs: 7_200_000 });
    expect(r.status).toBe('OK');
    expect(r.mttrHours).toBeCloseTo(0.75, 5);
    expect(r.laborMs).toBe(3_000_000);
    expect(r.downtimeMs).toBe(7_200_000);
  });
});

describe('isRepeatedEarlyFailure', () => {
  it('requires at least two failures and two premature failures', () => {
    expect(isRepeatedEarlyFailure(2, 2)).toBe(true);
    expect(isRepeatedEarlyFailure(2, 1)).toBe(false);
    expect(isRepeatedEarlyFailure(1, 2)).toBe(false);
  });
});
