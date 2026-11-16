import { printFormatters, PrintPreparationError, type PrintColumn, type PrintPage } from '../../lib/print';
import type { Locale } from '../../lib/i18n/types';
import type { PrintTranslate } from './PrintDocument';
import type { PreparedReportPrint, ReportPrintSnapshot } from './use-report-print-snapshot';

export interface PartsUsagePrintRow {
  id: string; request?: { requestNumber?: string } | null; product?: { name?: string; unit?: string } | null;
  quantity: number; totalCost?: number | null; createdAt: string;
}
export interface PartsUsagePrintData extends PrintPage<PartsUsagePrintRow> { cards: Array<{ label: string; value: number }> }
export function maintenancePartsUsagePrintModel(snapshot: ReportPrintSnapshot<PartsUsagePrintData>, t: PrintTranslate, locale: Locale): PreparedReportPrint {
  const { data, params, labels } = snapshot, fmt = printFormatters(locale), filters = [];
  for (const [key, label] of [['machineId', 'reports.machine'], ['productId', 'reports.product']]) if (params[key]) {
    if (!labels[key]) throw new PrintPreparationError('unavailable');
    filters.push({ label: t(label), value: labels[key] });
  }
  const columns: PrintColumn<PartsUsagePrintRow>[] = [
    { key: 'request', label: t('maintenance.requestNumber'), value: row => row.request?.requestNumber, align: 'start', priority: 1, width: 20, direction: 'ltr' },
    { key: 'product', label: t('reports.product'), value: row => row.product?.name, align: 'start', priority: 1, width: 26 },
    { key: 'quantity', label: t('inventoryCounting.quantity'), value: row => fmt.quantity(row.quantity), align: 'end', priority: 2, width: 12, direction: 'ltr' },
    { key: 'unit', label: t('maintenance.unit'), value: row => row.product?.unit, align: 'center', priority: 2, width: 8, direction: 'ltr' },
    { key: 'totalCost', label: t('reports.totalCost'), value: row => fmt.number(row.totalCost, { minimumFractionDigits: 2, maximumFractionDigits: 2 }), align: 'end', priority: 2, width: 16, direction: 'ltr' },
    { key: 'createdAt', label: t('common.createdAt'), value: row => fmt.date(row.createdAt), align: 'center', priority: 2, width: 18, direction: 'ltr' },
  ];
  return {
    mode: 'REPORT', title: t('reports.partsUsageReport'), paperSize: 'A4', orientation: 'portrait', scopeLabel: t('reports.printDocument.allFiltered'), filters,
    periodStart: params.dateFrom ? String(params.dateFrom) : undefined, periodEnd: params.dateTo ? String(params.dateTo) : undefined,
    summary: data.cards.filter(card => ['totalPartsUsageRows', 'totalCost'].includes(card.label)).map(card => ({ label: t(`reports.${card.label}`), value: fmt.number(card.value, card.label === 'totalCost' ? { minimumFractionDigits: 2, maximumFractionDigits: 2 } : {}) })),
    sections: [{ columns, rows: data.rows }], notes: [t('reports.printDocument.partsUsageUnitsNote'), t('reports.printDocument.costsLedgerNote')],
  };
}
