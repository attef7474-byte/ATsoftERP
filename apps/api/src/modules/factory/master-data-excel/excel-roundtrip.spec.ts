import * as ExcelJS from 'exceljs';
import { MasterDataExcelService } from './master-data-excel.service';
import { PermissionCheckService } from '../../../common/rbac/permission-check.service';
import { EXCEL_DEFINITIONS } from './excel.definitions';
import { ExcelEntity } from '../../../common/excel/excel.types';

/**
 * Production defect (2026-11-17, request dafb5511-4f1d-40e0-a3a6-1166d17f51c2):
 * exporting Machines and validating the same workbook with CREATE_AND_UPDATE
 * returned 500 because the shared planner applied `{ branchId: null }` inside
 * the reference filter for ProductionLine, whose `branchId` column is required.
 * These tests drive the real export builder through real XLSX bytes, the real
 * parser and the real planner so the production workflow is reproduced, not a
 * handcrafted fixture.
 */
const ctx: any = { companyId: 'A', branchId: 'A1', companyCode: 'A', companyName: 'Company A', branchCode: 'A1', branchName: 'Branch A1' };
type Row = Record<string, any>;

/** Fails the test when the planner asks a required-FK column to equal null, as Prisma does. */
function hasNullBranch(node: any): boolean {
  if (!node || typeof node !== 'object') return false;
  if (Array.isArray(node)) return node.some(hasNullBranch);
  return Object.entries(node).some(([key, value]) => (key === 'branchId' && value === null) || (typeof value === 'object' && hasNullBranch(value)));
}

function seed() {
  const costCenter = { id: 'cc-1', code: 'CC-0001', name: 'Machine cost center', type: 'PRODUCTION', companyId: 'A', branchId: 'A1' };
  const category = { id: 'cat-1', code: 'MCAT-0001', name: 'Packaging', status: 'ACTIVE', deletedAt: null };
  const department = { id: 'dep-1', code: 'DEP-0001', name: 'Packaging department', companyId: 'A', branchId: 'A1', status: 'ACTIVE', deletedAt: null };
  const productionLine = { id: 'line-1', code: 'PL-0001', name: 'Packaging line', companyId: 'A', branchId: 'A1', departmentId: 'dep-1', administrationId: null, status: 'ACTIVE', deletedAt: null };
  const operationType = { id: 'op-1', code: 'PACKAGING', name: 'Packaging', status: 'ACTIVE', deletedAt: null };
  const unit = { id: 'unit-kg', code: 'KG', name: 'Kilogram', isActive: true };
  const productCategory = { id: 'pcat-1', code: 'PCAT-0001', name: 'Catalog', status: 'ACTIVE', deletedAt: null };
  const product = { id: 'product-1', code: 'PRD-0001', name: 'Product', unit: 'KG', unitId: 'unit-kg', unitRef: unit, categoryId: 'pcat-1', category: productCategory, barcode: '0000001', minStock: 0, maxStock: 100, status: 'ACTIVE', deletedAt: null };
  const machineA = {
    id: 'm-1', code: 'MCH-000001', name: 'ماكينة تغليف 10019', categoryId: 'cat-1', category, companyId: 'A', branchId: 'A1',
    departmentId: 'dep-1', department, productionLineId: 'line-1', productionLine, operationTypeId: 'op-1', operationType,
    defaultCostCenterId: 'cc-1', defaultCostCenter: costCenter, manufacturer: 'الصين', model: 'X-100', serialNumber: '000123',
    purchaseDate: new Date('2026-01-05T00:00:00.000Z'), warrantyEnd: new Date('2027-01-05T00:00:00.000Z'), location: 'Line 1', notes: null, status: 'ACTIVE', deletedAt: null,
  };
  // Legacy machine without a branch and with blank optional columns: the optional-branch scope must keep working for Machine.
  const machineB = {
    id: 'm-2', code: 'MCH-000002', name: 'Machine 2', categoryId: null, category: null, companyId: 'A', branchId: null,
    departmentId: null, department: null, productionLineId: null, productionLine: null, operationTypeId: null, operationType: null,
    defaultCostCenterId: null, defaultCostCenter: null, manufacturer: null, model: null, serialNumber: null,
    purchaseDate: null, warrantyEnd: null, location: null, notes: null, status: 'ACTIVE', deletedAt: null,
  };
  const parentLink = { id: 'link-1', componentId: 'c-1', machineId: 'm-1', machine: { id: 'm-1', code: machineA.code }, status: 'ACTIVE', locationInMachine: null, serialNumber: null };
  const childLink = { id: 'link-2', componentId: 'c-2', machineId: 'm-1', machine: { id: 'm-1', code: machineA.code }, status: 'ACTIVE', locationInMachine: 'inside', serialNumber: 'S-1' };
  const parentComponent = { id: 'c-1', machineId: 'm-1', machine: machineA, machineLinks: [parentLink], parentComponentId: null, parentComponent: null, companyId: 'A', branchId: 'A1', code: 'CMP-0001', name: 'Parent', componentType: 'MECHANICAL', criticality: 'HIGH', status: 'ACTIVE', deletedAt: null };
  const childComponent = { id: 'c-2', machineId: 'm-1', machine: machineA, machineLinks: [childLink], parentComponentId: 'c-1', parentComponent: parentComponent, companyId: 'A', branchId: 'A1', code: 'CMP-0002', name: 'Child', componentType: 'ELECTRICAL', criticality: 'MEDIUM', description: 'desc', locationInMachine: 'inside', manufacturer: 'ACME', model: 'M1', serialNumber: 'S-1', status: 'ACTIVE', deletedAt: null };
  const sparePart = {
    id: 'sp-1', code: 'SP-0001', name: 'Bearing', description: 'desc', category: 'Mechanical', specification: '6204', unit: 'PCS', unitId: null, unitRef: null,
    manufacturer: 'SKF', model: '6204-2RS', partNumber: '0007', barcode: '0000123456789', minRecommendedStock: 5, maxRecommendedStock: 20,
    reorderPoint: 2, isCritical: true, technicalClassification: 'A', usageType: 'REGULAR', nature: 'CONSUMABLE', importance: 'HIGH',
    status: 'ACTIVE', productId: 'product-1', product, deletedAt: null,
  };
  return {
    costCenter: [costCenter], machineCategory: [category], productCategory: [productCategory], department: [department],
    productionLine: [productionLine], operationType: [operationType], unit: [unit], product: [product],
    machine: [machineA, machineB], machineComponent: [parentComponent, childComponent], sparePart: [sparePart],
  } as Record<string, Row[]>;
}

function scalarMatch(value: any, condition: any): boolean {
  if (condition === null) return value === null || value === undefined;
  if (Array.isArray(condition)) return condition.some(entry => scalarMatch(value, entry));
  if (condition && typeof condition === 'object') {
    if ('in' in condition) return (condition.in as any[]).includes(value);
    if ('notIn' in condition) return !(condition.notIn as any[]).includes(value);
    if ('not' in condition) return value !== condition.not;
    return false;
  }
  return value === condition;
}

function recordMatches(record: Row, where: any): boolean {
  if (!where) return true;
  for (const clause of Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : []) if (!recordMatches(record, clause)) return false;
  if (where.OR && !(where.OR as any[]).some((clause: any) => recordMatches(record, clause))) return false;
  if (where.NOT && recordMatches(record, where.NOT)) return false;
  for (const [key, condition] of Object.entries(where)) {
    if (['AND', 'OR', 'NOT'].includes(key)) continue;
    const value = record[key];
    const nested = condition && typeof condition === 'object' && !Array.isArray(condition) && !('in' in condition) && !('notIn' in condition) && !('not' in condition);
    if (nested) {
      if (!value || typeof value !== 'object' || !recordMatches(value, condition)) return false;
    } else if (!scalarMatch(value, condition)) return false;
  }
  return true;
}

function fixture(mutate?: (data: Record<string, Row[]>) => void) {
  const data = seed(); if (mutate) mutate(data);
  const calls: Array<{ model: string; where: any }> = [];
  const keys = ['machine:read', 'machine:create', 'machine:update', 'machine-component:read', 'machine-component:create', 'machine-component:update',
    'spare-part:read', 'spare-part:create', 'spare-part:update', 'products:read', 'products:create', 'products:update'];
  const db: any = {
    userRole: { findMany: jest.fn(async () => [{ role: { code: 'CATALOG', status: 'ACTIVE', permissions: keys.map(key => ({ permission: { key, status: 'ACTIVE' } })) } }]) },
    user: { findUnique: jest.fn(async () => ({ name: 'Owner' })) },
    $transaction: jest.fn(async (callback: any) => callback(db)),
  };
  for (const [model, records] of Object.entries(data)) {
    db[model] = {
      findMany: jest.fn(async (query: any = {}) => {
        calls.push({ model, where: query?.where });
        if (model === 'productionLine' && hasNullBranch(query?.where)) {
          throw new Error('PrismaClientValidationError: Argument `branchId` must not be null. (prisma.productionLine.findMany)');
        }
        return records.filter(record => recordMatches(record, query?.where));
      }),
    };
  }
  const audit = { logWithClient: jest.fn(async () => undefined) };
  const components = { saveInTx: jest.fn(async (_tx: any, _dto: any, _user: string, _ctx: any, existingId?: string) => ({ id: existingId ?? 'new-component-id' })) };
  const service = new MasterDataExcelService(db, new PermissionCheckService(db), audit as any, {} as any, components as any, {} as any, {} as any);
  return { service, db, calls, audit, components };
}

const upload = (buffer: Buffer) => ({ buffer, originalname: 'machines-export.xlsx', mimetype: 'application/octet-stream', size: buffer.length });
async function sheetBuffer(headers: string[], rows: any[][]): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Data');
  sheet.addRow(headers);
  for (const row of rows) sheet.addRow(row);
  return Buffer.from(await workbook.xlsx.writeBuffer() as any);
}

describe('generated export to validate round trip (Production regression)', () => {
  it('accepts the exported Machines workbook in CREATE_AND_UPDATE without the Production 500', async () => {
    const f = fixture();
    const buffer = await f.service.export('machines', 'u', ctx, 'en');
    const preview = await f.service.validate('machines', upload(buffer), 'CREATE_AND_UPDATE', 'u', ctx);

    expect(preview.rows.map(row => row.action)).toEqual(['UNCHANGED', 'UNCHANGED']);
    expect(preview.rows.map(row => row.code)).toEqual(['MCH-000001', 'MCH-000002']);
    expect(preview.summary).toMatchObject({ totalRows: 2, created: 0, updated: 0, unchanged: 2, failed: 0 });
    expect(preview.summary.errors).toEqual([]);
    expect(preview.rows.flatMap(row => row.errors)).toEqual([]);
    expect(preview.canImport).toBe(true);
    expect(f.db.$transaction).not.toHaveBeenCalled();
  });

  it('scopes ProductionLine by its required branch and keeps the optional-branch scope for Machine', async () => {
    const f = fixture();
    await f.service.validate('machines', upload(await f.service.export('machines', 'u', ctx, 'en')), 'CREATE_AND_UPDATE', 'u', ctx);

    const lineQuery = f.calls.find(call => call.model === 'productionLine');
    expect(lineQuery).toBeDefined();
    expect(hasNullBranch(lineQuery!.where)).toBe(false);
    expect(lineQuery!.where.AND).toEqual([{ companyId: 'A', branchId: 'A1' }]);
    const machineQuery = f.calls.filter(call => call.model === 'machine').map(call => call.where).find(where => Array.isArray(where?.AND) && where.AND[0]?.companyId === 'A');
    expect(machineQuery!.AND).toEqual([{ companyId: 'A', OR: [{ branchId: 'A1' }, { branchId: null }] }]);
  });

  it('never resolves a ProductionLine from another branch', async () => {
    const f = fixture(data => { data.productionLine[0].branchId = 'A2'; });
    const preview = await f.service.validate('machines', upload(await f.service.export('machines', 'u', ctx, 'en')), 'CREATE_AND_UPDATE', 'u', ctx);

    const row = preview.rows.find(entry => entry.code === 'MCH-000001')!;
    expect(row.errors.map(error => error.code)).toContain('validation.excelReference');
    expect(row.action).toBe('INVALID');
    expect(preview.canImport).toBe(false);
  });

  it.each(['machine-components', 'spare-parts', 'products'] as ExcelEntity[])('round-trips a real %s export through CREATE_AND_UPDATE', async entity => {
    const f = fixture();
    const buffer = await f.service.export(entity, 'u', ctx, 'en');
    const preview = await f.service.validate(entity, upload(buffer), 'CREATE_AND_UPDATE', 'u', ctx);

    expect(preview.rows.length).toBeGreaterThan(0);
    expect(preview.rows.every(row => row.action === 'UNCHANGED')).toBe(true);
    expect(preview.summary.errors).toEqual([]);
    expect(preview.rows.flatMap(row => row.errors)).toEqual([]);
    expect(preview.summary).toMatchObject({ created: 0, updated: 0, failed: 0 });
    expect(preview.canImport).toBe(true);
    expect(EXCEL_DEFINITIONS[entity].keyHeaders.every(header => preview.rows.every(row => row.values[header] !== undefined))).toBe(true);
  });

  it('exports the import headers with business codes and no formulas or internal IDs', async () => {
    const f = fixture();
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(await f.service.export('machines', 'u', ctx, 'en') as any);
    const data = workbook.getWorksheet('Data')!;
    expect((data.getRow(1).values as any[]).slice(1)).toEqual(EXCEL_DEFINITIONS.machines.columns.filter(column => column.export).map(column => column.header));

    const formulas: string[] = [], text: string[] = [];
    data.eachRow(row => row.eachCell(cell => {
      const value: any = cell.value;
      if (value && typeof value === 'object' && 'formula' in value) formulas.push(cell.address);
      text.push(String(value && typeof value === 'object' && 'text' in value ? value.text : value ?? ''), String(cell.note ?? ''));
    }));
    expect(formulas).toEqual([]);
    expect(text.join('\n')).toContain('PL-0001');
    for (const internalId of ['line-1', 'dep-1', 'cat-1', 'cc-1', 'op-1']) expect(text.join('\n')).not.toContain(internalId);
  });

  it('exports one row per logical component with MachineCodes and aligned per-machine fields', async () => {
    const f = fixture();
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(await f.service.export('machine-components', 'u', ctx, 'en') as any);
    const data = workbook.getWorksheet('Data')!;
    const headers = (data.getRow(1).values as any[]).slice(1);
    expect(headers).toContain('MachineCodes');
    expect(headers).toContain('LocationsInMachine');
    expect(headers).toContain('SerialNumbers');
    expect(headers).not.toContain('MachineCode');
    expect(headers).not.toContain('LocationInMachine');
    expect(headers).not.toContain('SerialNumber');
    const codeColumn = headers.indexOf('Code') + 1, machineCodesColumn = headers.indexOf('MachineCodes') + 1;
    const body = data.getRows(2, data.rowCount - 1) ?? [];
    expect(body.map(row => row.getCell(codeColumn).value)).toEqual(['CMP-0001', 'CMP-0002']);
    expect(body.map(row => String(row.getCell(machineCodesColumn).value))).toEqual(['MCH-000001', 'MCH-000001']);
  });

  it('imports MachineCodes into ONE component with N links and per-machine data', async () => {
    const f = fixture();
    const buffer = await sheetBuffer(
      ['Code', 'MachineCodes', 'Name', 'ComponentType', 'LocationsInMachine', 'SerialNumbers'],
      [['CMP-0003', 'MCH-000001;MCH-000002', 'Shared part', 'MECHANICAL', 'Upper;Lower', 'S-01;S-02']],
    );
    const preview = await f.service.validate('machine-components', upload(buffer), 'CREATE_AND_UPDATE', 'u', ctx);
    expect(preview.summary.errors).toEqual([]);
    expect(preview.rows.flatMap(row => row.errors)).toEqual([]);
    expect(preview.canImport).toBe(true);

    const result = await f.service.import('machine-components', upload(buffer), 'CREATE_AND_UPDATE', preview.token, 'u', ctx);
    expect(result).toMatchObject({ created: 1, updated: 0, failed: 0 });
    expect(f.components.saveInTx).toHaveBeenCalledTimes(1);
    const [tx, dto, user, activeCtx, existingId] = (f.components.saveInTx as jest.Mock).mock.calls[0];
    expect(tx).toBe(f.db);
    expect(user).toBe('u');
    expect(activeCtx).toBe(ctx);
    expect(existingId).toBeUndefined();
    expect(dto.machineIds).toEqual(['m-1', 'm-2']);
    expect(dto.machineData).toEqual([
      { machineId: 'm-1', locationInMachine: 'Upper', serialNumber: 'S-01' },
      { machineId: 'm-2', locationInMachine: 'Lower', serialNumber: 'S-02' },
    ]);
    expect(dto.locationInMachine).toBeUndefined();
    expect(dto.serialNumber).toBeUndefined();
    expect(f.audit.logWithClient).toHaveBeenCalledTimes(1);
  });

  it('rejects a foreign machine code inside MachineCodes with a row error', async () => {
    const f = fixture();
    const buffer = await sheetBuffer(
      ['Code', 'MachineCodes', 'Name', 'ComponentType'],
      [['CMP-0003', 'MCH-000001;FOREIGN', 'Shared part', 'MECHANICAL']],
    );
    const preview = await f.service.validate('machine-components', upload(buffer), 'CREATE_AND_UPDATE', 'u', ctx);
    expect(preview.canImport).toBe(false);
    expect(preview.rows[0].errors.map(error => error.code)).toContain('validation.excelReference');
    expect(preview.rows[0].errors.some(error => error.column === 'MachineCodes')).toBe(true);
    expect(preview.summary.failed).toBe(1);
  });

  it('accepts a legacy MachineCode file and normalizes it to a single machine id', async () => {
    const f = fixture();
    const buffer = await sheetBuffer(
      ['Code', 'MachineCode', 'Name', 'ComponentType', 'LocationInMachine', 'SerialNumber'],
      [['CMP-0003', 'MCH-000001', 'Legacy part', 'MECHANICAL', 'inside', 'S-L']],
    );
    const preview = await f.service.validate('machine-components', upload(buffer), 'CREATE_AND_UPDATE', 'u', ctx);
    expect(preview.summary.errors).toEqual([]);
    expect(preview.rows[0].errors).toEqual([]);
    expect(preview.rows[0].action).toBe('NEW');
    expect(preview.canImport).toBe(true);
    const result = await f.service.import('machine-components', upload(buffer), 'CREATE_AND_UPDATE', preview.token, 'u', ctx);
    expect(result.created).toBe(1);
    const dto = (f.components.saveInTx as jest.Mock).mock.calls[0][1];
    expect(dto.machineIds).toEqual(['m-1']);
    expect(dto.machineData).toEqual([{ machineId: 'm-1', locationInMachine: 'inside', serialNumber: 'S-L' }]);
  });

  it('updates the existing component to the final machine set without creating a second component', async () => {
    const f = fixture();
    const buffer = await sheetBuffer(
      ['Code', 'MachineCodes', 'Name', 'ComponentType'],
      [['CMP-0001', 'MCH-000001;MCH-000002', 'Parent', 'MECHANICAL']],
    );
    const preview = await f.service.validate('machine-components', upload(buffer), 'CREATE_AND_UPDATE', 'u', ctx);
    expect(preview.rows[0].action).toBe('UPDATE');
    expect(preview.canImport).toBe(true);
    const result = await f.service.import('machine-components', upload(buffer), 'CREATE_AND_UPDATE', preview.token, 'u', ctx);
    expect(result).toMatchObject({ created: 0, updated: 1, failed: 0 });
    expect(f.components.saveInTx).toHaveBeenCalledTimes(1);
    const [tx, dto, , , existingId] = (f.components.saveInTx as jest.Mock).mock.calls[0];
    expect(tx).toBe(f.db);
    expect(existingId).toBe('c-1');
    expect(dto.machineIds).toEqual(['m-1', 'm-2']);
  });
});
