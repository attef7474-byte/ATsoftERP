import { printFormatters, PrintPreparationError, type PrintColumn, type PrintDocumentModel, type PrintSection } from '../../lib/print';
import { translateEnum } from '../../lib/i18n/literals';
import type { Locale } from '../../lib/i18n/types';
import type { InventoryCount, InventoryCountLine } from '../../lib/admin-types';
import type { PrintTranslate } from './PrintDocument';

/**
 * Inventory Count business document.
 *
 * Canonical count family: `InventoryCount` behind `/admin/inventory/counts`
 * (the navigation entry `inventoryCounts`, also linked from barcode quick links,
 * adjustments, F9 and search). The second, newer `InventoryPhysicalCount` family
 * is a separate workflow and is not printed here; one count family is printed so
 * the shared engine does not gain a duplicate document contract.
 *
 * Document source: the print action re-reads
 * `GET /inventory/counts/:id/results` at print time. That endpoint is
 * count-scoped, requires only `inventory-count:read`, and internally re-runs the
 * same `findOne` tenant/warehouse scope as the canonical `GET /inventory/counts/:id`.
 * It is used because the legacy `GET /inventory/counts/:id` select omits the
 * product unit while this read returns the recorded UOM for every count line; a
 * backend contract change is out of scope for this print phase.
 *
 * The count records `InventoryCountLine.systemQty` when the line is created (or
 * an authorized explicit override) and never refreshes it afterwards. That stored
 * value is the only book quantity printed; the current InventoryBalance is never
 * read or substituted. `differenceQty` is the canonical stored value computed as
 * `countedQty - systemQty`, so the document keeps the domain sign convention and
 * never recalculates a variance from current stock.
 *
 * The domain has no blind-count mode, hidden expected quantity, variance masking,
 * recount round, or multiple independent counters: the existing detail screen
 * always shows system/counted/difference values to a reader with
 * `inventory-count:read`, so the document shows exactly the same fields. Nothing
 * is added that the authorized screen does not already expose.
 *
 * Internal ids, foreign keys, user ids, lock fields and request ids are never
 * printed. Counter/verifier identities are omitted because the contract supplies
 * only ids, never readable names. The count has no type/method field, so no type
 * label is invented. Quantities with different or missing units are never
 * summed, and no valuation is computed.
 */

export interface InventoryCountDocumentSource {
  count: InventoryCount;
  lines: InventoryCountLine[];
}

interface InventoryCountPrintRow {
  lineNumber: number;
  line: InventoryCountLine;
}

function warehouseLabel(data: InventoryCount): string | undefined {
  const warehouse = data.warehouse;
  if (!warehouse) return undefined;
  if (warehouse.code && warehouse.name) return `[${warehouse.code}] ${warehouse.name}`;
  return warehouse.name || warehouse.code || undefined;
}

function locationLabel(line: InventoryCountLine): string | undefined {
  const location = line.warehouseLocation;
  if (!location) return undefined;
  if (location.code && location.name) return `[${location.code}] ${location.name}`;
  return location.name || location.code || undefined;
}

function sortedLines(lines: InventoryCountLine[]): InventoryCountLine[] {
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

function lineColumns(t: PrintTranslate, locale: Locale, rows: InventoryCountPrintRow[]): PrintColumn<InventoryCountPrintRow>[] {
  const fmt = printFormatters(locale);
  const columns: PrintColumn<InventoryCountPrintRow>[] = [
    { key: 'rowNumber', label: t('reports.printDocument.rowNumber'), value: row => row.lineNumber, format: value => fmt.number(value), align: 'center', priority: 1, width: 4 },
    { key: 'productCode', label: t('inventory.productCode'), value: row => row.line.product?.code, align: 'start', priority: 1, width: 14, direction: 'ltr' },
    { key: 'productName', label: t('inventory.productName'), value: row => row.line.product?.name, align: 'start', priority: 1, width: 24 },
    { key: 'unit', label: t('inventoryCounting.unit'), value: row => row.line.product?.unit, align: 'center', priority: 2, width: 8 },
    { key: 'systemQty', label: t('inventoryCounting.systemQty'), value: row => row.line.systemQty, format: value => fmt.quantity(value), align: 'end', priority: 1, width: 11 },
    { key: 'countedQty', label: t('inventoryCounting.countedQty'), value: row => row.line.countedQty, format: value => fmt.quantity(value), align: 'end', priority: 1, width: 11 },
    { key: 'differenceQty', label: t('inventoryCounting.differenceQty'), value: row => row.line.differenceQty, format: value => fmt.quantity(value), align: 'end', priority: 1, width: 11 },
    { key: 'lineStatus', label: t('common.status'), value: row => translateEnum(row.line.status, locale), align: 'center', priority: 3, width: 9 },
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

export function inventoryCountDocumentModel(
  source: InventoryCountDocumentSource,
  t: PrintTranslate,
  locale: Locale,
): Omit<PrintDocumentModel, 'locale' | 'company' | 'branch' | 'printedBy' | 'printedAt' | 'timeZone'> {
  const data = source?.count;
  if (!data || !data.countNumber) throw new PrintPreparationError('unavailable');
  const fmt = printFormatters(locale);
  const lines = sortedLines(Array.isArray(source.lines) ? source.lines : []);
  const rows: InventoryCountPrintRow[] = lines.map((line, index) => ({ lineNumber: index + 1, line }));
  const optionalDate = (value: string | null | undefined) => (value ? fmt.dateTime(value) : undefined);
  const countedLines = lines.filter(line => line.countedQty != null).length;
  const verifiedLines = lines.filter(line => line.status === 'VERIFIED').length;

  const metadata = [
    { label: t('common.status'), value: translateEnum(data.status, locale) },
    { label: t('inventoryCounting.countDate'), value: data.countDate ? fmt.date(data.countDate) : undefined },
    { label: t('inventoryCounting.warehouse'), value: warehouseLabel(data) },
    { label: t('inventoryCounting.startedAt'), value: optionalDate(data.startedAt) },
    { label: t('inventoryCounting.completedAt'), value: optionalDate(data.completedAt) },
    { label: t('inventoryCounting.cancelledAt'), value: optionalDate(data.cancelledAt) },
    { label: t('common.createdAt'), value: optionalDate(data.createdAt) },
    { label: t('common.updatedAt'), value: optionalDate(data.updatedAt) },
  ];
  const summary = [
    { label: t('inventoryCounting.lineCount'), value: fmt.number(lines.length) },
    { label: t('inventoryCounting.countedLinesCount'), value: fmt.number(countedLines) },
    { label: t('inventoryCounting.verifiedLinesCount'), value: fmt.number(verifiedLines) },
  ];
  const sections: PrintSection<InventoryCountPrintRow>[] = [
    { title: t('inventoryCounting.lines'), columns: lineColumns(t, locale, rows), rows },
  ];

  const notes = [t('reports.printDocument.countDocumentNote'), ...noteLines(data.notes)];

  return {
    mode: 'DOCUMENT',
    title: t('inventoryCounting.count'),
    documentNumber: data.countNumber,
    metadata,
    summary,
    sections,
    notes,
    orientation: 'portrait',
    paperSize: 'A4',
    scopeLabel: t('reports.printDocument.countDocumentScope'),
  };
}
