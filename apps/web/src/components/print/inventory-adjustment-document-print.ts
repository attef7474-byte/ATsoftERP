import { printFormatters, PrintPreparationError, type PrintColumn, type PrintDocumentModel, type PrintSection } from '../../lib/print';
import { translateEnum } from '../../lib/i18n/literals';
import type { Locale } from '../../lib/i18n/types';
import type { InventoryAdjustment, InventoryAdjustmentLine } from '../../lib/admin-types';
import type { PrintTranslate } from './PrintDocument';

/**
 * Inventory Adjustment business document.
 *
 * Canonical detail read: `GET /inventory/adjustments/:id` (re-read at print time).
 * The adjustment is a single-warehouse document with one line per product/location
 * carrying the recorded count-time snapshot quantities: systemQty, countedQty and
 * the stored differenceQty (countedQty - systemQty, keeping the domain sign).
 *
 * The system quantity is the stored snapshot captured on the adjustment line; it is
 * never the current InventoryBalance. differenceQty is the canonical stored value and
 * is never recalculated from current stock or derived as a new "after" quantity.
 * No after-quantity is stored and the document must not compute one.
 *
 * Legacy adjustment posting creates no InventoryMovement, so there is no movement
 * reference to print. The adjustment has no type/method field and none is invented.
 * The detail contract does not expose cost/value, lot/batch/serial or readable user
 * identities, so those are omitted rather than replaced with identifiers.
 *
 * Internal ids, foreign keys, lock fields, request ids and _count are never printed.
 * The only visible cross-reference is the linked inventory count number when present.
 * Quantities with different or missing units are never summed and no quantity total
 * or valuation is computed.
 */

interface InventoryAdjustmentPrintRow {
  lineNumber: number;
  line: InventoryAdjustmentLine;
}

function warehouseLabel(data: InventoryAdjustment): string | undefined {
  const warehouse = data.warehouse;
  if (!warehouse) return undefined;
  if (warehouse.code && warehouse.name) return `[${warehouse.code}] ${warehouse.name}`;
  return warehouse.name || warehouse.code || undefined;
}

function locationLabel(line: InventoryAdjustmentLine): string | undefined {
  const location = line.warehouseLocation;
  if (!location) return undefined;
  if (location.code && location.name) return `[${location.code}] ${location.name}`;
  return location.name || location.code || undefined;
}

function sortedLines(lines: InventoryAdjustmentLine[]): InventoryAdjustmentLine[] {
  // Deterministic business ordering. The internal id is a tie-break only and is
  // never rendered: repeated product codes are separated by their location.
  return [...lines].sort((left, right) => {
    const leftCode = left.product?.code || '';
    const rightCode = right.product?.code || '';
    if (leftCode !== rightCode) return leftCode.localeCompare(rightCode);
    const leftLocation = left.warehouseLocation?.code || '';
    const rightLocation = right.warehouseLocation?.code || '';
    if (leftLocation !== rightLocation) return leftLocation.localeCompare(rightLocation);
    return left.id.localeCompare(right.id);
  });
}

function lineColumns(t: PrintTranslate, locale: Locale, rows: InventoryAdjustmentPrintRow[]): PrintColumn<InventoryAdjustmentPrintRow>[] {
  const fmt = printFormatters(locale);
  const columns: PrintColumn<InventoryAdjustmentPrintRow>[] = [
    { key: 'rowNumber', label: t('reports.printDocument.rowNumber'), value: row => row.lineNumber, format: value => fmt.number(value), align: 'center', priority: 1, width: 4 },
    { key: 'productCode', label: t('inventory.productCode'), value: row => row.line.product?.code, align: 'start', priority: 1, width: 14, direction: 'ltr' },
    { key: 'productName', label: t('inventory.productName'), value: row => row.line.product?.name, align: 'start', priority: 1, width: 24 },
    { key: 'unit', label: t('inventoryCounting.unit'), value: row => row.line.product?.unit, align: 'center', priority: 2, width: 8 },
    { key: 'systemQty', label: t('inventoryCounting.systemQty'), value: row => row.line.systemQty, format: value => fmt.quantity(value), align: 'end', priority: 1, width: 11 },
    { key: 'countedQty', label: t('inventoryCounting.countedQty'), value: row => row.line.countedQty, format: value => fmt.quantity(value), align: 'end', priority: 1, width: 11 },
    { key: 'differenceQty', label: t('inventoryCounting.differenceQty'), value: row => row.line.differenceQty, format: value => fmt.quantity(value), align: 'end', priority: 1, width: 11 },
  ];
  if (rows.some(row => Boolean(locationLabel(row.line)))) {
    columns.push({ key: 'location', label: t('inventoryCounting.warehouseLocation'), value: row => locationLabel(row.line), align: 'start', priority: 2, width: 16 });
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

export function inventoryAdjustmentDocumentModel(
  data: InventoryAdjustment,
  t: PrintTranslate,
  locale: Locale,
): Omit<PrintDocumentModel, 'locale' | 'company' | 'branch' | 'printedBy' | 'printedAt' | 'timeZone'> {
  if (!data || !data.adjustmentNumber) throw new PrintPreparationError('unavailable');
  const fmt = printFormatters(locale);
  const lines = sortedLines(Array.isArray(data.lines) ? data.lines : []);
  const rows: InventoryAdjustmentPrintRow[] = lines.map((line, index) => ({ lineNumber: index + 1, line }));
  const optionalDate = (value: string | null | undefined) => (value ? fmt.dateTime(value) : undefined);
  const countNumber = data.inventoryCount?.countNumber;

  const metadata = [
    { label: t('common.status'), value: translateEnum(data.status, locale) },
    { label: t('inventoryCounting.adjustmentDate'), value: data.adjustmentDate ? fmt.date(data.adjustmentDate) : undefined },
    { label: t('inventoryCounting.warehouse'), value: warehouseLabel(data) },
    { label: t('inventoryCounting.reason'), value: data.reason || undefined },
    { label: t('inventoryCounting.count'), value: countNumber || undefined },
    { label: t('inventoryCounting.postedAt'), value: optionalDate(data.postedAt) },
    { label: t('inventoryCounting.cancelledAt'), value: optionalDate(data.cancelledAt) },
    { label: t('common.createdAt'), value: optionalDate(data.createdAt) },
    { label: t('common.updatedAt'), value: optionalDate(data.updatedAt) },
  ];
  const summary = [
    { label: t('inventoryCounting.lineCount'), value: fmt.number(lines.length) },
  ];
  const sections: PrintSection<InventoryAdjustmentPrintRow>[] = [
    { title: t('details.inventoryAdjustment.lines'), columns: lineColumns(t, locale, rows), rows },
  ];

  const notes = [t('reports.printDocument.adjustmentDocumentNote'), ...noteLines(data.notes)];

  return {
    mode: 'DOCUMENT',
    title: t('inventoryCounting.adjustment'),
    documentNumber: data.adjustmentNumber,
    metadata,
    summary,
    sections,
    notes,
    orientation: 'portrait',
    paperSize: 'A4',
    scopeLabel: t('reports.printDocument.adjustmentDocumentScope'),
  };
}
