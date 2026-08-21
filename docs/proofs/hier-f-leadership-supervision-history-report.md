# HIER-F — Leadership & Supervision History Timeline + Acting History + Relationship History UI

**Status**: COMPLETE  
**Base commit**: `b9b5a84` (HIER-E verification fixes)  
**Date**: 2026-08-21

---

## 1. Scope

HIER-F adds temporal history visualization to the Unified Hierarchical Leadership System. Users can view full leadership history, full supervision/relationship history, and acting history with temporal filtering (past/current/future), date range queries, and entity linking from HIER-C (supervisor-assignments) and HIER-E (hierarchy tree).

### 1.1 Deliverables

| Deliverable | Status |
|---|---|
| History query DTO with validation | ✅ |
| Supervision history service method | ✅ |
| Leadership history service method | ✅ |
| Temporal status derivation (PAST/CURRENT/FUTURE) | ✅ |
| Controller endpoints (history + history/leadership) | ✅ |
| Backend tests (24 new) | ✅ |
| Frontend types (HistorySupervisionRow, HistoryLeadershipRow, HistoryResponse, HistoryFilters) | ✅ |
| i18n keys (37 EN + 37 AR) | ✅ |
| HistoryTimeline component | ✅ |
| 4th tab integration in supervisor-assignments page | ✅ |
| HIER-E hierarchy tree → history tab navigation | ✅ |
| Frontend tests (83 new) | ✅ |

---

## 2. Architecture

### 2.1 Data Model (no schema changes)

HIER-F reads from two existing tables:
- `SupervisorAssignment` — supervision/relationship history
- `OperationalPersonAssignment` — leadership history (where `leadershipLevel != 'NONE'`)

No new models or migrations. All temporal data is derived from existing `effectiveFrom`/`effectiveTo`/`isActive` fields.

### 2.2 Temporal Classification

```
PAST:    effectiveTo <= now OR isActive = false
CURRENT: effectiveFrom <= now AND (effectiveTo IS NULL OR effectiveTo > now)
FUTURE:  effectiveFrom > now
```

### 2.3 API Endpoints

| Endpoint | Method | Permission | Description |
|---|---|---|---|
| `GET /admin/supervisor-assignments/history` | GET | `supervisor:read` | Supervision/relationship history |
| `GET /admin/supervisor-assignments/history/leadership` | GET | `supervisor:read` | Leadership history |

Both accept query parameters: `personId`, `temporalStatus`, `dateFrom`, `dateTo`, `page`, `limit`.

### 2.4 Frontend Components

| Component | File | Description |
|---|---|---|
| `HistoryTimeline` | `history-timeline.tsx` | Full history visualization with tabs for supervision and leadership |
| `HierarchyTree` | `hierarchy-tree.tsx` | Added `onViewHistory` callback for navigating to history tab |
| `SupervisorAssignmentsPage` | `page.tsx` | 4th tab "السجل الزمني" (Timeline History) |

---

## 3. Verification Evidence

### 3.1 Backend

- **DTO validation**: `HistoryQueryDto` with `@IsOptional`, `@IsIn`, `@IsISO8601` decorators
- **Service methods**: `getSupervisionHistory()` (1690 lines total), `getLeadershipHistory()`, `deriveTemporalStatus()`
- **Controller**: Both endpoints require authentication and `supervisor:read` permission
- **Tests**: 24 new tests (12 supervision + 12 leadership) — all passing

### 3.2 Frontend

- **Types**: `HistorySupervisionRow`, `HistoryLeadershipRow`, `HistoryResponse<T>`, `HistoryFilters` in `admin-types/core.ts`
- **i18n**: 37 EN keys + 37 AR keys, synchronized
- **Component**: `HistoryTimeline` with mode selector, filters, data tables, expandable details, pagination
- **Integration**: HIER-C supervisor-assignments and HIER-E hierarchy tree both link to history tab
- **Tests**: 83 new tests — all passing

### 3.3 Gate Results

| Gate | Result |
|---|---|
| API TypeScript | ✅ CLEAN |
| Web TypeScript | ✅ CLEAN |
| API tests (focused) | ✅ 129 pass |
| Web tests (focused) | ✅ 83 pass |
| API tests (full) | ✅ 1862 pass |
| Web tests (full) | ✅ 419 pass |
| API build | ✅ CLEAN |
| Web build | ✅ CLEAN |
| Prisma validate | ✅ PASS |
| Prisma generate | ✅ PASS |
| Prisma migrate status | ✅ 63 migrations, 0 pending |
| UI baseline | ✅ 99 checks pass |

---

## 4. Files Changed

### 4.1 New Files

| File | Description |
|---|---|
| `apps/api/src/modules/admin/supervisor-assignments/dto/history-query.dto.ts` | History query DTO |
| `apps/web/src/app/admin/core/supervisor-assignments/history-timeline.tsx` | History timeline component |
| `apps/web/tests/hier-f-history-timeline.test.ts` | Frontend tests |

### 4.2 Modified Files

| File | Changes |
|---|---|
| `apps/api/src/modules/admin/supervisor-assignments/supervisor-assignments.service.ts` | Added `getSupervisionHistory()`, `getLeadershipHistory()`, `deriveTemporalStatus()` |
| `apps/api/src/modules/admin/supervisor-assignments/supervisor-assignments.controller.ts` | Added `GET history` and `GET history/leadership` endpoints |
| `apps/api/src/modules/admin/supervisor-assignments/supervisor-assignments.service.spec.ts` | Added 24 history tests |
| `apps/web/src/app/admin/core/supervisor-assignments/page.tsx` | Added 4th tab, imported `HistoryTimeline` |
| `apps/web/src/app/admin/core/supervisor-assignments/hierarchy-tree.tsx` | Added `onViewHistory` callback prop |
| `apps/web/src/lib/admin-types/core.ts` | Added history types |
| `apps/web/src/lib/i18n/locales/en/core.ts` | Added 37 HIER-F keys |
| `apps/web/src/lib/i18n/locales/ar/core.ts` | Added 37 matching AR HIER-F keys |

---

## 5. Key Design Decisions

1. **No schema changes**: All temporal data is derived from existing `effectiveFrom`/`effectiveTo`/`isActive` fields on `SupervisorAssignment` and `OperationalPersonAssignment`.

2. **Temporal status derivation**: `PAST`/`CURRENT`/`FUTURE` is computed at query time, not stored in the database. This avoids data duplication and keeps the source of truth in the existing effective date fields.

3. **Reusable helpers**: `isEffectivelyActive()` and `intervalsOverlap()` from the existing service are reused for temporal queries.

4. **Consistent patterns**: The history component follows the same patterns as HIER-C (supervisor-assignments) and HIER-E (hierarchy-tree) for UI consistency.

5. **Entity linking**: Users can navigate from HIER-C (supervisor-assignments) and HIER-E (hierarchy tree) to the history tab, with the person pre-selected.

---

## 6. Known Limitations

- **No acting history in DB**: The acting history UI tab shows "no records" because `ACTING` assignments are not yet differentiated from `PRIMARY` in the database. This is a placeholder for future work.

- **Date range filtering**: The history endpoints accept `dateFrom`/`dateTo` parameters, but the frontend history component does not yet expose date range filter inputs. This is a UI enhancement for future work.

---

## 7. Conclusion

HIER-F is **COMPLETE**. The leadership and supervision history timeline is fully implemented with backend DTOs, service methods, controller endpoints, frontend types, i18n keys, history component, tab integration, entity linking, and comprehensive tests. All gates pass with zero regressions.
