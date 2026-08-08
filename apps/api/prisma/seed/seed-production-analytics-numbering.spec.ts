import { PRODUCTION_PERFORMANCE_TARGET_NUMBER_SEQUENCE, seedProductionAnalyticsNumbering } from './seed-production-analytics-numbering';

describe('seedProductionAnalyticsNumbering', () => {
  it('owns the approved Phase 1.9 sequence', () => {
    expect(PRODUCTION_PERFORMANCE_TARGET_NUMBER_SEQUENCE).toEqual(expect.objectContaining({ code: 'PRODUCTION_PERFORMANCE_TARGET', prefix: 'PPT-', padding: 6, resetPolicy: 'NEVER' }));
  });

  it('creates only when missing and preserves existing counters', async () => {
    const create = jest.fn();
    const missing: any = { numberSequence: { findUnique: jest.fn().mockResolvedValue(null), create } };
    await seedProductionAnalyticsNumbering(missing);
    expect(create).toHaveBeenCalledTimes(1);
    expect(create).toHaveBeenCalledWith({ data: PRODUCTION_PERFORMANCE_TARGET_NUMBER_SEQUENCE });

    const existing: any = {
      numberSequence: {
        findUnique: jest.fn().mockResolvedValue({ code: 'PRODUCTION_PERFORMANCE_TARGET', currentNumber: 5 }),
        create: jest.fn(),
      },
    };
    await seedProductionAnalyticsNumbering(existing);
    expect(existing.numberSequence.create).not.toHaveBeenCalled();
  });
});
