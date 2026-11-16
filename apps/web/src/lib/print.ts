import type { Locale } from './i18n/types';

export type PrintValue = string | number | null | undefined;
export interface PrintField { label: string; value: PrintValue; direction?: 'auto' | 'ltr' | 'rtl' }
export interface PrintColumn<Row> {
  key: string;
  label: string;
  value: (row: Row) => PrintValue;
  format?: (value: PrintValue) => string;
  align: 'start' | 'center' | 'end';
  priority: 1 | 2 | 3 | 4;
  width: number;
  direction?: 'auto' | 'ltr' | 'rtl';
  screenOnly?: boolean;
  printOnly?: boolean;
}
export interface PrintSection<Row = Record<string, unknown>> {
  title?: string;
  columns: PrintColumn<Row>[];
  rows: Row[];
  totals?: PrintField[];
  pageBreakBefore?: boolean;
}
export interface PrintDocumentModel {
  mode: 'REPORT' | 'REGISTER' | 'DOCUMENT';
  title: string;
  subtitle?: string;
  description?: string;
  documentNumber?: string;
  locale: Locale;
  company: string;
  branch?: string;
  organization?: PrintField[];
  printedBy?: string;
  printedAt: Date;
  timeZone: string;
  periodStart?: string;
  periodEnd?: string;
  filters?: PrintField[];
  summary?: PrintField[];
  metadata?: PrintField[];
  sections: PrintSection<any>[];
  notes?: string[];
  orientation: 'portrait' | 'landscape';
  paperSize: 'A4';
  scopeLabel: string;
}

export const PRINT_ROW_LIMIT = 500;
export const PRINT_PAGE_SIZE = 100;
export const PRINT_EMPTY = '—';

export function printText(value: PrintValue): string {
  if (value == null || value === '' || (typeof value === 'number' && !Number.isFinite(value))) return PRINT_EMPTY;
  return String(value);
}

export function printFormatters(locale: Locale, timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone) {
  const language = locale === 'ar' ? 'ar-YE' : 'en-GB';
  const date = (value: PrintValue | Date, options: Intl.DateTimeFormatOptions) => {
    if (value == null || value === '') return PRINT_EMPTY;
    const parsed = value instanceof Date ? value : new Date(value);
    if (!Number.isFinite(parsed.getTime())) return PRINT_EMPTY;
    // Keep numeric dates in one LTR sequence inside RTL documents. Locale-added
    // RLM/ALM separators otherwise reorder date groups in some PDF renderers.
    return new Intl.DateTimeFormat(language, { calendar: 'gregory', numberingSystem: 'latn', timeZone, ...options }).format(parsed).replace(/[\u200e\u200f\u061c]/g, '');
  };
  const number = (value: PrintValue, options: Intl.NumberFormatOptions = {}) => {
    if (value == null || value === '' || !Number.isFinite(Number(value))) return PRINT_EMPTY;
    return new Intl.NumberFormat(language, { numberingSystem: 'latn', maximumFractionDigits: 3, ...options }).format(Number(value));
  };
  return {
    number,
    quantity: (value: PrintValue) => number(value),
    currency: (value: PrintValue, currency: string) => number(value, { style: 'currency', currency, minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    percent: (value: PrintValue) => number(value, { style: 'percent', maximumFractionDigits: 2 }),
    duration: (minutes: PrintValue) => number(minutes, { maximumFractionDigits: 2 }),
    date: (value: PrintValue | Date) => date(value, { year: 'numeric', month: '2-digit', day: '2-digit' }),
    // Date-only filters are calendar boundaries, not UTC instants to shift across timezones.
    dateOnly: (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value)
      ? printFormatters(locale, 'UTC').date(value + 'T12:00:00Z') : PRINT_EMPTY,
    time: (value: PrintValue | Date) => date(value, { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }),
    dateTime: (value: PrintValue | Date) => date(value, { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }),
  };
}

export class PrintPreparationError extends Error {
  constructor(public readonly key: 'unavailable' | 'limitExceeded' | 'dataChanged' | 'contextChanged') { super(key); }
}

export interface PrintPage<Row> { rows: Row[]; total: number; page: number; pageSize: number; totalPages: number }

/** Bounded all-results read. Never silently print one pagination page or a partial fetch. */
export async function collectPrintRows<Row>(
  load: (page: number, pageSize: number) => Promise<PrintPage<Row>>,
  assertScope: () => void,
  identity?: (row: Row) => string,
  pageSize: number = PRINT_PAGE_SIZE,
): Promise<{ rows: Row[]; first: PrintPage<Row> }> {
  if (!Number.isSafeInteger(pageSize) || pageSize <= 0 || pageSize > PRINT_ROW_LIMIT) throw new PrintPreparationError('dataChanged');
  const rows: Row[] = [], seen = new Set<string>();
  let first: PrintPage<Row> | undefined;
  for (let page = 1; page <= Math.ceil(PRINT_ROW_LIMIT / pageSize); page++) {
    assertScope();
    const result = await load(page, pageSize);
    assertScope();
    if (!result || !Array.isArray(result.rows) || !Number.isSafeInteger(result.total) || result.total < 0 || Number(result.page) !== page) throw new PrintPreparationError('dataChanged');
    if (result.total > PRINT_ROW_LIMIT) throw new PrintPreparationError('limitExceeded');
    if (!first) first = result;
    if (result.total !== first.total || Number(result.pageSize) !== pageSize || Number(result.totalPages) !== Math.ceil(result.total / pageSize)) throw new PrintPreparationError('dataChanged');
    const expected = Math.min(pageSize, Math.max(0, result.total - rows.length));
    if (result.rows.length !== expected) throw new PrintPreparationError('dataChanged');
    for (const row of result.rows) {
      if (identity) { const id = identity(row); if (!id || seen.has(id)) throw new PrintPreparationError('dataChanged'); seen.add(id); }
      rows.push(row);
    }
    if (rows.length === result.total) return { rows, first };
  }
  throw new PrintPreparationError('limitExceeded');
}
