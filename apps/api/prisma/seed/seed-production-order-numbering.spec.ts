import { PRODUCTION_ORDER_NUMBER_SEQUENCE, seedProductionOrderNumbering } from './seed-production-order-numbering';

describe('seedProductionOrderNumbering', () => {
  it('owns the single approved PO sequence', () => {
    expect(PRODUCTION_ORDER_NUMBER_SEQUENCE).toEqual(expect.objectContaining({ code: 'PRODUCTION_ORDER', prefix: 'PO-', padding: 6, resetPolicy: 'NEVER' }));
  });

  it('creates only when missing and preserves an existing counter', async () => {
    const create = jest.fn();
    const missing: any = { numberSequence: { findUnique: jest.fn().mockResolvedValue(null), create } };
    await seedProductionOrderNumbering(missing);
    expect(create).toHaveBeenCalledWith({ data: PRODUCTION_ORDER_NUMBER_SEQUENCE });
    const existing: any = { numberSequence: { findUnique: jest.fn().mockResolvedValue({ ...PRODUCTION_ORDER_NUMBER_SEQUENCE, currentNumber: 57 }), create: jest.fn() } };
    await seedProductionOrderNumbering(existing);
    expect(existing.numberSequence.create).not.toHaveBeenCalled();
  });
});
