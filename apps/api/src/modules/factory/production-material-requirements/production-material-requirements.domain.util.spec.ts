import { Prisma } from '@prisma/client';
import {
  computePlannedQuantity,
  isComponentRole,
  isOverIssuePolicy,
  isRequirementStatus,
  isWithinTolerance,
  maxDecimal,
  netIssued,
  positiveDecimal,
  varianceStatus,
} from './production-material-requirements.domain.util';

describe('ProductionMaterialRequirements domain util', () => {
  describe('computePlannedQuantity', () => {
    it('multiplies per-unit by order planned quantity and keeps 4 decimal places', () => {
      expect(computePlannedQuantity(2.5, 100, 1).toString()).toBe('250');
    });

    it('applies the conversion factor from base unit to issue unit', () => {
      expect(computePlannedQuantity(2.5, 100, 1.5).toString()).toBe('375');
    });

    it('rounds to 4 decimal places', () => {
      expect(computePlannedQuantity(1.23456, 3, 1).toString()).toBe('3.7037');
    });
  });

  describe('positiveDecimal', () => {
    it('accepts positive quantities', () => {
      expect(positiveDecimal(5).toString()).toBe('5');
    });

    it('rejects zero and negative quantities', () => {
      expect(() => positiveDecimal(0)).toThrow('quantityMustBePositive');
      expect(() => positiveDecimal(-1)).toThrow('quantityMustBePositive');
    });
  });

  describe('isWithinTolerance', () => {
    it('returns true when issued is within planned', () => {
      expect(isWithinTolerance(10, 10, null)).toBe(true);
      expect(isWithinTolerance(9, 10, 5)).toBe(true);
    });

    it('returns true when issued is within planned plus tolerance percent', () => {
      expect(isWithinTolerance(11, 10, 10)).toBe(true);
    });

    it('returns false when issued exceeds planned plus tolerance', () => {
      expect(isWithinTolerance(11.5, 10, 10)).toBe(false);
    });

    it('treats a missing tolerance as zero tolerance', () => {
      expect(isWithinTolerance(10.5, 10, null)).toBe(false);
    });
  });

  describe('varianceStatus', () => {
    it('returns SHORT when consumed is below planned', () => {
      expect(varianceStatus(8, 10, null)).toBe('SHORT');
    });

    it('returns OK when consumed equals planned', () => {
      expect(varianceStatus(10, 10, null)).toBe('OK');
    });

    it('returns OVER when consumed exceeds planned beyond tolerance', () => {
      expect(varianceStatus(11, 10, 5)).toBe('OVER');
    });
  });

  describe('netIssued', () => {
    it('subtracts IN quantities (returns) from OUT quantities (issues)', () => {
      expect(netIssued(['100', '50'], ['20', '10']).toString()).toBe('120');
    });

    it('returns zero for empty inputs', () => {
      expect(netIssued([], []).toString()).toBe('0');
    });
  });

  describe('maxDecimal', () => {
    it('returns the largest decimal', () => {
      expect(maxDecimal([new Prisma.Decimal(3), new Prisma.Decimal(9), new Prisma.Decimal(4)]).toString()).toBe('9');
    });

    it('returns zero for an empty array', () => {
      expect(maxDecimal([]).toString()).toBe('0');
    });
  });

  describe('enum guards', () => {
    it('validates requirement statuses', () => {
      expect(isRequirementStatus('FROZEN')).toBe(true);
      expect(isRequirementStatus('OPEN')).toBe(false);
    });

    it('validates component roles', () => {
      expect(isComponentRole('RAW_MATERIAL')).toBe(true);
      expect(isComponentRole('LABOR')).toBe(false);
    });

    it('validates over-issue policies', () => {
      expect(isOverIssuePolicy('TOLERANCE')).toBe(true);
      expect(isOverIssuePolicy('ALWAYS')).toBe(false);
    });
  });
});
