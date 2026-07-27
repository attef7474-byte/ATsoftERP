# Design Proof — Operational Stock Receiving

## Architecture
```
Frontend (React/Next.js)         Backend (NestJS)               Database (SQL Server)
─────────────────────────────    ─────────────────────────       ───────────────────────
operational-receipts/page.tsx →  InventoryOperationalReceipts → inventory_operational_receipts
                                 Controller                     inventory_operational_receipt_lines
                                  ↓
operational-receipts/[id]     →  InventoryOperationalReceipts
/page.tsx                        Service
                                  ↓ (on POST)
                                 InventoryMovement (STOCK_RECEIVING)
                                 InventoryBalance (+increment)
```

## Data Flow
1. User creates receipt (DRAFT) → stores in `inventory_operational_receipts` + `_lines`
2. User submits → status = SUBMITTED
3. Approver approves → status = APPROVED
4. System posts → creates `InventoryMovement` (STOCK_RECEIVING, IN direction), increments `InventoryBalance`
5. Receipt becomes POSTED — immutable

## No Purchasing Dependency
The receipt stands alone — no PO reference. Supplier fields are informational only.
