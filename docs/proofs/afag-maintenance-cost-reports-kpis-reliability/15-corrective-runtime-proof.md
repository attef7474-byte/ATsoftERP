# Corrective Runtime Proof — AF-AG @Map Fix

## Purpose

Verify that adding `@map(...)` to Prisma models `SparePartRepairOrder`, `SparePartRepairAction`, `MachineInstalledPart`, and `SparePartReplacementHistory` resolves the 500 errors caused by snake_case DB column names.

## Before Fix (at commit `5929f54`)

| Endpoint | Status | Reason |
|----------|--------|--------|
| `GET /reports/maintenance/costs/analysis` | ❌ **500** | `actualRepairCost` column not found |
| `GET /maintenance/repair-orders` | ❌ **500** | `actualRepairCost` column not found |

## After Fix (commit `...corrective`)

| # | Endpoint | Status | Size | Notes |
|---|----------|--------|------|-------|
| 1 | `GET /reports/maintenance/costs/analysis` | ✅ **200** | 906 bytes | `repairCost: 0` read correctly |
| 2 | `GET /reports/maintenance/costs/by-machine` | ✅ **200** | 615 bytes | — |
| 3 | `GET /reports/maintenance/schedule-compliance` | ✅ **200** | 265 bytes | — |
| 4 | `GET /reports/maintenance/kpi-overview` | ✅ **200** | 774 bytes | — |
| 5 | `GET /reports/maintenance/backlog-trend` | ✅ **200** | 96 bytes | — |
| 6 | `GET /maintenance/reliability/repeat-failure-rate` | ✅ **200** | 57 bytes | — |
| 7 | `GET /maintenance/reliability/availability` | ✅ **200** | 132 bytes | — |
| 8 | `GET /maintenance/reliability/sla-times` | ✅ **200** | 145 bytes | — |
| 9 | `GET /maintenance/repair-orders` (regression) | ✅ **200** | 2 bytes `[]` | Regression PASS |

**Result: 9/9 PASS ✅ (0 failures)**

## Key Observations

- `costs/analysis` now returns `repairCost: 0` from `sparePartRepairOrder.aggregate({ _sum: { actualRepairCost } })` — previously threw 500
- `repair-orders` now returns `[]` (empty array) — correctly reads from DB
- All values remain consistent with DB counters (no fake data)
- No schema migration needed — pure Prisma metadata fix
