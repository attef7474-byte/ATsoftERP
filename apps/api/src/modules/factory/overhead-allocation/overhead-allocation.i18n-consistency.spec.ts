import { getApiMessage, getApiMessageEntry } from '../../../common/i18n/api-messages';

/**
 * Every overheadAllocation.* message key the overhead-allocation controllers and
 * services can raise, including the COST-R2D-B3 ledger posting/reversal keys, must be
 * translated in both locales and never returned raw.
 */
const OVERHEAD_ALLOCATION_KEYS: string[] = [
  'overheadAllocation.notRepresentableAtPrecision',
  'overheadAllocation.noInputs',
  'overheadAllocation.tooManyInputs',
  'overheadAllocation.invalidInputs',
  'overheadAllocation.invalidDriver',
  'overheadAllocation.invalidTarget',
  'overheadAllocation.invalidSource',
  'overheadAllocation.notFound',
  'overheadAllocation.periodNotReady',
  'overheadAllocation.periodAlreadyAllocated',
  'overheadAllocation.requestConflict',
  'overheadAllocation.immutable',
  'overheadAllocation.postingRequiresFinal',
  'overheadAllocation.ledgerLineNotPosted',
];

describe('COST-R2D-B3 overhead-allocation i18n consistency', () => {
  it('defines every overheadAllocation key with non-empty ar and en', () => {
    for (const key of OVERHEAD_ALLOCATION_KEYS) {
      const entry = getApiMessageEntry(key);
      expect(entry).toBeDefined();
      expect(typeof entry!.ar).toBe('string');
      expect(entry!.ar!.length).toBeGreaterThan(0);
      expect(typeof entry!.en).toBe('string');
      expect(entry!.en!.length).toBeGreaterThan(0);
    }
  });
  it('returns translated strings (never the raw key) for both locales', () => {
    for (const key of OVERHEAD_ALLOCATION_KEYS) {
      const en = getApiMessage(key, 'en');
      const ar = getApiMessage(key, 'ar');
      expect(en).not.toBe(key);
      expect(en.length).toBeGreaterThan(0);
      expect(ar).not.toBe(key);
      expect(ar.length).toBeGreaterThan(0);
    }
  });
});