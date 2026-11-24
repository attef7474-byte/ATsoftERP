import { Prisma } from '@prisma/client';
import { computeKpiScore, scoreToNumber } from './performance-scoring.engine';

const D = (v: any) => new Prisma.Decimal(v);

describe('performance-scoring.engine', () => {
  describe('SCORING_ENGINE_MODES', () => {
    it('LINEAR_TARGET higher-is-better returns calculable score', () => {
      const r = computeKpiScore(85, { scoringMode: 'LINEAR_TARGET', direction: 'HIGHER_IS_BETTER', floorValue: 60, targetValue: 85, ceilingValue: 95, minScore: 0, maxScore: 100, targetScore: 100 });
      expect(r.status).toBe('CALCULABLE');
      expect(Number(r.score?.toString())).toBeCloseTo(100, 2);
    });
    it('LINEAR_RANGE higher-is-better returns calculable score', () => {
      const r = computeKpiScore(72.5, { scoringMode: 'LINEAR_RANGE', direction: 'HIGHER_IS_BETTER', floorValue: 60, targetValue: 85, ceilingValue: 95, minScore: 0, maxScore: 100, targetScore: 100 });
      expect(r.status).toBe('CALCULABLE');
      expect(Number(r.score?.toString())).toBeGreaterThan(0);
      expect(Number(r.score?.toString())).toBeLessThan(100);
    });
    it('THRESHOLD_BANDS returns matched band score', () => {
      const r = computeKpiScore(87, { scoringMode: 'THRESHOLD_BANDS', direction: 'HIGHER_IS_BETTER', bandsJson: JSON.stringify([{ min: 90, max: 100, score: 100 }, { min: 80, max: 89.99, score: 85 }, { min: 0, max: 79.99, score: 60 }]) });
      expect(r.status).toBe('CALCULABLE');
      expect(Number(r.score?.toString())).toBe(85);
    });
    it('CAPPED_RATIO caps at 100 by default clamp', () => {
      const r = computeKpiScore(120, { scoringMode: 'CAPPED_RATIO', direction: 'HIGHER_IS_BETTER', targetValue: 100 });
      expect(r.status).toBe('CALCULABLE');
      expect(Number(r.score?.toString())).toBe(100);
    });
    it('TARGET_BAND gives max at target and min outside band', () => {
      const atTarget = computeKpiScore(10, { scoringMode: 'TARGET_BAND', direction: 'TARGET_IS_BEST', floorValue: 5, targetValue: 10, ceilingValue: 15, minScore: 0, maxScore: 100 });
      const outside = computeKpiScore(20, { scoringMode: 'TARGET_BAND', direction: 'TARGET_IS_BEST', floorValue: 5, targetValue: 10, ceilingValue: 15, minScore: 0, maxScore: 100 });
      expect(Number(atTarget.score?.toString())).toBe(100);
      expect(Number(outside.score?.toString())).toBe(0);
    });
    it('INVERSE_LINEAR lower-is-better returns higher score for lower raw', () => {
      const good = computeKpiScore(5, { scoringMode: 'INVERSE_LINEAR', direction: 'LOWER_IS_BETTER', floorValue: 5, targetValue: 15, ceilingValue: 45, minScore: 0, maxScore: 100, targetScore: 80 });
      const bad = computeKpiScore(45, { scoringMode: 'INVERSE_LINEAR', direction: 'LOWER_IS_BETTER', floorValue: 5, targetValue: 15, ceilingValue: 45, minScore: 0, maxScore: 100, targetScore: 80 });
      expect(Number(good.score?.toString())).toBeGreaterThan(Number(bad.score?.toString()));
    });
  });

  describe('HIGHER_IS_BETTER_MONOTONICITY', () => {
    const rule = { scoringMode: 'LINEAR_TARGET' as const, direction: 'HIGHER_IS_BETTER' as const, floorValue: 60, targetValue: 85, ceilingValue: 95, minScore: 0, maxScore: 100, targetScore: 100 };
    it('score(50) < score(70) < score(85) <= score(95)', () => {
      const s50 = Number(computeKpiScore(50, rule).score);
      const s70 = Number(computeKpiScore(70, rule).score);
      const s85 = Number(computeKpiScore(85, rule).score);
      const s95 = Number(computeKpiScore(95, rule).score);
      expect(s50).toBeLessThan(s70);
      expect(s70).toBeLessThan(s85);
      expect(s85).toBeLessThanOrEqual(s95);
    });
    it('SCORE_CLAMP clamps below 0 and above 100', () => {
      const low = computeKpiScore(-1000, { ...rule, clampMin: 0, clampMax: 100 });
      const high = computeKpiScore(1000, { ...rule, clampMin: 0, clampMax: 100 });
      expect(Number(low.score)).toBeGreaterThanOrEqual(0);
      expect(Number(low.score)).toBeLessThanOrEqual(100);
      expect(Number(high.score)).toBeGreaterThanOrEqual(0);
      expect(Number(high.score)).toBeLessThanOrEqual(100);
    });
  });

  describe('LOWER_IS_BETTER_MONOTONICITY', () => {
    const rule = { scoringMode: 'INVERSE_LINEAR' as const, direction: 'LOWER_IS_BETTER' as const, floorValue: 5, targetValue: 15, ceilingValue: 45, minScore: 0, maxScore: 100, targetScore: 80 };
    it('score(5) > score(15) > score(45)', () => {
      const s5 = Number(computeKpiScore(5, rule).score);
      const s15 = Number(computeKpiScore(15, rule).score);
      const s45 = Number(computeKpiScore(45, rule).score);
      expect(s5).toBeGreaterThan(s15);
      expect(s15).toBeGreaterThan(s45);
    });
  });

  describe('SCORING_BOUNDARIES', () => {
    it('handles exact boundaries and just below/above', () => {
      const rule = { scoringMode: 'LINEAR_TARGET' as const, direction: 'HIGHER_IS_BETTER' as const, floorValue: 60, targetValue: 85, ceilingValue: 95, minScore: 0, maxScore: 100, targetScore: 100 };
      expect(Number(computeKpiScore(60, rule).score)).toBe(0);
      expect(Number(computeKpiScore(85, rule).score)).toBe(100);
      expect(Number(computeKpiScore(95, rule).score)).toBe(100);
      expect(Number(computeKpiScore(59.99, rule).score)).toBe(0);
      expect(Number(computeKpiScore(60.01, rule).score)).toBeGreaterThan(0);
      expect(Number(computeKpiScore(84.99, rule).score)).toBeLessThan(100);
    });
    it('threshold band exact edges', () => {
      const rule = { scoringMode: 'THRESHOLD_BANDS' as const, direction: 'HIGHER_IS_BETTER' as const, bandsJson: JSON.stringify([{ min: 0, max: 50, score: 0 }, { min: 50.01, max: 100, score: 100 }]) };
      expect(Number(computeKpiScore(50, rule).score)).toBe(0);
      expect(Number(computeKpiScore(50.01, rule).score)).toBe(100);
    });
    it('handles 0 and 100 raw values', () => {
      const rule = { scoringMode: 'CAPPED_RATIO' as const, direction: 'HIGHER_IS_BETTER' as const, targetValue: 100 };
      expect(Number(computeKpiScore(0, rule).score)).toBe(0);
      expect(Number(computeKpiScore(100, rule).score)).toBe(100);
    });
  });

  describe('DECIMAL_PRECISION', () => {
    it('uses Decimal-safe calculations for decimal inputs', () => {
      const r1 = computeKpiScore(12.5, { scoringMode: 'CAPPED_RATIO', direction: 'HIGHER_IS_BETTER', targetValue: 100 });
      expect(Number(r1.score?.toDecimalPlaces(4).toString())).toBeCloseTo(12.5, 4);
      const r2 = computeKpiScore(87.35, { scoringMode: 'CAPPED_RATIO', direction: 'HIGHER_IS_BETTER', targetValue: 100 });
      expect(Number(r2.score?.toDecimalPlaces(4).toString())).toBeCloseTo(87.35, 4);
      const r3 = computeKpiScore(0.3333, { scoringMode: 'CAPPED_RATIO', direction: 'HIGHER_IS_BETTER', targetValue: 1 });
      expect(Number(r3.score)).toBeCloseTo(33.33, 2);
      const r4 = computeKpiScore(99.99, { scoringMode: 'CAPPED_RATIO', direction: 'HIGHER_IS_BETTER', targetValue: 100 });
      expect(Number(r4.score?.toDecimalPlaces(4).toString())).toBeCloseTo(99.99, 4);
    });
    it('scoreToNumber returns null or 4dp number', () => {
      expect(scoreToNumber(null)).toBeNull();
      expect(scoreToNumber(new Prisma.Decimal('12.34567'))).toBe(12.3457);
    });
  });

  it('INFORMATIONAL direction returns no calculable score', () => {
    const r = computeKpiScore(50, { scoringMode: 'LINEAR_TARGET', direction: 'INFORMATIONAL' });
    expect(r.score).toBeNull();
    expect(r.status).toBe('CONFIGURATION_MISSING');
  });
});
