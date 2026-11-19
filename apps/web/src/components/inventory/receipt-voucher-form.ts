/**
 * Phase 2 — pure form model for the single user-facing "إذن استلام".
 *
 * It deliberately contains no persistence logic. The selected receipt type
 * resolves to one of two existing authorities:
 *   - RAW_MATERIAL / SPARE_PART / PACKAGING_MATERIAL / CONSUMABLE / GENERAL
 *     -> InventoryOperationalReceipt
 *   - FINISHED_GOOD -> ProductionFinishedGoodsReceipt
 *
 * Operational lines intentionally do NOT carry batch/serial/expiry/UOM fields;
 * those fields belong to the production authority and are never faked here.
 */
export type ReceiptType =
  | 'RAW_MATERIAL'
  | 'SPARE_PART'
  | 'FINISHED_GOOD'
  | 'PACKAGING_MATERIAL'
  | 'CONSUMABLE'
  | 'GENERAL';

export const RECEIPT_TYPES: ReceiptType[] = [
  'RAW_MATERIAL',
  'SPARE_PART',
  'FINISHED_GOOD',
  'PACKAGING_MATERIAL',
  'CONSUMABLE',
  'GENERAL',
];

export type ReceiptAuthority = 'OPERATIONAL' | 'PRODUCTION_FG';
export const RECEIPT_SOURCES = ['SUPPLIER', 'RETURN', 'INTERNAL', 'OTHER'] as const;
export type ReceiptSource = (typeof RECEIPT_SOURCES)[number];

export function receiptAuthorityFor(type: ReceiptType): ReceiptAuthority {
  return type === 'FINISHED_GOOD' ? 'PRODUCTION_FG' : 'OPERATIONAL';
}

export function itemTypeForReceiptType(type: ReceiptType): ReceiptType {
  return type;
}

export function receiptEndpoint(type: ReceiptType): string {
  return receiptAuthorityFor(type) === 'PRODUCTION_FG'
    ? '/production/finished-goods-receipts'
    : '/inventory/operational-receipts';
}

export function nativeReceiptPath(type: ReceiptType, id: string): string {
  return `${receiptEndpoint(type)}/${id}`;
}

export function receiptTypeLabelKey(type: ReceiptType): string {
  switch (type) {
    case 'RAW_MATERIAL': return 'inventory.receiptVoucher.typeRawMaterial';
    case 'SPARE_PART': return 'inventory.receiptVoucher.typeSparePart';
    case 'FINISHED_GOOD': return 'inventory.receiptVoucher.typeFinishedGood';
    case 'PACKAGING_MATERIAL': return 'inventory.receiptVoucher.typePackagingMaterial';
    case 'CONSUMABLE': return 'inventory.receiptVoucher.typeConsumable';
    case 'GENERAL': return 'inventory.receiptVoucher.typeGeneral';
  }
}

export function receiptSourceLabelKey(source: ReceiptSource): string {
  switch (source) {
    case 'SUPPLIER': return 'inventory.receiptVoucher.sourceSupplier';
    case 'RETURN': return 'inventory.receiptVoucher.sourceReturn';
    case 'INTERNAL': return 'inventory.receiptVoucher.sourceInternal';
    case 'OTHER': return 'inventory.receiptVoucher.sourceOther';
  }
}

export function receiptTypeFromRecord(record: any): ReceiptType | '' {
  if (record?.authority === 'PRODUCTION_FG') return 'FINISHED_GOOD';
  const type = record?.receiptType;
  return RECEIPT_TYPES.includes(type) ? type : '';
}

export interface ReceiptVoucherLine {
  key: string;
  productId: string;
  quantity: string;
  notes: string;
  unit: string;
  productUomId: string;
  warehouseLocationId: string;
  batchNumber: string;
  serialNumber: string;
  expiryDate: string;
}

export function newReceiptLineId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random()}`;
}

export function createEmptyReceiptLine(): ReceiptVoucherLine {
  return {
    key: newReceiptLineId(),
    productId: '',
    quantity: '',
    notes: '',
    unit: '',
    productUomId: '',
    warehouseLocationId: '',
    batchNumber: '',
    serialNumber: '',
    expiryDate: '',
  };
}

export interface ReceiptVoucherForm {
  receiptType: ReceiptType | '';
  warehouseId: string;
  locationId: string;
  receiptSource: ReceiptSource | '';
  supplierName: string;
  supplierDoc: string;
  reason: string;
  notes: string;
  documentDate: string;
  productionOrderId: string;
  productionRunId: string;
  requestId: string;
  lines: ReceiptVoucherLine[];
}

export function emptyReceiptVoucher(): ReceiptVoucherForm {
  return {
    receiptType: '',
    warehouseId: '',
    locationId: '',
    receiptSource: '',
    supplierName: '',
    supplierDoc: '',
    reason: '',
    notes: '',
    documentDate: new Date().toISOString().slice(0, 10),
    productionOrderId: '',
    productionRunId: '',
    requestId: newReceiptLineId(),
    lines: [createEmptyReceiptLine()],
  };
}

/** The first field is authoritative: changing it clears every downstream choice. */
export function changeReceiptType(
  form: ReceiptVoucherForm,
  receiptType: ReceiptType | '',
): ReceiptVoucherForm {
  return {
    ...emptyReceiptVoucher(),
    receiptType,
    documentDate: form.documentDate,
    requestId: form.requestId,
  };
}

export function changeReceiptWarehouse(form: ReceiptVoucherForm, warehouseId: string): ReceiptVoucherForm {
  return {
    ...form,
    warehouseId,
    locationId: '',
    lines: [createEmptyReceiptLine()],
  };
}

export function changeReceiptLocation(form: ReceiptVoucherForm, locationId: string): ReceiptVoucherForm {
  return {
    ...form,
    locationId,
    lines: [createEmptyReceiptLine()],
  };
}

export function changeReceiptSource(
  form: ReceiptVoucherForm,
  receiptSource: ReceiptSource | '',
): ReceiptVoucherForm {
  return {
    ...form,
    receiptSource,
    supplierName: '',
    supplierDoc: '',
  };
}

export function changeProductionOrder(form: ReceiptVoucherForm, productionOrderId: string): ReceiptVoucherForm {
  return {
    ...form,
    productionOrderId,
    productionRunId: '',
    lines: [createEmptyReceiptLine()],
  };
}

export function changeProductionRun(form: ReceiptVoucherForm, productionRunId: string): ReceiptVoucherForm {
  return {
    ...form,
    productionRunId,
    lines: [createEmptyReceiptLine()],
  };
}

function operationalLinesPayload(form: ReceiptVoucherForm) {
  return form.lines.map((line) => ({
    productId: line.productId,
    quantity: Number(line.quantity),
    notes: line.notes.trim() || undefined,
  }));
}

function finishedGoodsLinesPayload(form: ReceiptVoucherForm) {
  return form.lines.map((line) => ({
    productId: line.productId,
    quantity: Number(line.quantity),
    unit: line.unit.trim(),
    productUomId: line.productUomId || undefined,
    warehouseLocationId: line.warehouseLocationId || undefined,
    batchNumber: line.batchNumber.trim() || undefined,
    serialNumber: line.serialNumber.trim() || undefined,
    expiryDate: line.expiryDate || undefined,
    notes: line.notes.trim() || undefined,
  }));
}

/** Builds the exact DTO accepted by the selected native authority. */
export function receiptPayload(form: ReceiptVoucherForm, edit = false): Record<string, unknown> {
  if (!form.receiptType) return {};

  if (receiptAuthorityFor(form.receiptType) === 'PRODUCTION_FG') {
    return {
      ...(!edit ? {
        requestId: form.requestId,
        productionOrderId: form.productionOrderId,
        productionRunId: form.productionRunId,
        receiptWarehouseId: form.warehouseId || undefined,
      } : {}),
      receiptDate: form.documentDate || undefined,
      notes: form.notes.trim() || undefined,
      lines: finishedGoodsLinesPayload(form),
    };
  }

  return {
    warehouseId: form.warehouseId,
    locationId: form.locationId || undefined,
    reason: form.reason.trim(),
    notes: form.notes.trim() || undefined,
    receiptType: form.receiptType,
    receiptSource: form.receiptSource || undefined,
    supplierName: form.receiptSource === 'SUPPLIER' ? form.supplierName.trim() || undefined : undefined,
    supplierDoc: form.receiptSource === 'SUPPLIER' ? form.supplierDoc.trim() || undefined : undefined,
    lines: operationalLinesPayload(form),
  };
}

export function formFromReceipt(record: any): ReceiptVoucherForm {
  const receiptType = receiptTypeFromRecord(record);
  const base = emptyReceiptVoucher();
  const sourceLines: any[] = Array.isArray(record?.lines) ? record.lines : [];
  return {
    ...base,
    receiptType,
    warehouseId: record?.warehouseId || record?.receiptWarehouseId || '',
    locationId: record?.locationId || '',
    receiptSource: receiptType === 'FINISHED_GOOD' ? '' : (record?.receiptSource || ''),
    supplierName: record?.supplierName || '',
    supplierDoc: record?.supplierDoc || '',
    reason: record?.reason || '',
    notes: record?.notes || '',
    documentDate: String(record?.documentDate || record?.receiptDate || base.documentDate).slice(0, 10),
    productionOrderId: record?.productionOrderId || '',
    productionRunId: record?.productionRunId || '',
    lines: sourceLines.length ? sourceLines.map((line) => ({
      ...createEmptyReceiptLine(),
      productId: line.productId || '',
      quantity: String(line.quantity ?? ''),
      notes: line.notes || '',
      unit: line.unit || '',
      productUomId: line.productUomId || '',
      warehouseLocationId: line.warehouseLocationId || '',
      batchNumber: line.batchNumber || '',
      serialNumber: line.serialNumber || '',
      expiryDate: line.expiryDate ? String(line.expiryDate).slice(0, 10) : '',
    })) : base.lines,
  };
}
