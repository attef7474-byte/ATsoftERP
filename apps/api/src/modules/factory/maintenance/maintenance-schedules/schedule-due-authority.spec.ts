import {
  DUE_SOON_DAYS,
  ScheduleDueSource,
  ScheduleDueState,
  calculateNextDueDate,
  dueSoonWhere,
  dueStatusWhere,
  effectiveDueBetween,
  effectiveDueCompare,
  generationClaimWhere,
  getEffectiveDueDate,
  getScheduleDueState,
  inactiveWhere,
  isGenerationDue,
  overdueWhere,
  upcomingWhere,
  withDueAuthority,
} from './schedule-due-authority';

const NOW = new Date('2026-11-23T12:00:00.000Z');
const DAY = 86400000;

const fixture = (overrides: Partial<ScheduleDueSource> & { id?: string } = {}) => ({
  id: 's1',
  status: 'ACTIVE',
  startDate: new Date('2026-08-01T00:00:00.000Z'),
  nextDueDate: null,
  endDate: null,
  frequency: 'WEEKLY',
  intervalDays: null,
  ...overrides,
});

/** Controlled Phase 9 fixtures A-F. */
const fixtures: Record<string, ReturnType<typeof fixture>> = {
  A: fixture({ id: 'A', startDate: new Date('2026-11-01T00:00:00.000Z'), nextDueDate: null }),
  B: fixture({
    id: 'B',
    startDate: new Date('2026-08-01T00:00:00.000Z'),
    nextDueDate: new Date(NOW.getTime() + 10 * DAY),
  }),
  C: fixture({
    id: 'C',
    nextDueDate: new Date(NOW.getTime() + 3 * DAY),
  }),
  D: fixture({
    id: 'D',
    nextDueDate: new Date(NOW.getTime() - 3 * DAY),
  }),
  E: fixture({
    id: 'E',
    status: 'INACTIVE',
    nextDueDate: new Date(NOW.getTime() - 3 * DAY),
  }),
  F: fixture({
    id: 'F',
    endDate: new Date(NOW.getTime() - DAY),
    nextDueDate: new Date(NOW.getTime() - 3 * DAY),
  }),
};

const expectedStates: Record<string, ScheduleDueState> = {
  A: 'overdue',
  B: 'notDue',
  C: 'dueSoon',
  D: 'overdue',
  E: 'inactive',
  F: 'expired',
};

type where = Record<string, any>;

function compare(actual: unknown, operator: string, boundary: unknown): boolean {
  if (actual === null || actual === undefined || boundary === null || boundary === undefined) return false;
  const a = actual instanceof Date ? actual.getTime() : actual as any;
  const b = boundary instanceof Date ? (boundary as Date).getTime() : boundary as any;
  switch (operator) {
    case 'lt': return a < b;
    case 'lte': return a <= b;
    case 'gt': return a > b;
    case 'gte': return a >= b;
    default: throw new Error(`Unsupported operator ${operator}`);
  }
}

function matches(row: any, predicate: where): boolean {
  for (const [field, condition] of Object.entries(predicate)) {
    if (field === 'AND') {
      if (!(condition as any[]).every((child) => matches(row, child))) return false;
      continue;
    }
    if (field === 'OR') {
      if (!(condition as any[]).some((child) => matches(row, child))) return false;
      continue;
    }
    const value = row[field];
    if (condition === null) {
      if (value !== null && value !== undefined) return false;
      continue;
    }
    if (typeof condition !== 'object' || condition instanceof Date) {
      if (value !== condition) return false;
      continue;
    }
    const operators = condition as where;
    if ('not' in operators && value === operators.not) return false;
    if ('in' in operators && !(operators.in as any[]).includes(value)) return false;
    for (const [operator, boundary] of Object.entries(operators)) {
      if (operator === 'not' || operator === 'in') continue;
      if (!compare(value, operator, boundary)) return false;
    }
  }
  return true;
}

describe('Phase 9 — canonical schedule due authority', () => {
  describe('controlled fixtures A-F', () => {
    it.each(Object.keys(fixtures))('fixture %s derives the expected effective due and state', (key) => {
      const schedule = fixtures[key];
      expect(getEffectiveDueDate(schedule)).toEqual(schedule.nextDueDate ?? schedule.startDate);
      expect(getScheduleDueState(schedule, NOW)).toBe(expectedStates[key]);
      const enriched = withDueAuthority(schedule, NOW);
      expect(enriched.effectiveDueDate).toEqual(schedule.nextDueDate ?? schedule.startDate);
      expect(enriched.dueStatus).toBe(expectedStates[key]);
      expect(schedule).not.toHaveProperty('effectiveDueDate');
    });

    it('matches exactly one DB-level due-state predicate for every fixture', () => {
      const states: ScheduleDueState[] = ['inactive', 'expired', 'overdue', 'dueSoon', 'notDue'];
      for (const key of Object.keys(fixtures)) {
        const schedule = fixtures[key];
        const expected = expectedStates[key];
        const matching = states.filter((state) => matches(schedule, dueStatusWhere(state, NOW)));
        expect(matching).toEqual([expected]);
      }
    });

    it('selects only due occurrences for generation and never future effective dues', () => {
      expect(isGenerationDue(fixtures.A, NOW)).toBe(true);
      expect(isGenerationDue(fixtures.C, NOW)).toBe(true);
      expect(isGenerationDue(fixtures.D, NOW)).toBe(true);
      expect(isGenerationDue(fixtures.B, NOW)).toBe(false);
      expect(isGenerationDue(fixtures.E, NOW)).toBe(false);
      expect(isGenerationDue(fixtures.F, NOW)).toBe(false);
    });
  });

  describe('horizon boundaries', () => {
    it('treats exactly seven days as dueSoon and just beyond seven days as notDue', () => {
      const exact = fixture({ nextDueDate: new Date(NOW.getTime() + DUE_SOON_DAYS * DAY) });
      const beyond = fixture({ nextDueDate: new Date(NOW.getTime() + DUE_SOON_DAYS * DAY + 1) });
      expect(getScheduleDueState(exact, NOW)).toBe('dueSoon');
      expect(getScheduleDueState(beyond, NOW)).toBe('notDue');
      expect(matches(exact, dueSoonWhere(NOW))).toBe(true);
      expect(matches(beyond, dueSoonWhere(NOW))).toBe(false);
    });

    it('uses the same effective-due predicate for upcoming and overdue database filters', () => {
      const past = fixtures.D;
      const future = fixtures.B;
      expect(matches(past, overdueWhere(NOW))).toBe(true);
      expect(matches(future, overdueWhere(NOW))).toBe(false);
      expect(matches(future, upcomingWhere(NOW))).toBe(true);
      expect(matches(future, effectiveDueBetween(NOW, new Date(NOW.getTime() + 30 * DAY)))).toBe(true);
      expect(matches(past, effectiveDueCompare('lt', NOW))).toBe(true);
      expect(matches(future, effectiveDueCompare('gt', NOW))).toBe(true);
      expect(matches(fixtures.E, inactiveWhere())).toBe(true);
    });
  });

  describe('deterministic anchored recurrence', () => {
    it('advances day intervals from the effective due without wall-clock drift', () => {
      const schedule = fixture({
        startDate: new Date('2026-01-01T00:00:00.000Z'),
        nextDueDate: new Date('2026-01-08T00:00:00.000Z'),
        frequency: 'WEEKLY',
        intervalDays: null,
      });
      expect(calculateNextDueDate(schedule, new Date('2026-01-31T00:00:00.000Z')))
        .toEqual(new Date('2026-02-05T00:00:00.000Z'));
    });

    it('preserves the startDate day for monthly cadence and clamps month ends', () => {
      const schedule = fixture({
        startDate: new Date('2024-01-31T00:00:00.000Z'),
        nextDueDate: new Date('2024-02-29T00:00:00.000Z'),
        frequency: 'MONTHLY',
      });
      expect(calculateNextDueDate(schedule, new Date('2024-03-01T00:00:00.000Z')))
        .toEqual(new Date('2024-03-31T00:00:00.000Z'));
    });

    it('preserves leap-day anchoring for yearly cadence', () => {
      const schedule = fixture({
        startDate: new Date('2024-02-29T00:00:00.000Z'),
        frequency: 'YEARLY',
      });
      expect(calculateNextDueDate(schedule, new Date('2024-03-01T00:00:00.000Z')))
        .toEqual(new Date('2025-02-28T00:00:00.000Z'));
    });

    it('does not advance beyond endDate and returns null for unsupported cadence', () => {
      const bounded = fixture({
        startDate: new Date('2026-11-01T00:00:00.000Z'),
        endDate: new Date('2026-11-20T00:00:00.000Z'),
        frequency: 'WEEKLY',
      });
      expect(calculateNextDueDate(bounded, new Date('2026-11-23T00:00:00.000Z'))).toBeNull();

      const unsupported = fixture({ frequency: 'UNKNOWN', intervalDays: null });
      expect(calculateNextDueDate(unsupported, NOW)).toBeNull();
    });
  });

  describe('generation claim', () => {
    it('claims the exact observed occurrence including null lastGeneratedAt', () => {
      expect(generationClaimWhere(fixtures.D)).toEqual({
        id: 'D',
        nextDueDate: fixtures.D.nextDueDate,
        lastGeneratedAt: null,
      });
    });
  });
});
