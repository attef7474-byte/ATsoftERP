import { PaginationMeta } from './common';

export type InventoryValuationStatus = 'DRAFT' | 'INITIALIZING' | 'ACTIVE' | 'RETIRED';

export type InventoryValuationMethod = 'WEIGHTED_AVERAGE';

export interface InventoryValuationPolicyWarehouse {
  id: string;
  code: string;
  name: string;
}

export interface InventoryValuationPolicy {
  id: string;
  companyId: string;
  warehouseId: string;
  warehouse?: InventoryValuationPolicyWarehouse;
  method: InventoryValuationMethod | string;
  status: InventoryValuationStatus | string;
  currencyCode: string;
  activatedById?: string | null;
  activatedAt?: string | null;
  initializedById?: string | null;
  initializedAt?: string | null;
  createdById?: string | null;
  updatedById?: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
  _count?: { initializations: number };
}

export interface InventoryValuationReadyProduct {
  productId: string;
  quantitySnapshot: string;
  initialized: boolean;
}

export interface InventoryValuationReadiness {
  policyId: string;
  warehouseId: string;
  method: InventoryValuationMethod | string;
  status: InventoryValuationStatus | string;
  currencyCode: string;
  productsWithStock: number;
  initializedCount: number;
  missingCount: number;
  ready: boolean;
  missingProducts: InventoryValuationReadyProduct[];
  products: InventoryValuationReadyProduct[];
}

export interface InventoryValuationInitializationProduct {
  id: string;
  code: string;
  name: string;
  unit: string;
}

export interface InventoryValuationInitializationWarehouse {
  id: string;
  code: string;
  name: string;
}

export interface InventoryValuationInitialization {
  id: string;
  companyId: string;
  warehouseId: string;
  warehouse?: InventoryValuationInitializationWarehouse;
  productId: string;
  product?: InventoryValuationInitializationProduct;
  policyId: string;
  quantitySnapshot: string;
  unitCost: string;
  totalValue: string;
  currencyCode: string;
  reason?: string | null;
  createdById?: string | null;
  createdAt: string;
}

export interface InventoryValuationInitializationList {
  data: InventoryValuationInitialization[];
  meta: PaginationMeta;
}

export interface InventoryValuationPolicyList {
  data: InventoryValuationPolicy[];
  meta: PaginationMeta;
}

export interface CreateInventoryValuationPolicyInput {
  warehouseId: string;
  method: InventoryValuationMethod;
  currencyCode: string;
}

export interface UpdateInventoryValuationPolicyInput {
  method?: InventoryValuationMethod;
  currencyCode?: string;
}

export interface CostInput {
  lineId: string;
  unitCost: number;
  currencyCode: string;
  reason?: string;
}

export interface InitializeProductInput {
  productId: string;
  unitCost: number;
  reason?: string;
}

export interface ValuationSourceLine {
  lineId: string;
  productId: string;
  productName: string;
  productCode: string;
  unit?: string | null;
  quantity: number;
  unitCost?: string | null;
  currencyCode?: string | null;
  valuationReason?: string | null;
  sourceId: string;
  sourceCode: string;
  sourceDocDate?: string | null;
}
