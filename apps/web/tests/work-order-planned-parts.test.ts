import { plannedPartsPayload, validatePlannedParts, type PlannedPartDraft } from '../src/lib/work-order-planned-parts';

const draft = (patch: Partial<PlannedPartDraft> = {}): PlannedPartDraft => ({
  clientKey: 'draft-only', sparePartId: 'spare-a', productId: 'product-a', warehouseId: 'warehouse-a',
  quantity: '2.5', unit: ' pcs ', unitCost: '', notes: '', ...patch,
});

describe('new work order planned parts', () => {
  it('sends spare-part and per-line warehouse identities without draft product or actual stock fields', () => {
    expect(plannedPartsPayload([
      draft(),
      draft({ sparePartId: 'spare-b', productId: 'product-b', warehouseId: 'warehouse-b', quantity: '1', unitCost: '0', notes: ' estimate ' }),
    ], 'create')).toEqual({
      parts: [
        { sparePartId: 'spare-a', warehouseId: 'warehouse-a', quantity: 2.5, unit: 'pcs' },
        { sparePartId: 'spare-b', warehouseId: 'warehouse-b', quantity: 1, unit: 'pcs', unitCost: 0, notes: 'estimate' },
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

  it('rejects a missing per-line warehouse before any create request', () => {
    expect(validatePlannedParts([draft({ warehouseId: '' })])).toEqual({ 'parts.0.warehouseId': 'validation.required' });
  });

  it('accepts canonical spare-part plans with independent warehouses, optional cost and the minimum quantity', () => {
    expect(validatePlannedParts([
      draft({ quantity: '0.0001' }),
      draft({ sparePartId: 'spare-b', warehouseId: 'warehouse-b', unitCost: '0' }),
    ])).toEqual({});
  });

  it('identifies the exact missing-reference rows without dropping incomplete drafts', () => {
    const parts = [draft(), draft({ sparePartId: '', productId: 'product-b', warehouseId: '' })];
    expect(validatePlannedParts(parts)).toEqual({
      'parts.1.sparePartId': 'validation.required',
      'parts.1.warehouseId': 'validation.required',
    });
    expect(parts).toHaveLength(2);
  });

  it('rejects a product-only draft because the canonical spare part is the authority', () => {
    expect(validatePlannedParts([draft({ sparePartId: '' })])).toEqual({ 'parts.0.sparePartId': 'validation.required' });
  });
});