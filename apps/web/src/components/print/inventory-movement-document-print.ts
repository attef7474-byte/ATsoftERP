import { printFormatters, PrintPreparationError, type PrintColumn, type PrintDocumentModel, type PrintSection } from '../../lib/print';
import { translateEnum, translateMovementSourceType, translateMovementType } from '../../lib/i18n/literals';
import type { Locale } from '../../lib/i18n/types';
import type { InventoryMovement, InventoryMovementLine } from '../../lib/admin-types';
import type { PrintTranslate } from './PrintDocument';

/**
 * Inventory Movement business document.
 *
 * The canonical detail contract (`GET /inventory/movements/:id`) represents a
 * single-warehouse movement: the header carries one warehouse and every line
 * carries its own IN/OUT direction. There is no header-level direction field and
 * no source/destination warehouse pair, so the document prints the one warehouse
 * plus a per-line direction instead of empty "source/destination" labels.
 *
 * The visible identity is the generated movement number plus the product
 * code/name. Internal ids, foreign keys, request ids, lock fields, user ids and
 * the warehouse-location id are never printed. A line prints its recorded batch,
 * serial, expiry, unit cost, total cost and currency only when present; no
 * document quantity total is computed across units and no value is inferred.
 */

interface InventoryMovementPrintRow {
  lineNumber: number;
  line: InventoryMovementLine;
}

function warehouseLabel(data: InventoryMovement): string | undefined {
  const warehouse = data.warehouse;
  if (!warehouse) return undefined;
  if (warehouse.code && warehouse.name) return `[${warehouse.code}] ${warehouse.name}`;
  return warehouse.name || warehouse.code || undefined;
}

function lineColumns(t: PrintTranslate, locale: Locale, rows: InventoryMovementPrintRow[]): PrintColumn<InventoryMovementPrintRow>[] {
  const fmt = printFormatters(locale);
  const columns: PrintColumn<InventoryMovementPrintRow>[] = [
    { key: 'rowNumber', label: t('reports.printDocument.rowNumber'), value: row => row.lineNumber, format: value => fmt.number(value), align: 'center', priority: 1, width: 4 },
    { key: 'productCode', label: t('inventory.productCode'), value: row => row.line.product?.code, align: 'start', priority: 1, width: 14, direction: 'ltr' },
    { key: 'productName', label: t('inventory.productName'), value: row => row.line.product?.name, align: 'start', priority: 1, width: 26 },
    { key: 'quantity', label: t('inventoryCounting.quantity'), value: row => row.line.quantity, format: value => fmt.quantity(value), align: 'end', priority: 1, width: 10 },
    { key: 'unit', label: t('inventoryCounting.unit'), value: row => row.line.unit, align: 'center', priority: 1, width: 8 },
    { key: 'direction', label: t('inventoryCounting.direction'), value: row => translateEnum(row.line.direction, locale), align: 'center', priority: 1, width: 8 },
  ];
  if (rows.some(row => Boolean(row.line.batchNumber))) {
    columns.push({ key: 'batchNumber', label: t('inventoryCounting.batchNumber'), value: row => row.line.batchNumber, align: 'start', priority: 2, width: 12, direction: 'ltr' });
  }
  if (rows.some(row => Boolean(row.line.serialNumber))) {
    columns.push({ key: 'serialNumber', label: t('inventoryCounting.serialNumber'), value: row => row.line.serialNumber, align: 'start', priority: 2, width: 12, direction: 'ltr' });
  }
  if (rows.some(row => Boolean(row.line.expiryDate))) {
    columns.push({ key: 'expiryDate', label: t('inventoryCounting.expiryDate'), value: row => row.line.expiryDate, format: value => fmt.date(value), align: 'center', priority: 2, width: 11, direction: 'ltr' });
  }
  if (rows.some(row => row.line.unitCost != null && row.line.unitCost !== '')) {
    columns.push({ key: 'unitCost', label: t('inventoryValuation.unitCost'), value: row => row.line.unitCost, format: value => fmt.number(value), align: 'end', priority: 3, width: 12 });
  }
  if (rows.some(row => row.line.totalCost != null && row.line.totalCost !== '')) {
    columns.push({ key: 'totalCost', label: t('inventoryCounting.totalCost'), value: row => row.line.totalCost, format: value => fmt.number(value), align: 'end', priority: 3, width: 12 });
  }
  if (rows.some(row => Boolean(row.line.currencyCode))) {
    columns.push({ key: 'currency', label: t('inventoryValuation.currency'), value: row => row.line.currencyCode, align: 'center', priority: 3, width: 8, direction: 'ltr' });
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

export function inventoryMovementDocumentModel(
  data: InventoryMovement,
  t: PrintTranslate,
  locale: Locale,
): Omit<PrintDocumentModel, 'locale' | 'company' | 'branch' | 'printedBy' | 'printedAt' | 'timeZone'> {
  if (!data || !data.movementNumber) throw new PrintPreparationError('unavailable');
  const fmt = printFormatters(locale);
  const lines = Array.isArray(data.lines) ? data.lines : [];
  const rows: InventoryMovementPrintRow[] = lines.map((line, index) => ({ lineNumber: index + 1, line }));
  const optionalDate = (value: string | null | undefined) => (value ? fmt.dateTime(value) : undefined);

  const metadata = [
    { label: t('inventoryCounting.movementType'), value: translateMovementType(data.movementType, locale) },
    { label: t('common.status'), value: translateEnum(data.status, locale) },
    { label: t('inventoryCounting.movementDate'), value: data.movementDate ? fmt.date(data.movementDate) : undefined },
    { label: t('inventoryCounting.warehouse'), value: warehouseLabel(data) },
    { label: t('inventoryCounting.sourceType'), value: data.sourceType ? translateMovementSourceType(data.sourceType, locale) : undefined },
    { label: t('inventoryCounting.postedAt'), value: optionalDate(data.postedAt) },
    { label: t('inventoryCounting.cancelledAt'), value: optionalDate(data.cancelledAt) },
    { label: t('common.createdAt'), value: optionalDate(data.createdAt) },
    { label: t('common.updatedAt'), value: optionalDate(data.updatedAt) },
  ];
  const summary = [{ label: t('inventoryCounting.lineCount'), value: fmt.number(lines.length) }];
  const sections: PrintSection<InventoryMovementPrintRow>[] = [
    { title: t('inventoryCounting.lines'), columns: lineColumns(t, locale, rows), rows },
  ];

  const notes = [t('reports.printDocument.movementDocumentNote'), ...noteLines(data.notes)];

  return {
    mode: 'DOCUMENT',
    title: t('inventoryCounting.movement'),
    documentNumber: data.movementNumber,
    metadata,
    summary,
    sections,
    notes,
    orientation: 'portrait',
    paperSize: 'A4',
    scopeLabel: t('reports.printDocument.movementDocumentScope'),
  };
}
