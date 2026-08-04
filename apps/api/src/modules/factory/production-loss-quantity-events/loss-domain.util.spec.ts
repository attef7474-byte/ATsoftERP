import { Prisma } from '@prisma/client';
import {
  categoryCompatible,
  computeOutstandingRecoverable,
  isPositiveQuantity,
  isProductionLossType,
  PRODUCTION_LOSS_TYPES,
} from './loss-domain.util';

describe('loss-domain.util', () => {
  describe('isProductionLossType', () => {
    it('accepts the four documented types', () => {
      for (const type of PRODUCTION_LOSS_TYPES) expect(isProductionLossType(type)).toBe(true);
    });
    it('rejects unknown types', () => {
      expect(isProductionLossType('RECOVERED')).toBe(false);
      expect(isProductionLossType('')).toBe(false);
    });
  });

  describe('isPositiveQuantity', () => {
    it('accepts positive values', () => {
      expect(isPositiveQuantity('12.5')).toBe(true);
      expect(isPositiveQuantity(new Prisma.Decimal('0.0001'))).toBe(true);
    });
    it('rejects zero and negatives', () => {
      expect(isPositiveQuantity('0')).toBe(false);
      expect(isPositiveQuantity('-3')).toBe(false);
    });
  });

  describe('categoryCompatible', () => {
    it('enforces category per type', () => {
      expect(categoryCompatible('WASTE', 'WASTE')).toBe(true);
      expect(categoryCompatible('WASTE', 'SCRAP')).toBe(false);
      expect(categoryCompatible('SCRAP', 'SCRAP')).toBe(true);
      expect(categoryCompatible('SCRAP', 'REWORK')).toBe(false);
      expect(categoryCompatible('REWORK_SENT', 'REWORK')).toBe(true);
      expect(categoryCompatible('REWORK_RECOVERED', 'REWORK')).toBe(true);
      expect(categoryCompatible('REWORK_RECOVERED', 'WASTE')).toBe(false);
    });
    it('allows missing category', () => {
      expect(categoryCompatible('WASTE', null)).toBe(true);
    });
  });

  describe('computeOutstandingRecoverable', () => {
    it('subtracts effective recoveries', () => {
      expect(computeOutstandingRecoverable('100', ['30', '20']).toString()).toBe('50');
    });
    it('floors at zero instead of going negative', () => {
      expect(computeOutstandingRecoverable('10', ['30']).toString()).toBe('0');
    });
    it('returns the full sent quantity when no recoveries exist', () => {
      expect(computeOutstandingRecoverable('7.5', []).toString()).toBe('7.5');
    });
  });
});
