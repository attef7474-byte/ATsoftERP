# Blocker Identification

**Date**: 2026-07-29  
**Base commit**: 6bbf338

## Actual vs Previous Findings

### 4 API Path Mismatches (LIM-01 through LIM-04) — FALSE POSITIVES

Investigation of actual frontend code (`apps/web/src/`) reveals that **no frontend code calls these wrong paths**:

| Wrong Path | Actual Frontend Usage | Status |
|-----------|----------------------|--------|
| `/inventory/stock-transfers` | All calls use `/inventory/transfers` | ✅ Already correct |
| `/machine-categories` (bare) | All calls use `/maintenance/machine-categories` | ✅ Already correct |
| `/spare-parts` (bare) | All calls use `/maintenance/spare-parts` | ✅ Already correct |
| `/audit` (bare API call) | Only `/inventory/audit` and `/reports/audit` used | ✅ Already correct |

**Decision**: No fix needed. These were false positives from manual curl tests in the review, not actual frontend bugs.

### BOM / SparePartPlans 404 (LIM-05 and LIM-06) — FIXED BY SERVER RESTART

| Endpoint | Before Restart | After Restart | Root Cause |
|----------|---------------|---------------|------------|
| `GET /api/v1/maintenance/bom` | 404 | 200 (empty array) | Stale API server process — modules compiled but not loaded in running instance |
| `GET /api/v1/maintenance/spare-part-plans` | 404 | 200 (empty array) | Stale API server process |

Both controllers and modules are correctly configured. NestJS modules registered in `app.module.ts` at lines 71-72 (imports) and 112-113 (array). Build passes clean.

**Decision**: No code fix needed. Server restart resolved the issue.

### 8 Missing Frontend Pages (LIM-07 through LIM-14)

| # | URL | Module/Batch | API Works? | Nav Link? | Classification | Action |
|---|-----|-------------|-----------|-----------|---------------|--------|
| LIM-07 | `/admin/maintenance/repair-orders` | AD-AE | ✅ 200 | ❌ | ACTIVE_ACCEPTED_PAGE | Create page + nav link |
| LIM-08 | `/admin/installed-parts` | AB-AC | ✅ 200 | ❌ | ACTIVE_ACCEPTED_PAGE | Create page + nav link |
| LIM-09 | `/admin/maintenance/bom` | AH-AI | ✅ 200 (fixed) | ❌ | ACTIVE_ACCEPTED_PAGE | Create page + nav link |
| LIM-10 | `/admin/maintenance/spare-part-plans` | AH-AI | ✅ 200 (fixed) | ❌ | ACTIVE_ACCEPTED_PAGE | Create page + nav link |
| LIM-11 | `/admin/spare-part-conditions` | Z-AA | ✅ 200 | ❌ | ACTIVE_ACCEPTED_PAGE | Create page + nav link |
| LIM-12 | `/admin/maintenance/reliability/mttr` | AF-AG | ✅ 200 | ❌ | ACTIVE_ACCEPTED_PAGE | Create page + nav link |
| LIM-13 | `/admin/maintenance/sla` | Built-in | ✅ 200 | ❌ | ACTIVE_ACCEPTED_PAGE | Create page + nav link |
| LIM-14 | `/admin/reports` | Built-in | N/A | ✅ (has sub-items) | ACTIVE_ACCEPTED_PAGE | Create index page |

### Forbidden Module 404s

| URL | Module | Decision |
|-----|--------|----------|
| `/admin/finance` | Finance | Keep 404 ✅ No nav link exists |
| `/admin/purchasing` | Purchasing | Keep 404 ✅ No nav link exists |
| `/admin/sales` | Sales | Keep 404 ✅ No nav link exists |
| `/admin/hr` | HR | Keep 404 ✅ No nav link exists |

All 4 forbidden modules are confirmed to have **no navigation links** in `navigation-data.ts`. Manual URL access returns 404 by design.

## Summary

| Blocker Type | Count | Resolved? |
|-------------|-------|-----------|
| False positive API mismatches | 4 | ✅ Already correct |
| BOM/Plan 404 (stale server) | 2 | ✅ Fixed by restart |
| Missing frontend pages | 8 | ❌ Need creation |
| Forbidden module 404s | 4 | ✅ Expected behavior |
