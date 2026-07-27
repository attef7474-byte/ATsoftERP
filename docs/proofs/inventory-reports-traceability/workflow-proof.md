# Workflow Proof: Inventory Reports & Traceability (Batch U)

## Workflow Scope
Batch U is **read-only** — no new transaction workflows are introduced. The reporting layer provides visibility into existing inventory workflows.

## Traceability Workflow
1. User navigates to `/admin/inventory/reports/traceability`
2. Searches by movement ID or reference
3. System retrieves movement detail + source resolution
4. Source resolution displays linked document (PO, transfer, adjustment, receiving, etc.)
5. Full line-item details with direction (IN/OUT), quantities, and batch/lot info

## Exception Detection Workflow
1. User navigates to `/admin/inventory/reports/exceptions`
2. System queries movements without linked source documents
3. System queries movements with negative balance impact
4. Results displayed in exception cards and detailed table

## Stock Card Workflow
1. User navigates to `/admin/inventory/reports/stock-card`
2. Selects product via F9 lookup
3. System retrieves opening balance at date range start
4. Movements listed chronologically with running balance
5. Closing balance displayed at footer

## No Workflow Changes
- No create/edit/delete operations added
- No approval workflows modified
- No notification workflows added
- All existing Batch O–T workflows continue functioning
