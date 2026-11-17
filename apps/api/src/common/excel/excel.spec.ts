import * as ExcelJS from 'exceljs';
import { parseExcel, canonicalDate, ExcelUpload } from './excel-parser';
import { buildExcelWorkbook } from './excel-workbook';
import { EXCEL_DEFINITIONS } from '../../modules/factory/master-data-excel/excel.definitions';
import { assertSafeXlsxZip } from './excel-zip';
const def = EXCEL_DEFINITIONS.products;
export async function upload(headers: string[], rows: any[][] = []): Promise<ExcelUpload> {
  const book = new ExcelJS.Workbook(), data = book.addWorksheet('Data'); data.addRow(headers); rows.forEach(row => data.addRow(row));
  const buffer = Buffer.from(await book.xlsx.writeBuffer()); return { buffer, originalname: 'master.xlsx', mimetype: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', size: buffer.length };
}
describe('bounded shared XLSX contract', () => {
  it.each(Object.values(EXCEL_DEFINITIONS))('creates an empty round-trip template for $entity', async definition => {
    const buffer = await buildExcelWorkbook(definition, [], { locale: 'ar', company: 'شركة', branch: 'فرع', user: 'Owner' });
    const file = { buffer, originalname: 'template.xlsx', mimetype: 'application/octet-stream', size: buffer.length };
    const parsed = await parseExcel(file, definition); expect(parsed.rows).toEqual([]);
    const workbook = new ExcelJS.Workbook(); await workbook.xlsx.load(buffer as any);
    expect(workbook.worksheets.map(s => s.name)).toEqual(['Data', 'Instructions']); expect(workbook.worksheets[0].rowCount).toBe(1);
    expect(workbook.worksheets[0].views[0].rightToLeft).toBe(true);
    expect(JSON.stringify(workbook.worksheets[1].model)).not.toContain('excel.');
  });
  it('preserves Arabic, Unicode, zeros and literal injection prefixes without formulas', async () => {
    const buffer = await buildExcelWorkbook(def, [{ Code: '00001', Name: '=SUM(A1:A2)', Barcode: '00000001', Description: 'عربي + @ -', MinStock: 0 }], { locale: 'en', company: 'C', branch: 'B', user: 'U' });
    const parsed = await parseExcel({ buffer, originalname: 'test.xlsx', mimetype: 'application/zip', size: buffer.length }, def);
    expect(parsed.rows[0].errors).toEqual([]); expect(parsed.rows[0].values).toMatchObject({ Code: '00001', Name: '=SUM(A1:A2)', Barcode: '00000001', MinStock: 0 });
  });
  it.each([['Code', 1, 'excelTextRequired'], ['Name', { formula: '1+1', result: 2 }, 'excelFormula'], ['MinStock', -1, 'excelNumber'], ['MinStock', false, 'excelNumber'], ['MinStock', '1,000', 'excelNumber'], ['MinStock', 0.1234567, 'excelNumber'], ['Name', '__CLEAR__', 'excelClearUnsupported'], ['Name', 'x'.repeat(256), 'excelCellLimit'], ['Name', '\uFFFD', 'excelCellLimit'], ['Name', { text: 'link', hyperlink: 'https://example.com' }, 'excelCellType']])('rejects %s invalid typed value %p', async (header, value, error) => {
    const file = await upload(['Code', ...(header === 'Code' ? [] : [String(header)])], [[...(header === 'Code' ? [value] : ['C', value])]]);
    // External hyperlink relationships are rejected before ExcelJS reads the file.
    if (typeof value === 'object' && 'hyperlink' in value) await expect(parseExcel(file, def)).rejects.toThrow();
    else expect((await parseExcel(file, def)).rows[0].errors[0].code).toBe(`validation.${error}`);
  });
  it.each([['Code', 'Code'], ['Name'], ['Code', 'InventoryBalance'], ['Code', '']])('rejects unsafe headers %j', async (...headers: string[]) => { await expect(parseExcel(await upload(headers, [['A', 'B']]), def)).rejects.toThrow(); });
  it('rejects values beyond declared headers', async () => { await expect(parseExcel(await upload(['Code'], [['A', 'hidden']]), def)).rejects.toThrow(); });
  it('rejects 201 data rows', async () => { await expect(parseExcel(await upload(['Code'], Array.from({ length: 201 }, (_, i) => ['C'+i])), def)).rejects.toThrow(); });
  it('accepts header-only and sparse rows without phantom records', async () => { expect((await parseExcel(await upload(['Code'], [[], []]), def)).rows).toHaveLength(0); });
  it('rejects renamed, truncated, CRC-corrupt and oversized files', async () => {
    const file = await upload(['Code'], [['C']]);
    await expect(parseExcel({ ...file, originalname: 'old.xls' }, def)).rejects.toThrow();
    expect(() => assertSafeXlsxZip(file.buffer.subarray(0, file.buffer.length-1))).toThrow();
    const corrupt = Buffer.from(file.buffer); corrupt[40] ^= 1; expect(() => assertSafeXlsxZip(corrupt)).toThrow();
    await expect(parseExcel({ ...file, size: 3*1024*1024 }, def)).rejects.toThrow();
  });
  it('validates calendar days without timezone or locale guessing', () => { expect(canonicalDate('2024-02-29')).toBe('2024-02-29'); expect(canonicalDate('2026-02-29')).toBeUndefined(); expect(canonicalDate('17/11/2026')).toBeUndefined(); });
  it('includes original row, safe values and localized errors in error workbook', async () => {
    const buffer = await buildExcelWorkbook(def, [{ Code: '0001' }], { locale: 'en', company: 'C', branch: 'B', user: 'U' }, [{ row: 7, code: '0001', name: '', action: 'INVALID', values: { Code: '0001' }, errors: [{ row: 7, column: 'Name', code: 'validation.excelRequired' }] }]);
    const book = new ExcelJS.Workbook(); await book.xlsx.load(buffer as any);
    expect(book.getWorksheet('Errors')!.getRow(2).values).toEqual(expect.arrayContaining(['7', 'Name', 'This field is required.', '0001']));
  });
});
