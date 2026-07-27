# Console & Network Proof — Operational Stock Receiving (Batch S)

## Console Errors
- **Total console errors**: 0
- **ChunkLoadError**: 0
- **Page errors**: 0
- **Runtime exceptions**: 0

## Network Failures
- **Total failed requests**: 0
- **_next/static failures**: 0
- **API 4xx/5xx**: 0 (all authenticated requests returned 200/201)

## API Calls Verified (via browser network tab)

| # | Action | Method | Endpoint | Status | Verified |
|---|--------|--------|----------|--------|----------|
| 1 | List receipts | GET | /api/v1/inventory/operational-receipts | 200 | PASS |
| 2 | Create receipt | POST | /api/v1/inventory/operational-receipts | 201 | PASS |
| 3 | Get detail | GET | /api/v1/inventory/operational-receipts/:id | 200 | PASS |
| 4 | Update receipt | PATCH | /api/v1/inventory/operational-receipts/:id | 200 | PASS |
| 5 | Submit | POST | /api/v1/inventory/operational-receipts/:id/submit | 200 | PASS |
| 6 | Approve | POST | /api/v1/inventory/operational-receipts/:id/approve | 200 | PASS |
| 7 | Post | POST | /api/v1/inventory/operational-receipts/:id/post | 200 | PASS |
| 8 | Reject | POST | /api/v1/inventory/operational-receipts/:id/reject | 200 | PASS |
| 9 | Cancel | POST | /api/v1/inventory/operational-receipts/:id/cancel | 200 | PASS |
| 10 | Delete | DELETE | /api/v1/inventory/operational-receipts/:id | 200 | PASS |
| 11 | Add line | POST | /api/v1/inventory/operational-receipts/:id/lines | 201 | PASS |
| 12 | Summary | GET | /api/v1/inventory/operational-receipts/:id/summary | 200 | PASS |
| 13 | Stock movement | GET | /api/v1/inventory/ledger/by-source | 200 | PASS |
| 14 | Stock balance | GET | /api/v1/inventory/balances | 200 | PASS |

## Summary

| Metric | Value |
|--------|-------|
| Console errors | 0 |
| Network failures | 0 |
| ChunkLoadError | 0 |
| _next/static failures | 0 |
| API errors | 0 |
| Screenshots | DISABLED_BY_USER |
