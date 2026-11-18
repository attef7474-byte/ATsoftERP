import { createEmptyIssueLine, IssueLineDraft, newIssueClientId } from '../../app/admin/inventory/finished-goods-issues/_components/lines-editor';
export type IssueType = 'SPARE_PART' | 'RAW_MATERIAL' | 'FINISHED_GOODS';
/**
 * The native authority behind a unified issue-voucher row. A spare-part row can
 * either be a line under a maintenance request or an independent spare-part
 * issue voucher; every other type is a flat authority.
 */
export type IssueAuthority = 'MAINTENANCE_REQUEST_PART' | 'SPARE_PART_ISSUE' | 'FLAT';
export const ISSUE_TYPES: IssueType[] = ['SPARE_PART', 'RAW_MATERIAL', 'FINISHED_GOODS'];
export const ISSUE_PERMISSION = {
  SPARE_PART: 'maintenance-request-parts',
  RAW_MATERIAL: 'production-material-document',
  FINISHED_GOODS: 'finished-goods-issue'
};
/**
 * Resolves the permission prefix of the authority that will actually receive
 * the request. Linked spare parts stay with `maintenance-request-parts:*`;
 * standalone spare parts use the dedicated `spare-part-issue:*` keys.
 */
export function issuePermissionPrefix(type: IssueType, authority?: IssueAuthority): string {
  if (authority === 'SPARE_PART_ISSUE') return 'spare-part-issue';
  if (authority === 'MAINTENANCE_REQUEST_PART') return 'maintenance-request-parts';
  return ISSUE_PERMISSION[type];
}
export interface IssueVoucherForm {
  issueType: IssueType | '';
  warehouseId: string;
  maintenanceRequestId: string;
  machineName: string;
  productionOrderId: string;
  productionRunId: string;
  date: string;
  purpose: string;
  notes: string;
  requestId: string;
  lines: IssueLineDraft[];
}
export function emptyIssueVoucher(): IssueVoucherForm {
  return {
    issueType: '',
    warehouseId: '',
    maintenanceRequestId: '',
    machineName: '',
    productionOrderId: '',
    productionRunId: '',
    date: new Date().toISOString().slice(0, 10),
    purpose: '',
    notes: '',
    requestId: newIssueClientId(),
    lines: [createEmptyIssueLine()]
  };
}
export function changeIssueType(form: IssueVoucherForm, issueType: IssueType | ''): IssueVoucherForm {
  return {
    ...emptyIssueVoucher(),
    issueType,
    date: form.date
  };
}
export function changeIssueWarehouse(form: IssueVoucherForm, warehouseId: string): IssueVoucherForm {
  return {
    ...form,
    warehouseId,
    lines: [createEmptyIssueLine()]
  };
}
export function changeProductionOrder(form: IssueVoucherForm, productionOrderId: string): IssueVoucherForm {
  return {
    ...form,
    productionOrderId,
    productionRunId: '',
    lines: [createEmptyIssueLine()]
  };
}
export function changeProductionRun(form: IssueVoucherForm, productionRunId: string): IssueVoucherForm {
  return {
    ...form,
    productionRunId,
    lines: [createEmptyIssueLine()]
  };
}
/**
 * The maintenance request is optional for spare parts. Only the part lines and
 * the derived machine name depend on it; the warehouse, issue type, date,
 * purpose and notes belong to the voucher itself and are always preserved.
 */
export function changeMaintenanceRequest(form: IssueVoucherForm, maintenanceRequestId: string, machineName = form.machineName): IssueVoucherForm {
  return {
    ...form,
    maintenanceRequestId,
    machineName: maintenanceRequestId ? machineName : '',
    lines: form.lines.map(line => ({
      ...createEmptyIssueLine(),
      key: line.key
    }))
  };
}
export function issueEndpoint(type: IssueType, maintenanceRequestId?: string): string {
  if (type === 'SPARE_PART') {
    // Never build a nested URL with an empty parent id. No maintenance request
    // means the independent spare-part issue authority.
    if (!maintenanceRequestId) return '/inventory/spare-part-issues';
    return `/maintenance/requests/${maintenanceRequestId}/parts`;
  }
  return type === 'RAW_MATERIAL' ? '/production/material-documents' : '/inventory/finished-goods-issues';
}
function issueLinesPayload(form: IssueVoucherForm): Record<string, unknown>[] {
  return form.lines.map(line => ({
    sparePartId: line.sparePartId || undefined,
    productId: line.productId || undefined,
    quantity: Number(line.quantity),
    unit: line.unit || undefined,
    productUomId: line.productUomId || undefined,
    warehouseLocationId: line.warehouseLocationId || undefined,
    batchNumber: line.batchNumber || undefined,
    serialNumber: line.serialNumber || undefined,
    expiryDate: line.expiryDate || undefined,
    notes: line.notes || undefined
  }));
}
export function issuePayload(form: IssueVoucherForm, edit = false): Record<string, unknown> {
  if (form.issueType === 'SPARE_PART') {
    // Linked spare parts keep their existing single-line maintenance payload.
    if (form.maintenanceRequestId) {
      const line = form.lines[0];
      return {
        ...(!edit ? {
          sparePartId: line.sparePartId
        } : {}),
        warehouseId: form.warehouseId,
        quantity: Number(line.quantity),
        unit: line.unit || undefined,
        reason: form.purpose,
        usageNote: form.notes || line.notes
      };
    }
    // Standalone spare-part issues are real multi-line inventory documents.
    return {
      ...(!edit ? {
        issueWarehouseId: form.warehouseId,
        requestId: form.requestId
      } : {}),
      issueDate: form.date,
      purpose: form.purpose,
      notes: form.notes,
      lines: issueLinesPayload(form)
    };
  }
  const lines = issueLinesPayload(form);
  if (form.issueType === 'RAW_MATERIAL') return {
    ...(!edit ? {
      documentType: 'ISSUE',
      issueWarehouseId: form.warehouseId,
      productionOrderId: form.productionOrderId,
      productionRunId: form.productionRunId,
      requestId: form.requestId
    } : {}),
    documentDate: form.date,
    notes: form.notes,
    lines
  };
  return {
    ...(!edit ? {
      issueWarehouseId: form.warehouseId,
      requestId: form.requestId
    } : {}),
    issueDate: form.date,
    purpose: form.purpose,
    notes: form.notes,
    lines
  };
}
export function formFromIssue(type: IssueType, record: any, maintenanceRequestId?: string): IssueVoucherForm {
  const linkedSpare = type === 'SPARE_PART' && Boolean(maintenanceRequestId);
  const sourceLines = type !== 'SPARE_PART'
    ? (record.lines || [])
    : linkedSpare
      ? [{
        ...record,
        productId: record.sparePart?.productId
      }]
      : (record.lines || []);
  return {
    ...emptyIssueVoucher(),
    issueType: type,
    warehouseId: record.issueWarehouseId || record.warehouseId || '',
    maintenanceRequestId: linkedSpare ? maintenanceRequestId! : '',
    machineName: record.machine?.name || '',
    productionOrderId: record.productionOrderId || '',
    productionRunId: record.productionRunId || '',
    date: String(record.issueDate || record.documentDate || record.createdAt).slice(0, 10),
    purpose: record.purpose || record.reason || '',
    notes: record.notes || record.usageNote || '',
    lines: sourceLines.map((line: any) => ({
      ...createEmptyIssueLine(),
      productId: line.productId || line.sparePart?.productId || '',
      uoms: line.product?.uoms || [],
      sparePartId: line.sparePartId || (line.sparePart?.id ?? undefined),
      quantity: String(line.quantity ?? line.requestedQuantity ?? ''),
      unit: line.unit || '',
      productUomId: line.productUomId || record.movement?.lines?.find((movementLine: any) => movementLine.productId === line.productId && Number(movementLine.quantity) === Number(line.quantity) && movementLine.unit === line.unit)?.productUomId || '',
      warehouseLocationId: line.warehouseLocationId || '',
      batchNumber: line.batchNumber || '',
      serialNumber: line.serialNumber || '',
      expiryDate: line.expiryDate ? String(line.expiryDate).slice(0, 10) : '',
      notes: line.notes || ''
    }))
  };
}
