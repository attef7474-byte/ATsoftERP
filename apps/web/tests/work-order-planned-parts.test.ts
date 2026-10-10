import { plannedPartsPayload, validatePlannedParts, type PlannedPartDraft } from '../src/lib/work-order-planned-parts';

const draft = (patch: Partial<PlannedPartDraft> = {}): PlannedPartDraft => ({
  clientKey: 'draft-only', sparePartId: 'spare-a', productId: 'product-a',
  quantity: '2.5', unit: ' pcs ', unitCost: '', notes: '', ...patch,
});

describe('new work order planned parts', () => {
  it('sends all lines in the existing create payload without draft identities or actual stock fields', () => {
    expect(plannedPartsPayload([draft(), draft({ sparePartId: '', productId: 'product-b', quantity: '1', unitCost: '0', notes: ' estimate ' })], 'create')).toEqual({
      parts: [
        { sparePartId: 'spare-a', productId: 'product-a', quantity: 2.5, unit: 'pcs' },
        { productId: 'product-b', quantity: 1, unit: 'pcs', unitCost: 0, notes: 'estimate' },
      ],
    });
  });

  it('does not send planned lines through PATCH or require any lines for creation', () => {
    expect(plannedPartsPayload([draft()], 'edit')).toEqual({});
    expect(plannedPartsPayload([], 'create')).toEqual({});
    expect(validatePlannedParts([])).toEqual({});
  });

  it.each(['', ' ', '0', '-1', '0.00001', 'NaN', 'Infinity'])('rejects invalid quantity %j before any create request', quantity => {
    expect(validatePlannedParts([draft({ quantity })])).toEqual({ 'parts.0.quantity': 'validation.invalidQuantity' });
  });

  it.each(['-0.01', 'NaN', 'Infinity'])('rejects invalid estimated unit cost %j', unitCost => {
    expect(validatePlannedParts([draft({ unitCost })])).toEqual({ 'parts.0.unitCost': 'validation.number' });
  });

  it('accepts spare-part-only or product-only plans, optional cost, and the minimum quantity', () => {
    expect(validatePlannedParts([draft({ productId: '', quantity: '0.0001' }), draft({ sparePartId: '', unitCost: '0' })])).toEqual({});
  });

  it('identifies the exact missing-reference row without dropping incomplete drafts', () => {
    const parts = [draft(), draft({ sparePartId: '', productId: '' })];
    expect(validatePlannedParts(parts)).toEqual({ 'parts.1.sparePartId': 'validation.required' });
    expect(parts).toHaveLength(2);
  });
});
