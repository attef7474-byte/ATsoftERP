import { printFormatters, PrintPreparationError, type PrintColumn, type PrintPage } from '../../lib/print';
import { translateEnum } from '../../lib/i18n/literals';
import type { Locale } from '../../lib/i18n/types';
import type { PrintTranslate } from './PrintDocument';
import type { PreparedReportPrint, ReportPrintSnapshot } from './use-report-print-snapshot';

export interface SchedulePrintRow {
  id: string; title: string; machine?: { name?: string } | null; type: string; frequency: string;
  effectiveDueDate?: string | null; endDate?: string | null; status: string;
}
export interface SchedulesPrintData extends PrintPage<SchedulePrintRow> {
  cards: Array<{ label: string; value: number }>;
}
export function maintenanceSchedulesPrintModel(snapshot: ReportPrintSnapshot<SchedulesPrintData>, t: PrintTranslate, locale: Locale): PreparedReportPrint {
  const { data, params, labels } = snapshot, fmt = printFormatters(locale);
  const definitions: Record<string, string> = { productionLineId: 'maintenance.productionLine', machineId: 'reports.machine', operationTypeId: 'maintenance.operationType', costCenterId: 'maintenance.costCenter' };
  const filters = Object.entries(definitions).filter(([key]) => params[key]).map(([key, label]) => {
    if (!labels[key]) throw new PrintPreparationError('unavailable');
    return { label: t(label), value: labels[key] };
  });
  const dueLabels: Record<string, string> = { overdue: 'reports.overdue', dueSoon: 'reports.dueSoon', notDue: 'reports.notDue' };
  if (params.dueStatus) {
    if (!dueLabels[String(params.dueStatus)]) throw new PrintPreparationError('unavailable');
    filters.push({ label: t('reports.status'), value: t(dueLabels[String(params.dueStatus)]) });
  }
  const columns: PrintColumn<SchedulePrintRow>[] = [
    { key: 'title', label: t('common.name'), value: row => row.title, align: 'start', priority: 1, width: 22 },
    { key: 'machine', label: t('reports.machine'), value: row => row.machine?.name, align: 'start', priority: 1, width: 16 },
    { key: 'type', label: t('reports.type'), value: row => translateEnum(row.type, locale), align: 'start', priority: 2, width: 12 },
    { key: 'frequency', label: t('maintenance.frequency'), value: row => translateEnum(row.frequency, locale), align: 'start', priority: 2, width: 12 },
    { key: 'effectiveDueDate', label: t('maintenance.nextDueDate'), value: row => fmt.date(row.effectiveDueDate), align: 'center', priority: 2, width: 15, direction: 'ltr' },
    { key: 'endDate', label: t('maintenance.endDate'), value: row => fmt.date(row.endDate), align: 'center', priority: 2, width: 15, direction: 'ltr' },
    { key: 'status', label: t('reports.status'), value: row => translateEnum(row.status, locale), align: 'start', priority: 2, width: 12 },
  ];
  return {
    mode: 'REPORT', title: t('reports.schedulesReport'), paperSize: 'A4', orientation: 'portrait', scopeLabel: t('reports.printDocument.allFiltered'), filters,
    summary: data.cards.map(card => ({ label: t(`reports.${card.label}`), value: fmt.number(card.value) })),
    sections: [{ columns, rows: data.rows }], notes: [t('reports.printDocument.schedulesMetricNote')],
  };
}
