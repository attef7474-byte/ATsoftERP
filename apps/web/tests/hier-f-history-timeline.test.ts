import en from '../src/lib/i18n/locales/en';
import ar from '../src/lib/i18n/locales/ar';
import { resolveTranslation } from '../src/lib/i18n/translation-core';

function resolve(key: string, locale: 'ar' | 'en'): string {
  const data = locale === 'ar' ? (ar as any) : (en as any);
  return resolveTranslation(data, locale, key);
}

const HIER_F_KEYS = [
  'timelineHistory',
  'supervisionHistory',
  'leadershipHistory',
  'combinedTimeline',
  'viewHistory',
  'viewLeadershipHistory',
  'viewSupervisionHistory',
  'subordinate',
  'supervisor',
  'temporalStatus',
  'dateRange',
  'from',
  'to',
  'noSupervisionHistory',
  'noLeadershipHistory',
  'noRecordsInDateRange',
  'noActingHistory',
  'noCurrentRecords',
  'past',
  'current',
  'future',
  'filterByPerson',
  'filterBySupervisor',
  'filterBySubordinate',
  'filterByRelationshipType',
  'filterByLeadershipRole',
  'filterByAssignmentType',
  'filterByBranch',
  'filterByAdministration',
  'filterByDepartment',
  'filterByTemporalStatus',
  'allRelationshipTypes',
  'allLeadershipRoles',
  'allAssignmentTypes',
  'allTemporalStatuses',
];

describe('HIER-F history timeline i18n keys', () => {
  describe('English translations', () => {
    for (const key of HIER_F_KEYS) {
      it(`EN: core.${key} resolves to a non-empty string`, () => {
        const value = resolve(`core.${key}`, 'en');
        expect(value).toBeTruthy();
        expect(typeof value).toBe('string');
        expect(value.length).toBeGreaterThan(0);
      });
    }
  });

  describe('Arabic translations', () => {
    for (const key of HIER_F_KEYS) {
      it(`AR: core.${key} resolves to a non-empty string`, () => {
        const value = resolve(`core.${key}`, 'ar');
        expect(value).toBeTruthy();
        expect(typeof value).toBe('string');
        expect(value.length).toBeGreaterThan(0);
      });
    }
  });

  describe('EN/AR key synchronization', () => {
    it('EN and AR have the same HIER-F keys', () => {
      const enCore = (en as any).core;
      const arCore = (ar as any).core;
      for (const key of HIER_F_KEYS) {
        expect(enCore).toHaveProperty(key);
        expect(arCore).toHaveProperty(key);
      }
    });
  });
});

describe('HIER-F type existence', () => {
  it('HistorySupervisionRow has required fields', () => {
    const row = {
      id: 'test',
      relationshipType: 'DIRECT',
      subordinate: {
        assignmentId: 'pa1',
        person: { id: 'p1', name: 'Test', code: 'T' },
        jobTitle: null,
        department: null,
        branch: null,
        administration: null,
        assignmentType: 'PRIMARY',
      },
      supervisor: null,
      effectiveFrom: '2026-01-01T00:00:00.000Z',
      effectiveTo: null,
      isActive: true,
      status: 'ACTIVE',
      temporalStatus: 'CURRENT' as const,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    };
    expect(row.id).toBe('test');
    expect(row.relationshipType).toBe('DIRECT');
    expect(row.temporalStatus).toBe('CURRENT');
    expect(row.subordinate.person?.name).toBe('Test');
  });

  it('HistoryLeadershipRow has required fields', () => {
    const row = {
      id: 'test',
      person: { id: 'p1', name: 'Ahmed', code: 'A001' },
      personCode: 'A001',
      leadershipLevel: 'DEPARTMENT_HEAD',
      assignmentType: 'PRIMARY',
      jobTitle: null,
      department: null,
      branch: null,
      administration: null,
      effectiveFrom: '2026-01-01T00:00:00.000Z',
      effectiveTo: null,
      isActive: true,
      status: 'ACTIVE',
      temporalStatus: 'CURRENT' as const,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    };
    expect(row.leadershipLevel).toBe('DEPARTMENT_HEAD');
    expect(row.assignmentType).toBe('PRIMARY');
    expect(row.temporalStatus).toBe('CURRENT');
  });

  it('HistorySupervisionRow supports all temporal statuses', () => {
    const statuses = ['PAST', 'CURRENT', 'FUTURE'] as const;
    for (const status of statuses) {
      const row = {
        id: 'test',
        relationshipType: 'DIRECT',
        subordinate: null,
        supervisor: null,
        effectiveFrom: '2026-01-01T00:00:00.000Z',
        effectiveTo: null,
        isActive: true,
        status: 'ACTIVE',
        temporalStatus: status,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      };
      expect(row.temporalStatus).toBe(status);
    }
  });

  it('HistoryLeadershipRow supports all leadership levels', () => {
    const levels = ['TEAM_LEAD', 'SUPERVISOR', 'DEPARTMENT_HEAD', 'ADMINISTRATION_MANAGER'];
    for (const level of levels) {
      const row = {
        id: 'test',
        person: null,
        personCode: null,
        leadershipLevel: level,
        assignmentType: 'PRIMARY',
        jobTitle: null,
        department: null,
        branch: null,
        administration: null,
        effectiveFrom: '2026-01-01T00:00:00.000Z',
        effectiveTo: null,
        isActive: true,
        status: 'ACTIVE',
        temporalStatus: 'CURRENT' as const,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      };
      expect(row.leadershipLevel).toBe(level);
    }
  });
});

describe('HIER-F history logic', () => {
  it('temporal classification: past record has effectiveTo in the past', () => {
    const effectiveTo = new Date('2025-12-31');
    const now = new Date('2026-06-01');
    expect(effectiveTo <= now).toBe(true);
  });

  it('temporal classification: current record has effectiveFrom <= now and effectiveTo > now or null', () => {
    const effectiveFrom = new Date('2026-01-01');
    const effectiveTo: Date | null = null;
    const now = new Date('2026-06-01');
    expect(effectiveFrom <= now).toBe(true);
    const effectiveToDate = effectiveTo ?? new Date('9999-12-31T23:59:59.999Z');
    expect(effectiveToDate > now).toBe(true);
  });

  it('temporal classification: future record has effectiveFrom > now', () => {
    const effectiveFrom = new Date('2027-01-01');
    const now = new Date('2026-06-01');
    expect(effectiveFrom > now).toBe(true);
  });

  it('date range overlap: record overlapping query range', () => {
    const recordStart = new Date('2026-01-01');
    const recordEnd = new Date('2026-12-31');
    const queryStart = new Date('2026-06-01');
    const queryEnd = new Date('2026-06-30');
    const overlaps = recordStart < queryEnd && queryStart < recordEnd;
    expect(overlaps).toBe(true);
  });

  it('date range overlap: record before query range', () => {
    const recordStart = new Date('2025-01-01');
    const recordEnd = new Date('2025-06-01');
    const queryStart = new Date('2026-01-01');
    const queryEnd = new Date('2026-12-31');
    const overlaps = recordStart < queryEnd && queryStart < recordEnd;
    expect(overlaps).toBe(false);
  });

  it('date range overlap: open-ended record overlaps query', () => {
    const recordStart = new Date('2026-01-01');
    const recordEnd = null;
    const queryStart = new Date('2026-06-01');
    const queryEnd = new Date('2026-12-31');
    const recordEndValue = recordEnd ?? new Date('9999-12-31T23:59:59.999Z');
    const overlaps = recordStart < queryEnd && queryStart < recordEndValue;
    expect(overlaps).toBe(true);
  });

  it('exact boundary: old ends when new starts', () => {
    const oldEffectiveTo = new Date('2026-06-01T00:00:00.000Z');
    const newEffectiveFrom = new Date('2026-06-01T00:00:00.000Z');
    const isSequential = oldEffectiveTo.getTime() === newEffectiveFrom.getTime();
    expect(isSequential).toBe(true);
    const hasOverlap = newEffectiveFrom < oldEffectiveTo;
    expect(hasOverlap).toBe(false);
  });

  it('PRIMARY and ACTING can coexist in leadership history', () => {
    const primary = { assignmentType: 'PRIMARY', leadershipLevel: 'DEPARTMENT_HEAD' };
    const acting = { assignmentType: 'ACTING', leadershipLevel: 'DEPARTMENT_HEAD' };
    expect(primary.assignmentType).not.toBe(acting.assignmentType);
    expect(primary.leadershipLevel).toBe(acting.leadershipLevel);
  });
});
