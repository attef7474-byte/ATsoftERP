import { printFormatters, PrintPreparationError, type PrintColumn, type PrintDocumentModel, type PrintSection } from '../../lib/print';
import { translateEnum } from '../../lib/i18n/literals';
import type { Locale } from '../../lib/i18n/types';
import type { MaintenanceWorkOrder, MaintenanceWorkOrderCostEntry, MaintenanceWorkOrderPart } from '../../lib/admin-types';
import type { PrintTranslate } from './PrintDocument';

function partLabel(part: MaintenanceWorkOrderPart): string | undefined {
  const item = part.sparePart || part.product;
  if (!item) return undefined;
  return item.code ? `[${item.code}] ${item.name}` : item.name;
}

function costTypeLabel(type: string, t: PrintTranslate, locale: Locale): string {
  const suffix = type.charAt(0) + type.slice(1).toLowerCase();
  const key = `maintenance.costType${suffix}`;
  const label = t(key);
  return label === key ? translateEnum(type, locale) : label;
}

function workOrderPartColumns(t: PrintTranslate, locale: Locale): PrintColumn<MaintenanceWorkOrderPart>[] {
  const fmt = printFormatters(locale);
  return [
    { key: 'item', label: t('maintenance.workOrderItem'), value: partLabel, align: 'start', priority: 1, width: 30 },
    { key: 'quantity', label: t('maintenance.partQuantity'), value: row => row.quantity, format: value => fmt.quantity(value), align: 'end', priority: 1, width: 10 },
    { key: 'unit', label: t('maintenance.unit'), value: row => row.unit, align: 'center', priority: 2, width: 8 },
    { key: 'unitCost', label: t('maintenance.partUnitCost'), value: row => row.unitCost, format: value => fmt.number(value), align: 'end', priority: 3, width: 14 },
    { key: 'totalCost', label: t('maintenance.partTotalCost'), value: row => row.totalCost, format: value => fmt.number(value), align: 'end', priority: 2, width: 14 },
    { key: 'issueStatus', label: t('maintenance.partIssueStatus'), value: row => translateEnum(row.stockIssueStatus, locale), align: 'center', priority: 3, width: 14 },
    { key: 'issuedQuantity', label: t('maintenance.partIssuedQuantity'), value: row => row.issuedQuantity, format: value => fmt.quantity(value), align: 'end', priority: 3, width: 12 },
  ];
}

function workOrderCostColumns(t: PrintTranslate, locale: Locale): PrintColumn<MaintenanceWorkOrderCostEntry>[] {
  const fmt = printFormatters(locale);
  return [
    { key: 'type', label: t('maintenance.costType'), value: row => costTypeLabel(row.type, t, locale), align: 'start', priority: 2, width: 18 },
    { key: 'description', label: t('maintenance.costDescription'), value: row => row.description, align: 'start', priority: 1, width: 36 },
    { key: 'amount', label: t('maintenance.costAmount'), value: row => row.amount, format: value => fmt.number(value), align: 'end', priority: 2, width: 18 },
    { key: 'incurredAt', label: t('maintenance.costIncurredAt'), value: row => fmt.dateTime(row.incurredAt), align: 'center', priority: 3, width: 22, direction: 'ltr' },
    { key: 'createdBy', label: t('common.createdBy'), value: row => row.createdBy?.name, align: 'start', priority: 3, width: 20 },
  ];
}

export function maintenanceWorkOrderDocumentModel(
  data: MaintenanceWorkOrder,
  t: PrintTranslate,
  locale: Locale,
): Omit<PrintDocumentModel, 'locale' | 'company' | 'branch' | 'printedBy' | 'printedAt' | 'timeZone'> {
  if (!data || !data.workOrderNumber || !data.title) throw new PrintPreparationError('unavailable');
  const fmt = printFormatters(locale);
  const parts = data.parts || [];
  const costs = data.costEntries || [];
  const scopeType = data.scopeType === 'MACHINE'
    ? t('maintenance.scopeTypeMachine')
    : data.scopeType === 'PRODUCTION_LINE'
      ? t('maintenance.scopeTypeProductionLine')
      : t('maintenance.scopeTypeGeneral');
  const metadata = [
    { label: t('common.status'), value: translateEnum(data.status, locale) },
    { label: t('maintenance.workOrderType'), value: translateEnum(data.type, locale) },
    { label: t('maintenance.workOrderPriority'), value: translateEnum(data.priority, locale) },
    { label: t('maintenance.scopeType'), value: scopeType },
    { label: t('maintenance.workOrderMachine'), value: data.machine ? `[${data.machine.code}] ${data.machine.name}` : undefined },
    { label: t('maintenance.productionLine'), value: data.productionLine?.name },
    { label: t('maintenance.workOrderComponent'), value: data.machineComponent ? `[${data.machineComponent.code}] ${data.machineComponent.name}` : undefined },
    { label: t('maintenance.costCenter'), value: data.costCenter?.name },
    { label: t('maintenance.workLocation'), value: data.workLocation },
    { label: t('maintenance.workOrderRequest'), value: data.request ? `[${data.request.requestNumber}] ${data.request.title || ''}`.trim() : undefined },
    { label: t('maintenance.workOrderWarehouse'), value: data.warehouse ? `[${data.warehouse.code}] ${data.warehouse.name}` : undefined },
    { label: t('maintenance.workOrderAssignedTo'), value: data.assignedTo?.name },
    { label: t('maintenance.workOrderSupervisor'), value: data.supervisor?.name },
    { label: t('common.createdBy'), value: data.createdBy?.name },
    { label: t('maintenance.workOrderPlannedStart'), value: fmt.dateTime(data.plannedStartAt) },
    { label: t('maintenance.workOrderPlannedEnd'), value: fmt.dateTime(data.plannedEndAt) },
    { label: t('maintenance.startedAt'), value: fmt.dateTime(data.startedAt) },
    { label: t('maintenance.completedAt'), value: fmt.dateTime(data.completedAt) },
    { label: t('common.createdAt'), value: fmt.dateTime(data.createdAt) },
    { label: t('common.updatedAt'), value: fmt.dateTime(data.updatedAt) },
    { label: t('maintenance.cancelledAt'), value: fmt.dateTime(data.cancelledAt) },
    { label: t('maintenance.cancelReason'), value: data.cancelReason },
  ];
  const summary = [
    { label: t('maintenance.workOrderEstimatedCost'), value: fmt.number(data.estimatedCost) },
    { label: t('maintenance.workOrderActualCost'), value: fmt.number(data.actualCost) },
    { label: t('maintenance.workOrderParts'), value: fmt.number(parts.length) },
    { label: t('maintenance.workOrderCostEntries'), value: fmt.number(costs.length) },
  ];
  const sections: PrintSection<any>[] = [];
  if (parts.length) sections.push({ title: t('maintenance.workOrderParts'), columns: workOrderPartColumns(t, locale), rows: parts });
  if (costs.length) sections.push({ title: t('maintenance.workOrderCostEntries'), columns: workOrderCostColumns(t, locale), rows: costs });
  const notes = [t('reports.printDocument.workOrderDocumentNote')];
  if (data.notes) notes.push(data.notes);
  return {
    mode: 'DOCUMENT',
    title: t('maintenance.maintenanceWorkOrder'),
    subtitle: data.title,
    description: data.description || undefined,
    documentNumber: data.workOrderNumber,
    metadata,
    summary,
    sections,
    notes,
    orientation: 'portrait',
    paperSize: 'A4',
    scopeLabel: t('reports.printDocument.workOrderDocumentScope'),
  };
}
