import { printFormatters, PrintPreparationError, type PrintColumn, type PrintField } from '../../lib/print';
import { translateEnum } from '../../lib/i18n/literals';
import type { Locale } from '../../lib/i18n/types';
import type { PrintTranslate } from './PrintDocument';
import type { PreparedReportPrint, ReportPrintSnapshot } from './use-report-print-snapshot';

interface NamedMachine { id: string; name?: string; code?: string }
interface RequestRow { id: string; requestNumber: string; title: string; machine?: NamedMachine | null; status: string; createdAt: string }
interface ScheduleRow { id: string; title: string; machine?: NamedMachine | null; endDate?: string | null; status: string }
export interface MaintenanceOverviewPrintData {
  totalRequests: number; openRequests: number; inProgressRequests: number; completedRequests: number; cancelledRequests: number;
  overdueSchedules: number; totalDowntimeMinutes: number; activeDowntime: number; totalCost: number; partsUsageCount: number;
  requestsByStatus: Array<{ status: string; count: number }>;
  requestsByPriority: Array<{ priority: string; count: number }>;
  requestsByType: Array<{ type: string; count: number }>;
  topMachinesByRequestCount: Array<{ machineId: string; count: number }>;
  topMachinesByDowntime: Array<{ machineId: string; totalMinutes: number }>;
  dueSchedules: ScheduleRow[]; recentRequests: RequestRow[];
}

export function maintenanceOverviewPrintModel(snapshot: ReportPrintSnapshot<MaintenanceOverviewPrintData>, t: PrintTranslate, locale: Locale): PreparedReportPrint {
  const { data, params, labels } = snapshot, fmt = printFormatters(locale);
  const filterDefinitions: Record<string, string> = { productionLineId: 'maintenance.productionLine', machineId: 'reports.machine', machineComponentId: 'maintenance.machineComponent', operationTypeId: 'maintenance.operationType', costCenterId: 'maintenance.costCenter' };
  const filters: PrintField[] = [];
  for (const [key, label] of Object.entries(filterDefinitions)) if (params[key]) {
    if (!labels[key]) throw new PrintPreparationError('unavailable');
    filters.push({ label: t(label), value: labels[key] });
  }
  const namedMachines = new Map<string, string>();
  for (const row of [...data.recentRequests, ...data.dueSchedules]) if (row.machine?.id) namedMachines.set(row.machine.id, row.machine.name || row.machine.code || '');
  const countColumn: PrintColumn<any> = { key: 'count', label: t('reports.total'), value: row => fmt.number(row.count), align: 'end', priority: 2, width: 15, direction: 'ltr' };
  const groupSection = (key: 'status' | 'priority' | 'type', rows: any[]) => ({ title: `${t('reports.total')} — ${t(`reports.${key}`)}`, rows, columns: [{ key, label: t(`reports.${key}`), value: (row: any) => translateEnum(row[key], locale), align: 'start' as const, priority: 1 as const, width: 40 }, countColumn] });
  const metricColumns: PrintColumn<PrintField>[] = [
    { key: 'label', label: t('reports.printDocument.metric'), value: row => row.label, align: 'start', priority: 1, width: 70 },
    { key: 'value', label: t('reports.printDocument.value'), value: row => row.value, align: 'end', priority: 2, width: 30, direction: 'ltr' },
  ];
  const machineColumn: PrintColumn<any> = { key: 'machine', label: t('reports.machine'), value: row => namedMachines.get(row.machineId) || undefined, align: 'start', priority: 1, width: 50 };
  const hasUnavailableMachineNames = [...data.topMachinesByRequestCount, ...data.topMachinesByDowntime].some(row => !namedMachines.get(row.machineId));
  return {
    mode: 'REPORT', title: t('reports.maintenanceOverview'), paperSize: 'A4', orientation: 'portrait',
    scopeLabel: t('reports.printDocument.overviewScope'), filters,
    summary: [
      { label: t('reports.totalRequests'), value: fmt.number(data.totalRequests) },
      { label: t('reports.openRequests'), value: fmt.number(data.openRequests) },
      { label: t('reports.inProgressRequests'), value: fmt.number(data.inProgressRequests) },
      { label: t('reports.completedRequests'), value: fmt.number(data.completedRequests) },
      { label: t('reports.cancelledRequests'), value: fmt.number(data.cancelledRequests) },
    ],
    sections: [
      groupSection('status', data.requestsByStatus), groupSection('priority', data.requestsByPriority), groupSection('type', data.requestsByType),
      { title: t('reports.topMachinesByRequests'), rows: data.topMachinesByRequestCount, columns: [machineColumn, countColumn] },
      { title: t('reports.printDocument.downtimeScope'), rows: data.topMachinesByDowntime, totals: [{ label: t('reports.totalDowntimeMinutes'), value: fmt.duration(data.totalDowntimeMinutes), direction: 'ltr' }], columns: [machineColumn, { key: 'totalMinutes', label: t('reports.totalDowntimeMinutes'), value: row => fmt.duration(row.totalMinutes), align: 'end', priority: 2, width: 25, direction: 'ltr' }] },
      { title: t('reports.printDocument.scheduleScope'), rows: data.dueSchedules, totals: [{ label: t('reports.overdueSchedules'), value: fmt.number(data.overdueSchedules), direction: 'ltr' }], columns: [
        { key: 'title', label: t('common.name'), value: row => row.title, align: 'start', priority: 1, width: 30 },
        { key: 'machine', label: t('reports.machine'), value: row => row.machine?.name || row.machine?.code, align: 'start', priority: 2, width: 30 },
        { key: 'endDate', label: t('maintenance.endDate'), value: row => fmt.date(row.endDate), align: 'center', priority: 2, width: 22, direction: 'ltr' },
        { key: 'status', label: t('reports.status'), value: row => translateEnum(row.status, locale), align: 'start', priority: 2, width: 18 },
      ] },
      { title: t('reports.recentRequests'), rows: data.recentRequests, columns: [
        { key: 'requestNumber', label: t('maintenance.requestNumber'), value: row => row.requestNumber, align: 'start', priority: 1, width: 20, direction: 'ltr' },
        { key: 'title', label: t('common.name'), value: row => row.title, align: 'start', priority: 1, width: 30 },
        { key: 'machine', label: t('reports.machine'), value: row => row.machine?.name || row.machine?.code, align: 'start', priority: 2, width: 25 },
        { key: 'status', label: t('reports.status'), value: row => translateEnum(row.status, locale), align: 'start', priority: 2, width: 17 },
        { key: 'date', label: t('common.createdAt'), value: row => fmt.date(row.createdAt), align: 'center', priority: 2, width: 22, direction: 'ltr' },
      ] },
      { title: t('reports.printDocument.entireContextTotals'), rows: [
        { label: t('reports.totalCost'), value: fmt.number(data.totalCost) },
        { label: t('reports.partsUsage'), value: fmt.number(data.partsUsageCount) },
        { label: t('reports.activeDowntime'), value: fmt.number(data.activeDowntime) },
      ], columns: metricColumns },
    ],
    notes: [t('reports.printDocument.overviewFilterScope'), t('reports.printDocument.legacyCostNote'), ...(hasUnavailableMachineNames ? [t('reports.printDocument.missingMachineNames')] : [])],
  };
}
