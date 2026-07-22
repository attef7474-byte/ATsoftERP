export interface Warehouse {
  id: string;
  companyId: string;
  branchId?: string | null;
  code: string;
  name: string;
  location?: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
  company?: { id: string; name: string };
  branch?: { id: string; name: string };
  locations?: WarehouseLocation[];
  _count?: { locations: number; balances: number };
}

export interface WarehouseLocation {
  id: string;
  warehouseId: string;
  code: string;
  name: string;
  barcode?: string | null;
  status: string;
  createdAt?: string;
  updatedAt?: string;
  warehouse?: { id: string; name: string; code: string };
}

export interface ProductCategory {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  parentId?: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
  parent?: { id: string; name: string };
  children?: { id: string; name: string; code: string }[];
  _count?: { children: number; products: number };
}

export interface Product {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  categoryId?: string | null;
  unit: string;
  barcode?: string | null;
  qrCode?: string | null;
  image?: string | null;
  minStock: number;
  maxStock: number;
  status: string;
  createdAt: string;
  updatedAt: string;
  category?: { id: string; name: string; code: string };
}

export type InventoryCountStatus = 'DRAFT' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
export type InventoryCountLineStatus = 'PENDING' | 'COUNTED' | 'VERIFIED';
export type InventoryAdjustmentStatus = 'DRAFT' | 'POSTED' | 'CANCELLED';

export interface InventoryCount {
  id: string;
  countNumber: string;
  companyId: string;
  branchId: string;
  warehouseId: string;
  status: InventoryCountStatus;
  countDate: string;
  startedAt?: string | null;
  completedAt?: string | null;
  cancelledAt?: string | null;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
  company?: { id: string; name: string };
  branch?: { id: string; name: string };
  warehouse?: { id: string; name: string; code: string };
  lines?: InventoryCountLine[];
  _count?: { lines: number };
  summary?: { linesCount: number; countedLinesCount: number; verifiedLinesCount: number; totalDifferenceQty: number };
}

export interface InventoryCountLine {
  id: string;
  countId: string;
  productId: string;
  warehouseLocationId?: string | null;
  systemQty: number;
  countedQty?: number | null;
  differenceQty?: number | null;
  status: InventoryCountLineStatus;
  countedAt?: string | null;
  countedById?: string | null;
  verifiedAt?: string | null;
  verifiedById?: string | null;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
  product?: { id: string; name: string; code: string; unit: string };
  warehouseLocation?: { id: string; name: string; code: string };
}

export interface InventoryAdjustment {
  id: string;
  adjustmentNumber: string;
  companyId: string;
  branchId: string;
  warehouseId: string;
  inventoryCountId?: string | null;
  status: InventoryAdjustmentStatus;
  adjustmentDate: string;
  reason?: string | null;
  notes?: string | null;
  postedAt?: string | null;
  postedById?: string | null;
  cancelledAt?: string | null;
  createdAt: string;
  updatedAt: string;
  company?: { id: string; name: string };
  branch?: { id: string; name: string };
  warehouse?: { id: string; name: string; code: string };
  inventoryCount?: { id: string; countNumber: string; status: string };
  lines?: InventoryAdjustmentLine[];
  _count?: { lines: number };
}

export interface InventoryAdjustmentLine {
  id: string;
  adjustmentId: string;
  productId: string;
  warehouseLocationId?: string | null;
  systemQty: number;
  countedQty: number;
  differenceQty: number;
  notes?: string | null;
  product?: { id: string; name: string; code: string; unit: string };
  warehouseLocation?: { id: string; name: string; code: string };
}

export interface InventoryBalance {
  id: string;
  productId: string;
  warehouseId: string;
  warehouseLocationId?: string | null;
  quantity: number;
  updatedAt: string;
  product?: { id: string; name: string; code: string; unit: string };
  warehouse?: { id: string; name: string; code: string };
  warehouseLocation?: { id: string; name: string; code: string };
}
