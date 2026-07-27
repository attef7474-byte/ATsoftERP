# Admin Types Proof — Operational Stock Receiving

## Types Added
File: `apps/web/src/lib/admin-types/inventory.ts`

### OperationalReceipt
```typescript
export interface OperationalReceipt {
  id: string; code: string; companyId: string;
  branchId?: string | null; warehouseId: string;
  warehouse?: { id: string; name: string; code: string };
  locationId?: string | null; location?: { id: string; name: string; code: string };
  status: OperationalReceiptStatus; documentDate: string;
  reason: string; notes?: string | null;
  supplierName?: string | null; supplierDoc?: string | null;
  submittedAt?: string | null; approvedAt?: string | null;
  rejectedAt?: string | null; postedAt?: string | null;
  cancelledAt?: string | null; createdById: string;
  createdAt: string; updatedAt: string;
  company?: { id: string; name: string };
  branch?: { id: string; name: string };
  lines?: OperationalReceiptLine[];
  _count?: { lines: number };
}
```

### OperationalReceiptLine
```typescript
export interface OperationalReceiptLine {
  id: string; receiptId: string; productId: string;
  quantity: number; notes?: string | null;
  createdAt: string; updatedAt: string;
  product?: { id: string; name: string; code: string; unit: string };
}
```

### OperationalReceiptStatus
```typescript
export type OperationalReceiptStatus = 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED' | 'POSTED' | 'CANCELLED';
```
