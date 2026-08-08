import { clampToPeriod, intersectIntervals, intersectionMinutes, mergeIntervals, totalDurationMinutes } from './downtime-union.util';

const at = (iso: string) => new Date(iso);

describe('downtime-union.util', () => {
  describe('mergeIntervals', () => {
    it('merges overlapping and touching intervals and drops empty ones', () => {
      const merged = mergeIntervals([
        { start: at('2026-08-05T00:00:00Z'), end: at('2026-08-05T02:00:00Z') },
        { start: at('2026-08-05T01:00:00Z'), end: at('2026-08-05T03:00:00Z') },
        { start: at('2026-08-05T03:00:00Z'), end: at('2026-08-05T04:00:00Z') },
        { start: at('2026-08-05T05:00:00Z'), end: at('2026-08-05T05:00:00Z') },
        { start: at('2026-08-05T09:00:00Z'), end: at('2026-08-05T10:00:00Z') },
      ]);
      expect(merged).toHaveLength(2);
      expect(merged[0].start.toISOString()).toBe('2026-08-05T00:00:00.000Z');
      expect(merged[0].end.toISOString()).toBe('2026-08-05T04:00:00.000Z');
      expect(merged[1].end.toISOString()).toBe('2026-08-05T10:00:00.000Z');
    });
  });

  describe('totalDurationMinutes', () => {
    it('sums non-overlapping intervals', () => {
      const minutes = totalDurationMinutes([
        { start: at('2026-08-05T00:00:00Z'), end: at('2026-08-05T01:00:00Z') },
        { start: at('2026-08-05T02:00:00Z'), end: at('2026-08-05T04:00:00Z') },
      ]);
      expect(minutes).toBe(180);
    });
  });

  describe('intersectIntervals', () => {
    it('computes the overlap of two merged sets', () => {
      const sessions = [
        { start: at('2026-08-05T00:00:00Z'), end: at('2026-08-05T02:00:00Z') },
        { start: at('2026-08-05T04:00:00Z'), end: at('2026-08-05T06:00:00Z') },
      ];
      const downtime = [
        { start: at('2026-08-05T01:00:00Z'), end: at('2026-08-05T05:00:00Z') },
      ];
      const overlap = intersectIntervals(sessions, downtime);
      expect(totalDurationMinutes(overlap)).toBe(120);
    });
  });

  describe('intersectionMinutes', () => {
    it('counts only downtime that falls inside sessions', () => {
      const sessions = [
        { start: at('2026-08-05T00:00:00Z'), end: at('2026-08-05T02:00:00Z') },
      ];
      const downtime = [
        { start: at('2026-08-05T01:00:00Z'), end: at('2026-08-05T04:00:00Z') },
      ];
      expect(intersectionMinutes(sessions, downtime)).toBe(60);
    });
    it('counts zero when downtime sits outside every session', () => {
      const sessions = [
        { start: at('2026-08-05T00:00:00Z'), end: at('2026-08-05T02:00:00Z') },
      ];
      const downtime = [
        { start: at('2026-08-05T06:00:00Z'), end: at('2026-08-05T07:00:00Z') },
      ];
      expect(intersectionMinutes(sessions, downtime)).toBe(0);
    });
  });

  describe('clampToPeriod', () => {
    it('clips intervals to the requested period', () => {
      const clamped = clampToPeriod(
        [{ start: at('2026-08-05T00:00:00Z'), end: at('2026-08-05T23:00:00Z') }],
        at('2026-08-05T08:00:00Z'),
        at('2026-08-05T16:00:00Z'),
      );
      expect(totalDurationMinutes(clamped)).toBe(480);
    });
  });
});
