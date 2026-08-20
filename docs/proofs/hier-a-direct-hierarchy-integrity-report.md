# HIER-A: Formal Direct Hierarchy Data Integrity — Proof Report

**Date:** 2026-08-20  
**Commit:** `ea71ef2` → pending commit `feat(org): enforce formal direct leadership hierarchy integrity`  
**Status:** ✅ COMPLETE

---

## 1. Scope

Implement all 15 integrity rules for formal DIRECT supervisor assignment hierarchy in `SupervisorAssignmentsService`, with date-aware effective filtering, true hierarchical levels, and comprehensive test coverage.

---

## 2. Integrity Rules Implemented

| # | Rule | Implementation | Evidence |
|---|------|---------------|----------|
| 1 | Self-supervision prohibition | `create()` and `update()` — same `personnelId` check | `supervisor-assignments.service.spec.ts:78-96` |
| 2 | Assignment existence validation | `findFirst` with `id + companyId + deletedAt: null` | `supervisor-assignments.service.spec.ts:52-76` |
| 3 | Branch compatibility (5 cases) | `assertBranchCompatible()` | `supervisor-assignments.service.ts:42-107` |
| 4 | Half-open interval overlap prevention | `intervalsOverlap()` + `assertNoOverlappingDirect()` | `supervisor-assignments.service.ts:15-21, 505-545` |
| 5 | One DIRECT supervisor per subordinate | `findMany` filtered by `DIRECT` + overlap check | `supervisor-assignments.service.ts:518-545` |
| 6 | MATRIX/FUNCTIONAL coexistence | Not blocked by DIRECT overlap check | `supervisor-assignments.service.spec.ts:148-172` |
| 7 | Cycle detection | `detectCycle()` — walks upward following DIRECT links | `supervisor-assignments.service.ts:546-606` |
| 8 | Assignment date-window validity | Subordinate + supervisor `effectiveTo` checks | `supervisor-assignments.service.spec.ts:223-270` |
| 9 | Date-aware effective filtering | `isEffectivelyActive()` — `deletedAt + isActive + effectiveFrom + effectiveTo` | `supervisor-assignments.service.ts:27-36` |
| 10 | Date-aware getReportingLine | `asOf` parameter, DIRECT-only, true depth levels | `supervisor-assignments.service.spec.ts:271-374` |
| 11 | Date-aware getSubordinates | `asOf` parameter, BFS, true depth (not count) | `supervisor-assignments.service.spec.ts:377-449` |
| 12 | Soft delete enforcement | `remove()` sets `deletedAt + isActive: false` | `supervisor-assignments.service.spec.ts:488-506` |
| 13 | Tenant scoping on all operations | `companyId: ctx.companyId` on every query | `tenant-isolation.spec.ts:142-292` |
| 14 | Audit logging | `CREATE`, `UPDATE`, `REMOVE` with `entityType: 'SupervisorAssignment'` | `supervisor-assignments.service.spec.ts:98-112, 470-486, 488-506` |
| 15 | MAX_HIERARCHY_DEPTH + MAX_TOTAL_NODES | `100` depth, `10000` total nodes safety | `supervisor-assignments.service.spec.ts:437-449` |

---

## 3. Files Modified

| File | Change |
|------|--------|
| `apps/api/src/modules/admin/supervisor-assignments/supervisor-assignments.service.ts` | Full rewrite with 15 integrity rules |
| `apps/api/src/modules/admin/supervisor-assignments/supervisor-assignments.controller.ts` | Added `asOf` query params |
| `apps/api/src/modules/admin/supervisor-assignments/supervisor-assignments.service.spec.ts` | 35 comprehensive tests |
| `apps/api/src/modules/admin/supervisor-assignments/tenant-isolation.spec.ts` | 17 tenant isolation tests |

---

## 4. Test Results

| Suite | Tests | Status |
|-------|-------|--------|
| `supervisor-assignments.service.spec.ts` | 35 | ✅ PASS |
| `tenant-isolation.spec.ts` | 17 | ✅ PASS |
| **Total API tests** | **1759** | ✅ **115/115 suites PASS** |

---

## 5. Regression Gates

| Gate | Result |
|------|--------|
| Prisma validate | ✅ PASS |
| Prisma generate | ✅ PASS (no schema changes) |
| API TypeScript | ✅ PASS (0 errors) |
| Web TypeScript | ✅ PASS (0 errors) |
| API build | ✅ PASS |
| Web build | ✅ PASS |
| API tests | ✅ 1759/1759 PASS |

---

## 6. API Endpoints

| Endpoint | Method | Change |
|----------|--------|--------|
| `POST /admin/supervisor-assignments` | POST | New integrity rules enforced |
| `PATCH /admin/supervisor-assignments/:id` | PATCH | Integrity rules on update |
| `GET /admin/supervisor-assignments/:id/reporting-line` | GET | Added `asOf` query param |
| `GET /admin/supervisor-assignments/:id/subordinates` | GET | Added `asOf` query param |

---

## 7. Business Data Delta

- **0** database records created or modified (no real DB operations)
- **0** Prisma migrations (schema unchanged)
- All tests use mocked PrismaService

---

## 8. Known Limitations

- `leadershipLevel` field not yet implemented (deferred to HIER-D)
- Branch compatibility assertions are read-only; actual branch data comes from the assignment records (which currently have no DB data)
- `detectCycle` follows only DIRECT links for temporal cycle detection (correct per spec)
- Bulk assign, hierarchy tree UI, and team view deferred to later batches

---

## 9. Hierarchy Helpers

| Helper | Location | Purpose |
|--------|----------|---------|
| `intervalsOverlap()` | `service.ts:15-21` | Half-open interval overlap detection |
| `isEffectivelyActive()` | `service.ts:27-36` | Date-aware effective check |
| `assertBranchCompatible()` | `service.ts:42-107` | 5-case branch policy |
| `assertNoOverlappingDirect()` | `service.ts:505-545` | One DIRECT + no overlap |
| `detectCycle()` | `service.ts:546-606` | Temporal DIRECT cycle detection |
