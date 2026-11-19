import { buildExcelPlan } from './excel-plan';
import { EXCEL_DEFINITIONS } from './excel.definitions';
const ctx: any = { companyId: 'A', branchId: 'A1' };
const machine = (id: string, code: string) => ({ id, code, companyId: 'A', branchId: 'A1', status: 'ACTIVE', deletedAt: null });
const machines = [machine('m', 'M'), machine('m1', 'M01'), machine('m2', 'M02'), machine('m3', 'M03')];

function fixture(model: string, records: any[] = [], graph: any[] = []) {
  const db: any = {};
  for (const name of ['machine', 'machineComponent', 'sparePart', 'product', 'unit', 'machineCategory', 'productCategory', 'department', 'productionLine', 'operationType']) db[name] = { findMany: jest.fn(async () => []) };
  db[model].findMany.mockImplementation(async (q: any) => q.where.deletedAt === null && model === 'machineComponent' ? graph : records);
  if (model === 'machineComponent') db.machine.findMany.mockImplementation(async (q: any) => (q?.where?.code?.in ?? []).map((code: string) => machines.find(item => item.code === code)).filter(Boolean));
  else if (model !== 'machine') db.machine.findMany.mockResolvedValue([machine('m', 'M')]);
  db.unit.findMany.mockResolvedValue([{ id: 'kg', code: 'KG', isActive: true }]);
  return db;
}
function component(id: string, code: string, machineIds: string[], extra: any = {}) {
  const primary = machines.find(item => item.id === machineIds[0])!;
  return {
    id, code, name: code, componentType: 'MECHANICAL', criticality: 'MEDIUM', companyId: 'A', branchId: 'A1', status: 'ACTIVE', deletedAt: null,
    machineId: primary.id, machine: primary, parentComponentId: null, parentComponent: null,
    machineLinks: machineIds.map(machineId => ({ machineId, status: 'ACTIVE', locationInMachine: null, serialNumber: null, machine: { id: machineId, code: machines.find(item => item.id === machineId)!.code } })),
    ...extra,
  };
}
function parsed(...values: Record<string, any>[]) { return { rows: values.map((values, i) => ({ row: i + 2, values, errors: [] })), warnings: [] }; }

describe('authoritative Excel planner', () => {
  it('requires creation fields but preserves blank update fields and numeric zero', async () => {
    const db = fixture('product', [{ id: 'p', code: '001', name: 'Old', minStock: 9, unitId: 'kg', unit: 'KG' }]);
    const plan = await buildExcelPlan(db, EXCEL_DEFINITIONS.products, parsed({ Code: '001', MinStock: 0 }), 'UPDATE_EXISTING', ctx);
    expect(plan.errors).toEqual([]); expect(plan.rows[0].dto).toEqual({ code: '001', minStock: 0 }); expect(plan.rows[0].action).toBe('UPDATE');
    const missing = await buildExcelPlan(fixture('product'), EXCEL_DEFINITIONS.products, parsed({ Code: 'NEW' }), 'CREATE_ONLY', ctx);
    expect(missing.errors.map(e => e.column)).toEqual(expect.arrayContaining(['Name', 'UnitCode']));
  });
  it('keeps an unchanged historical global unit without rewriting or relinking it', async () => {
    const db = fixture('product', [{ id: 'p', code: 'P', name: 'N', unitId: 'old', unitRef: { id: 'old', code: 'OLD', isActive: false } }]); db.unit.findMany.mockResolvedValue([]);
    const plan = await buildExcelPlan(db, EXCEL_DEFINITIONS.products, parsed({ Code: 'P', UnitCode: 'OLD' }), 'UPDATE_EXISTING', ctx);
    expect(plan.errors).toEqual([]); expect(plan.rows[0].action).toBe('UNCHANGED');
  });
  it('rejects base-unit changes', async () => {
    const plan = await buildExcelPlan(fixture('product', [{ id: 'p', code: 'P', unitId: 'other' }]), EXCEL_DEFINITIONS.products, parsed({ Code: 'P', UnitCode: 'KG' }), 'UPDATE_EXISTING', ctx);
    expect(plan.errors.some(e => e.code === 'validation.excelImmutable')).toBe(true);
  });
  it.each(['CREATE_ONLY', 'UPDATE_EXISTING', 'CREATE_AND_UPDATE'] as const)('enforces mode %s', async mode => {
    const records = [{ id: 'p', code: 'OLD', name: 'Old' }];
    const plan = await buildExcelPlan(fixture('product', records), EXCEL_DEFINITIONS.products, parsed({ Code: 'OLD', Name: 'Changed' }, { Code: 'NEW', Name: 'New', UnitCode: 'KG' }), mode, ctx);
    expect(plan.rows[0].action).toBe(mode === 'CREATE_ONLY' ? 'CONFLICT_EXISTING' : 'UPDATE');
    expect(plan.rows[1].action).toBe(mode === 'UPDATE_EXISTING' ? 'INVALID' : 'NEW');
  });
  it('rejects duplicate file keys case-insensitively without choosing a winner', async () => {
    const plan = await buildExcelPlan(fixture('product'), EXCEL_DEFINITIONS.products, parsed({ Code: 'P', Name: 'A', UnitCode: 'KG' }, { Code: 'p', Name: 'B', UnitCode: 'KG' }), 'CREATE_ONLY', ctx);
    expect(plan.rows.map(r => r.action)).toEqual(['DUPLICATE_IN_FILE', 'DUPLICATE_IN_FILE']);
  });
  it('uses only the component code as identity and resolves parents before children', async () => {
    expect(EXCEL_DEFINITIONS['machine-components'].keyHeaders).toEqual(['Code']);
    const plan = await buildExcelPlan(fixture('machineComponent'), EXCEL_DEFINITIONS['machine-components'], parsed({ Code: 'C', Name: 'Child', ComponentType: 'OTHER', ParentComponentCode: 'P', MachineCodes: 'M01' }, { Code: 'P', Name: 'Parent', ComponentType: 'OTHER', MachineCodes: 'M01' }), 'CREATE_ONLY', ctx);
    expect(plan.errors).toEqual([]); expect(plan.ordered.map(r => r.code)).toEqual(['P', 'C']);
    expect(plan.rows[0].dto.machineIds).toEqual(['m1']);
  });
  it.each([['A', 'A'], ['A', 'B']])('rejects self/cyclic hierarchy %s→%s', async (code, parent) => {
    const plan = await buildExcelPlan(fixture('machineComponent'), EXCEL_DEFINITIONS['machine-components'], parsed({ Code: code, Name: 'A', ComponentType: 'OTHER', MachineCodes: 'M01', ParentComponentCode: parent }, ...(code === parent ? [] : [{ Code: 'B', Name: 'B', ComponentType: 'OTHER', MachineCodes: 'M01', ParentComponentCode: 'A' }])), 'CREATE_ONLY', ctx);
    expect(plan.errors.some(e => e.code === 'validation.excelCycle')).toBe(true);
  });
  it('rejects a parent component code that is not in the active tenant/branch scope', async () => {
    const plan = await buildExcelPlan(fixture('machineComponent'), EXCEL_DEFINITIONS['machine-components'], parsed({ Code: 'C', Name: 'C', ComponentType: 'OTHER', MachineCodes: 'M01', ParentComponentCode: 'OTHER-PARENT' }), 'CREATE_ONLY', ctx);
    expect(plan.errors.some(e => e.column === 'ParentComponentCode')).toBe(true);
  });
  it('scopes machine-code lookups in the backend and rejects unavailable references', async () => {
    const db = fixture('machineComponent'); db.machine.findMany.mockResolvedValue([]);
    const plan = await buildExcelPlan(db, EXCEL_DEFINITIONS['machine-components'], parsed({ Code: 'C', Name: 'C', ComponentType: 'OTHER', MachineCodes: 'FOREIGN' }), 'CREATE_ONLY', ctx);
    expect(db.machine.findMany.mock.calls[0][0].where.AND).toEqual([{ companyId: 'A', OR: [{ branchId: 'A1' }, { branchId: null }] }]);
    expect(plan.errors.some(e => e.column === 'MachineCodes')).toBe(true);
  });
  it('rejects a foreign code inside a multi-machine list', async () => {
    const plan = await buildExcelPlan(fixture('machineComponent'), EXCEL_DEFINITIONS['machine-components'], parsed({ Code: 'C', Name: 'C', ComponentType: 'OTHER', MachineCodes: 'M01;FOREIGN' }), 'CREATE_ONLY', ctx);
    expect(plan.errors.some(e => e.column === 'MachineCodes' && e.code === 'validation.excelReference')).toBe(true);
    expect(plan.rows[0].dto.machineIds).toEqual(['m1']);
  });
  it('creates ONE component DTO with N machines and aligned per-machine physical fields', async () => {
    const plan = await buildExcelPlan(fixture('machineComponent'), EXCEL_DEFINITIONS['machine-components'], parsed({ Code: 'C', Name: 'Shared', ComponentType: 'MECHANICAL', MachineCodes: 'M01;M02;M03', LocationsInMachine: 'Upper;Lower;Frame', SerialNumbers: 'S-01;S-02;S-03' }), 'CREATE_ONLY', ctx);
    expect(plan.errors).toEqual([]); expect(plan.rows).toHaveLength(1);
    expect(plan.rows[0].dto.machineIds).toEqual(['m1', 'm2', 'm3']);
    expect(plan.rows[0].dto.machineData).toEqual([
      { machineId: 'm1', locationInMachine: 'Upper', serialNumber: 'S-01' },
      { machineId: 'm2', locationInMachine: 'Lower', serialNumber: 'S-02' },
      { machineId: 'm3', locationInMachine: 'Frame', serialNumber: 'S-03' },
    ]);
    expect(plan.rows[0].dto.locationInMachine).toBeUndefined();
    expect(plan.rows[0].dto.serialNumber).toBeUndefined();
    expect(plan.rows[0].dto.machineId).toBeUndefined();
  });
  it('dedupes repeated machine codes case-insensitively', async () => {
    const plan = await buildExcelPlan(fixture('machineComponent'), EXCEL_DEFINITIONS['machine-components'], parsed({ Code: 'C', Name: 'C', ComponentType: 'OTHER', MachineCodes: 'M01;m01;M02' }), 'CREATE_ONLY', ctx);
    expect(plan.errors).toEqual([]);
    expect(plan.rows[0].dto.machineIds).toEqual(['m1', 'm2']);
    expect(plan.rows[0].dto.machineData).toHaveLength(2);
  });
  it('normalizes legacy MachineCode and legacy physical fields to one machine entry', async () => {
    const plan = await buildExcelPlan(fixture('machineComponent'), EXCEL_DEFINITIONS['machine-components'], parsed({ Code: 'C', Name: 'C', ComponentType: 'OTHER', MachineCode: 'M01', LocationInMachine: 'inside', SerialNumber: 'S-1' }), 'CREATE_ONLY', ctx);
    expect(plan.errors).toEqual([]);
    expect(plan.rows[0].dto.machineIds).toEqual(['m1']);
    expect(plan.rows[0].dto.machineData).toEqual([{ machineId: 'm1', locationInMachine: 'inside', serialNumber: 'S-1' }]);
    expect(plan.rows[0].dto.locationInMachine).toBeUndefined();
    expect(plan.rows[0].dto.serialNumber).toBeUndefined();
  });
  it('updates the same component id to the final machine set without creating a second component', async () => {
    const existing = component('c-1', 'C', ['m1', 'm2']);
    const plan = await buildExcelPlan(fixture('machineComponent', [existing]), EXCEL_DEFINITIONS['machine-components'], parsed({ Code: 'C', Name: 'Shared', ComponentType: 'MECHANICAL', MachineCodes: 'M02;M03' }), 'CREATE_AND_UPDATE', ctx);
    expect(plan.errors).toEqual([]);
    expect(plan.rows[0].action).toBe('UPDATE');
    expect(plan.rows[0].dto.machineIds).toEqual(['m2', 'm3']);
    expect(plan.existingIds.get('C')).toBe('c-1');
    expect(plan.rows).toHaveLength(1);
  });
  it('never resolves an ambiguous reference by first match', async () => {
    const db = fixture('product'); db.unit.findMany.mockResolvedValue([{ id: '1', code: 'KG' }, { id: '2', code: 'kg' }]);
    const plan = await buildExcelPlan(db, EXCEL_DEFINITIONS.products, parsed({ Code: 'P', Name: 'P', UnitCode: 'KG' }), 'CREATE_ONLY', ctx);
    expect(plan.errors.some(e => e.column === 'UnitCode')).toBe(true);
  });
  it('preserves explicit global catalog policy and detects canonical barcode collisions', async () => {
    const db = fixture('product'); db.product.findMany.mockImplementation(async (q: any) => q.where.OR ? [{ id: 'other', code: 'OTHER', barcode: '0001' }] : []);
    const plan = await buildExcelPlan(db, EXCEL_DEFINITIONS.products, parsed({ Code: 'P', Name: 'P', UnitCode: 'KG', Barcode: '0001' }), 'CREATE_ONLY', ctx);
    expect(plan.errors.some(e => e.code === 'validation.excelIdentityConflict')).toBe(true);
    expect(db.product.findMany.mock.calls[0][0].where).toEqual({ code: { in: ['P'] } });
  });
  it('binds fingerprints to current data and references', async () => {
    const db = fixture('product', [{ id: 'p', code: 'P', name: 'Before' }]);
    const first = await buildExcelPlan(db, EXCEL_DEFINITIONS.products, parsed({ Code: 'P', Name: 'After' }), 'UPDATE_EXISTING', ctx);
    db.product.findMany.mockResolvedValue([{ id: 'p', code: 'P', name: 'Concurrent' }]);
    const second = await buildExcelPlan(db, EXCEL_DEFINITIONS.products, parsed({ Code: 'P', Name: 'After' }), 'UPDATE_EXISTING', ctx);
    expect(first.fingerprint).not.toBe(second.fingerprint);
  });
});
