import { printFormatters, PrintPreparationError, type PrintColumn, type PrintPage } from '../../lib/print';
import { translateEnum } from '../../lib/i18n/literals';
import type { Locale } from '../../lib/i18n/types';
import type { PrintTranslate } from './PrintDocument';
import type { PreparedReportPrint, ReportPrintSnapshot } from './use-report-print-snapshot';

export interface AdjustmentPrintRow {
  id: string; adjustmentNumber: string; adjustmentDate?: string | null;
  warehouse?: { name?: string; code?: string } | null; status: string; reason?: string | null;
  inventoryCount?: { countNumber?: string } | null;
}
export type AdjustmentsPrintData = PrintPage<AdjustmentPrintRow>;
export function inventoryAdjustmentsPrintModel(snapshot: ReportPrintSnapshot<AdjustmentsPrintData>, t: PrintTranslate, locale: Locale): PreparedReportPrint {
  const { data, params, labels } = snapshot, fmt = printFormatters(locale), filters = [];
  if (params.warehouseId) {
    if (!labels.warehouseId) throw new PrintPreparationError('unavailable');
    filters.push({ label: t('reports.warehouse'), value: labels.warehouseId });
  }
  if (params.countStatus) filters.push({ label: t('reports.status'), value: `${translateEnum(String(params.countStatus), locale)} — ${t('reports.printDocument.notApplied')}` });
  const columns: PrintColumn<AdjustmentPrintRow>[] = [
    { key: 'adjustmentNumber', label: t('inventoryCounting.adjustmentNumber'), value: row => row.adjustmentNumber, align: 'start', priority: 1, width: 19, direction: 'ltr' },
    { key: 'adjustmentDate', label: t('common.date'), value: row => fmt.date(row.adjustmentDate), align: 'center', priority: 1, width: 17, direction: 'ltr' },
    { key: 'warehouse', label: t('reports.warehouse'), value: row => row.warehouse?.name || row.warehouse?.code, align: 'start', priority: 1, width: 21 },
    { key: 'reason', label: t('inventoryCounting.reason'), value: row => row.reason, align: 'start', priority: 1, width: 25 },
    { key: 'status', label: t('reports.status'), value: row => translateEnum(row.status, locale), align: 'start', priority: 1, width: 15 },
    { key: 'countNumber', label: t('reports.count'), value: row => row.inventoryCount?.countNumber, align: 'start', priority: 2, width: 19, direction: 'ltr' },
  ];
  return {
    mode: 'REGISTER', title: t('reports.adjustmentsReport'), paperSize: 'A4', orientation: 'portrait', scopeLabel: t('reports.printDocument.allFiltered'), filters,
    periodStart: params.dateFrom ? String(params.dateFrom) : undefined, periodEnd: params.dateTo ? String(params.dateTo) : undefined,
    summary: [{ label: t('reports.totalAdjustments'), value: fmt.number(data.total) }], sections: [{ columns, rows: data.rows }],
    notes: [t('reports.printDocument.adjustmentHeadersOnly'), t('reports.printDocument.inventoryMixedUnits'), ...(params.countStatus ? [t('reports.printDocument.inventoryStatusNotApplied')] : [])],
  };
}
