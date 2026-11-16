import { PRINT_ROW_LIMIT, printFormatters, PrintPreparationError, type PrintColumn, type PrintPage } from '../../lib/print';
import type { Locale } from '../../lib/i18n/types';
import type { PrintTranslate } from './PrintDocument';
import type { PreparedReportPrint, ReportPrintSnapshot } from './use-report-print-snapshot';

export interface MaintenanceCostPrintRow {
  id: string; _type: 'cost' | 'part';
  request?: { requestNumber?: string } | null;
  description?: string | null; product?: { name?: string } | null;
  amount?: number | null; quantity?: number | null; totalCost?: number | null;
  incurredAt?: string | null; createdAt?: string | null;
}
export interface MaintenanceCostsPrintData extends PrintPage<MaintenanceCostPrintRow> {
  cards: Array<{ label: string; value: number }>;
}

/** The canonical composite endpoint cannot page its parts stream. Never claim ALL_FILTERED_RESULTS. */
export function maintenanceCostsPrintModel(snapshot: ReportPrintSnapshot<MaintenanceCostsPrintData>, t: PrintTranslate, locale: Locale): PreparedReportPrint {
  const { data, params, labels } = snapshot, fmt = printFormatters(locale);
  const page = Number(data.page), pageSize = Number(data.pageSize);
  if (!Array.isArray(data.rows) || !Number.isSafeInteger(page) || page < 1 || page !== Number(params.page || 1) || !Number.isSafeInteger(pageSize) || pageSize < 1 || pageSize !== Number(params.pageSize || 20)) throw new PrintPreparationError('dataChanged');
  if (data.rows.length > PRINT_ROW_LIMIT) throw new PrintPreparationError('limitExceeded');
  const costs = data.rows.filter(row => row._type === 'cost'), parts = data.rows.filter(row => row._type === 'part');
  const identities = data.rows.map(row => `${row._type}:${row.id}`);
  if (costs.length + parts.length !== data.rows.length || costs.length > pageSize || parts.length > 10 || data.rows.some(row => !row.id) || new Set(identities).size !== identities.length) throw new PrintPreparationError('dataChanged');
  const definitions: Record<string, string> = { productionLineId: 'maintenance.productionLine', machineId: 'reports.machine', machineComponentId: 'maintenance.machineComponent', operationTypeId: 'maintenance.operationType', costCenterId: 'maintenance.costCenter', sparePartId: 'maintenance.sparePartLabel' };
  const filters = Object.entries(definitions).filter(([key]) => params[key]).map(([key, label]) => {
    if (!labels[key]) throw new PrintPreparationError('unavailable');
    return { label: t(label), value: labels[key] };
  });
  const amount = (value: number | null | undefined) => fmt.number(value, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const request: PrintColumn<MaintenanceCostPrintRow> = { key: 'request', label: t('maintenance.requestNumber'), value: row => row.request?.requestNumber, align: 'start', priority: 1, width: 22, direction: 'ltr' };
  const costColumns: PrintColumn<MaintenanceCostPrintRow>[] = [request,
    { key: 'description', label: t('common.description'), value: row => row.description, align: 'start', priority: 1, width: 40 },
    { key: 'amount', label: t('reports.totalCost'), value: row => amount(row.amount), align: 'end', priority: 2, width: 18, direction: 'ltr' },
    { key: 'incurredAt', label: t('reports.printDocument.costIncurredDate'), value: row => fmt.date(row.incurredAt), align: 'center', priority: 2, width: 20, direction: 'ltr' },
  ];
  const partColumns: PrintColumn<MaintenanceCostPrintRow>[] = [request,
    { key: 'product', label: t('reports.product'), value: row => row.product?.name, align: 'start', priority: 1, width: 28 },
    { key: 'quantity', label: t('inventoryCounting.quantity'), value: row => fmt.quantity(row.quantity), align: 'end', priority: 2, width: 12, direction: 'ltr' },
    { key: 'totalCost', label: t('reports.totalCost'), value: row => amount(row.totalCost), align: 'end', priority: 2, width: 18, direction: 'ltr' },
    { key: 'createdAt', label: t('common.createdAt'), value: row => fmt.date(row.createdAt), align: 'center', priority: 2, width: 20, direction: 'ltr' },
  ];
  return {
    mode: 'REPORT', title: t('reports.costsReport'), paperSize: 'A4', orientation: 'portrait', scopeLabel: t('reports.printDocument.costsPageScope'), filters,
    periodStart: params.dateFrom ? String(params.dateFrom) : undefined, periodEnd: params.dateTo ? String(params.dateTo) : undefined,
    metadata: [{ label: t('common.page'), value: fmt.number(data.page) }, { label: t('reports.printDocument.printedRows'), value: fmt.number(data.rows.length) }],
    sections: [
      { title: t('reports.otherCost'), columns: costColumns, rows: costs },
      { title: t('reports.partsCost'), columns: partColumns, rows: parts },
      { title: t('reports.printDocument.costsTotalsScope'), columns: [
        { key: 'label', label: t('reports.printDocument.metric'), value: row => t(`reports.${row.label}`), align: 'start', priority: 1, width: 65 },
        { key: 'value', label: t('reports.printDocument.value'), value: row => row.label === 'partsUsage' ? fmt.number(row.value) : amount(row.value), align: 'end', priority: 2, width: 35, direction: 'ltr' },
      ], rows: data.cards },
    ],
    notes: [t('reports.printDocument.costsFilterNote'), t('reports.printDocument.costsUnitsNote'), t('reports.printDocument.costsLedgerNote')],
  };
}
