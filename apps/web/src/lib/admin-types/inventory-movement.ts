export type InventoryMovementStatus = 'DRAFT' | 'POSTED' | 'CANCELLED';
export type InventoryMovementType = 'OPENING' | 'PURCHASE_RECEIPT' | 'SALES_ISSUE' | 'PRODUCTION_RECEIPT' | 'PRODUCTION_ISSUE' | 'TRANSFER_IN' | 'TRANSFER_OUT' | 'ADJUSTMENT_IN' | 'ADJUSTMENT_OUT' | 'COUNT_ADJUSTMENT' | 'MAINTENANCE_ISSUE' | 'MAINTENANCE_RETURN' | 'COUNT_VARIANCE_IN' | 'COUNT_VARIANCE_OUT';
export type InventoryMovementDirection = 'IN' | 'OUT';

export interface InventoryMovement {
  id: string;
  movementNumber: string;
  companyId: string;
  branchId: string;
  warehouseId: string;
  movementType: InventoryMovementType;
  status: InventoryMovementStatus;
  direction: InventoryMovementDirection;
  movementDate: string;
  sourceType?: string | null;
  sourceId?: string | null;
  postedAt?: string | null;
  postedById?: string | null;
  cancelledAt?: string | null;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
  company?: { id: string; name: string };
  branch?: { id: string; name: string };
  warehouse?: { id: string; name: string; code: string };
  lines?: InventoryMovementLine[];
  _count?: { lines: number };
}

export interface InventoryMovementLine {
  id: string;
  movementId: string;
  productId: string;
  warehouseLocationId?: string | null;
  quantity: number;
  direction: InventoryMovementDirection;
  unit?: string | null;
  notes?: string | null;
  product?: { id: string; name: string; code: string; unit: string };
  warehouseLocation?: { id: string; name: string; code: string };
}

export type ReconciliationStatus = 'MATCHED' | 'DIFFERENCE' | 'NEGATIVE_BALANCE' | 'ORPHAN_BALANCE' | 'ORPHAN_MOVEMENT' | 'INVALID_MOVEMENT';

export interface ReconciliationLine {
  productId: string;
  productName?: string;
  productCode?: string;
  warehouseId: string;
  warehouseName?: string;
  locationId?: string | null;
  currentBalance: number;
  expectedBalance: number;
  difference: number;
  status: ReconciliationStatus;
}

export interface ReconciliationSummary {
  totalBalances: number;
  totalMovements: number;
  matched: number;
  differences: number;
  negativeBalances: number;
  totalCurrentQty: number;
  totalExpectedQty: number;
  totalDifference: number;
}

export interface LedgerMovementFilter {
  page?: number;
  limit?: number;
  search?: string;
  warehouseId?: string;
  movementType?: string;
  status?: string;
  direction?: string;
  productId?: string;
  sourceType?: string;
  sourceId?: string;
  dateFrom?: string;
  dateTo?: string;
}
