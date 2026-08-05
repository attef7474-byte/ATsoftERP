import {
  PRODUCTION_QUALITY_PLAN_NUMBER_SEQUENCE,
  PRODUCTION_INSPECTION_NUMBER_SEQUENCE,
  PRODUCTION_NCR_NUMBER_SEQUENCE,
  seedProductionQualityCostNumbering,
} from './seed-production-quality-cost-numbering';

describe('seedProductionQualityCostNumbering', () => {
  it('owns the three approved Phase 1.8 sequences', () => {
    expect(PRODUCTION_QUALITY_PLAN_NUMBER_SEQUENCE).toEqual(expect.objectContaining({ code: 'PRODUCTION_QUALITY_PLAN', prefix: 'PQP-', padding: 6, resetPolicy: 'NEVER' }));
    expect(PRODUCTION_INSPECTION_NUMBER_SEQUENCE).toEqual(expect.objectContaining({ code: 'PRODUCTION_INSPECTION', prefix: 'PIN-', padding: 6, resetPolicy: 'NEVER' }));
    expect(PRODUCTION_NCR_NUMBER_SEQUENCE).toEqual(expect.objectContaining({ code: 'PRODUCTION_NCR', prefix: 'NCR-', padding: 6, resetPolicy: 'NEVER' }));
  });

  it('creates only when missing and preserves existing counters', async () => {
    const create = jest.fn();
    const missing: any = { numberSequence: { findUnique: jest.fn().mockResolvedValue(null), create } };
    await seedProductionQualityCostNumbering(missing);
    expect(create).toHaveBeenCalledTimes(3);
    expect(create).toHaveBeenCalledWith({ data: PRODUCTION_QUALITY_PLAN_NUMBER_SEQUENCE });
    expect(create).toHaveBeenCalledWith({ data: PRODUCTION_INSPECTION_NUMBER_SEQUENCE });
    expect(create).toHaveBeenCalledWith({ data: PRODUCTION_NCR_NUMBER_SEQUENCE });

    const existing: any = {
      numberSequence: {
        findUnique: jest.fn().mockResolvedValue({ code: 'PRODUCTION_QUALITY_PLAN', currentNumber: 12 }),
        create: jest.fn(),
      },
    };
    await seedProductionQualityCostNumbering(existing);
    expect(existing.numberSequence.create).not.toHaveBeenCalled();
  });
});
