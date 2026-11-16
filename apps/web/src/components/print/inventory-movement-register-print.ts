import { printFormatters, type PrintColumn, type PrintField, type PrintPage } from '../../lib/print';
import { translateEnum, translateMovementType } from '../../lib/i18n/literals';
import type { Locale } from '../../lib/i18n/types';
import type { PrintTranslate } from './PrintDocument';
import type { PreparedReportPrint } from './use-report-print-snapshot';

/**
 * One shared InventoryMovement register row contract. The Ledger and the
 * Inventory Movements report are two entry points to the same header-level
 * business record; only route metadata (title, filters, scope note) differs.
 */
export interface MovementRegisterRow {
  id: string; movementNumber: string; movementDate?: string | null; movementType: string;
  warehouse?: { name?: string; code?: string } | null; status: string; notes?: string | null;
}
export type MovementRegisterPrintData = PrintPage<MovementRegisterRow>;

export interface MovementRegisterPrintInput {
  data: MovementRegisterPrintData;
  title: string;
  filters?: PrintField[];
  notes?: string[];
  periodStart?: string;
  periodEnd?: string;
}

/** Canonical six business columns. One row per movement header, never per line. */
export function movementRegisterColumns(t: PrintTranslate, locale: Locale): PrintColumn<MovementRegisterRow>[] {
  const fmt = printFormatters(locale);
  return [
    { key: 'movementNumber', label: t('inventoryCounting.movementNumber'), value: row => row.movementNumber, align: 'start', priority: 1, width: 19, direction: 'ltr' },
    { key: 'movementDate', label: t('common.date'), value: row => fmt.date(row.movementDate), align: 'center', priority: 1, width: 17, direction: 'ltr' },
    { key: 'movementType', label: t('inventoryCounting.movementType'), value: row => translateMovementType(row.movementType, locale), align: 'start', priority: 1, width: 18 },
    { key: 'warehouse', label: t('reports.warehouse'), value: row => row.warehouse?.name || row.warehouse?.code, align: 'start', priority: 1, width: 21 },
    { key: 'status', label: t('reports.status'), value: row => translateEnum(row.status, locale), align: 'start', priority: 1, width: 15 },
    { key: 'notes', label: t('common.notes'), value: row => row.notes, align: 'start', priority: 2, width: 25 },
  ];
}

/**
 * Builds the accepted REGISTER document shape. Shared notes enforce the
 * header-only and no-mixed-UOM rules; callers may append route-specific notes
 * but must not restate or widen the business columns.
 */
export function buildMovementRegisterPrint(
  input: MovementRegisterPrintInput,
  t: PrintTranslate,
  locale: Locale,
): PreparedReportPrint {
  const fmt = printFormatters(locale);
  return {
    mode: 'REGISTER',
    title: input.title,
    paperSize: 'A4',
    orientation: 'portrait',
    scopeLabel: t('reports.printDocument.allFiltered'),
    filters: input.filters || [],
    periodStart: input.periodStart,
    periodEnd: input.periodEnd,
    summary: [{ label: t('reports.totalMovements'), value: fmt.number(input.data.total) }],
    sections: [{ columns: movementRegisterColumns(t, locale), rows: input.data.rows }],
    notes: [t('reports.printDocument.movementHeadersOnly'), t('reports.printDocument.inventoryMixedUnits'), ...(input.notes || [])],
  };
}
