import {
  COST_R2C_EXTERNAL_SERVICE_MIGRATION,
  EXTERNAL_SERVICE_EVENT_TYPE,
  MATERIAL_EVENT_TYPE,
  canonicalLedgerUnit,
} from './production-cost.constants';

describe('COST-R1B-B2 canonical ledger helper contract', () => {
  it('freezes the COST-R2C-B external service event and exact migration identity', () => {
    expect(EXTERNAL_SERVICE_EVENT_TYPE).toBe('EXTERNAL_SERVICE');
    expect(COST_R2C_EXTERNAL_SERVICE_MIGRATION).toBe('20260904120000_cost_r2c_external_service_ledger');
  });
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
