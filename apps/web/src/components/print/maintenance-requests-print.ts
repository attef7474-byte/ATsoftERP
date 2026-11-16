import { printFormatters, PrintPreparationError, type PrintColumn, type PrintDocumentModel } from '../../lib/print';
import { translateEnum } from '../../lib/i18n/literals';
import type { Locale } from '../../lib/i18n/types';
import type { PrintTranslate } from './PrintDocument';

export interface MaintenanceRequestPrintRow {
  id: string;
  requestNumber: string;
  title: string;
  machine?: { code?: string; name?: string } | null;
  type: string;
  priority: string;
  status: string;
  createdAt: string;
}
export type RequestPrintFilters = Record<string, string | number | undefined>;
export type LookupPrintLabels = Record<string, string>;

export function maintenanceRequestsPrintColumns(t: PrintTranslate, locale: Locale, line?: string): PrintColumn<MaintenanceRequestPrintRow>[] {
  const fmt = printFormatters(locale);
  const columns: PrintColumn<MaintenanceRequestPrintRow>[] = [
    { key: 'requestNumber', label: t('maintenance.requestNumber'), value: row => row.requestNumber, align: 'start', priority: 1, width: 20, direction: 'ltr' },
    { key: 'title', label: t('common.name'), value: row => row.title, align: 'start', priority: 1, width: 24 },
    { key: 'machine', label: t('reports.machine'), value: row => row.machine?.name, align: 'start', priority: 2, width: 19 },
    { key: 'type', label: t('reports.type'), value: row => translateEnum(row.type, locale), align: 'start', priority: 2, width: 11 },
    { key: 'priority', label: t('reports.priority'), value: row => translateEnum(row.priority, locale), align: 'start', priority: 2, width: 9 },
    { key: 'status', label: t('reports.status'), value: row => translateEnum(row.status, locale), align: 'start', priority: 2, width: 11 },
    { key: 'createdAt', label: t('common.createdAt'), value: row => fmt.date(row.createdAt), align: 'center', priority: 2, width: 16, direction: 'ltr' },
  ];
  // The report API exposes machine name but no line/assignee relation. A selected
  // line is known for every row through the canonical report filter.
  if (line) columns.splice(3, 0, { key: 'productionLine', label: t('maintenance.productionLine'), value: () => line, align: 'start', priority: 2, width: 15 });
  return columns;
}

export function maintenanceRequestsPrintModel(
  data: { rows: MaintenanceRequestPrintRow[]; cards?: Array<{ label: string; value: string | number }> },
  params: RequestPrintFilters,
  labels: LookupPrintLabels,
  t: PrintTranslate,
  locale: Locale,
): Omit<PrintDocumentModel, 'locale' | 'company' | 'branch' | 'printedBy' | 'printedAt' | 'timeZone'> {
  const filters = [];
  const lookupKeys: Record<string, string> = {
    productionLineId: 'maintenance.productionLine', machineId: 'reports.machine', machineComponentId: 'maintenance.machineComponent',
    operationTypeId: 'maintenance.operationType', costCenterId: 'maintenance.costCenter', sparePartId: 'maintenance.sparePartLabel',
  };
  for (const [key, labelKey] of Object.entries(lookupKeys)) if (params[key]) {
    if (!labels[key]) throw new PrintPreparationError('unavailable');
    filters.push({ label: t(labelKey), value: labels[key] });
  }
  for (const [key, labelKey] of [['requestStatus', 'reports.status'], ['maintenanceType', 'reports.type'], ['priority', 'reports.priority']]) {
    if (params[key]) filters.push({ label: t(labelKey), value: translateEnum(String(params[key]), locale) });
  }
  if (params.search) filters.push({ label: t('common.search'), value: String(params.search) });
  return {
    mode: 'REPORT', title: t('reports.requestsReport'), paperSize: 'A4', orientation: 'portrait',
    periodStart: params.dateFrom ? String(params.dateFrom) : undefined,
    periodEnd: params.dateTo ? String(params.dateTo) : undefined,
    scopeLabel: t('reports.printDocument.allFiltered'), filters,
    summary: (data.cards || []).map(card => ({ label: t(`reports.${card.label.replace(/^reports\./, '')}`), value: printFormatters(locale).number(card.value) })),
    sections: [{ columns: maintenanceRequestsPrintColumns(t, locale, params.productionLineId ? labels.productionLineId : undefined), rows: data.rows }],
  };
}
