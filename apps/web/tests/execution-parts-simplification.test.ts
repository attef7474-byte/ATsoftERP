import * as fs from 'fs';
import * as path from 'path';
import { buildExecutionPartPayload, validateExecutionParts } from '../src/lib/maintenance-execution';
import type { ExecutionPartInput } from '../src/lib/maintenance-execution';
import en from '../src/lib/i18n/locales/en';
import ar from '../src/lib/i18n/locales/ar';

const editorSource = fs.readFileSync(path.join(__dirname, '../src/components/maintenance/execution-parts.tsx'), 'utf8');
const tasksPageSource = fs.readFileSync(path.join(__dirname, '../src/app/admin/maintenance/tasks/page.tsx'), 'utf8');
const executionFormSource = fs.readFileSync(path.join(__dirname, '../src/components/maintenance/execution-form.tsx'), 'utf8');

const base: ExecutionPartInput = {
  clientRequestId: 'row-1',
  warehouseId: 'wh-1',
  quantity: 1,
  usageType: 'CONSUMED',
};

describe('execution actual-part form simplification (owner-approved)', () => {
  it('A. editor renders no Storage Location (maintenance.warehouseLocation) control', () => {
    expect(editorSource).not.toContain('maintenance.warehouseLocation');
    expect(editorSource).not.toContain('warehouseLocationId');
  });

  it('B. editor renders no Usage Share (maintenance.partAttribution / teamUsage) control', () => {
    expect(editorSource).not.toContain('maintenance.partAttribution');
    expect(editorSource).not.toContain('maintenance.teamUsage');
    expect(editorSource).not.toContain('executionSessionId');
  });

  it('C. editor no longer imports the removed location adapter or session type', () => {
    expect(editorSource).not.toContain('warehouseLocationAdapter');
    expect(editorSource).not.toContain('MaintenanceExecutionSession');
  });

  it('D. editor no longer accepts or consumes a sessions prop', () => {
    expect(editorSource).not.toMatch(/sessions/);
    expect(tasksPageSource).not.toContain('sessions={selected.sessions}');
  });

  it('E. editor keeps every retained field label', () => {
    for (const key of [
      'sparePartIssue.sparePart',
      'maintenance.inventoryProduct',
      'maintenance.workOrderWarehouse',
      'maintenance.quantity',
      'maintenance.partUsageType',
      'sparePartRequest.issuedStockCondition',
      'maintenance.notes',
    ]) {
      expect(editorSource).toContain(key);
    }
  });

  it('F. ExecutionPartInput declares no warehouseLocationId field', () => {
    const lib = fs.readFileSync(path.join(__dirname, '../src/lib/maintenance-execution.ts'), 'utf8');
    const iface = lib.slice(lib.indexOf('interface ExecutionPartInput'), lib.indexOf('buildExecutionPartPayload'));
    expect(iface).not.toContain('warehouseLocationId');
  });

  it('G. ExecutionPartInput declares no executionSessionId field', () => {
    const lib = fs.readFileSync(path.join(__dirname, '../src/lib/maintenance-execution.ts'), 'utf8');
    const iface = lib.slice(lib.indexOf('interface ExecutionPartInput'), lib.indexOf('buildExecutionPartPayload'));
    expect(iface).not.toContain('executionSessionId');
  });

  it('H. payload omits warehouseLocationId even if a caller supplies one', () => {
    const payload = buildExecutionPartPayload({ ...base, productId: 'p-1', warehouseLocationId: 'loc-1' } as ExecutionPartInput);
    expect('warehouseLocationId' in payload).toBe(false);
  });

  it('I. payload omits executionSessionId (canonical execution-level/team attribution)', () => {
    const payload = buildExecutionPartPayload({ ...base, productId: 'p-1', executionSessionId: 'session-1' } as ExecutionPartInput);
    expect('executionSessionId' in payload).toBe(false);
  });

  it('J. payload keeps canonical identity, quantity, warehouse and usage type', () => {
    const payload = buildExecutionPartPayload({ ...base, productId: 'p-1' });
    expect(payload.clientRequestId).toBe('row-1');
    expect(payload.warehouseId).toBe('wh-1');
    expect(payload.quantity).toBe(1);
    expect(payload.usageType).toBe('CONSUMED');
    expect(payload.productId).toBe('p-1');
  });

  it('K. payload omits undefined optional modifiers instead of sending empty values', () => {
    const payload = buildExecutionPartPayload({ ...base, productId: 'p-1' });
    expect('sparePartId' in payload).toBe(false);
    expect('notes' in payload).toBe(false);
    expect(Object.values(payload).every((value) => value !== undefined)).toBe(true);
  });

  it('L. payload preserves REPLACED removal fields when present', () => {
    const payload = buildExecutionPartPayload({
      ...base,
      productId: 'p-1',
      usageType: 'REPLACED',
      oldInstalledPartId: 'old-1',
      replacementAction: 'RETURNED_REMOVED_PART',
      removedPartCondition: 'USED_REPAIRABLE',
      removedPartWarehouseId: 'wh-2',
      removedPartQuantity: 2,
    });
    expect(payload.oldInstalledPartId).toBe('old-1');
    expect(payload.replacementAction).toBe('RETURNED_REMOVED_PART');
    expect(payload.removedPartCondition).toBe('USED_REPAIRABLE');
    expect(payload.removedPartWarehouseId).toBe('wh-2');
    expect(payload.removedPartQuantity).toBe(2);
  });

  it('M. simplified payloads still pass client validation', () => {
    expect(validateExecutionParts([{ ...base, productId: 'p-1' }])).toBe(true);
  });

  it('N. removed UI translation keys are gone from both ar and en', () => {
    for (const locale of [en, ar]) {
      expect(locale.maintenance.warehouseLocation).toBeUndefined();
      expect(locale.maintenance.partAttribution).toBeUndefined();
      expect(locale.maintenance.teamUsage).toBeUndefined();
    }
  });

  it('O. the shared-once team hint is retained in both languages', () => {
    expect(typeof en.maintenance.actualPartsTeamHint).toBe('string');
    expect(typeof ar.maintenance.actualPartsTeamHint).toBe('string');
  });

  it('P. both submit paths send the canonical builder payload', () => {
    expect(tasksPageSource).toContain('buildExecutionPartPayload(part)');
    expect(tasksPageSource).toContain('parts.map(buildExecutionPartPayload)');
    expect(tasksPageSource).not.toContain("api.post(url + '/parts', part)");
    expect(executionFormSource).toContain('parts.map(buildExecutionPartPayload)');
  });
});
