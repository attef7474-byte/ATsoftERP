import { printFormatters, PrintPreparationError, type PrintColumn, type PrintPage } from '../../lib/print';
import type { Locale } from '../../lib/i18n/types';
import type { PrintTranslate } from './PrintDocument';
import type { PreparedReportPrint, ReportPrintSnapshot } from './use-report-print-snapshot';

export interface BalancePrintRow {
  id: string; product?: { code?: string; name?: string } | null; warehouse?: { name?: string; code?: string } | null;
  location?: { name?: string; code?: string } | null; quantity: number | string; updatedAt?: string | null;
}
export type BalancesPrintData = PrintPage<BalancePrintRow>;
export function inventoryBalancesPrintModel(snapshot: ReportPrintSnapshot<BalancesPrintData>, t: PrintTranslate, locale: Locale): PreparedReportPrint {
  const { data, params, labels } = snapshot, fmt = printFormatters(locale), filters = [];
  for (const [key, label] of [['warehouseId', 'reports.warehouse'], ['productId', 'reports.product']]) if (params[key]) {
    if (!labels[key]) throw new PrintPreparationError('unavailable');
    filters.push({ label: t(label), value: labels[key] });
  }
  const columns: PrintColumn<BalancePrintRow>[] = [
    { key: 'productCode', label: t('common.code'), value: row => row.product?.code, align: 'start', priority: 1, width: 16, direction: 'ltr' },
    { key: 'product', label: t('reports.product'), value: row => row.product?.name, align: 'start', priority: 1, width: 23 },
    { key: 'warehouse', label: t('reports.warehouse'), value: row => row.warehouse?.name || row.warehouse?.code, align: 'start', priority: 1, width: 19 },
    { key: 'location', label: t('reports.warehouseLocation'), value: row => row.location?.name || row.location?.code, align: 'start', priority: 2, width: 14 },
    { key: 'quantity', label: t('inventoryCounting.quantity'), value: row => fmt.quantity(row.quantity), align: 'end', priority: 1, width: 14, direction: 'ltr' },
    { key: 'updatedAt', label: t('common.updatedAt'), value: row => fmt.date(row.updatedAt), align: 'center', priority: 2, width: 18, direction: 'ltr' },
  ];
  return {
    mode: 'REPORT', title: t('reports.balancesReport'), paperSize: 'A4', orientation: 'portrait', scopeLabel: t('reports.printDocument.allFiltered'), filters,
    summary: [{ label: t('reports.totalBalanceRows'), value: fmt.number(data.total) }], sections: [{ columns, rows: data.rows }],
    notes: [t('reports.printDocument.balanceContract'), t('reports.printDocument.inventoryMixedUnits')],
  };
}
