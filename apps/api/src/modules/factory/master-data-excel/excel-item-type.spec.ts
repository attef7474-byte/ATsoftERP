import * as ExcelJS from 'exceljs';
import { MasterDataExcelService } from './master-data-excel.service';
import { PermissionCheckService } from '../../../common/rbac/permission-check.service';
import { EXCEL_DEFINITIONS } from './excel.definitions';

/** Phase 1: the Products Excel contract must carry a validated Item Type. */
describe('Products Excel ItemType column', () => {
  const ctx: any = { companyId: 'A', branchId: 'A1', companyCode: 'A', companyName: 'Company A', branchCode: 'A1', branchName: 'Branch A1' };
  const permissionKeys = ['products:read', 'products:create', 'products:update'];

  function fixture() {
    const unit = { id: 'unit-pcs', code: 'PCS', isActive: true };
    const product = {
      id: 'product-1', code: 'PRD-0001', name: 'Raw steel', description: null,
      itemType: 'RAW_MATERIAL', categoryId: null, category: null,
      unit: 'PCS', unitId: unit.id, unitRef: unit, barcode: null,
      minStock: 0, maxStock: 100, status: 'ACTIVE', deletedAt: null,
    };
    const db: any = {
      userRole: { findMany: jest.fn(async () => [{ role: { code: 'CATALOG', status: 'ACTIVE', permissions: permissionKeys.map(key => ({ permission: { key, status: 'ACTIVE' } })) } }]) },
      user: { findUnique: jest.fn(async () => ({ name: 'Owner' })) },
      product: { findMany: jest.fn(async () => [product]) },
      productCategory: { findMany: jest.fn(async () => []) },
      unit: { findMany: jest.fn(async () => [unit]) },
      $transaction: jest.fn(async (callback: any) => callback(db)),
    };
    const service = new MasterDataExcelService(
      db, new PermissionCheckService(db), { logWithClient: jest.fn() } as any,
      {} as any, {} as any, {} as any, {} as any,
    );
    return { service, db };
  }

  const upload = (buffer: Buffer) => ({ buffer, originalname: 'products.xlsx', mimetype: 'application/octet-stream', size: buffer.length });

  it('defines ItemType as a required enum column with the six canonical values', () => {
    const column = EXCEL_DEFINITIONS.products.columns.find(c => c.header === 'ItemType')!;
    expect(column).toBeDefined();
    expect(column.field).toBe('itemType');
    expect(column.type).toBe('enum');
    expect(column.required).toBe('create');
    expect(column.values).toEqual(['RAW_MATERIAL', 'FINISHED_GOOD', 'SPARE_PART', 'PACKAGING_MATERIAL', 'CONSUMABLE', 'GENERAL']);
  });

  it('includes ItemType in export/template headers and writes the stored value', async () => {
    const { service } = fixture();
    const buffer = await service.export('products', 'u', ctx, 'en');
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as any);
    const sheet = workbook.getWorksheet('Data')!;
    const headers = (sheet.getRow(1).values as any[]).slice(1);
    expect(headers).toContain('ItemType');
    const itemTypeIndex = headers.indexOf('ItemType') + 1;
    expect(sheet.getRow(2).getCell(itemTypeIndex).value).toBe('RAW_MATERIAL');
  });

  it('round-trips an unchanged ItemType through CREATE_AND_UPDATE validation', async () => {
    const { service } = fixture();
    const buffer = await service.export('products', 'u', ctx, 'en');
    const preview = await service.validate('products', upload(buffer), 'CREATE_AND_UPDATE', 'u', ctx);
    expect(preview.canImport).toBe(true);
    expect(preview.rows.map(row => row.action)).toEqual(['UNCHANGED']);
    expect(preview.rows.flatMap(row => row.errors)).toEqual([]);
    expect(preview.rows[0].values.ItemType).toBe('RAW_MATERIAL');
  });

  it('rejects an unsupported ItemType value with validation.excelEnum', async () => {
    const { service } = fixture();
    const buffer = await service.export('products', 'u', ctx, 'en');
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as any);
    const sheet = workbook.getWorksheet('Data')!;
    const headers = (sheet.getRow(1).values as any[]).slice(1);
    sheet.getRow(2).getCell(headers.indexOf('ItemType') + 1).value = 'BOGUS';
    const modified = Buffer.from(await workbook.xlsx.writeBuffer() as any);

    const preview = await service.validate('products', upload(modified), 'CREATE_AND_UPDATE', 'u', ctx);
    expect(preview.canImport).toBe(false);
    expect(preview.rows.flatMap(row => row.errors).some(error => error.code === 'validation.excelEnum')).toBe(true);
  });
});
