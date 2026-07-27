# Operational Stock Receiving — Analysis

## Overview
Batch S adds **Operational Stock Receiving** — a workflow for receiving stock into inventory without purchasing. This covers receiving from operations (e.g., production returns, donated goods, sample receipts, inter-company transfers without PO).

## Scope
- New models: `InventoryOperationalReceipt`, `InventoryOperationalReceiptLine`
- Workflow: DRAFT → SUBMITTED → APPROVED → POSTED (or REJECTED / CANCELLED)
- On POST: creates an `INVENTORY_MOVEMENT` with type `STOCK_RECEIVING`, increments `InventoryBalance`
- No Purchasing, Finance, HR, Sales activated
- `STOCK_RECEIVING` movement type added to allowed types

## Design Decisions
1. Receipts are NOT tied to purchase orders — purely operational
2. Each receipt targets a single warehouse (with optional location)
3. Supplier fields are informational only (no supplier validation)
4. Movement type `STOCK_RECEIVING` is distinct from `PURCHASE_RECEIPT`
5. Pricing is NOT tracked — quantity-only
