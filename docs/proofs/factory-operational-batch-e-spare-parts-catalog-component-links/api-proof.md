# API Proof — Spare Parts Catalog (Batch E)

Date: 2026-07-23
Server: http://localhost:4000/api/v1

## Test Results — 21/21 PASS

| # | Test | Status |
|---|------|--------|
| 1 | List spare parts (GET /maintenance/spare-parts) | PASS |
| 2 | Create QA spare part (POST /maintenance/spare-parts) | PASS |
| 3 | Get spare part detail (GET /maintenance/spare-parts/:id) | PASS |
| 4 | Update spare part (PATCH /maintenance/spare-parts/:id) | PASS |
| 5 | Reload get detail verifies persistence | PASS |
| 6 | Duplicate spare part code rejected (409) | PASS |
| 7 | Create component spare part link (POST /maintenance/component-spare-parts) | PASS |
| 8 | Duplicate component spare part link rejected (409) | PASS |
| 9 | Invalid componentId rejected (400) | PASS |
| 10 | Invalid sparePartId rejected (400) | PASS |
| 11 | Create machine spare part link (POST /maintenance/machine-spare-parts) | PASS |
| 12 | Duplicate machine spare part link rejected (409) | PASS |
| 13 | Invalid machineId rejected (400) | PASS |
| 14 | Quantity <= 0 rejected (400) | PASS |
| 15 | Deactivate spare part (PATCH /maintenance/spare-parts/:id/deactivate) | PASS |
| 16 | Unauthorized returns 401 (no token on all endpoints) | PASS |
| 17 | Component endpoint shows linked spare part | PASS |
| 18 | Machine endpoint shows linked spare part | PASS |
| 19 | No inventory movement created | PASS (total=0) |
| 20 | No stock balance changed | PASS (no change) |
| 21 | No finance entry created | PASS (Finance module inactive) |

## Summary
- Total: 21
- Passed: 21
- Failed: 0
- No stock movement verified
- No stock balance change verified
- No finance entry verified
