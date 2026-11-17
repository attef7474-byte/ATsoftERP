export const EXCEL_LIMITS = Object.freeze({ fileBytes: 2 * 1024 * 1024, importRows: 200, exportRows: 5000, columns: 32, cellLength: 4000, sheets: 4, zipEntries: 64, inflatedBytes: 12 * 1024 * 1024, entryBytes: 6 * 1024 * 1024, sessionMs: 10 * 60 * 1000, sessions: 100 });
export const IMPORT_MODES = ['CREATE_ONLY', 'UPDATE_EXISTING', 'CREATE_AND_UPDATE'] as const;
export type ExcelImportMode = typeof IMPORT_MODES[number];
export type ExcelEntity = 'machines' | 'machine-components' | 'spare-parts' | 'products';
export type ExcelScalar = string | number | boolean;
export type ExcelRowState = 'NEW' | 'UPDATE' | 'UNCHANGED' | 'DUPLICATE_IN_FILE' | 'CONFLICT_EXISTING' | 'INVALID';
export type ExcelReference = 'machineCategory' | 'productCategory' | 'department' | 'productionLine' | 'operationType' | 'unit' | 'product' | 'machine' | 'parentComponent';
export interface ExcelColumnDefinition {
  header: string; field: string; label: string; type: 'text' | 'number' | 'boolean' | 'date' | 'enum';
  required?: 'identity' | 'create'; maxLength: number; values?: readonly string[]; reference?: ExcelReference;
  update: boolean; importable: boolean; export: boolean; example: string; width: number;
}
export interface ExcelDefinition {
  entity: ExcelEntity; model: 'machine' | 'machineComponent' | 'sparePart' | 'product'; permission: string; shared: boolean;
  keyHeaders: string[]; columns: ExcelColumnDefinition[];
}
export interface ExcelRowError { row: number; column: string; code: string; value?: string; }
export interface ParsedExcelRow { row: number; values: Record<string, ExcelScalar>; errors: ExcelRowError[]; }
export interface ParsedExcel { rows: ParsedExcelRow[]; warnings: ExcelRowError[]; }
export interface ExcelPreviewRow { row: number; code: string; name: string; action: ExcelRowState; values: Record<string, ExcelScalar>; errors: ExcelRowError[]; }
export interface ExcelImportResult { totalRows: number; created: number; updated: number; unchanged: number; skipped: number; warnings: number; failed: number; errors: ExcelRowError[]; }
