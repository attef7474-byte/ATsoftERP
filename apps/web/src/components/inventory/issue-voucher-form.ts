import { createEmptyIssueLine, IssueLineDraft, newIssueClientId } from '../../app/admin/inventory/finished-goods-issues/_components/lines-editor';
export type IssueType = 'SPARE_PART' | 'RAW_MATERIAL' | 'FINISHED_GOODS';
export const ISSUE_TYPES: IssueType[] = ['SPARE_PART', 'RAW_MATERIAL', 'FINISHED_GOODS'];
export const ISSUE_PERMISSION = {
  SPARE_PART: 'maintenance-request-parts',
  RAW_MATERIAL: 'production-material-document',
  FINISHED_GOODS: 'finished-goods-issue'
};
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
export function changeMaintenanceRequest(form: IssueVoucherForm, maintenanceRequestId: string, machineName = form.machineName): IssueVoucherForm {
  return {
    ...form,
    maintenanceRequestId,
    machineName: maintenanceRequestId ? machineName : '',
    lines: [createEmptyIssueLine()]
  };
}
export function issueEndpoint(type: IssueType, maintenanceRequestId?: string): string {
  if (type === 'SPARE_PART') return `/maintenance/requests/${maintenanceRequestId}/parts`;
  return type === 'RAW_MATERIAL' ? '/production/material-documents' : '/inventory/finished-goods-issues';
}
export function issuePayload(form: IssueVoucherForm, edit = false): Record<string, unknown> {
  if (form.issueType === 'SPARE_PART') {
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
  const lines = form.lines.map(line => ({
    productId: line.productId,
    quantity: Number(line.quantity),
    unit: line.unit,
    productUomId: line.productUomId || undefined,
    warehouseLocationId: line.warehouseLocationId || undefined,
    batchNumber: line.batchNumber || undefined,
    serialNumber: line.serialNumber || undefined,
    expiryDate: line.expiryDate || undefined,
    notes: line.notes || undefined
  }));
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
  const spare = type === 'SPARE_PART';
  return {
    ...emptyIssueVoucher(),
    issueType: type,
    warehouseId: record.issueWarehouseId || record.warehouseId || '',
    maintenanceRequestId: maintenanceRequestId || '',
    machineName: record.machine?.name || '',
    productionOrderId: record.productionOrderId || '',
    productionRunId: record.productionRunId || '',
    date: String(record.issueDate || record.documentDate || record.createdAt).slice(0, 10),
    purpose: record.purpose || record.reason || '',
    notes: record.notes || record.usageNote || '',
    lines: (spare ? [{
      ...record,
      productId: record.sparePart?.productId
    }] : record.lines || []).map((line: any) => ({
      ...createEmptyIssueLine(),
      productId: line.productId || '',
      uoms: line.product?.uoms || [],
      sparePartId: line.sparePartId,
      quantity: String(line.quantity),
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
