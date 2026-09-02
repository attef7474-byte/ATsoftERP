import {
  MATERIAL_EVENT_TYPE,
  canonicalLedgerUnit,
} from './production-cost.constants';

describe('COST-R1B-B2 canonical ledger helper contract', () => {
  it('MATERIAL_EVENT_TYPE is the canonical material event', () => {
    expect(MATERIAL_EVENT_TYPE).toBe('MATERIAL');
  });

  it("canonicalLedgerUnit('pcs') normalizes the lowercase fallback to UNIT", () => {
    expect(canonicalLedgerUnit('pcs')).toBe('UNIT');
  });

  it("canonicalLedgerUnit('PCS') normalizes uppercase non-canonical to UNIT (case-insensitive)", () => {
    expect(canonicalLedgerUnit('PCS')).toBe('UNIT');
  });

  it("canonicalLedgerUnit('UNIT') preserves the canonical unit", () => {
    expect(canonicalLedgerUnit('UNIT')).toBe('UNIT');
  });

  it.each(['KG', 'PACK', 'TON', 'LITER', 'BATCH', 'HOUR', 'MINUTE'])(
    'canonicalLedgerUnit(%s) preserves an existing canonical unit',
    (unit) => {
      expect(canonicalLedgerUnit(unit)).toBe(unit);
    },
  );

  it.each([null, undefined, '', '  ', 'bag', 'dozen'])(
    'canonicalLedgerUnit(%s) falls back to UNIT for null/blank/non-canonical',
    (unit) => {
      expect(canonicalLedgerUnit(unit as string | null | undefined)).toBe('UNIT');
    },
  );
});
