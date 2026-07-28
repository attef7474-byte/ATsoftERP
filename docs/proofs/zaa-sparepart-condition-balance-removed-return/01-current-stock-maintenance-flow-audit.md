# Z-AA Phase 1 — Current Stock & Maintenance Flow Audit

## Baseline
- **Commit**: `e52a1a6` (UX-0)
- **Branch**: `main`
- **Clean working tree**: YES

---

## 1. Current Stock Model (Product-based only)

### InventoryBalance (schema.prisma:768)
```
id, warehouseId, locationId?, productId, quantity, batchNumber?, serialNumber?, expiryDate?, createdAt, updatedAt
@@unique([warehouseId, productId, batchNumber, serialNumber])
```
- **NO** sparePartId
- **NO** condition field
- Product-based only per AGENTS.md rule

### InventoryMovement (schema.prisma:928)
```
movementNumber (unique), companyId, branchId?, warehouseId, movementType, status, sourceType?, sourceId?, ...
```
### InventoryMovementLine (schema.prisma:967)
```
movementId, productId, warehouseLocationId?, quantity, unit?, direction, notes
```
- **NO** sparePartId
- **NO** condition field

---

## 2. Warehouse Model
```
warehouseType: String?  // Batch Y addition — nullable, values: SPARE_PART, PRODUCT, RAW_MATERIAL, etc.
```

---

## 3. SparePart Model (schema.prisma:1463)
```
productId: String?  // Optional link to Product
```
- No condition balance fields
- Classification fields: `technicalClassification`, `usageType`, `nature`, `importance` (Batch Y)

---

## 4. MaintenanceRequestRequiredPart (schema.prisma:1623)

### Stock Issue Fields (Batch O)
| Field | Type | Purpose |
|-------|------|---------|
| `issuedQuantity` | Float? | Quantity actually issued |
| `returnedQuantity` | Float? | Quantity returned |
| `stockIssueStatus` | String? | NOT_ISSUED / PARTIALLY_ISSUED / FULLY_ISSUED |
| `warehouseId` | String? | Warehouse source for issue |

### Condition & Replacement Fields (Batch Y Addendum)
| Field | Type | Purpose |
|-------|------|---------|
| `issuedStockCondition` | String? | NEW / USED_SERVICEABLE / USED_REPAIRABLE / DAMAGED_REPAIRABLE / DAMAGED_NOT_REPAIRABLE |
| `replacementAction` | String? | RETURNED_REMOVED_PART / NO_REMOVED_PART / NEW_INSTALLATION |
| `removedPartCondition` | String? | Condition of removed part |
| `removedPartWarehouseId` | String? | Warehouse for removed part return |
| `removedPartQuantity` | Float? | Quantity of removed part |
| `removedPartReturnedByUserId` | String? | Who returned |
| `removedPartReceivedByUserId` | String? | Who received |
| `removedPartReturnedAt` | DateTime? | When returned |
| `noReturnReason` | String? | Why not returned |

---

## 5. MaintenanceStockIssueService — Current Flow

### `issue()` Method Flow (line 85)
1. Find part line, validate status = APPROVED or RESERVED
2. Validate replacementAction + stockCondition
3. Validate remaining quantity
4. Check SparePart.productId exists
5. Validate warehouse exists + type NOT in FORBIDDEN_WAREHOUSE_TYPES (PRODUCT, RAW_MATERIAL)
6. Auto-derive cost hierarchy from machine
7. **Transaction**:
   - Generate movementNumber via NumberingService
   - Find/Create InventoryBalance
   - Validate sufficient balance
   - Decrement InventoryBalance
   - Create InventoryMovement OUT + line
   - Update RequiredPart: issuedQuantity, stockIssueStatus, warehouseId, condition/action fields (metadata only)
8. Audit log

### `returnStock()` Method Flow (line 241)
1. Validates net issued > 0
2. Checks returnQuantity <= net issued
3. **Transaction**:
   - Generate movementNumber
   - Find InventoryBalance for original warehouse
   - Increment InventoryBalance
   - Create InventoryMovement IN
   - Update returnedQuantity + stockIssueStatus
4. Audit log

---

## 6. Current Gaps (What Z-AA Must Fix)

| # | Gap | Severity |
|---|-----|----------|
| 1 | **No SparePartConditionBalance** — condition-level stock not tracked separately | CRITICAL |
| 2 | **No SparePartConditionMovement** — condition-level movements not recorded | CRITICAL |
| 3 | **Removed part return is metadata only** — `removedPart*` fields are stored but no InventoryBalance IN is created | CRITICAL |
| 4 | **No condition balance validation on issue** — `issuedStockCondition` is stored but not validated against available condition balance | HIGH |
| 5 | **No condition balance decrement on issue** — only InventoryBalance is decremented | HIGH |
| 6 | **Duplicate issue not fully guarded** — `stockIssueStatus` partially guards but no explicit duplicate check | MEDIUM |
| 7 | **ReturnStock doesn't handle condition** — condition balance not updated on return | MEDIUM |
| 8 | **No condition balance visibility API** — no endpoint to query condition balances | MEDIUM |

---

## 7. Existing APIs / Constants / i18n

### Condition Values (already exist in code)
```typescript
const VALID_STOCK_CONDITIONS = ['NEW', 'USED_SERVICEABLE', 'USED_REPAIRABLE', 'DAMAGED_REPAIRABLE', 'DAMAGED_NOT_REPAIRABLE'];
const VALID_REPLACEMENT_ACTIONS = ['RETURNED_REMOVED_PART', 'NO_REMOVED_PART', 'NEW_INSTALLATION'];
const FORBIDDEN_WAREHOUSE_TYPES = ['PRODUCT', 'RAW_MATERIAL'];
```

### Existing i18n API Messages (api-messages.ts)
- `stock.conditionBalanceNotFound` — AR/EN
- `stock.insufficientBalance` — AR/EN
- `stock.sparePartWarehouseRequired` — AR/EN
- `stock.productWarehouseBlocked` — AR/EN
- `stock.rawMaterialWarehouseBlocked` — AR/EN
- `maintenance.sparePartNotFound` — AR/EN
- `maintenance.invalidReplacementAction` — AR/EN
- `maintenance.removedPartRequired` — AR/EN
- `maintenance.noReturnReasonRequired` — AR/EN
- `validation.invalidQuantity` — AR/EN

### Frontend i18n (maintenance.ts)
- `issuedStockCondition`, `conditionNew`, `conditionUsedServiceable`, etc.
- `replacementAction`, `removedPartFields`, `removedPartCondition`, `removedPartWarehouse`, `removedPartQuantity`

### Numbering Constants (numbering.constants.ts)
- 45 entity types defined
- **Missing**: `SPARE_PART_CONDITION_MOVEMENT`

---

## 8. Implementation Plan

1. **Phase 2**: Add `SparePartConditionBalance` + `SparePartConditionMovement` to Prisma schema + SQL migration
2. **Phase 3**: Add `SPARE_PART_CONDITION_MOVEMENT` to numbering constants + seed
3. **Phase 4**: Create `SparePartConditionService` (balance + movement operations)
4. **Phase 5**: Integrate into `MaintenanceStockIssueService.issue()` — condition balance OUT + removed part return IN
5. **Phase 6**: Add API endpoints for condition balances/movements
6. **Phase 7**: Frontend — condition balance display + warehouse filtering
7. **Phase 8**: Security/permissions/audit
8. **Phase 9-14**: Proof docs + validation
