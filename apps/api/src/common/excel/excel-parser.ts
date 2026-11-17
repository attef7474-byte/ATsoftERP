import * as ExcelJS from 'exceljs';
import { assertSafeXlsxZip, excelFailure } from './excel-zip';
import { EXCEL_LIMITS, ExcelColumnDefinition, ExcelDefinition, ExcelRowError, ParsedExcel, ParsedExcelRow } from './excel.types';

export interface ExcelUpload { buffer: Buffer; originalname: string; mimetype: string; size: number; }
export function canonicalDate(value: unknown): string | undefined {
  const text = value instanceof Date ? (Number.isFinite(value.getTime()) ? value.toISOString().slice(0, 10) : '') : String(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text) || text.startsWith('0000')) return undefined;
  const date = new Date(text + 'T00:00:00Z');
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === text ? text : undefined;
}
function scalar(cell: ExcelJS.Cell, definition: ExcelColumnDefinition): { value?: string | number | boolean; error?: string } {
  let value: unknown = cell.value;
  if (value === null || value === undefined || value === '') return {};
  if (typeof value === 'object' && !(value instanceof Date)) {
    if ('formula' in value || 'sharedFormula' in value) return { error: 'excelFormula' };
    if ('richText' in value && Array.isArray((value as any).richText)) value = (value as any).richText.map((part: any) => part.text).join('');
    else return { error: 'excelCellType' };
  }
  if (definition.type === 'date') { const date = canonicalDate(value); return date ? { value: date } : { error: 'excelDate' }; }
  if (definition.type === 'text' || definition.type === 'enum') {
    if (typeof value !== 'string') return { error: 'excelTextRequired' };
    const text = value.trim(); if (!text) return {};
    if (text === '__CLEAR__') return { error: 'excelClearUnsupported' };
    if (text.length > definition.maxLength || /[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFD]/.test(text)) return { error: 'excelCellLimit' };
    if (definition.values && !definition.values.includes(text)) return { error: 'excelEnum' };
    return { value: text };
  }
  if (definition.type === 'boolean') {
    if (typeof value === 'boolean') return { value };
    if (value === 'true' || value === 'false') return { value: value === 'true' };
    return { error: 'excelBoolean' };
  }
  if (typeof value === 'string' && !/^(?:\d+)(?:\.\d{1,6})?$/.test(value.trim())) return { error: 'excelNumber' };
  if (typeof value !== 'number' && typeof value !== 'string') return { error: 'excelNumber' };
  const number = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(number) || number < 0 || number > 1e9 || Math.abs(number * 1e6 - Math.round(number * 1e6)) > 0.00001) return { error: 'excelNumber' };
  return { value: number };
}

export async function parseExcel(file: ExcelUpload, definition: ExcelDefinition): Promise<ParsedExcel> {
  if (!file || !/\.xlsx$/i.test(file.originalname) || !['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/octet-stream', 'application/zip'].includes(file.mimetype)) throw excelFailure('excelFileType');
  if (file.size !== file.buffer.length || file.size > EXCEL_LIMITS.fileBytes) throw excelFailure('excelFileLimit');
  assertSafeXlsxZip(file.buffer);
  const workbook = new ExcelJS.Workbook();
  try { await workbook.xlsx.load(file.buffer as any); } catch { throw excelFailure('excelInvalidWorkbook'); }
  if (!workbook.worksheets.length || workbook.worksheets.length > EXCEL_LIMITS.sheets || workbook.worksheets[0].name !== 'Data') throw excelFailure('excelSheets');
  const sheet = workbook.worksheets[0];
  if (sheet.rowCount > EXCEL_LIMITS.importRows + 1 || sheet.columnCount > EXCEL_LIMITS.columns) throw excelFailure('excelRowLimit');
  const headers: Array<{ column: number; definition: ExcelColumnDefinition }> = [], seen = new Set<string>(), warnings: ExcelRowError[] = [];
  sheet.getRow(1).eachCell({ includeEmpty: true }, (cell, index) => {
    if (typeof cell.value !== 'string') throw excelFailure('excelHeaders');
    const header = cell.value.replace(/^\uFEFF/, '').trim(), column = definition.columns.find(c => c.header === header);
    if (!column || seen.has(header)) throw excelFailure('excelHeaders');
    seen.add(header); headers.push({ column: index, definition: column });
    if (!column.importable) warnings.push({ row: 1, column: header, code: 'validation.excelReadOnlyColumn' });
  });
  if (!headers.length || definition.keyHeaders.some(header => !seen.has(header))) throw excelFailure('excelHeaders');
  const rows: ParsedExcelRow[] = [];
  for (let at = 2; at <= sheet.rowCount; at++) {
    const row = sheet.getRow(at); if (!row.hasValues) continue;
    if (row.cellCount > headers.length && row.values && Object.keys(row.values).some(index => Number(index) > headers.length && row.getCell(Number(index)).value != null)) throw excelFailure('excelHeaders');
    const values: ParsedExcelRow['values'] = {}, errors: ExcelRowError[] = [];
    for (const entry of headers) {
      const parsed = scalar(row.getCell(entry.column), entry.definition);
      if (parsed.error) errors.push({ row: at, column: entry.definition.header, code: `validation.${parsed.error}`, value: typeof row.getCell(entry.column).value === 'string' ? String(row.getCell(entry.column).value).slice(0, 100) : undefined });
      else if (parsed.value !== undefined) values[entry.definition.header] = parsed.value;
    }
    if (Object.keys(values).length || errors.length) rows.push({ row: at, values, errors });
  }
  return { rows, warnings };
}
