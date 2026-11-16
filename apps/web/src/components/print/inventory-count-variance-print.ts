import { printFormatters, PrintPreparationError, type PrintColumn, type PrintPage } from '../../lib/print';
import { translateEnum } from '../../lib/i18n/literals';
import type { Locale } from '../../lib/i18n/types';
import type { PrintTranslate } from './PrintDocument';
import type { PreparedReportPrint, ReportPrintSnapshot } from './use-report-print-snapshot';

export interface CountVariancePrintRow {
  id: string; count?: { countNumber?: string; status?: string } | null; product?: { code?: string; name?: string } | null;
  warehouseLocation?: { name?: string; code?: string } | null; systemQty: number | string;
  countedQty?: number | string | null; differenceQty?: number | string | null; status: string;
}
export type CountVariancePrintData = PrintPage<CountVariancePrintRow>;
export function inventoryCountVariancePrintModel(snapshot: ReportPrintSnapshot<CountVariancePrintData>, t: PrintTranslate, locale: Locale): PreparedReportPrint {
  const { data, params, labels } = snapshot, fmt = printFormatters(locale), filters = [];
  for (const [key, label] of [['warehouseId', 'reports.warehouse'], ['productId', 'reports.product']]) if (params[key]) {
    if (!labels[key]) throw new PrintPreparationError('unavailable');
    filters.push({ label: t(label), value: labels[key] });
  }
  if (params.varianceOnly) filters.push({ label: t('reports.varianceOnly'), value: t('common.yes') });
  const columns: PrintColumn<CountVariancePrintRow>[] = [
    { key: 'countNumber', label: t('reports.count'), value: row => row.count?.countNumber, align: 'start', priority: 1, width: 16, direction: 'ltr' },
    { key: 'productCode', label: t('common.code'), value: row => row.product?.code, align: 'start', priority: 1, width: 16, direction: 'ltr' },
    { key: 'product', label: t('reports.product'), value: row => row.product?.name, align: 'start', priority: 1, width: 28 },
    { key: 'location', label: t('reports.warehouseLocation'), value: row => row.warehouseLocation?.name || row.warehouseLocation?.code, align: 'start', priority: 1, width: 18 },
    { key: 'systemQty', label: t('inventoryCounting.systemQty'), value: row => fmt.quantity(row.systemQty), align: 'end', priority: 1, width: 14, direction: 'ltr' },
    { key: 'countedQty', label: t('inventoryCounting.countedQty'), value: row => fmt.quantity(row.countedQty), align: 'end', priority: 1, width: 14, direction: 'ltr' },
    { key: 'differenceQty', label: t('reports.varianceQty'), value: row => fmt.quantity(row.differenceQty), align: 'end', priority: 1, width: 14, direction: 'ltr' },
    { key: 'status', label: t('reports.printDocument.countLineStatus'), value: row => translateEnum(row.status, locale), align: 'start', priority: 1, width: 16 },
  ];
  return {
    mode: 'REPORT', title: t('reports.countVarianceReport'), paperSize: 'A4', orientation: 'landscape', scopeLabel: t('reports.printDocument.allFiltered'), filters,
    summary: [{ label: t('reports.printDocument.matchingCountLines'), value: fmt.number(data.total) }], sections: [{ columns, rows: data.rows }],
    notes: [t('reports.printDocument.countVarianceContract'), t('reports.printDocument.inventoryMixedUnits')],
  };
}
