import { printFormatters, PrintPreparationError, type PrintColumn, type PrintDocumentModel, type PrintSection } from '../../lib/print';
import { translateEnum } from '../../lib/i18n/literals';
import type { Locale } from '../../lib/i18n/types';
import type {
  DowntimeLog,
  MaintenanceRequest,
  MaintenanceRequestCostEntry,
  MaintenanceRequestPartUsage,
  MaintenanceTask,
} from '../../lib/admin-types';
import type { PrintTranslate } from './PrintDocument';

export interface MaintenanceRequestDocumentData extends MaintenanceRequest {
  tasks?: MaintenanceTask[];
  partsUsed?: MaintenanceRequestPartUsage[];
  costEntries?: MaintenanceRequestCostEntry[];
  downtimeLogs?: DowntimeLog[];
}

function requestTaskColumns(t: PrintTranslate, locale: Locale): PrintColumn<MaintenanceTask>[] {
  const fmt = printFormatters(locale);
  return [
    { key: 'title', label: t('common.name'), value: row => row.title, align: 'start', priority: 1, width: 30 },
    { key: 'status', label: t('common.status'), value: row => translateEnum(row.status, locale), align: 'start', priority: 2, width: 14 },
    { key: 'assignedTo', label: t('maintenance.assignedTo'), value: row => row.assignedTo?.name, align: 'start', priority: 2, width: 20 },
    { key: 'startedAt', label: t('maintenance.startedAt'), value: row => fmt.dateTime(row.startedAt), align: 'center', priority: 3, width: 18, direction: 'ltr' },
    { key: 'completedAt', label: t('maintenance.completedAt'), value: row => fmt.dateTime(row.completedAt), align: 'center', priority: 3, width: 18, direction: 'ltr' },
  ];
}

function requestPartColumns(t: PrintTranslate, locale: Locale): PrintColumn<MaintenanceRequestPartUsage>[] {
  const fmt = printFormatters(locale);
  return [
    { key: 'product', label: t('common.name'), value: row => row.product?.name, align: 'start', priority: 1, width: 34 },
    { key: 'unit', label: t('maintenance.unit'), value: row => row.product?.unit, align: 'center', priority: 2, width: 10 },
    { key: 'quantity', label: t('maintenance.partQuantity'), value: row => row.quantity, format: value => fmt.quantity(value), align: 'end', priority: 2, width: 12 },
    { key: 'unitCost', label: t('maintenance.partUnitCost'), value: row => row.unitCost, format: value => fmt.number(value), align: 'end', priority: 3, width: 20 },
    { key: 'totalCost', label: t('maintenance.partTotalCost'), value: row => row.totalCost, format: value => fmt.number(value), align: 'end', priority: 3, width: 20 },
  ];
}

function requestCostColumns(t: PrintTranslate, locale: Locale): PrintColumn<MaintenanceRequestCostEntry>[] {
  const fmt = printFormatters(locale);
  return [
    { key: 'type', label: t('maintenance.costType'), value: row => translateEnum(row.type, locale), align: 'start', priority: 2, width: 18 },
    { key: 'description', label: t('common.description'), value: row => row.description, align: 'start', priority: 1, width: 38 },
    { key: 'amount', label: t('maintenance.costAmount'), value: row => row.amount, format: value => fmt.number(value), align: 'end', priority: 2, width: 18 },
    { key: 'incurredAt', label: t('maintenance.costIncurredAt'), value: row => fmt.dateTime(row.incurredAt), align: 'center', priority: 3, width: 22, direction: 'ltr' },
  ];
}

function requestDowntimeColumns(t: PrintTranslate, locale: Locale): PrintColumn<DowntimeLog>[] {
  const fmt = printFormatters(locale);
  return [
    { key: 'reason', label: t('maintenance.reason'), value: row => row.reason, align: 'start', priority: 1, width: 34 },
    { key: 'startTime', label: t('maintenance.startTime'), value: row => fmt.dateTime(row.startTime), align: 'center', priority: 2, width: 22, direction: 'ltr' },
    { key: 'endTime', label: t('maintenance.endTime'), value: row => fmt.dateTime(row.endTime), align: 'center', priority: 2, width: 22, direction: 'ltr' },
    { key: 'durationHours', label: t('maintenance.durationHours'), value: row => row.durationHours, format: value => fmt.duration(value), align: 'end', priority: 3, width: 18 },
  ];
}

export function maintenanceRequestDocumentModel(
  data: MaintenanceRequestDocumentData,
  t: PrintTranslate,
  locale: Locale,
): Omit<PrintDocumentModel, 'locale' | 'company' | 'branch' | 'printedBy' | 'printedAt' | 'timeZone'> {
  if (!data || !data.requestNumber || !data.title) throw new PrintPreparationError('unavailable');
  const fmt = printFormatters(locale);
  const date = (value: string | null | undefined) => value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? fmt.dateOnly(value) : fmt.date(value);
  const tasks = data.tasks || [];
  const parts = data.partsUsed || [];
  const costs = data.costEntries || [];
  const downtimes = data.downtimeLogs || [];
  const metadata = [
    { label: t('common.status'), value: translateEnum(data.status, locale) },
    { label: t('maintenance.maintenanceType'), value: translateEnum(data.type, locale) },
    { label: t('maintenance.priority'), value: translateEnum(data.priority, locale) },
    { label: t('maintenance.isEmergency'), value: data.isEmergency == null ? undefined : (data.isEmergency ? t('common.yes') : t('common.no')) },
    { label: t('details.maintenanceRequest.machine'), value: data.machine?.name },
    { label: t('maintenance.productionLine'), value: data.productionLine?.name },
    { label: t('maintenance.machineComponent'), value: data.machineComponent?.name },
    { label: t('maintenance.operationType'), value: data.operationType?.name },
    { label: t('maintenance.costCenter'), value: data.costCenter?.name },
    { label: t('details.maintenanceRequest.requestedBy'), value: data.requestedBy?.name },
    { label: t('maintenance.assignedTo'), value: data.assignedTo?.name },
    { label: t('maintenance.reportedAt'), value: fmt.dateTime(data.reportedAt) },
    { label: t('maintenance.startDate'), value: date(data.startDate) },
    { label: t('maintenance.endDate'), value: date(data.endDate) },
    { label: t('maintenance.startedAt'), value: fmt.dateTime(data.startedAt) },
    { label: t('maintenance.completedAt'), value: fmt.dateTime(data.completedAt) },
    { label: t('common.createdAt'), value: fmt.dateTime(data.createdAt) },
    { label: t('common.updatedAt'), value: fmt.dateTime(data.updatedAt) },
    { label: t('maintenance.cancelledAt'), value: fmt.dateTime(data.cancelledAt) },
  ];
  const summary = [
    { label: t('maintenance.estimatedCost'), value: fmt.number(data.estimatedCost) },
    { label: t('maintenance.actualCost'), value: fmt.number(data.actualCost) },
    { label: t('maintenance.downtimeHours'), value: fmt.duration(data.downtimeHours) },
    { label: t('details.maintenanceRequest.tasks'), value: fmt.number(tasks.length) },
    { label: t('maintenanceWorkflow.workflowParts'), value: fmt.number(parts.length) },
    { label: t('maintenanceWorkflow.workflowCosts'), value: fmt.number(costs.length) },
    { label: t('details.maintenanceRequest.downtimeLogs'), value: fmt.number(downtimes.length) },
  ];
  const sections: PrintSection<any>[] = [];
  if (tasks.length) sections.push({ title: t('details.maintenanceRequest.tasks'), columns: requestTaskColumns(t, locale), rows: tasks });
  if (parts.length) sections.push({ title: t('maintenanceWorkflow.workflowParts'), columns: requestPartColumns(t, locale), rows: parts });
  if (costs.length) sections.push({ title: t('maintenanceWorkflow.workflowCosts'), columns: requestCostColumns(t, locale), rows: costs });
  if (downtimes.length) sections.push({ title: t('details.maintenanceRequest.downtimeLogs'), columns: requestDowntimeColumns(t, locale), rows: downtimes });
  const notes = [t('reports.printDocument.maintenanceRequestNote')];
  if (data.notes) notes.push(data.notes);
  return {
    mode: 'DOCUMENT',
    title: t('maintenance.maintenanceRequest'),
    subtitle: data.title,
    description: data.description || undefined,
    documentNumber: data.requestNumber,
    metadata,
    summary,
    sections,
    notes,
    orientation: 'portrait',
    paperSize: 'A4',
    scopeLabel: t('reports.printDocument.maintenanceRequestScope'),
  };
}
