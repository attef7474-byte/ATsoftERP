import * as fs from 'fs';
import * as path from 'path';
import { buildExecutionPartPayload, validateExecutionParts } from '../src/lib/maintenance-execution';
import type { ExecutionPartInput } from '../src/lib/maintenance-execution';
import en from '../src/lib/i18n/locales/en';
import ar from '../src/lib/i18n/locales/ar';

const editorSource = fs.readFileSync(path.join(__dirname, '../src/components/maintenance/execution-parts.tsx'), 'utf8');

const base: ExecutionPartInput = {
  clientRequestId: 'row-1',
  warehouseId: 'wh-1',
  quantity: 1,
  usageType: 'CONSUMED',
};

describe('execution actual-part canonical SparePart -> Product integrity', () => {
  it('A. the free inventory-product picker is only offered when no canonical spare part is chosen', () => {
    expect(editorSource).toContain('!part.sparePartId && <F9Lookup');
    expect(editorSource).not.toContain('!part.sparePartId || !part.productId');
  });

  it('B. a spare-part row that resolves to no product shows the canonical blocking message', () => {
    expect(editorSource).toContain('part.sparePartId && !part.productId');
    expect(editorSource).toContain('maintenance.sparePartInventoryProductMissing');
  });

  it('C. the blocking message key is translated in both Arabic and English', () => {
    expect(typeof en.maintenance.sparePartInventoryProductMissing).toBe('string');
    expect(typeof ar.maintenance.sparePartInventoryProductMissing).toBe('string');
    expect(en.maintenance.sparePartInventoryProductMissing.length).toBeGreaterThan(0);
    expect(ar.maintenance.sparePartInventoryProductMissing.length).toBeGreaterThan(0);
  });

  it('D. an unlinked canonical spare row cannot be submitted (no resolvable product)', () => {
    expect(validateExecutionParts([{ ...base, sparePartId: 'sp-1' }])).toBe(false);
  });

  it('E. a linked canonical spare row resolves the product and is submittable', () => {
    expect(validateExecutionParts([{ ...base, sparePartId: 'sp-1', productId: 'p-1' }])).toBe(true);
  });

  it('F. product-only consumption remains submittable', () => {
    expect(validateExecutionParts([{ ...base, productId: 'p-1' }])).toBe(true);
  });

  it('G. the payload still carries the resolved canonical product and spare part', () => {
    const payload = buildExecutionPartPayload({ ...base, sparePartId: 'sp-1', productId: 'p-1' });
    expect(payload.sparePartId).toBe('sp-1');
    expect(payload.productId).toBe('p-1');
  });
});
