import { printFormatters, PrintPreparationError, type PrintField } from '../../lib/print';
import { translateMovementSourceType, translateMovementType, translateStatus } from '../../lib/i18n/literals';
import type { Locale } from '../../lib/i18n/types';
import type { PrintTranslate } from './PrintDocument';
import type { PreparedReportPrint, ReportPrintSnapshot } from './use-report-print-snapshot';
import {
  buildMovementRegisterPrint,
  type MovementRegisterPrintData,
  type MovementRegisterRow,
} from './inventory-movement-register-print';

export type LedgerRegisterRow = MovementRegisterRow;
export type LedgerRegisterPrintData = MovementRegisterPrintData;

/**
 * Ledger entry point to the shared InventoryMovement REGISTER model. Filter
 * metadata is the only Ledger-specific part; rows and columns stay canonical.
 * Readable warehouse/product labels are mandatory so a raw internal id can
 * never reach the printed filter summary.
 */
export function inventoryLedgerPrintModel(
  snapshot: ReportPrintSnapshot<LedgerRegisterPrintData>,
  t: PrintTranslate,
  locale: Locale,
): PreparedReportPrint {
  const { data, params, labels } = snapshot;
  const fmt = printFormatters(locale);
  const filters: PrintField[] = [];

  if (params.search) filters.push({ label: t('inventoryLedger.search'), value: String(params.search) });
  if (params.warehouseId) {
    if (!labels.warehouseId) throw new PrintPreparationError('unavailable');
    filters.push({ label: t('reports.warehouse'), value: labels.warehouseId });
  }
  if (params.productId) {
    if (!labels.productId) throw new PrintPreparationError('unavailable');
    filters.push({ label: t('inventoryLedger.product'), value: labels.productId });
  }
  if (params.movementType) filters.push({ label: t('inventoryLedger.movementType'), value: translateMovementType(String(params.movementType), locale) });
  if (params.status) filters.push({ label: t('inventoryLedger.status'), value: translateStatus(String(params.status), locale) });
  if (params.direction) filters.push({ label: t('inventoryLedger.direction'), value: translateStatus(String(params.direction), locale) });
  if (params.sourceType) filters.push({ label: t('inventoryLedger.sourceType'), value: translateMovementSourceType(String(params.sourceType), locale) });
  if (params.dateFrom) filters.push({ label: t('reports.dateFrom'), value: fmt.dateOnly(String(params.dateFrom)), direction: 'ltr' });
  if (params.dateTo) filters.push({ label: t('reports.dateTo'), value: fmt.dateOnly(String(params.dateTo)), direction: 'ltr' });

  return buildMovementRegisterPrint({
    data,
    title: t('inventoryLedger.title'),
    filters,
    periodStart: params.dateFrom ? String(params.dateFrom) : undefined,
    periodEnd: params.dateTo ? String(params.dateTo) : undefined,
  }, t, locale);
}
