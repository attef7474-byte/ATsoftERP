import {
  allowedStatusTransition,
  computeDurationMinutes,
  intervalsOverlap,
  isValidInterval,
  resolveOccurrenceType,
} from './downtime-domain.util';

const start = (ms: number) => new Date(ms);

describe('downtime-domain.util', () => {
  describe('computeDurationMinutes', () => {
    it('returns minutes rounded to 4 decimals', () => {
      const a = start(1_700_000_000_000);
      const b = start(1_700_000_000_000 + 30 * 60 * 1000 + 12_000);
      expect(computeDurationMinutes(a, b)).toBe(30.2);
    });

    it('returns 0 when the interval is not positive', () => {
      const a = start(1_700_000_000_000);
      expect(computeDurationMinutes(a, a)).toBe(0);
      expect(computeDurationMinutes(a, new Date(a.getTime() - 1000))).toBe(0);
    });
  });

  describe('intervalsOverlap', () => {
    it('detects overlap between closed intervals', () => {
      const a: [number, number] = [0, 100];
      const b: [number, number] = [90, 200];
      expect(intervalsOverlap({ startedAt: start(a[0]), endedAt: start(a[1]) }, { startedAt: start(b[0]), endedAt: start(b[1]) })).toBe(true);
    });

    it('detects adjacency as non-overlap', () => {
      expect(intervalsOverlap({ startedAt: start(0), endedAt: start(100) }, { startedAt: start(100), endedAt: start(200) })).toBe(false);
    });

    it('treats an open interval as unbounded', () => {
      expect(intervalsOverlap({ startedAt: start(50), endedAt: null }, { startedAt: start(0), endedAt: start(100) })).toBe(true);
      expect(intervalsOverlap({ startedAt: start(50), endedAt: null }, { startedAt: start(0), endedAt: start(40) })).toBe(false);
    });
  });

  describe('isValidInterval', () => {
    it('accepts an open interval', () => {
      expect(isValidInterval({ startedAt: start(0), endedAt: null })).toEqual({ valid: true, errorKey: null });
    });

    it('rejects endedAt not after startedAt', () => {
      expect(isValidInterval({ startedAt: start(100), endedAt: start(100) })).toEqual({ valid: false, errorKey: 'productionDowntime.endBeforeStart' });
      expect(isValidInterval({ startedAt: start(100), endedAt: start(90) })).toEqual({ valid: false, errorKey: 'productionDowntime.endBeforeStart' });
    });

    it('accepts a positive closed interval', () => {
      expect(isValidInterval({ startedAt: start(0), endedAt: start(100) })).toEqual({ valid: true, errorKey: null });
    });
  });

  describe('allowedStatusTransition', () => {
    it('allows documented transitions', () => {
      expect(allowedStatusTransition('OPEN', 'CLOSED')).toBe(true);
      expect(allowedStatusTransition('OPEN', 'SUPERSEDED')).toBe(true);
      expect(allowedStatusTransition('OPEN', 'CANCELLED')).toBe(true);
      expect(allowedStatusTransition('CLOSED', 'SUPERSEDED')).toBe(true);
    });

    it('rejects unknown transitions and no-ops', () => {
      expect(allowedStatusTransition('CLOSED', 'OPEN')).toBe(false);
      expect(allowedStatusTransition('CANCELLED', 'OPEN')).toBe(false);
      expect(allowedStatusTransition('OPEN', 'OPEN')).toBe(false);
      expect(allowedStatusTransition('SUPERSEDED', 'CLOSED')).toBe(false);
    });
  });

  describe('resolveOccurrenceType', () => {
    it('maps planned flag to occurrence type', () => {
      expect(resolveOccurrenceType(true)).toBe('PLANNED');
      expect(resolveOccurrenceType(false)).toBe('UNPLANNED');
    });
  });
});
