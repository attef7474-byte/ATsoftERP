import { validateExecutionParts } from '../src/lib/maintenance-execution';
import type { ExecutionPartInput } from '../src/lib/maintenance-execution';

const base: ExecutionPartInput = {
  clientRequestId: 'row-1',
  warehouseId: 'wh-1',
  quantity: 1,
  usageType: 'CONSUMED',
};

describe('execution part client validation (Defect B regression)', () => {
  it('accepts an inventory product-only consumption', () => {
    expect(validateExecutionParts([{ ...base, productId: 'p-1' }])).toBe(true);
  });

  it('accepts a canonical spare plus a resolvable inventory product', () => {
    expect(validateExecutionParts([{ ...base, sparePartId: 'sp-1', productId: 'p-1' }])).toBe(true);
  });

  it('rejects a spare that resolves to no inventory product (unlinked spare without product)', () => {
    expect(validateExecutionParts([{ ...base, sparePartId: 'sp-1' }])).toBe(false);
  });

  it('rejects a line with neither a product nor a spare', () => {
    expect(validateExecutionParts([{ ...base }])).toBe(false);
  });

  it('rejects a missing warehouse or non-positive quantity', () => {
    expect(validateExecutionParts([{ ...base, productId: 'p-1', warehouseId: '' }])).toBe(false);
    expect(validateExecutionParts([{ ...base, productId: 'p-1', quantity: 0 }])).toBe(false);
  });

  it('keeps the REPLACED removal requirements', () => {
    const replaced = { ...base, productId: 'p-1', usageType: 'REPLACED' as const };
    expect(validateExecutionParts([replaced])).toBe(false);
    expect(validateExecutionParts([{
      ...replaced,
      oldInstalledPartId: 'old-1',
      replacementAction: 'RETURNED_REMOVED_PART',
      removedPartCondition: 'USED_REPAIRABLE',
      removedPartWarehouseId: 'wh-2',
      removedPartQuantity: 1,
    }])).toBe(true);
    expect(validateExecutionParts([{
      ...replaced,
      oldInstalledPartId: 'old-1',
      replacementAction: 'NO_REMOVED_PART',
      noReturnReason: 'destroyed',
    }])).toBe(true);
  });
});
