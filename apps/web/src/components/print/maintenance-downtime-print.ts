import { printFormatters, PrintPreparationError, type PrintColumn, type PrintPage } from '../../lib/print';
import type { Locale } from '../../lib/i18n/types';
import type { PrintTranslate } from './PrintDocument';
import type { PreparedReportPrint, ReportPrintSnapshot } from './use-report-print-snapshot';

export interface DowntimePrintRow {
  id: string;
  machine?: { name?: string } | null;
  reason?: string | null;
  startTime: string;
  endTime?: string | null;
  durationMinutes?: number | null;
  cancelledAt?: string | null;
}
export interface DowntimePrintData extends PrintPage<DowntimePrintRow> {
  cards: Array<{ label: string; value: number; unit?: string }>;
}

export function maintenanceDowntimePrintModel(snapshot: ReportPrintSnapshot<DowntimePrintData>, t: PrintTranslate, locale: Locale): PreparedReportPrint {
  const { data, params, labels } = snapshot, fmt = printFormatters(locale);
  const definitions: Record<string, string> = { productionLineId: 'maintenance.productionLine', machineId: 'reports.machine', operationTypeId: 'maintenance.operationType', costCenterId: 'maintenance.costCenter' };
  const filters = Object.entries(definitions).filter(([key]) => params[key]).map(([key, label]) => {
    if (!labels[key]) throw new PrintPreparationError('unavailable');
    return { label: t(label), value: labels[key] };
  });
  const columns: PrintColumn<DowntimePrintRow>[] = [
    { key: 'machine', label: t('reports.machine'), value: row => row.machine?.name, align: 'start', priority: 1, width: 18 },
    { key: 'reason', label: t('maintenance.reason'), value: row => row.reason, align: 'start', priority: 1, width: 24 },
    { key: 'startTime', label: t('maintenance.startTime'), value: row => fmt.dateTime(row.startTime), align: 'center', priority: 2, width: 18, direction: 'ltr' },
    { key: 'endTime', label: t('maintenance.endTime'), value: row => fmt.dateTime(row.endTime), align: 'center', priority: 2, width: 18, direction: 'ltr' },
    { key: 'durationMinutes', label: t('reports.totalDowntimeMinutes'), value: row => fmt.duration(row.durationMinutes), align: 'end', priority: 2, width: 10, direction: 'ltr' },
    { key: 'status', label: t('reports.status'), value: row => t(row.cancelledAt ? 'reports.cancelled' : row.endTime ? 'reports.completed' : 'reports.active'), align: 'start', priority: 2, width: 12 },
  ];
  return {
    mode: 'REPORT', title: t('reports.downtimeReport'), paperSize: 'A4', orientation: 'portrait', scopeLabel: t('reports.printDocument.allFiltered'), filters,
    periodStart: params.dateFrom ? String(params.dateFrom) : undefined, periodEnd: params.dateTo ? String(params.dateTo) : undefined,
    summary: data.cards.map(card => ({ label: t(`reports.${card.label}`), value: fmt.number(card.value) })),
    sections: [{ columns, rows: data.rows }], notes: [t('reports.printDocument.downtimeRecordedNote')],
  };
}
