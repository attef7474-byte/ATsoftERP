import { printFormatters, PrintPreparationError, type PrintColumn, type PrintPage } from '../../lib/print';
import { translateEnum } from '../../lib/i18n/literals';
import type { Locale } from '../../lib/i18n/types';
import type { PrintTranslate } from './PrintDocument';
import type { PreparedReportPrint, ReportPrintSnapshot } from './use-report-print-snapshot';

export interface MachineLogPrintRow {
  id: string; requestNumber: string; title: string; machine?: { name?: string } | null; type: string; status: string; createdAt: string;
}
export type MachineLogPrintData = PrintPage<MachineLogPrintRow>;
export function maintenanceMachineLogPrintModel(snapshot: ReportPrintSnapshot<MachineLogPrintData>, t: PrintTranslate, locale: Locale): PreparedReportPrint {
  const { data, params, labels } = snapshot, fmt = printFormatters(locale), filters = [];
  if (params.machineId) {
    if (!labels.machineId) throw new PrintPreparationError('unavailable');
    filters.push({ label: t('reports.machine'), value: labels.machineId });
  }
  const columns: PrintColumn<MachineLogPrintRow>[] = [
    { key: 'requestNumber', label: t('maintenance.requestNumber'), value: row => row.requestNumber, align: 'start', priority: 1, width: 20, direction: 'ltr' },
    { key: 'title', label: t('common.name'), value: row => row.title, align: 'start', priority: 1, width: 28 },
    { key: 'machine', label: t('reports.machine'), value: row => row.machine?.name, align: 'start', priority: 1, width: 20 },
    { key: 'type', label: t('reports.type'), value: row => translateEnum(row.type, locale), align: 'start', priority: 2, width: 12 },
    { key: 'status', label: t('reports.status'), value: row => translateEnum(row.status, locale), align: 'start', priority: 2, width: 14 },
    { key: 'createdAt', label: t('common.createdAt'), value: row => fmt.date(row.createdAt), align: 'center', priority: 2, width: 16, direction: 'ltr' },
  ];
  return {
    mode: 'REPORT', title: t('reports.machineLogReport'), paperSize: 'A4', orientation: 'portrait', scopeLabel: t('reports.printDocument.allFiltered'), filters,
    periodStart: params.dateFrom ? String(params.dateFrom) : undefined, periodEnd: params.dateTo ? String(params.dateTo) : undefined,
    summary: [{ label: t('reports.totalRequests'), value: fmt.number(data.total) }], sections: [{ columns, rows: data.rows }],
  };
}
