import { PrintPreparationError, type PrintPage } from '../../lib/print';
import { translateEnum } from '../../lib/i18n/literals';
import type { Locale } from '../../lib/i18n/types';
import type { PrintTranslate } from './PrintDocument';
import type { PreparedReportPrint, ReportPrintSnapshot } from './use-report-print-snapshot';
import { buildMovementRegisterPrint, type MovementRegisterRow } from './inventory-movement-register-print';

/** @deprecated Prefer the shared `MovementRegisterRow` contract. */
export type MovementPrintRow = MovementRegisterRow;
export type MovementsPrintData = PrintPage<MovementRegisterRow>;
export function inventoryMovementsPrintModel(snapshot: ReportPrintSnapshot<MovementsPrintData>, t: PrintTranslate, locale: Locale): PreparedReportPrint {
  const { data, params, labels } = snapshot, filters = [];
  if (params.warehouseId) {
    if (!labels.warehouseId) throw new PrintPreparationError('unavailable');
    filters.push({ label: t('reports.warehouse'), value: labels.warehouseId });
  }
  if (params.countStatus) filters.push({ label: t('reports.status'), value: `${translateEnum(String(params.countStatus), locale)} — ${t('reports.printDocument.notApplied')}` });
  return buildMovementRegisterPrint({
    data,
    title: t('reports.movementsReport'),
    filters,
    periodStart: params.dateFrom ? String(params.dateFrom) : undefined,
    periodEnd: params.dateTo ? String(params.dateTo) : undefined,
    notes: params.countStatus ? [t('reports.printDocument.inventoryStatusNotApplied')] : [],
  }, t, locale);
}
