# Phase 2: Physical Count Design — InventoryPhysicalCount

## Model: InventoryPhysicalCount
- id: String @id @default(cuid())
- countNumber: String @unique (prefix PC-)
- companyId: String
- company: Company @relation
- branchId: String?
- branch: Branch? @relation
- warehouseId: String
- warehouse: Warehouse @relation
- status: String @default("DRAFT")
  - DRAFT → SUBMITTED → APPROVED → POSTED
  - DRAFT → CANCELLED
  - SUBMITTED → REJECTED (→ back to DRAFT)
  - APPROVED → CANCELLED (before posting)
- countDate: DateTime @default(now())
- frozenAt: DateTime? (when system qty is frozen)
- submittedAt: DateTime?
- submittedById: String?
- approvedAt: DateTime?
- approvedById: String?
- rejectedAt: DateTime?
- rejectedById: String?
- rejectedReason: String?
- postedAt: DateTime?
- postedById: String?
- cancelledAt: DateTime?
- cancelledById: String?
- notes: String?
- createdById: String?
- createdAt: DateTime @default(now())
- updatedAt: DateTime @updatedAt
- deletedAt: DateTime?

## Model: InventoryPhysicalCountLine
- id: String @id @default(cuid())
- physicalCountId: String
- physicalCount: InventoryPhysicalCount @relation
- productId: String
- product: Product @relation
- warehouseLocationId: String?
- warehouseLocation: WarehouseLocation? @relation
- systemQty: Float @default(0) (frozen at count creation)
- countedQty: Float? (entered by counter)
- varianceQty: Float? (calculated by backend: countedQty - systemQty)
- notes: String?
- createdAt: DateTime @default(now())
- updatedAt: DateTime @updatedAt

Unique: [physicalCountId, productId, warehouseLocationId]

## Workflow
1. DRAFT: Create count header, auto-generate countNumber from PHYSICAL_COUNT sequence
2. Add lines: Select products to count, backend auto-fills systemQty from InventoryBalance
3. SUBMIT: Set status to SUBMITTED, record submittedAt/submittedById
4. APPROVE: Set status to APPROVED, record approvedAt/approvedById
5. POST: Create movements, update StockBalance, set status to POSTED
6. REJECT: Set status to DRAFT (back to editing), record rejectedAt/rejectedById/rejectedReason
7. CANCELLED: Can cancel from DRAFT or APPROVED states

## System Quantity Freeze
- When count is created, systemQty is NOT frozen yet
- System quantity is frozen when the count is first submitted (lines created from balances)
- The frozen systemQty represents the balance at the time of count creation

## Backend-Enforced Rules
- systemQty is always filled from InventoryBalance, never from frontend
- varianceQty is always calculated as countedQty - systemQty
- POST is all-or-nothing (transactional)
- A line with variance 0 does not generate a movement line
