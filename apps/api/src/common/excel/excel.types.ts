export const EXCEL_LIMITS = Object.freeze({ fileBytes: 2 * 1024 * 1024, importRows: 200, exportRows: 5000, columns: 32, cellLength: 4000, sheets: 4, zipEntries: 64, inflatedBytes: 12 * 1024 * 1024, entryBytes: 6 * 1024 * 1024, sessionMs: 10 * 60 * 1000, sessions: 100 });
export const IMPORT_MODES = ['CREATE_ONLY', 'UPDATE_EXISTING', 'CREATE_AND_UPDATE'] as const;
export type ExcelImportMode = typeof IMPORT_MODES[number];
/** Adapter slug. The canonical four entities support template/preview/import;
 *  governance export adapters are registered with `exportOnly: true`. */
export type ExcelEntity = string;
export type ExcelScalar = string | number | boolean;
export type ExcelRowState = 'NEW' | 'UPDATE' | 'UNCHANGED' | 'DUPLICATE_IN_FILE' | 'CONFLICT_EXISTING' | 'INVALID';
export type ExcelReference = 'machineCategory' | 'productCategory' | 'department' | 'productionLine' | 'operationType' | 'unit' | 'product' | 'machine' | 'parentComponent';
export interface ExcelColumnDefinition {
  header: string; field: string; label: string; type: 'text' | 'number' | 'boolean' | 'date' | 'enum';
  required?: 'identity' | 'create'; maxLength: number; values?: readonly string[]; reference?: ExcelReference;
  update: boolean; importable: boolean; export: boolean; example: string; width: number;
}
/** Tenant scope applied at query time by the canonical Excel export authority.
 *  `companyField`/`branchField` are real Prisma field names on the model. */
export interface ExcelScope {
  /** Dot-separated Prisma relation path, e.g. `machine.companyId`. */
  companyField?: string;
  branchField?: string;
  /** Only for genuinely system-owned catalogues with no tenant-owned rows. */
  global?: boolean;
}
export interface ExcelDefinition {
  entity: ExcelEntity; model: string; permission: string; shared: boolean;
  keyHeaders: string[]; columns: ExcelColumnDefinition[];
  /** Export-only adapters have no template/preview/import path by design. */
  exportOnly?: boolean;
  /** Tenant scope for list/export reads. Absent means company+branch fields. */
  scope?: ExcelScope;
  /** Fields included verbatim in the audit metadata only when allowlisted. */
  auditFields?: string[];
  /** Human-readable workbook module title. Prevents raw i18n keys in XLSX files. */
  moduleTitle?: { en: string; ar: string };
  /** Set only when the Prisma model actually has `deletedAt`. */
  softDelete?: boolean;
  /** Stable UI route served by this adapter. */
  route?: string;
}
export interface ExcelRowError { row: number; column: string; code: string; value?: string; }
export interface ParsedExcelRow { row: number; values: Record<string, ExcelScalar>; errors: ExcelRowError[]; }
export interface ParsedExcel { rows: ParsedExcelRow[]; warnings: ExcelRowError[]; }
export interface ExcelPreviewRow { row: number; code: string; name: string; action: ExcelRowState; values: Record<string, ExcelScalar>; errors: ExcelRowError[]; }
export interface ExcelImportResult { totalRows: number; created: number; updated: number; unchanged: number; skipped: number; warnings: number; failed: number; errors: ExcelRowError[]; }
