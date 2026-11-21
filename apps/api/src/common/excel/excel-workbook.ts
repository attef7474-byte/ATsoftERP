import * as ExcelJS from 'exceljs';
import { getApiMessage } from '../i18n/api-messages';
import { ExcelDefinition, ExcelPreviewRow, EXCEL_LIMITS } from './excel.types';

export interface ExcelWorkbookContext { locale: 'ar' | 'en'; company: string; branch: string; user: string; filters?: Record<string, string>; moduleTitle?: { en: string; ar: string }; }
function textCell(cell: ExcelJS.Cell, value: unknown): void {
  // Explicit XLSX string cells never become formula objects, including =,+,-,@ prefixes.
  cell.value = value === null || value === undefined ? '' : String(value);
  cell.numFmt = '@'; cell.alignment = { vertical: 'top', wrapText: true };
}
function header(sheet: ExcelJS.Worksheet, values: string[]) {
  const row = sheet.addRow(values); row.height = 30;
  row.eachCell(cell => { cell.font = { name: 'Arial', bold: true, color: { argb: 'FFFFFFFF' }, size: 11 }; cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF153B56' } }; cell.alignment = { vertical: 'middle', wrapText: true }; });
}
function sheet(workbook: ExcelJS.Workbook, name: string, ctx: ExcelWorkbookContext): ExcelJS.Worksheet {
  const result = workbook.addWorksheet(name, { views: [{ state: 'frozen', ySplit: 1, rightToLeft: ctx.locale === 'ar' }] });
  result.properties.defaultRowHeight = 21; return result;
}
export async function buildExcelWorkbook(definition: ExcelDefinition, rows: Record<string, unknown>[], ctx: ExcelWorkbookContext, errors?: ExcelPreviewRow[]): Promise<Buffer> {
  const t = (key: string) => getApiMessage(key, ctx.locale), workbook = new ExcelJS.Workbook();
  workbook.creator = 'ATsoft ERP'; workbook.created = new Date();
  const columns = definition.columns.filter(c => c.export), data = sheet(workbook, 'Data', ctx);
  columns.forEach((column, index) => { const c = data.getColumn(index + 1); c.width = column.width; c.numFmt = column.type === 'number' ? '#,##0.######' : column.type === 'date' ? 'yyyy-mm-dd' : '@'; });
  header(data, columns.map(c => c.header));
  columns.forEach((column, index) => {
    data.getCell(1, index + 1).note = `${column.header}\n${t(column.required === 'identity' ? 'excel.identity' : column.required === 'create' ? 'excel.requiredCreate' : 'excel.optional')}\n${column.values?.join(', ') || ''}`;
  });
  for (const values of rows) {
    const row = data.addRow([]);
    columns.forEach((column, index) => {
      const cell = row.getCell(index + 1), value = values[column.header];
      if (value !== null && value !== undefined && value !== '' && column.type === 'number') cell.value = Number(value);
      else if (typeof value === 'boolean') cell.value = value;
      else if (column.type === 'date' && typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && value >= '1900-01-01') cell.value = new Date(value + 'T00:00:00Z');
      else textCell(cell, value);
      cell.font = { name: 'Arial', size: 11 }; cell.alignment = { vertical: 'top', wrapText: true };
    });
    row.height = 30;
  }
  data.autoFilter = { from: { row: 1, column: 1 }, to: { row: Math.max(1, data.rowCount), column: columns.length } };
  const instructions = sheet(workbook, 'Instructions', ctx);
  instructions.columns = [{ width: 28 }, { width: 52 }, { width: 26 }, { width: 22 }, { width: 65 }];
  header(instructions, [t('excel.item'), t('excel.instructions')]);
  const metadata = [
    [t('excel.module'), definition.moduleTitle ? definition.moduleTitle[ctx.locale] : t(`excel.module.${definition.entity}`)], [t('excel.company'), ctx.company], [t('excel.branch'), ctx.branch], [t('excel.user'), ctx.user],
    [t('excel.timestamp'), new Date().toISOString()], [t('excel.scope'), t(definition.shared ? 'excel.sharedScope' : 'excel.tenantScope')],
    [t('excel.policy'), t('excel.importPolicy')], [t('excel.limits'), `${EXCEL_LIMITS.importRows} / ${EXCEL_LIMITS.exportRows} / 2 MB`],
    ...Object.entries(ctx.filters || {}).map(([key, value]) => [key, value]),
  ];
  for (const values of metadata) { const row = instructions.addRow([]); values.forEach((v, i) => textCell(row.getCell(i + 1), v)); row.height = values[1].length > 80 ? 72 : 32; }
  instructions.addRow([]);
  const columnHeader = instructions.addRow([t('excel.column'), t('excel.required'), t('excel.type'), t('excel.update'), t('excel.values')]);
  columnHeader.font = { bold: true, color: { argb: 'FF153B56' } }; columnHeader.height = 28;
  for (const column of columns) {
    const row = instructions.addRow([]);
    [column.header, t(column.required === 'identity' ? 'excel.identity' : column.required === 'create' ? 'excel.requiredCreate' : 'excel.optional'), column.reference || column.type,
      t(!column.importable ? 'excel.readOnly' : column.update ? 'excel.yes' : 'excel.createOnly'), column.values?.join(', ') || column.example,
    ].forEach((v, i) => textCell(row.getCell(i + 1), v)); row.height = column.values ? 60 : 30;
  }
  if (errors) {
    const errorSheet = sheet(workbook, 'Errors', ctx);
    const errorHeaders = ['OriginalRowNumber', 'Status', 'ErrorColumn', 'ErrorCode', 'ErrorMessage', ...columns.map(c => c.header)];
    errorSheet.columns = errorHeaders.map((key, i) => ({ key, width: i === 4 ? 65 : 24 })); header(errorSheet, errorHeaders);
    for (const row of errors) for (const error of row.errors) {
      const line = errorSheet.addRow([]);
      const values = [row.row, row.action, error.column, error.code, t(error.code), ...columns.map(c => row.values[c.header] ?? '')];
      values.forEach((value, i) => textCell(line.getCell(i + 1), value)); line.height = 42;
    }
  }
  return Buffer.from(await workbook.xlsx.writeBuffer() as any);
}
