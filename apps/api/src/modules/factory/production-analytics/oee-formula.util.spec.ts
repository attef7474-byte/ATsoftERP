import {
  aggregateFactor,
  availabilityFactor,
  clampedInterval,
  computeFactor,
  idealRatePerHour,
  minutesBetween,
  oeeProduct,
  performanceFactor,
  qualityFactor,
} from './oee-formula.util';

describe('oee-formula.util', () => {
  describe('idealRatePerHour', () => {
    it('keeps HOUR basis as-is', () => {
      expect(idealRatePerHour('40', 'HOUR').toString()).toBe('40');
    });
    it('multiplies MINUTE basis by 60', () => {
      expect(idealRatePerHour('2.5', 'MINUTE').toString()).toBe('150');
    });
  });

  describe('computeFactor', () => {
    it('computes fraction and percent', () => {
      const factor = computeFactor('8', '10', 'minutes');
      expect(factor.fraction).toBe('0.8');
      expect(factor.percent).toBe('80');
      expect(factor.blockers).toHaveLength(0);
    });
    it('preserves raw values above 1 (no clamping)', () => {
      const factor = computeFactor('12', '10', 'units');
      expect(factor.fraction).toBe('1.2');
      expect(factor.percent).toBe('120');
    });
    it('blocks on zero denominator', () => {
      const factor = computeFactor('5', '0', 'units');
      expect(factor.fraction).toBeNull();
      expect(factor.blockers).toContain('zeroDenominator');
    });
    it('blocks on negative denominator', () => {
      const factor = computeFactor('5', '-2', 'units');
      expect(factor.fraction).toBeNull();
      expect(factor.blockers).toContain('zeroDenominator');
    });
    it('carries explicit blockers and rounds to declared precision', () => {
      const factor = computeFactor('1.23456789', '3', 'minutes', ['noPlannedProductionTime']);
      expect(factor.fraction).toBeNull();
      expect(factor.blockers).toEqual(['noPlannedProductionTime']);
      expect(factor.numerator).toBe('1.234568');
    });
  });

  describe('availabilityFactor', () => {
    it('returns null when there is no planned production time', () => {
      const factor = availabilityFactor('0', '0');
      expect(factor.fraction).toBeNull();
      expect(factor.blockers).toContain('noPlannedProductionTime');
    });
    it('computes run/planned', () => {
      const factor = availabilityFactor('480', '420');
      expect(factor.fraction).toBe('0.875');
      expect(factor.percent).toBe('87.5');
    });
  });

  describe('performanceFactor', () => {
    it('computes actual/ideal', () => {
      const factor = performanceFactor('400', '360');
      expect(factor.fraction).toBe('0.9');
      expect(factor.percent).toBe('90');
      expect(factor.warnings).not.toContain('performanceAboveCap');
    });
    it('warns but keeps raw value when above 100%', () => {
      const factor = performanceFactor('360', '400');
      expect(factor.fraction).toBe('1.111111');
      expect(factor.warnings).toContain('performanceAboveCap');
    });
    it('propagates incompatible-unit blocker', () => {
      const factor = performanceFactor('400', '360', ['incompatibleUnit']);
      expect(factor.fraction).toBeNull();
      expect(factor.blockers).toContain('incompatibleUnit');
    });
  });

  describe('qualityFactor', () => {
    it('computes good/total', () => {
      const factor = qualityFactor('950', '1000');
      expect(factor.fraction).toBe('0.95');
      expect(factor.percent).toBe('95');
    });
    it('blocks on zero total', () => {
      const factor = qualityFactor('0', '0');
      expect(factor.fraction).toBeNull();
      expect(factor.blockers).toContain('noTotalOutput');
    });
    it('warns when good exceeds total', () => {
      const factor = qualityFactor('1100', '1000');
      expect(factor.fraction).toBe('1.1');
      expect(factor.warnings).toContain('qualityGoodExceedsTotal');
    });
  });

  describe('oeeProduct', () => {
    it('multiplies the three factors', () => {
      const availability = availabilityFactor('480', '480');
      const performance = performanceFactor('400', '400');
      const quality = qualityFactor('1000', '1000');
      const oee = oeeProduct(availability, performance, quality);
      expect(oee.fraction).toBe('1');
      expect(oee.percent).toBe('100');
    });
    it('is blocked when any factor is null', () => {
      const availability = availabilityFactor('0', '0');
      const performance = performanceFactor('400', '400');
      const quality = qualityFactor('1000', '1000');
      const oee = oeeProduct(availability, performance, quality);
      expect(oee.fraction).toBeNull();
      expect(oee.blockers).toContain('noPlannedProductionTime');
    });
    it('aggregates blockers from several null factors', () => {
      const availability = availabilityFactor('0', '0');
      const performance = performanceFactor('0', '0', ['incompatibleUnit']);
      const quality = qualityFactor('0', '0');
      const oee = oeeProduct(availability, performance, quality);
      expect(oee.fraction).toBeNull();
      expect(oee.blockers).toEqual(expect.arrayContaining(['noPlannedProductionTime', 'incompatibleUnit', 'noTotalOutput']));
    });
  });

  describe('aggregateFactor', () => {
    it('divides summed numerators by summed denominators', () => {
      const factor = aggregateFactor('800', '1000', 'units');
      expect(factor.fraction).toBe('0.8');
    });
    it('blocks when the aggregate denominator is not positive', () => {
      const factor = aggregateFactor('0', '0', 'units');
      expect(factor.fraction).toBeNull();
      expect(factor.blockers).toContain('zeroDenominator');
    });
  });

  describe('time helpers', () => {
    it('minutesBetween computes elapsed minutes', () => {
      const start = new Date('2026-08-05T00:00:00Z');
      const end = new Date('2026-08-05T08:00:00Z');
      expect(minutesBetween(start, end).toString()).toBe('480');
    });
    it('clampedInterval returns the intersection window', () => {
      const start = new Date('2026-08-05T00:00:00Z');
      const end = new Date('2026-08-05T23:00:00Z');
      const from = new Date('2026-08-05T08:00:00Z');
      const to = new Date('2026-08-05T16:00:00Z');
      const clamped = clampedInterval(start, end, from, to);
      expect(clamped).not.toBeNull();
      expect(clamped!.start.toISOString()).toBe('2026-08-05T08:00:00.000Z');
      expect(clamped!.end.toISOString()).toBe('2026-08-05T16:00:00.000Z');
    });
    it('clampedInterval returns null when there is no overlap', () => {
      const start = new Date('2026-08-06T00:00:00Z');
      const end = new Date('2026-08-06T02:00:00Z');
      const from = new Date('2026-08-05T08:00:00Z');
      const to = new Date('2026-08-05T16:00:00Z');
      expect(clampedInterval(start, end, from, to)).toBeNull();
    });
  });
});
