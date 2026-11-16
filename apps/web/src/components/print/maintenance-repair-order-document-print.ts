import { printFormatters, PrintPreparationError, type PrintColumn, type PrintDocumentModel, type PrintField, type PrintSection } from '../../lib/print';
import { translateEnum } from '../../lib/i18n/literals';
import type { Locale } from '../../lib/i18n/types';
import type { RepairOrderAction, RepairOrderDetail } from '../../app/admin/maintenance/repair-orders/repair-order-api';
import type { PrintTranslate } from './PrintDocument';

/**
 * Repair Order business document.
 *
 * The business identity is the generated repair order number plus the spare part
 * code/name. Raw foreign keys (`sparePartId`, `machineId`, `warehouseId`,
 * `maintenanceRequestId`, `replacementHistoryId`, movement ids, user ids, lock
 * fields) are never printed: the detail page already exposes several of them as
 * raw ids, but a document must present business references only. Performer
 * identity is omitted entirely because the detail contract carries only
 * `performedByUserId`, never a display name.
 */

interface RepairRecordRow {
  field: string;
  value: string;
}

function partLabel(data: RepairOrderDetail): string | undefined {
  const part = data.sparePart;
  if (!part) return undefined;
  const name = part.name || part.code;
  if (!name) return undefined;
  return part.code ? `[${part.code}] ${name}` : name;
}

function actionTypeLabel(type: string, t: PrintTranslate, locale: Locale): string {
  const key = `maintenance.repairActionType_${type}`;
  const label = t(key);
  return label === key ? translateEnum(type, locale) : label;
}

function repairRecordColumns(t: PrintTranslate): PrintColumn<RepairRecordRow>[] {
  return [
    { key: 'field', label: t('maintenance.repairRecordField'), value: row => row.field, align: 'start', priority: 1, width: 22 },
    { key: 'value', label: t('maintenance.repairRecordValue'), value: row => row.value, align: 'start', priority: 1, width: 78 },
  ];
}

function repairActionColumns(t: PrintTranslate, locale: Locale): PrintColumn<RepairOrderAction>[] {
  const fmt = printFormatters(locale);
  return [
    { key: 'actionType', label: t('maintenance.repairActionType'), value: row => actionTypeLabel(row.actionType, t, locale), align: 'start', priority: 1, width: 16 },
    { key: 'actionStatus', label: t('maintenance.repairActionStatus'), value: row => translateEnum(row.actionStatus || '', locale), align: 'center', priority: 2, width: 12 },
    { key: 'description', label: t('maintenance.repairActionDescription'), value: row => row.description, align: 'start', priority: 1, width: 32 },
    { key: 'result', label: t('maintenance.repairActionResult'), value: row => row.result, align: 'start', priority: 2, width: 24 },
    { key: 'performedAt', label: t('maintenance.repairActionPerformedAt'), value: row => fmt.dateTime(row.performedAt), align: 'center', priority: 3, width: 18, direction: 'ltr' },
    { key: 'duration', label: t('maintenance.durationMinutes'), value: row => row.durationMinutes, format: value => fmt.number(value), align: 'end', priority: 3, width: 10 },
  ];
}

export function maintenanceRepairOrderDocumentModel(
  data: RepairOrderDetail,
  t: PrintTranslate,
  locale: Locale,
): Omit<PrintDocumentModel, 'locale' | 'company' | 'branch' | 'printedBy' | 'printedAt' | 'timeZone'> {
  if (!data || !data.repairOrderNumber || !data.sparePart) throw new PrintPreparationError('unavailable');
  const fmt = printFormatters(locale);
  const actions = data.actions || [];

  const optionalDate = (value: string | null | undefined) => (value ? fmt.dateTime(value) : undefined);
  const namedRef = (ref: { code?: string | null; name?: string | null } | null | undefined) => {
    if (!ref) return undefined;
    if (ref.code && ref.name) return `[${ref.code}] ${ref.name}`;
    return ref.name || ref.code || undefined;
  };

  const metadata: PrintField[] = [
    { label: t('common.status'), value: translateEnum(data.status, locale) },
    { label: t('maintenance.condition'), value: translateEnum(data.sourceCondition, locale) },
    { label: t('maintenance.targetCondition'), value: data.targetCondition ? translateEnum(data.targetCondition, locale) : undefined },
    { label: t('maintenance.repairSourceQuantity'), value: fmt.quantity(data.sourceQuantity) },
    { label: t('maintenance.repairReservedQuantity'), value: fmt.quantity(data.reservedQuantity ?? 0) },
    { label: t('maintenance.repairedQuantity'), value: fmt.quantity(data.repairedQuantity ?? 0) },
    { label: t('maintenance.scrappedQuantity'), value: fmt.quantity(data.scrappedQuantity ?? 0) },
    { label: t('maintenance.repairRemainingQuantity'), value: fmt.quantity(data.remainingQuantity ?? data.sourceQuantity ?? 0) },
    { label: t('maintenance.warehouse'), value: data.warehouse ? namedRef(data.warehouse) : undefined },
    { label: t('maintenance.machine'), value: data.machine ? namedRef(data.machine) : undefined },
    { label: t('maintenance.repairComponent'), value: data.machineComponent ? namedRef(data.machineComponent) : undefined },
    { label: t('maintenance.repairRequest'), value: data.maintenanceRequest ? `[${data.maintenanceRequest.requestNumber || ''}] ${data.maintenanceRequest.title || ''}`.trim() : undefined },
    { label: t('maintenance.repairExternal'), value: data.externalRepair ? t('common.yes') : t('common.no') },
    { label: t('maintenance.repairExternalProvider'), value: data.externalRepair ? data.externalRepairProviderName || undefined : undefined },
    { label: t('maintenance.repairOpenedAt'), value: optionalDate(data.openedAt) },
    { label: t('maintenance.repairInspectionStartedAt'), value: optionalDate(data.inspectionStartedAt) },
    { label: t('maintenance.repairStartedAt'), value: optionalDate(data.repairStartedAt) },
    { label: t('maintenance.repairTestStartedAt'), value: optionalDate(data.testStartedAt) },
    { label: t('maintenance.repairCompletedAt'), value: optionalDate(data.completedAt) },
    { label: t('maintenance.repairCancelledAt'), value: optionalDate(data.cancelledAt) },
    { label: t('common.createdAt'), value: optionalDate(data.createdAt) },
    { label: t('common.updatedAt'), value: optionalDate(data.updatedAt) },
  ];

  // Optional money is omitted until recorded, so a draft order does not print
  // placeholder amounts as if they were zero-cost decisions.
  const summary: PrintField[] = [];
  if (data.estimatedRepairCost != null) summary.push({ label: t('maintenance.repairEstimatedCost'), value: fmt.number(data.estimatedRepairCost) });
  if (data.actualRepairCost != null) summary.push({ label: t('maintenance.repairActualCost'), value: fmt.number(data.actualRepairCost) });
  summary.push({ label: t('maintenance.repairActions'), value: fmt.number(actions.length) });

  const narrative: RepairRecordRow[] = [];
  const pushNarrative = (label: string, value: string | null | undefined) => {
    if (value && value.trim()) narrative.push({ field: label, value: value.trim() });
  };
  pushNarrative(t('maintenance.inspectionResult'), data.inspectionResult);
  pushNarrative(t('maintenance.failureDescription'), data.failureDescription);
  pushNarrative(t('maintenance.repairDescription'), data.repairDescription);
  pushNarrative(t('maintenance.testResult'), data.testResult);
  pushNarrative(t('maintenance.repairTestNotes'), data.testNotes);
  pushNarrative(t('maintenance.repairReason'), data.cancelReason);

  const sections: PrintSection<any>[] = [];
  if (narrative.length) sections.push({ title: t('maintenance.repairRecord'), columns: repairRecordColumns(t), rows: narrative });
  if (actions.length) sections.push({ title: t('maintenance.repairActions'), columns: repairActionColumns(t, locale), rows: actions });

  const notes = [t('reports.printDocument.repairOrderDocumentNote')];
  if (data.notes) notes.push(data.notes);

  return {
    mode: 'DOCUMENT',
    title: t('maintenance.repairOrder'),
    subtitle: partLabel(data),
    documentNumber: data.repairOrderNumber,
    metadata,
    summary,
    sections,
    notes,
    orientation: 'portrait',
    paperSize: 'A4',
    scopeLabel: t('reports.printDocument.repairOrderDocumentScope'),
  };
}
