import type { LedgerMovementFilter } from '../../../../lib/admin-types/inventory-movement';
import type { PrintPage } from '../../../../lib/print';

/**
 * Explicit Ledger filter contract. Only fields in this shape may leave the
 * browser. `companyId`, `branchId`, `sourceId` and raw `locationId` are
 * deliberately absent: tenant scope is derived server-side from the active
 * operational context, and no readable source/location selector exists yet.
 */
export interface LedgerFilterDraft {
  search: string;
  warehouseId: string;
  productId: string;
  movementType: string;
  status: string;
  direction: string;
  sourceType: string;
  dateFrom: string;
  dateTo: string;
}

export function createEmptyLedgerFilters(): LedgerFilterDraft {
  return {
    search: '',
    warehouseId: '',
    productId: '',
    movementType: '',
    status: '',
    direction: '',
    sourceType: '',
    dateFrom: '',
    dateTo: '',
  };
}

export const LEDGER_MOVEMENT_TYPES = [
  'OPENING',
  'PURCHASE_RECEIPT',
  'SALES_ISSUE',
  'PRODUCTION_RECEIPT',
  'PRODUCTION_ISSUE',
  'TRANSFER_IN',
  'TRANSFER_OUT',
  'ADJUSTMENT_IN',
  'ADJUSTMENT_OUT',
  'COUNT_ADJUSTMENT',
  'MAINTENANCE_ISSUE',
  'MAINTENANCE_RETURN',
  'COUNT_VARIANCE_IN',
  'COUNT_VARIANCE_OUT',
  'OPENING_BALANCE',
  'STOCK_RECEIVING',
  'STOCK_TRANSFER_IN',
  'STOCK_TRANSFER_OUT',
  'STOCK_ADJUSTMENT_IN',
  'STOCK_ADJUSTMENT_OUT',
  'PRODUCTION_RETURN',
  'PRODUCTION_MATERIAL_ISSUE',
  'PRODUCTION_CONSUMPTION',
  'PRODUCTION_FG_RECEIPT',
  'PRODUCTION_FG_RECEIPT_REVERSAL',
  'FINISHED_GOODS_ISSUE',
  'FINISHED_GOODS_ISSUE_REVERSAL',
  'MANUAL',
] as const;

export const LEDGER_STATUSES = ['DRAFT', 'POSTED', 'CANCELLED'] as const;
export const LEDGER_DIRECTIONS = ['IN', 'OUT'] as const;

export const LEDGER_SOURCE_TYPES = [
  'STOCK_TRANSFER',
  'OPERATIONAL_RECEIPT',
  'STOCK_ADJUSTMENT',
  'PHYSICAL_COUNT',
  'OPENING_BALANCE',
  'PRODUCTION_MATERIAL_DOCUMENT',
  'PRODUCTION_FINISHED_GOODS_RECEIPT',
  'FINISHED_GOODS_ISSUE',
  'MAINTENANCE_WORK_ORDER',
  'MAINTENANCE_EXECUTION',
  'MAINTENANCE_PART_LINE',
  'INVENTORY_MOVEMENT_LINE',
  'INVENTORY_MOVEMENT_REVERSAL',
  'MANUAL',
  'REVERSE',
] as const;

export function normalizeLedgerFilters(
  draft: LedgerFilterDraft,
): LedgerMovementFilter {
  const normalized: LedgerMovementFilter = {};
  const search = draft.search.trim();
  if (search) normalized.search = search;
  if (draft.warehouseId) normalized.warehouseId = draft.warehouseId;
  if (draft.productId) normalized.productId = draft.productId;
  if (draft.movementType) normalized.movementType = draft.movementType;
  if (draft.status) normalized.status = draft.status;
  if (draft.direction) normalized.direction = draft.direction;
  if (draft.sourceType) normalized.sourceType = draft.sourceType;
  if (draft.dateFrom) normalized.dateFrom = draft.dateFrom;
  if (draft.dateTo) normalized.dateTo = draft.dateTo;
  return normalized;
}

export function buildLedgerQueryParams(
  draft: LedgerFilterDraft,
  page: number,
  limit = 20,
): Record<string, string | number> {
  const safePage =
    Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
  const safeLimit = Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : 20;
  return {
    page: safePage,
    limit: safeLimit,
    ...normalizeLedgerFilters(draft),
  };
}

export interface LedgerMovementsPageResponse<Row> {
  data?: Row[] | null;
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
    totalPages?: number;
  } | null;
}

/**
 * Minimal response-shape adapter for the bounded print collector. Business
 * rows are passed through untouched; only `meta.limit` becomes `pageSize`.
 * Missing/invalid meta values stay invalid on purpose so the collector fails
 * closed instead of printing an unverified register.
 */
export function normalizeLedgerPrintPage<Row>(
  payload: LedgerMovementsPageResponse<Row> | null | undefined,
): PrintPage<Row> {
  const meta = payload?.meta ?? {};
  return {
    rows: Array.isArray(payload?.data) ? payload.data : [],
    total: Number(meta.total),
    page: Number(meta.page),
    pageSize: Number(meta.limit),
    totalPages: Number(meta.totalPages),
  };
}
