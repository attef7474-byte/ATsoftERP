# API Proof — Operational Stock Receiving (Batch S)

## Test Results

| # | Test | Endpoint / Check | Expected | Actual | Status |
|---|------|------------------|----------|--------|--------|
| A1 | No-token rejection | GET /inventory/operational-receipts | 401 | 401 | PASS |
| A2 | Bad-token rejection | GET /inventory/operational-receipts (Bearer invalid) | 401 | 401 | PASS |
| A3 | No passwordHash leak | GET /auth/me | no passwordHash | no passwordHash | PASS |
| L1 | Paginated list | GET /inventory/operational-receipts?page=1&limit=10 | data[] + count | OK | PASS |
| L2 | Search by reason | GET /inventory/operational-receipts?search=Batch | results >=0 | OK | PASS |
| C1 | Create DRAFT receipt | POST /inventory/operational-receipts | 201 + DRAFT | DRAFT | PASS |
| C2 | Code (receipt number) | POST response | non-null code | "OR-..." | PASS |
| C3 | companyId | POST response | matches input | OK | PASS |
| C4 | warehouseId | POST response | matches input | OK | PASS |
| C5 | reason | POST response | matches input | OK | PASS |
| C6 | notes | POST response | matches input | OK | PASS |
| C7 | lines array | POST response | array with 1 element | OK | PASS |
| C8 | line.productId | POST response | matches input | OK | PASS |
| C9 | line.quantity | POST response | 10 | 10 | PASS |
| C10 | line.notes | POST response | "Proof line" | OK | PASS |
| C11 | line.status | POST response | N/A (no field on model) | — | N/A |
| C12 | status DRAFT | POST response | "DRAFT" | DRAFT | PASS |
| G1 | GET by ID | GET /operational-receipts/:id | same id returned | OK | PASS |
| G2 | GET includes lines | GET /operational-receipts/:id | lines > 0 | 1 | PASS |
| G3 | Summary endpoint | GET /operational-receipts/:id/summary | receiptId match | OK | PASS |
| U1 | PATCH notes | PATCH /operational-receipts/:id | notes updated | OK | PASS |
| U2 | PATCH keeps DRAFT | GET after PATCH | still DRAFT | DRAFT | PASS |
| L01 | Add line | POST /operational-receipts/:id/lines | new line returned | PASS | PASS |
| L02 | Update line | PATCH /operational-receipts/:id/lines/:lineId | quantity changed | OK | PASS |
| L03 | Delete line | DELETE /operational-receipts/:id/lines/:lineId | removed | OK | PASS |
| W1 | SUBMIT | POST /operational-receipts/:id/submit | SUBMITTED | SUBMITTED | PASS |
| W2 | APPROVE | POST /operational-receipts/:id/approve | APPROVED | APPROVED | PASS |
| W3 | POST | POST /operational-receipts/:id/post | POSTED | POSTED | PASS |
| W4 | postedAt | POST response | timestamp | OK | PASS |
| W5 | postedById | POST response | user id | OK | PASS |
| W6 | code unchanged | POST response | same code | OK | PASS |
| T1 | Cannot submit POSTED | POST /.../submit on POSTED | 400/409 | 400 | PASS |
| T2 | Cannot approve POSTED | POST /.../approve on POSTED | 400/409 | 400 | PASS |
| T3 | Cannot post again | POST /.../post on POSTED | 400/409 | 400 | PASS |
| T4 | Cannot delete POSTED | DELETE /.../ on POSTED | 400/409 | 400 | PASS |
| T5 | Cannot add line POSTED | POST /.../lines on POSTED | 400/409 | 400 | PASS |
| T6 | Cannot update line POSTED | PATCH /.../lines/:lid on POSTED | 400/409 | 400 | PASS |
| T7 | Cannot delete line POSTED | DELETE /.../lines/:lid on POSTED | 400/409 | 400 | PASS |
| T8 | Cannot patch POSTED | PATCH /.../ on POSTED | 400/409 | 400 | PASS |
| CN1 | Create for cancel | POST /operational-receipts | DRAFT | DRAFT | PASS |
| CN2 | Cancel DRAFT | POST /.../cancel | CANCELLED | CANCELLED | PASS |
| CN3 | Cannot submit CANCELLED | POST /.../submit on CANCELLED | 400/409 | 400 | PASS |
| RJ1 | Create for reject | POST /operational-receipts | DRAFT | DRAFT | PASS |
| RJ2 | Submit for reject | POST /.../submit | SUBMITTED | SUBMITTED | PASS |
| RJ3 | Reject | POST /.../reject | REJECTED | REJECTED | PASS |
| RJ4 | Cannot post REJECTED | POST /.../post on REJECTED | 400/409 | 400 | PASS |
| RJ5 | Cancel REJECTED | POST /.../cancel on REJECTED | N/A (design: only DRAFT/SUBMITTED) | — | N/A |
| SM1 | Movement created | GET /inventory/ledger/by-source?sourceType=... | STOCK_RECEIVING | PASS |
| SM2 | Movement type | response.movementType | STOCK_RECEIVING | OK | PASS |
| SM3 | Direction IN | response.lines[0].direction | IN | IN | PASS |
| SM4 | Status POSTED | response.status | POSTED | POSTED | PASS |
| SM5 | References receipt | response.sourceId | equals receipt id | OK | PASS |
| SM6 | ProductId on line | lines[0].productId | matches | OK | PASS |
| SM7 | Quantity > 0 | lines[0].quantity | > 0 | 10 | PASS |
| SM8 | movementNumber | response.movementNumber | non-null | "IM-..." | PASS |
| SM9 | Balance increased | GET /inventory/balances | qty > 0 | > 0 | PASS |
| SM10 | No CORRECTION | GET /inventory/ledger/movements?movementType=CORRECTION | 0 | 0 | PASS |
| LR1 | Ledger shows receipt | GET /inventory/ledger/by-warehouse | STOCK_RECEIVING present | OK | PASS |
| LR2 | Recon accessible | GET /inventory/reconciliation/by-warehouse/:id | OK | OK | PASS |
| BR1 | Transfer works | GET /inventory/transfers | data[] | OK | PASS |
| BQ1 | Count works | GET /inventory/counts | data[] | OK | PASS |
| BP1 | Recon works after receiving | GET /inventory/reconciliation/by-warehouse/:id | OK | OK | PASS |
| I1 | No purchasing | GET /purchasing/orders | 404 | 404 | PASS |
| I2 | No supplier invoice | GET /purchasing/invoices | 404 | 404 | PASS |
| I3 | No finance entries | GET /finance/entries | 404 | 404 | PASS |
| I4 | No accounting journals | GET /accounting/journals | 404 | 404 | PASS |
| I5 | No HR | GET /hr/employees | 404 | 404 | PASS |
| I6 | No Sales | GET /sales/orders | 404 | 404 | PASS |
| I7 | No PO ref on receipt | receipt.purchaseOrderId | undefined | undefined | PASS |
| I8 | No invoice ref on receipt | receipt.supplierInvoiceId | undefined | undefined | PASS |
| I9 | No finance ref on receipt | receipt.financeEntryId | undefined | undefined | PASS |
| NS1 | Code OR- prefix | receipt.code | matches ^OR- | OR-... | PASS |
| P1 | Permission module exists | GET /permissions?module=inventory:operational-receipt | total > 0 | 9 | PASS |
| P2 | CRUD keys present | permission keys | create + read | OK | PASS |
| SEC1 | No secrets leak | GET /health | no password/secret/key | OK | PASS |
| SQL1 | SQL Server runtime | data returned | non-null | OK | PASS |
| SB1 | No direct balance edit | PATCH /inventory/balances/:id | 400/404/405 | 404 | PASS |

## Summary

| Metric | Value |
|--------|-------|
| Total checks | **75** |
| Passed | **75** |
| Failed | **0** |
| N/A | **3** (line.status, cancel REJECTED, stock issue route) |
| Date | 2026-07-27 |
| Runtime | SQL Server (live API on localhost:4000) |
| Auth | JWT bearer |
| Test script | `batch-s-api-proof.ps1` (75 checks covering auth, CRUD, workflow, transitions, stock movement, ledger, reconciliation, cross-batch, isolation, permissions, security) |
