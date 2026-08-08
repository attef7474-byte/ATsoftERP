import { PRODUCTION_MEASUREMENT_POINT_NUMBER_SEQUENCE, PRODUCTION_RUN_NUMBER_SEQUENCE, seedProductionRunNumbering } from './seed-production-run-numbering';

describe('seedProductionRunNumbering', () => {
  it('owns the approved run and measurement point sequences', () => {
    expect(PRODUCTION_RUN_NUMBER_SEQUENCE).toEqual(expect.objectContaining({ code: 'PRODUCTION_RUN', prefix: 'RUN-', padding: 6, resetPolicy: 'NEVER' }));
    expect(PRODUCTION_MEASUREMENT_POINT_NUMBER_SEQUENCE).toEqual(expect.objectContaining({ code: 'PRODUCTION_MEASUREMENT_POINT', prefix: 'MP-', padding: 5, resetPolicy: 'NEVER' }));
  });

  it('creates missing sequences and preserves existing counters', async () => {
    const create = jest.fn();
    const missing: any = { numberSequence: { findUnique: jest.fn().mockResolvedValue(null), create } };
    await seedProductionRunNumbering(missing);
    expect(create).toHaveBeenCalledTimes(2);
    expect(create).toHaveBeenCalledWith({ data: PRODUCTION_RUN_NUMBER_SEQUENCE });
    expect(create).toHaveBeenCalledWith({ data: PRODUCTION_MEASUREMENT_POINT_NUMBER_SEQUENCE });

    const existing: any = {
      numberSequence: { findUnique: jest.fn().mockResolvedValue({ ...PRODUCTION_RUN_NUMBER_SEQUENCE, currentNumber: 12 }), create: jest.fn() },
    };
    await seedProductionRunNumbering(existing);
    expect(existing.numberSequence.create).not.toHaveBeenCalled();
  });
});