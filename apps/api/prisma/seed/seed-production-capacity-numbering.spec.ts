import { PRODUCTION_CAPACITY_NUMBER_SEQUENCE, seedProductionCapacityNumbering } from './seed-production-capacity-numbering';

describe('seedProductionCapacityNumbering', () => {
  it('owns the approved stable PCS sequence', () => {
    expect(PRODUCTION_CAPACITY_NUMBER_SEQUENCE).toEqual(expect.objectContaining({ code: 'PRODUCTION_CAPACITY_STANDARD', prefix: 'PCS-', padding: 6, resetPolicy: 'NEVER' }));
  });

  it('creates only when missing and preserves an existing counter', async () => {
    const create = jest.fn();
    const missing: any = { numberSequence: { findUnique: jest.fn().mockResolvedValue(null), create } };
    await seedProductionCapacityNumbering(missing);
    expect(create).toHaveBeenCalledWith({ data: PRODUCTION_CAPACITY_NUMBER_SEQUENCE });
    const existing: any = { numberSequence: { findUnique: jest.fn().mockResolvedValue({ ...PRODUCTION_CAPACITY_NUMBER_SEQUENCE, currentNumber: 42 }), create: jest.fn() } };
    await seedProductionCapacityNumbering(existing);
    expect(existing.numberSequence.create).not.toHaveBeenCalled();
  });
});
