import { printFormatters, PrintPreparationError, type PrintColumn, type PrintDocumentModel, type PrintSection } from '../../lib/print';
import { translateEnum } from '../../lib/i18n/literals';
import type { Locale } from '../../lib/i18n/types';
import type { InventoryStockAdjustment, InventoryStockAdjustmentLine } from '../../lib/admin-types';
import type { PrintTranslate } from './PrintDocument';

/**
 * Inventory Stock Adjustment business document.
 *
 * Canonical detail read: `GET /inventory/stock-adjustments/:id` (re-read at
 * print time). The document is a single-warehouse adjustment with one line per
 * product. `adjustmentType` (`ADJUSTMENT_IN` / `ADJUSTMENT_OUT`) is the stored
 * direction and `quantity` is the stored positive quantity; the sign is never
 * derived from the quantity and the quantity is never negated or absolute-valued.
 *
 * The canonical detail contract does not expose before/after quantities or a
 * live InventoryBalance, so none is printed or derived. It also does not expose
 * the warehouse-location relation or the movement relation, so the location and
 * movement business reference are omitted instead of being replaced by raw ids.
 *
 * `unitCost`/`currencyCode` are stored transaction values and are printed only
 * when recorded on the line (typically ADJUSTMENT_IN). No line value, document
 * total or valuation is computed. `product.unit` is the only UOM available; the
 * detail contract carries no historical per-line UOM snapshot.
 *
 * Internal ids, foreign keys, lock fields, request ids, user ids and `_count`
 * are never printed. Quantities with different or missing units are never summed.
 */

interface InventoryStockAdjustmentPrintRow {
  lineNumber: number;
  line: InventoryStockAdjustmentLine;
}

function warehouseLabel(data: InventoryStockAdjustment): string | undefined {
  const warehouse = data.warehouse;
  if (!warehouse) return undefined;
  if (warehouse.code && warehouse.name) return `[${warehouse.code}] ${warehouse.name}`;
  return warehouse.name || warehouse.code || undefined;
}

function sortedLines(lines: InventoryStockAdjustmentLine[]): InventoryStockAdjustmentLine[] {
  // Deterministic business ordering by product code and direction. The internal
  // id is a tie-break only and is never rendered.
  return [...lines].sort((left, right) => {
    const leftCode = left.product?.code || '';
    const rightCode = right.product?.code || '';
    if (leftCode !== rightCode) return leftCode.localeCompare(rightCode);
    const leftType = left.adjustmentType || '';
    const rightType = right.adjustmentType || '';
    if (leftType !== rightType) return leftType.localeCompare(rightType);
    return left.id.localeCompare(right.id);
  });
}

function hasUnitCost(line: InventoryStockAdjustmentLine): boolean {
  return line.unitCost != null && line.unitCost !== '' && Number.isFinite(Number(line.unitCost));
}

function lineColumns(t: PrintTranslate, locale: Locale, rows: InventoryStockAdjustmentPrintRow[]): PrintColumn<InventoryStockAdjustmentPrintRow>[] {
  const fmt = printFormatters(locale);
  const columns: PrintColumn<InventoryStockAdjustmentPrintRow>[] = [
    { key: 'rowNumber', label: t('reports.printDocument.rowNumber'), value: row => row.lineNumber, format: value => fmt.number(value), align: 'center', priority: 1, width: 4 },
    { key: 'productCode', label: t('inventory.productCode'), value: row => row.line.product?.code, align: 'start', priority: 1, width: 14, direction: 'ltr' },
    { key: 'productName', label: t('inventory.productName'), value: row => row.line.product?.name, align: 'start', priority: 1, width: 24 },
    { key: 'adjustmentType', label: t('common.type'), value: row => translateEnum(row.line.adjustmentType, locale), align: 'center', priority: 1, width: 12 },
    { key: 'quantity', label: t('inventoryCounting.quantity'), value: row => row.line.quantity, format: value => fmt.quantity(value), align: 'end', priority: 1, width: 11 },
    { key: 'unit', label: t('inventoryCounting.unit'), value: row => row.line.product?.unit, align: 'center', priority: 2, width: 8 },
  ];
  if (rows.some(row => hasUnitCost(row.line))) {
    columns.push({ key: 'unitCost', label: t('inventoryValuation.unitCost'), value: row => row.line.unitCost, format: value => fmt.number(value, { maximumFractionDigits: 6 }), align: 'end', priority: 3, width: 13 });
  }
  if (rows.some(row => Boolean(row.line.currencyCode))) {
    columns.push({ key: 'currency', label: t('inventoryValuation.currency'), value: row => row.line.currencyCode, align: 'center', priority: 3, width: 8, direction: 'ltr' });
  }
  if (rows.some(row => Boolean(row.line.valuationReason))) {
    columns.push({ key: 'valuationReason', label: t('inventoryValuation.valuationReason'), value: row => row.line.valuationReason, align: 'start', priority: 4, width: 18 });
  }
  if (rows.some(row => Boolean(row.line.notes))) {
    columns.push({ key: 'lineNotes', label: t('inventoryCounting.notes'), value: row => row.line.notes, align: 'start', priority: 4, width: 20 });
  }
  return columns;
}

function noteLines(value: string | null | undefined): string[] {
  if (!value) return [];
  return value.split(/\r?\n/).map(part => part.trim()).filter(Boolean);
}

export function inventoryStockAdjustmentDocumentModel(
  data: InventoryStockAdjustment,
  t: PrintTranslate,
  locale: Locale,
): Omit<PrintDocumentModel, 'locale' | 'company' | 'branch' | 'printedBy' | 'printedAt' | 'timeZone'> {
  if (!data || !data.code) throw new PrintPreparationError('unavailable');
  const fmt = printFormatters(locale);
  const lines = sortedLines(Array.isArray(data.lines) ? data.lines : []);
  const rows: InventoryStockAdjustmentPrintRow[] = lines.map((line, index) => ({ lineNumber: index + 1, line }));
  const optionalDate = (value: string | null | undefined) => (value ? fmt.dateTime(value) : undefined);

  const metadata = [
    { label: t('common.status'), value: translateEnum(data.status, locale) },
    { label: t('inventoryCounting.documentDate'), value: data.documentDate ? fmt.date(data.documentDate) : undefined },
    { label: t('inventoryCounting.warehouse'), value: warehouseLabel(data) },
    { label: t('inventoryCounting.reason'), value: data.reason || undefined },
    { label: t('inventoryCounting.submittedAt'), value: optionalDate(data.submittedAt) },
    { label: t('inventoryCounting.approvedAt'), value: optionalDate(data.approvedAt) },
    { label: t('inventoryCounting.rejectedAt'), value: optionalDate(data.rejectedAt) },
    { label: t('inventoryCounting.postedAt'), value: optionalDate(data.postedAt) },
    { label: t('inventoryCounting.cancelledAt'), value: optionalDate(data.cancelledAt) },
    { label: t('common.createdAt'), value: optionalDate(data.createdAt) },
    { label: t('common.updatedAt'), value: optionalDate(data.updatedAt) },
  ];
  const summary = [{ label: t('inventoryCounting.lineCount'), value: fmt.number(lines.length) }];
  const sections: PrintSection<InventoryStockAdjustmentPrintRow>[] = [
    { title: t('inventoryCounting.lines'), columns: lineColumns(t, locale, rows), rows },
  ];

  const notes = [t('reports.printDocument.stockAdjustmentDocumentNote'), ...noteLines(data.notes)];

  return {
    mode: 'DOCUMENT',
    title: t('inventoryCounting.stockAdjustment'),
    documentNumber: data.code,
    metadata,
    summary,
    sections,
    notes,
    orientation: 'portrait',
    paperSize: 'A4',
    scopeLabel: t('reports.printDocument.stockAdjustmentDocumentScope'),
  };
}
