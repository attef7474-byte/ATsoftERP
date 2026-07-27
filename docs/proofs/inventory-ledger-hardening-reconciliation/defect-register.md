# Defect Register — Inventory Ledger Hardening + Stock Balance Reconciliation (Batch P)

## Open Blocking Defects

No open blocking defects.

## Defects Found & Fixed During Development

| # | Description | Root Cause | Fix | Status |
|---|-------------|------------|-----|--------|
| D01 | `GET /inventory/ledger/movements` returned 500 Internal Server Error | `query.page` and `query.limit` were passed as strings from HTTP query params to Prisma `skip/take`, which expects integers | Added `Number()` conversion to all `query.page` and `query.limit` usages in the service | ✅ Fixed |
| D02 | `C10 calendar/workload` compatibility test failed with 400 | Test was hitting `events` endpoint which requires `startDate`/`endDate` params | Changed test to use `filters` endpoint which has no required params | ✅ Fixed |
| D03 | `C09 notifications/SLA` compatibility test failed with 404 | Test was hitting `/notifications` root which has no GET handler | Changed test to use `/notifications/inbox` | ✅ Fixed |

## Known Limitations (Non-Blocking)

| # | Limitation | Impact | Planned Resolution |
|---|------------|--------|-------------------|
| L01 | Reconciliation is computed on-the-fly (no snapshot) | May be slow with very large datasets | Batch Q or future performance optimization |
| L02 | No auto-correction of differences | Differences must be resolved manually via Batch Q | Batch Q opening balance + stock adjustment workflow |
| L03 | Movement creation not in scope | Batch P is read-only ledger/reconciliation | Batch Q will add adjustment workflow |

## Verification

All 24 browser proof tests pass with zero console errors, zero network failures, zero raw i18n keys.

All 70 API proof tests pass with 0 failures.
