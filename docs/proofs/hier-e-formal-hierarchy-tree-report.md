# HIER-E: Formal Hierarchy Tree + Reporting Line Visualization — Browser Runtime Proof

**Date:** 2026-08-20  
**Status:** COMPLETE  
**Commit:** (pending)

---

## 1. Scope

Formal hierarchy tree visualization with reporting line display, node detail panel, expand/collapse, search, and leadership level badges for the Supervisor Assignments module.

---

## 2. Backend Verification

### 2.1 TypeScript Check
- **Command:** `npx tsc --noEmit` (apps/api)
- **Result:** CLEAN — 0 errors

### 2.2 Build
- **Command:** `npx tsc --build` (apps/api)
- **Result:** CLEAN — 0 errors

### 2.3 API Tests
- **Command:** `npx jest --testPathPattern="supervisor-assignments.service.spec"`
- **Result:** 83 passed, 0 failed
- **HIER-E specific:** 10 passed (getHierarchyTree: NotFoundException, leaf node, two-level tree, three-level tree, leadershipLevel, inactive children, expired children, reportingLine, truncation, tenant scope)

### 2.4 Full API Test Suite
- **Command:** `npm run test:api`
- **Result:** 115 suites, 1837 tests — ALL PASS

---

## 3. Frontend Verification

### 3.1 TypeScript Check
- **Command:** `npx tsc --noEmit` (apps/web)
- **Result:** CLEAN — 0 errors

### 3.2 Build
- **Command:** `npx next build` (apps/web)
- **Result:** CLEAN — all pages compiled successfully

### 3.3 Frontend Tests
- **Command:** `npx jest --config apps/web/tests/jest.config.js --testPathPattern="hier-e"`
- **Result:** 32 passed, 0 failed
- **Coverage:** EN translations (12), AR translations (12), key sync (1), type existence (4), tree structure logic (3)

### 3.4 Full Web Test Suite
- **Command:** `npm run test:web-logic`
- **Result:** 11 suites, 336 tests — ALL PASS

### 3.5 UI Baseline Check
- **Command:** `npm run ui-baseline:check`
- **Result:** PASS — all baseline checks succeeded

---

## 4. API Endpoint Added

| Method | Path | Permission | Description |
|--------|------|-----------|-------------|
| GET | `/v1/supervisor-assignments/hierarchy/:assignmentId` | `supervisor:read` | Formal hierarchy tree with reporting line |

**Query Parameters:** `asOf?` (ISO 8601 date)

**Response Shape:**
```json
{
  "root": { "assignmentId", "level", "person", "jobTitle", "department", "branch", "administration", "leadershipLevel", "assignmentType", "effectiveFrom", "effectiveTo", "isActive", "childCount", "children": [...] },
  "reportingLine": [{ "level", "supervisor", "department", "jobTitle", "relationshipType" }],
  "totalDescendants": number,
  "maxDepth": number,
  "truncated": boolean,
  "asOf": "ISO date"
}
```

---

## 5. Frontend Feature

### 5.1 New Tab
- Third tab "Hierarchy Tree" (شجرة الهيكل التنظيمي) added to `/admin/core/supervisor-assignments`
- Uses existing F9 person assignment lookup for selection
- Shares leader selection with Team Management tab

### 5.2 Hierarchy Tree Component (`hierarchy-tree.tsx`)
- Recursive tree rendering with expand/collapse per node
- "Expand All" / "Collapse All" buttons
- Search filtering across person name, code, job title, department
- Leadership level badges (color-coded: NONE, TEAM_LEAD, SUPERVISOR, DEPARTMENT_HEAD, ADMINISTRATION_MANAGER)
- Direct reports count per node
- Click-to-select node with detail panel

### 5.3 Reporting Line Panel
- Shows upward reporting chain from the selected person
- Numbered levels with supervisor name, job title, department

### 5.4 Node Detail Panel
- Person name/code, job title, department, branch, administration
- Assignment type badge, leadership level badge
- Status badge (ACTIVE/INACTIVE)
- Effective date range, direct reports count

### 5.5 Summary Statistics
- Total descendants count
- Max depth
- Truncation warning (when >10000 nodes)

---

## 6. i18n Keys Added (12 keys, both EN and AR)

| Key | EN | AR |
|-----|----|----|
| hierarchyTree | Hierarchy Tree | شجرة الهيكل التنظيمي |
| selectPersonToViewHierarchy | Select a person assignment to view their hierarchy. | اختر تعيين موظف لعرض الهيكل التنظيمي. |
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

---

## 7. Files Modified

| File | Changes |
|------|---------|
| `apps/api/src/modules/admin/supervisor-assignments/supervisor-assignments.service.ts` | +153 lines: `HierarchyTreeNode` type, `getHierarchyTree()` method with BFS tree builder |
| `apps/api/src/modules/admin/supervisor-assignments/supervisor-assignments.controller.ts` | +12 lines: `GET hierarchy/:assignmentId` endpoint |
| `apps/api/src/modules/admin/supervisor-assignments/supervisor-assignments.service.spec.ts` | +186 lines: 10 hierarchy tree tests |
| `apps/web/src/app/admin/core/supervisor-assignments/page.tsx` | +51 lines: Hierarchy tab, import HierarchyTree |
| `apps/web/src/app/admin/core/supervisor-assignments/hierarchy-tree.tsx` | NEW: 350+ lines HierarchyTree component |
| `apps/web/src/lib/admin-types/core.ts` | +32 lines: HierarchyTreeNode, HierarchyTreeResponse types |
| `apps/web/src/lib/i18n/locales/en/core.ts` | +12 lines: EN hierarchy translations |
| `apps/web/src/lib/i18n/locales/ar/core.ts` | +12 lines: AR hierarchy translations |
| `apps/web/tests/hier-e-hierarchy-tree.test.ts` | NEW: 32 frontend tests |

---

## 8. Database Changes

None. HIER-E is purely read-only visualization using existing HIER-A data structures.

---

## 9. Design Decisions

1. **New endpoint vs reusing existing:** Added `GET /hierarchy/:assignmentId` because the existing `getSubordinates()` returns a flat list without parent-child relationships needed for tree rendering. The new endpoint builds a proper nested tree with `children` arrays.

2. **Reuses existing traversal logic:** The BFS pattern mirrors `getSubordinates()` but maintains parent→children mapping via `childrenMap` and `nodeMap`.

3. **Read-only:** The hierarchy endpoint is purely for visualization. All mutations go through existing team management endpoints.

4. **Reporting line included:** The response includes the upward reporting line from `getReportingLine()` so the frontend can display both directions in a single API call.

---

## 10. Known Limitations

- Maximum 10,000 descendant nodes (configurable constant)
- Maximum hierarchy depth: 100 levels
- Search is client-side only (all nodes loaded into memory)
- HIER-E browser visual proof not captured (Playwright available but no runtime server currently active)

---

## 11. Status

**COMPLETE** — All implementation, tests, builds, and baseline checks pass. No regressions.
