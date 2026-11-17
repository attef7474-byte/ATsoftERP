import * as ExcelJS from 'exceljs';
import { MasterDataExcelService } from './master-data-excel.service';
import { PermissionCheckService } from '../../../common/rbac/permission-check.service';
const ctx: any = { companyId: 'A', branchId: 'A1', companyCode: 'A', companyName: 'Company A', branchCode: 'A1', branchName: 'Branch A1' };
async function file(rows = [['P', 'New', 'KG']], headers = ['Code', 'Name', 'UnitCode']) {
  const book = new ExcelJS.Workbook(); const data = book.addWorksheet('Data'); data.addRow(headers); rows.forEach(row => data.addRow(row));
  const buffer = Buffer.from(await book.xlsx.writeBuffer()); return { buffer, originalname: 'data.xlsx', mimetype: 'application/octet-stream', size: buffer.length };
}
function fixture(keys = ['products:read', 'products:create', 'products:update']) {
  let records: any[] = [], writes: any[] = [];
  const db: any = {
    userRole: { findMany: jest.fn(async () => [{ role: { code: 'CATALOG', status: 'ACTIVE', permissions: keys.map(key => ({ permission: { key, status: 'ACTIVE' } })) } }]) },
    user: { findUnique: jest.fn(async () => ({ name: 'Owner' })) },
    product: { findMany: jest.fn(async (query: any) => query.where.OR ? records : records.filter(r => query.where.code?.in?.includes(r.code))) },
    unit: { findMany: jest.fn(async () => [{ id: 'kg', code: 'KG', isActive: true }]) },
  };
  db.$transaction = jest.fn(async (callback: any) => { const before = [...records], beforeWrites = [...writes]; try { return await callback(db); } catch (error) { records = before; writes = beforeWrites; throw error; } });
  const products: any = {
    createInTx: jest.fn(async (_tx, dto) => { const record = { ...dto, id: 'new-'+dto.code }; records.push(record); writes.push(['product', dto]); return record; }),
    updateInTx: jest.fn(async (_tx, id, dto) => { const index = records.findIndex(r => r.id === id); records[index] = { ...records[index], ...dto }; writes.push(['update', dto]); return records[index]; }),
  };
  const audit: any = { logWithClient: jest.fn(async (_tx, data) => { writes.push(['audit', data]); }) };
  const permissions = new PermissionCheckService(db);
  const service = new MasterDataExcelService(db, permissions, audit, {} as any, {} as any, {} as any, products);
  return { service, db, products, audit, records: () => records, writes: () => writes, set: (r: any[]) => { records = r; } };
}
describe('Excel application transaction and authorization', () => {
  it('never writes during preview, returns only business values, then commits and audits once', async () => {
    const f = fixture(), upload = await file(); const preview = await f.service.validate('products', upload, 'CREATE_ONLY', 'u', ctx);
    expect(f.writes()).toEqual([]); expect(f.db.$transaction).not.toHaveBeenCalled(); expect(JSON.stringify(preview)).not.toContain('unitId'); expect(preview.canImport).toBe(true);
    const result = await f.service.import('products', upload, 'CREATE_ONLY', preview.token, 'u', ctx);
    expect(result).toMatchObject({ created: 1, failed: 0 }); expect(f.products.createInTx).toHaveBeenCalledTimes(1);
    expect(f.audit.logWithClient.mock.calls[0][1]).toMatchObject({ action: 'EXCEL_IMPORT', details: { companyId: 'A', branchId: 'A1', sharedCatalog: true } });
    expect(f.db.$transaction.mock.calls[0][1]).toMatchObject({ isolationLevel: 'Serializable' });
    expect(await f.service.import('products', upload, 'CREATE_ONLY', preview.token, 'u', ctx)).toEqual(result);
    expect(f.products.createInTx).toHaveBeenCalledTimes(1);
  });
  it('rolls back earlier rows and audits when a later canonical write fails', async () => {
    const f = fixture(), upload = await file([['P', 'First', 'KG'], ['Q', 'Second', 'KG']]);
    const preview = await f.service.validate('products', upload, 'CREATE_ONLY', 'u', ctx);
    f.products.createInTx.mockImplementationOnce(async (_tx: any, dto: any) => { f.set([{ ...dto, id: 'first' }]); return { id: 'first' }; }).mockRejectedValueOnce(new Error('write failed'));
    await expect(f.service.import('products', upload, 'CREATE_ONLY', preview.token, 'u', ctx)).rejects.toThrow('write failed'); expect(f.records()).toEqual([]); expect(f.writes()).toEqual([]);
  });
  it('rolls back all rows if the transactional audit fails', async () => {
    const f = fixture(), upload = await file(), preview = await f.service.validate('products', upload, 'CREATE_ONLY', 'u', ctx);
    f.audit.logWithClient.mockRejectedValueOnce(new Error('audit unavailable'));
    await expect(f.service.import('products', upload, 'CREATE_ONLY', preview.token, 'u', ctx)).rejects.toThrow(); expect(f.records()).toEqual([]);
  });
  it.each(['CREATE_ONLY', 'UPDATE_EXISTING', 'CREATE_AND_UPDATE'] as const)('enforces canonical permissions for %s', async mode => {
    const f = fixture(['products:read']); await expect(f.service.validate('products', await file(), mode, 'u', ctx)).rejects.toMatchObject({ status: 403 }); expect(f.db.product.findMany).not.toHaveBeenCalled();
  });
  it('rechecks permissions before replaying a consumed token', async () => {
    const f = fixture(), upload = await file(), preview = await f.service.validate('products', upload, 'CREATE_ONLY', 'u', ctx);
    await f.service.import('products', upload, 'CREATE_ONLY', preview.token, 'u', ctx); f.db.userRole.findMany.mockResolvedValue([]);
    await expect(f.service.import('products', upload, 'CREATE_ONLY', preview.token, 'u', ctx)).rejects.toMatchObject({ status: 403 });
  });
  it.each([{ ...ctx, companyId: 'B' }, { ...ctx, branchId: 'A2' }])('binds preview to company and branch', async other => {
    const f = fixture(), upload = await file(), preview = await f.service.validate('products', upload, 'CREATE_ONLY', 'u', ctx);
    await expect(f.service.import('products', upload, 'CREATE_ONLY', preview.token, 'u', other)).rejects.toMatchObject({ status: 409 }); expect(f.records()).toEqual([]);
  });
  it('denies archived or missing context', async () => {
    const f = fixture(); await expect(f.service.validate('products', await file(), 'CREATE_ONLY', 'u', { ...ctx, isArchived: true })).rejects.toMatchObject({ status: 403 });
    await expect(f.service.template('products', 'u', undefined as any, 'en')).rejects.toMatchObject({ status: 403 });
  });
  it('rejects another user, changed mode/file and expired tokens', async () => {
    const f = fixture(), upload = await file(), preview = await f.service.validate('products', upload, 'CREATE_ONLY', 'u', ctx);
    await expect(f.service.import('products', upload, 'CREATE_ONLY', preview.token, 'other', ctx)).rejects.toMatchObject({ status: 409 });
    await expect(f.service.import('products', upload, 'CREATE_AND_UPDATE', preview.token, 'u', ctx)).rejects.toMatchObject({ status: 409 });
    await expect(f.service.import('products', await file([['Q', 'Changed', 'KG']]), 'CREATE_ONLY', preview.token, 'u', ctx)).rejects.toMatchObject({ status: 409 });
    jest.spyOn(Date, 'now').mockReturnValue(Date.now()+601000);
    try { await expect(f.service.import('products', upload, 'CREATE_ONLY', preview.token, 'u', ctx)).rejects.toMatchObject({ status: 409 }); } finally { jest.restoreAllMocks(); }
  });
  it('rejects concurrent data changes and invalid files without any writes', async () => {
    const f = fixture(), upload = await file(), preview = await f.service.validate('products', upload, 'CREATE_ONLY', 'u', ctx);
    f.set([{ id: 'concurrent', code: 'P', name: 'Other' }]); await expect(f.service.import('products', upload, 'CREATE_ONLY', preview.token, 'u', ctx)).rejects.toMatchObject({ status: 409 }); expect(f.products.createInTx).not.toHaveBeenCalled();
  });
  it('returns safe conflict on simultaneous double submit and succeeds once', async () => {
    const f = fixture(), upload = await file(), preview = await f.service.validate('products', upload, 'CREATE_ONLY', 'u', ctx);
    const results = await Promise.allSettled([f.service.import('products', upload, 'CREATE_ONLY', preview.token, 'u', ctx), f.service.import('products', upload, 'CREATE_ONLY', preview.token, 'u', ctx)]);
    expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1); expect(f.products.createInTx).toHaveBeenCalledTimes(1);
  });
  it('uses AND to retain branch scope while exporting searched machines', async () => {
    const f = fixture(['machine:read']); f.db.machine = { findMany: jest.fn(async () => []) };
    await f.service.export('machines', 'u', ctx, 'en', 'machine');
    const query = f.db.machine.findMany.mock.calls[0][0]; expect(query.where.AND[1]).toEqual({ companyId: 'A', OR: [{ branchId: 'A1' }, { branchId: null }] }); expect(query.take).toBe(5001);
  });
  it('rejects export overflow rather than silently truncating', async () => {
    const f = fixture(); f.db.product.findMany.mockResolvedValue(Array.from({ length: 5001 }, () => ({})));
    await expect(f.service.export('products', 'u', ctx, 'en')).rejects.toMatchObject({ status: 400 });
  });
  it('exports business codes and actor name without raw database IDs', async () => {
    const f = fixture(); f.db.product.findMany.mockResolvedValue([{ id: 'secret-db-id', code: '0001', name: 'Product', unitId: 'secret-unit-id', unitRef: { code: 'KG' }, unit: 'KG' }]);
    const buffer = await f.service.export('products', 'secret-user-id', ctx, 'en'); const book = new ExcelJS.Workbook(); await book.xlsx.load(buffer as any);
    const text = JSON.stringify(book.worksheets.map(s => s.model)); expect(text).not.toContain('secret-'); expect(text).toContain('0001'); expect(text).toContain('Owner');
  });
});
