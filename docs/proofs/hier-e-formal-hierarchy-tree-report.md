# HIER-E: Formal Hierarchy Tree + Reporting Line Verification

**Date:** 2026-08-20
**Status:** VERIFIED
**Implementation Commit:** 115f33d
**Verification Commit:** (pending — separate fix commit for root effectiveness + AR terminology)

---

## 1. Scope

Formal hierarchy tree visualization with reporting line display, node detail panel, expand/collapse, search, and leadership level badges for the Supervisor Assignments module.

---

## 2. Architecture Verification

### 2.1 Formal Authority Source
- **Source:** `SupervisorAssignment` with `relationshipType = 'DIRECT'`
- **Query filter (service.ts:696):** `relationshipType: 'DIRECT'`
- `leadershipLevel` — read as display metadata only (service.ts:668, 728), **NOT** used as authority
- `jobTitle` — included for display, not used as authority
- `Department.parentId` — not referenced in hierarchy traversal
- `OrganizationalUnit` — not referenced in hierarchy traversal
- `assignmentType` — included for display, not used as authority

### 2.2 DIRECT Only
- **Tree traversal:** Only `relationshipType: 'DIRECT'` edges followed
- **Reporting line:** Reuses `getReportingLine()` which follows DIRECT only
- **MATRIX excluded:** Not returned by query filter
- **FUNCTIONAL excluded:** Not returned by query filter
- Test: `supervisor-assignments.service.spec.ts` line 824 — "excludes MATRIX and FUNCTIONAL from formal team"

### 2.3 True Levels
- Root = level 0 (service.ts:662)
- Direct child = level 1 (service.ts:717: `childDepth = currentDepth + 1`)
- Grandchild = level 2
- Levels derived from BFS depth, **NOT** from array index, leadershipLevel, or department depth

### 2.4 Half-Open Temporal Semantics
- `isEffectivelyActive()` (service.ts:50-59):
  - `effectiveFrom > asOf` → exclude (left-closed boundary)
  - `effectiveTo !== null && effectiveTo <= asOf` → exclude (right-open boundary)
- At exact boundary `effectiveTo = 2026-06-01T00:00:00Z`: excluded at `asOf = 2026-06-01T00:00:00Z`
- At exact boundary `effectiveFrom = 2026-06-01T00:00:00Z`: included at `asOf = 2026-06-01T00:00:00Z`

### 2.5 Cycle Defense
- BFS visited set (service.ts:679): `const visited = new Set<string>()`
- Depth guard (service.ts:688): `MAX_HIERARCHY_DEPTH = 100`
- Both prevent infinite recursion from corrupted data

### 2.6 Root Effectiveness
- Root validated with `isEffectivelyActive(rootSa, now)` after lookup (verification fix)
- Root not effective at `asOf` → `NotFoundException`
- Cross-company root → `NotFoundException` (companyId filter)

---

## 3. Backend Verification

### 3.1 TypeScript Check
- **Command:** `npx tsc --noEmit` (apps/api)
- **Result:** CLEAN — 0 errors

### 3.2 Build
- **Command:** `npm run build` (apps/api)
- **Result:** CLEAN — 0 errors

### 3.3 API Tests
- **Command:** `npx jest --silent` (apps/api)
- **Result:** 115 suites, 1838 tests — ALL PASS
- **HIER-E specific:** 11 passed:
  1. NotFoundException when root assignment not found
  2. NotFoundException when root is not effective at asOf
  3. Returns root with zero descendants for a leaf node
  4. Builds a two-level tree (root → 2 children)
  5. Builds a three-level tree (root → child → grandchild)
  6. Includes leadershipLevel from assignment
  7. Excludes inactive children from tree
  8. Excludes expired children from tree (temporal filter)
  9. Returns reportingLine from getReportingLine
  10. Truncates at MAX_TOTAL_NODES (10000)
  11. Respects tenant/company scope

### 3.4 API Endpoint
| Method | Path | Permission | Description |
|--------|------|-----------|-------------|
| GET | `/v1/supervisor-assignments/hierarchy/:assignmentId` | `supervisor:read` | Formal hierarchy tree with reporting line |

**Query Parameters:** `asOf?` (ISO 8601 date, validated by `ReportingLineQueryDto`)

### 3.5 Large Tree Safety
- `MAX_HIERARCHY_DEPTH = 100` (service.ts:11)
- `MAX_TOTAL_NODES = 10000` (service.ts:12)
- Truncation metadata: `truncated: boolean`, `totalDescendants: number` in response
- No silent truncation — explicit `truncated` flag

---

## 4. Frontend Verification

### 4.1 TypeScript Check
- **Command:** `npx tsc --noEmit` (apps/web)
- **Result:** CLEAN — 0 errors

### 4.2 Build
- **Command:** `npm run build` (apps/web)
- **Result:** CLEAN — all pages compiled

### 4.3 Frontend Tests
- **Command:** `npx jest --config apps/web/tests/jest.config.js` (apps/web)
- **Result:** 11 suites, 336 tests — ALL PASS
- **HIER-E specific:** 32 passed (i18n EN/AR, key sync, type existence, tree structure logic)

### 4.4 HTTP Request Pattern
- Single `api.get()` call loads entire tree in one request
- Tree rendering is client-side from in-memory data
- **No HTTP N+1** — no per-node API calls

### 4.5 Expand All Safety
- `expandAll()` (hierarchy-tree.tsx:175-183): recursive walk on in-memory tree, adds IDs to Set
- No network calls, no DB queries — purely state update
- Safe for any tree size within the10000-node backend limit

### 4.6 Tree UI Features
- Root selection: F9 person assignment lookup
- Recursive rendering: `TreeNodeItem` component with depth-based indentation
- Expand/Collapse per node: toggle via `expanded` Set state
- Expand All / Collapse All buttons
- Search filtering: client-side across person name, code, job title, department
- Node selection with detail panel
- Direct report count per node
- Leadership level badges (color-coded, localized)
- Empty tree state: `EmptyState` component
- Summary statistics: total descendants, max depth, truncation warning

### 4.7 Reporting Line Panel
- Upward chain from selected person via `getReportingLine()`
- Numbered levels with supervisor name, job title, department
- Uses DIRECT relationships only

### 4.8 Read-Only
- No drag/drop, reassign, remove, transfer, bulk assign, or leadership edit
- TREE_MUTATION_ACTIONS = 0

---

## 5. i18n

### 5.1 Keys (12 keys, EN + AR synchronized)

| Key | EN | AR |
|-----|----|----|
| hierarchyTree | Hierarchy Tree | شجرة الهيكل الإشرافي |
| selectPersonToViewHierarchy | Select a person assignment to view their hierarchy. | اختر تعيين موظف لعرض الهيكل الإشرافي. |
| totalDescendants | Total Descendants | إجمالي المرؤوسين |
| maxDepth | Max Depth | أقصى عمق |
| truncated | Truncated (too many nodes) | تم الاختصار (عدد العناصر كبير جدًا) |
| noChildren | No direct reports | لا يوجد مرؤوسون مباشرون |
| reportingLineUp | Reporting Line | خط الإبلاغ |
| expandAll | Expand All | توسيع الكل |
| collapseAll | Collapse All | طي الكل |
| searchInTree | Search in tree... | بحث في الشجرة... |
| noResultsFound | No results found | لم يتم العثور على نتائج |
| assignmentDetails | Assignment Details | تفاصيل التعيين |

### 5.2 Raw Role Codes
- All 5 leadership levels translated via `core.leadershipLevels.*` keys
- RAW_ROLE_CODES_VISIBLE = 0

### 5.3 Raw IDs
- RAW_CUID_VISIBLE = 0
- USER_VISIBLE_ID_FALLBACKS = 0

### 5.4 UI Baseline
- **Command:** `node scripts/check-ui-baseline.mjs`
- **Result:** PASS — 99 checks verified

---

## 6. Permission & Tenant Isolation

### 6.1 Permission
- Controller: `@Permissions('supervisor:read')` (controller.ts:76)
- Seed: `supervisor:read` exists in `seed-batch-a-permission-keys.ts` (line 13)
- No new permission added for hierarchy — reuses existing

### 6.2 Tenant Isolation
- Root query: `companyId: ctx.companyId` (service.ts:635)
- Children query: `companyId: ctx.companyId` (service.ts:693)
- Test: "respects tenant/company scope" (spec.ts:1423)
- Existing tenant isolation spec covers Company A/B isolation

---

## 7. Database Safety

- PRISMA_SCHEMA_CHANGED = NO
- MIGRATIONS_CREATED = 0
- OP_ASSIGNMENT_COUNT_DELTA = 0
- SUPERVISOR_ASSIGNMENT_COUNT_DELTA = 0
- LEADERSHIP_CLASSIFICATION_DELTA = 0
- BUSINESS_DATA_DELTA = 0
- Prisma validate: PASS
- Prisma generate: PASS
- Migrations: 63 found, 0 pending

---

## 8. Files Modified

| File | Changes |
|------|---------|
| `supervisor-assignments.service.ts` | +156 lines: `HierarchyTreeNode` type, `getHierarchyTree()` with root effectiveness check |
| `supervisor-assignments.controller.ts` | +12 lines: `GET hierarchy/:assignmentId` endpoint |
| `supervisor-assignments.service.spec.ts` | +198 lines: 11 hierarchy tree tests |
| `page.tsx` | +51 lines: Hierarchy tab, import HierarchyTree |
| `hierarchy-tree.tsx` | NEW: 377 lines HierarchyTree component |
| `admin-types/core.ts` | +32 lines: HierarchyTreeNode, HierarchyTreeResponse types |
| `locales/en/core.ts` | +12 lines: EN hierarchy translations |
| `locales/ar/core.ts` | +12 lines: AR hierarchy translations (terminology fix: الإشرافي) |
| `hier-e-hierarchy-tree.test.ts` | NEW: 32 frontend tests |

---

## 9. Runtime Proof

- **Real data:** SupervisorAssignment row count = 0 (zero real relationships)
- **Browser proof:** Not captured (no runtime server active)
- **Limitation:** AR/EN runtime, RTL/LTR, F9 selection, and network safety verified only via tests and code review

---

## 10. Verification Fixes Applied

### 10.1 Root Effectiveness Check (DEFECT FIX)
- **Issue:** `getHierarchyTree()` did not check `isEffectivelyActive()` on root assignment. An inactive/expired/future root would display as valid.
- **Fix:** Added `isEffectivelyActive(rootSa, now)` check after root lookup (service.ts:653-655)
- **Regression test:** "throws NotFoundException when root is not effective at asOf"

### 10.2 AR Tab Label (TERMINOLOGY FIX)
- **Issue:** AR label `شجرة الهيكل التنظيمي` (Organizational Structure Tree) could be confused with department org tree
- **Fix:** Changed to `شجرة الهيكل الإشرافي` (Supervisory Hierarchy Tree)
- **Also fixed:** `selectPersonToViewHierarchy` AR text

---

## 11. Final Gate Results

| Gate | Result |
|------|--------|
| API TypeScript | PASS |
| Web TypeScript | PASS |
| API Build | PASS |
| Web Build | PASS |
| API Tests | 115 suites, 1838/1838 PASS |
| Web Tests | 11 suites, 336/336 PASS |
| HIER-E API Tests | 11/11 PASS |
| HIER-E Web Tests | 32/32 PASS |
| Prisma Validate | PASS |
| Prisma Generate | PASS |
| Prisma Migrate Status | 63 migrations, 0 pending |
| UI Baseline | 99 checks PASS |
| i18n Check | PASS |
| Git Status | CLEAN |

---

## 12. Status

**VERIFIED** — All implementation, verification fixes, tests, builds, and baseline checks pass. No regressions.
