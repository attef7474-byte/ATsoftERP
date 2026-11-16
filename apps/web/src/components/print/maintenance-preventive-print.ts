import { printFormatters, PrintPreparationError, type PrintColumn } from '../../lib/print';
import { translateEnum } from '../../lib/i18n/literals';
import type { Locale } from '../../lib/i18n/types';
import type { PrintTranslate } from './PrintDocument';
import type { PreparedReportPrint, ReportPrintSnapshot } from './use-report-print-snapshot';
import type { SchedulePrintRow, SchedulesPrintData } from './maintenance-schedules-print';
export type PreventivePrintData = SchedulesPrintData;

function preventiveModel(snapshot: ReportPrintSnapshot<PreventivePrintData>, t: PrintTranslate, locale: Locale, overdue: boolean): PreparedReportPrint {
  const { data, params, labels } = snapshot, fmt = printFormatters(locale), filters = [];
  if (params.machineId) {
    if (!labels.machineId) throw new PrintPreparationError('unavailable');
    filters.push({ label: t('reports.machine'), value: labels.machineId });
  }
  const columns: PrintColumn<SchedulePrintRow>[] = [
    { key: 'title', label: t('common.name'), value: row => row.title, align: 'start', priority: 1, width: 28 },
    { key: 'machine', label: t('reports.machine'), value: row => row.machine?.name, align: 'start', priority: 1, width: 22 },
    { key: 'type', label: t('reports.type'), value: row => translateEnum(row.type, locale), align: 'start', priority: 2, width: 12 },
    { key: 'frequency', label: t('maintenance.frequency'), value: row => translateEnum(row.frequency, locale), align: 'start', priority: 2, width: 12 },
    { key: 'endDate', label: t('maintenance.endDate'), value: row => fmt.date(row.endDate), align: 'center', priority: 2, width: 16, direction: 'ltr' },
    { key: 'status', label: t('reports.status'), value: row => translateEnum(row.status, locale), align: 'start', priority: 2, width: 12 },
  ];
  return {
    mode: 'REPORT', title: t(overdue ? 'reports.overduePreventiveReport' : 'reports.upcomingPreventiveReport'), paperSize: 'A4', orientation: 'portrait', scopeLabel: t('reports.printDocument.allFiltered'), filters,
    summary: [{ label: t(overdue ? 'reports.overdueSchedules' : 'reports.upcomingSchedules'), value: fmt.number(data.total) }],
    sections: [{ columns, rows: data.rows }], notes: [t(overdue ? 'reports.printDocument.overdueWindowNote' : 'reports.printDocument.upcomingWindowNote')],
  };
}
export function maintenanceUpcomingPrintModel(snapshot: ReportPrintSnapshot<PreventivePrintData>, t: PrintTranslate, locale: Locale): PreparedReportPrint {
  return preventiveModel(snapshot, t, locale, false);
}
export function maintenanceOverduePrintModel(snapshot: ReportPrintSnapshot<PreventivePrintData>, t: PrintTranslate, locale: Locale): PreparedReportPrint {
  return preventiveModel(snapshot, t, locale, true);
}
