import { printFormatters, PrintPreparationError, type PrintColumn, type PrintDocumentModel, type PrintSection } from '../../lib/print';
import { translateEnum } from '../../lib/i18n/literals';
import type { Locale } from '../../lib/i18n/types';
import type { OpeningBalance, OpeningBalanceLine } from '../../lib/admin-types';
import type { PrintTranslate } from './PrintDocument';

/**
 * Inventory Opening Balance business document.
 *
 * The visible identity is the generated document number plus the product
 * code/name. Internal ids, foreign keys, lock fields, movement links and user
 * ids are never printed: the canonical detail contract returns several of them,
 * but a business document shows business references only.
 *
 * The contract does not return location names, lot/batch data, readable user
 * names or any line value/document total. Those fields are omitted rather than
 * inferred. Unit cost and currency are printed only when recorded on the line.
 * Quantities are never summed across different or missing units.
 */

interface OpeningBalancePrintRow {
  lineNumber: number;
  line: OpeningBalanceLine;
}

function warehouseLabel(data: OpeningBalance): string | undefined {
  const warehouse = data.warehouse;
  if (!warehouse) return undefined;
  if (warehouse.code && warehouse.name) return `[${warehouse.code}] ${warehouse.name}`;
  return warehouse.name || warehouse.code || undefined;
}

function lineColumns(t: PrintTranslate, locale: Locale, rows: OpeningBalancePrintRow[]): PrintColumn<OpeningBalancePrintRow>[] {
  const fmt = printFormatters(locale);
  const columns: PrintColumn<OpeningBalancePrintRow>[] = [
    { key: 'rowNumber', label: t('reports.printDocument.rowNumber'), value: row => row.lineNumber, format: value => fmt.number(value), align: 'center', priority: 1, width: 5 },
    { key: 'productCode', label: t('inventory.productCode'), value: row => row.line.product?.code, align: 'start', priority: 1, width: 16, direction: 'ltr' },
    { key: 'productName', label: t('inventory.productName'), value: row => row.line.product?.name, align: 'start', priority: 1, width: 30 },
    { key: 'quantity', label: t('inventoryCounting.quantity'), value: row => row.line.quantity, format: value => fmt.quantity(value), align: 'end', priority: 1, width: 12 },
    { key: 'unit', label: t('inventoryCounting.unit'), value: row => row.line.product?.unit, align: 'center', priority: 2, width: 9 },
  ];
  if (rows.some(row => row.line.unitCost != null && row.line.unitCost !== '')) {
    columns.push({ key: 'unitCost', label: t('inventoryValuation.unitCost'), value: row => row.line.unitCost, format: value => fmt.number(value), align: 'end', priority: 3, width: 14 });
  }
  if (rows.some(row => Boolean(row.line.currencyCode))) {
    columns.push({ key: 'currency', label: t('inventoryValuation.currency'), value: row => row.line.currencyCode, align: 'center', priority: 3, width: 9, direction: 'ltr' });
  }
  if (rows.some(row => Boolean(row.line.notes))) {
    columns.push({ key: 'lineNotes', label: t('inventoryCounting.notes'), value: row => row.line.notes, align: 'start', priority: 4, width: 22 });
  }
  return columns;
}

function noteLines(value: string | null | undefined): string[] {
  if (!value) return [];
  return value.split(/\r?\n/).map(part => part.trim()).filter(Boolean);
}

export function inventoryOpeningBalanceDocumentModel(
  data: OpeningBalance,
  t: PrintTranslate,
  locale: Locale,
): Omit<PrintDocumentModel, 'locale' | 'company' | 'branch' | 'printedBy' | 'printedAt' | 'timeZone'> {
  if (!data || !data.code) throw new PrintPreparationError('unavailable');
  const fmt = printFormatters(locale);
  const lines = Array.isArray(data.lines) ? data.lines : [];
  const rows: OpeningBalancePrintRow[] = lines.map((line, index) => ({ lineNumber: index + 1, line }));
  const optionalDate = (value: string | null | undefined) => (value ? fmt.dateTime(value) : undefined);

  const metadata = [
    { label: t('common.status'), value: translateEnum(data.status, locale) },
    { label: t('inventoryCounting.documentDate'), value: data.documentDate ? fmt.date(data.documentDate) : undefined },
    { label: t('inventoryCounting.warehouse'), value: warehouseLabel(data) },
    { label: t('inventoryCounting.reason'), value: data.reason },
    { label: t('inventoryCounting.postedAt'), value: optionalDate(data.postedAt) },
    { label: t('common.createdAt'), value: optionalDate(data.createdAt) },
    { label: t('common.updatedAt'), value: optionalDate(data.updatedAt) },
  ];
  const summary = [{ label: t('inventoryCounting.lineCount'), value: fmt.number(lines.length) }];
  const sections: PrintSection<OpeningBalancePrintRow>[] = [
    { title: t('inventoryCounting.lines'), columns: lineColumns(t, locale, rows), rows },
  ];

  const notes = [t('reports.printDocument.openingBalanceDocumentNote'), ...noteLines(data.notes)];

  return {
    mode: 'DOCUMENT',
    title: t('inventoryCounting.openingBalance'),
    documentNumber: data.code,
    metadata,
    summary,
    sections,
    notes,
    orientation: 'portrait',
    paperSize: 'A4',
    scopeLabel: t('reports.printDocument.openingBalanceDocumentScope'),
  };
}
