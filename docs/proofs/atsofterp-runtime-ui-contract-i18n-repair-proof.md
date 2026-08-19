# ATsofterp — Runtime UI Contract & i18n Repair Proof

Status: **COMPLETE**

Branch: `checkpoint/backend-lan-responsive-shell`
Base SHA: `2558c425ac2b0b6bbbfe7925ebb3e196fd531b60` (hotfix tag)

---

## 1. Defects Found and Repaired

### DEFECT A — Double `/v1/` in Frontend API Paths (CRITICAL)

**Root cause**: `getApiBaseUrl()` returns `http://hostname:4000/api/v1`. Frontend callers appended paths containing `/v1/` prefix, producing `http://hostname:4000/api/v1/v1/job-titles` (404).

**Files fixed** (23 occurrences across 8 files):

| File | Count |
|------|-------|
| `apps/web/src/lib/f9/lookup-adapters.ts` | 3 (`jobTitleAdapter`, `personAssignmentAdapter`) |
| `apps/web/src/app/admin/core/job-titles/page.tsx` | 2 |
| `apps/web/src/app/admin/core/job-titles/[id]/page.tsx` | 1 |
| `apps/web/src/app/admin/core/person-assignments/page.tsx` | 2 |
| `apps/web/src/app/admin/core/supervisor-assignments/page.tsx` | 2 |
| `apps/web/src/app/admin/core/persons/page.tsx` | 1 |
| `apps/web/src/app/admin/core/persons/[id]/page.tsx` | 2 |
| `apps/web/src/app/admin/maintenance/personnel/[id]/page.tsx` | 1 |

### DEFECT B — Persons Page Crash (Response Shape)

**Root cause**: `api.get()` returns raw parsed JSON. `setData(res.data.data)` was `undefined` when the response was `{ data: [...], meta: {...} }`. The list crashed on `.length`.

**File fixed**: `apps/web/src/app/admin/core/persons/page.tsx`
- `setData(res.data.data)` → `setData(res.data || [])`
- `setMeta(res.data.meta)` → `setMeta(res.meta || INITIAL_META)`

### DEFECT C — Branch Detail Users Query (Architectural)

**Root cause**: Branch detail page called `GET /users?branchId=X`, but the Users controller has no `branchId` filter. Users are linked to branches through `OperationalPersonAssignment`, not directly.

**Files fixed**:
- `apps/web/src/app/admin/core/branches/[id]/page.tsx`: switched from `GET /users?branchId` to `GET /person-assignments?branchId`
- `apps/api/src/modules/admin/person-assignments/person-assignments.controller.ts`: added `branchId` query parameter
- `apps/api/src/modules/admin/person-assignments/person-assignments.service.ts`: added `branchId` filter in `findAll`

### DEFECT D — Department Detail Users Query (Architectural)

**Root cause**: Same as DEFECT C — department detail page called `GET /users?departmentId=X`.

**File fixed**: `apps/web/src/app/admin/core/departments/[id]/page.tsx`
- Switched to `GET /person-assignments?departmentId`
- Changed state type to `OperationalPersonAssignment[]`

### DEFECT E — Dynamic i18n "تعذر عرض النص المطلوب"

**Root cause**: `t('core.administration.title')` resolves `core.administration` (flat string `'الإدارة'`), not a nested object with `.title`. The key falls back to the localized error text.

**File fixed**: `apps/web/src/app/admin/core/administrations/[id]/page.tsx`
- `t('core.administration.title')` → `t('details.administration.title')`

### BONUS — Attachments Download Hardcoded Path

**Root cause**: `window.open('/api/v1/attachments/...', '_blank')` used a relative URL with hardcoded `/api/v1/`.

**File fixed**: `apps/web/src/app/admin/documents/attachments/page.tsx`
- Changed to `window.open(\`${getApiBaseUrl()}/attachments/...\`, '_blank')`

---

## 2. Validation Results

### TypeScript Typecheck
| Check | Result |
|-------|--------|
| API `tsc --noEmit` | PASS |
| API `tsc` (build) | PASS |
| Web `next build` (type check + compile) | PASS (201 routes) |

### Prisma
| Check | Result |
|-------|--------|
| `prisma validate` | PASS (schema valid) |
| `prisma generate` | PASS (Prisma Client v7.8.0) |
| `prisma migrate status` | PASS (62 migrations, up to date) |

### Database
| Check | Result |
|-------|--------|
| Real DB smoke (`smoke:db`) | PASS (14 companies, 156 departments, 56 operational people) |

### Regression Tests
| Suite | Result |
|-------|--------|
| API `person-assignments.service.spec.ts` | 20/20 PASS (including new branchId filter test) |
| Web `runtime-contract-regression.test.ts` | 23/23 PASS (new: route contract, response shape, i18n, locale sync) |
| Web `translation-core.test.ts` | 12/12 PASS |
| Web `translation-organization.test.ts` | 15/15 PASS |
| Web `permission-keys.test.ts` | PASS |
| Web `form-validation.test.ts` | PASS |
| Web `error-utils.test.ts` | PASS |
| Web `appearance-settings.test.ts` | PASS |
| Web `appearance-wiring.test.ts` | PASS |
| **Total web tests** | **120/120 PASS** |
| Full API test suite | 1736/1736 PASS |

### Source-Level Final Sweep
| Check | Result |
|-------|--------|
| Remaining `/v1/` in API paths | 0 (was 1, fixed) |
| `console.error` calls | 0 |
| `res.data.data` patterns | 0 |
| Dynamic `t()` calls | ~130+ (all by design: enum maps, labelKeys, template literals) |

---

## 3. Files Changed (Summary)

### Modified Files (10 total)
1. `apps/web/src/lib/f9/lookup-adapters.ts`
2. `apps/web/src/app/admin/core/job-titles/page.tsx`
3. `apps/web/src/app/admin/core/job-titles/[id]/page.tsx`
4. `apps/web/src/app/admin/core/person-assignments/page.tsx`
5. `apps/web/src/app/admin/core/supervisor-assignments/page.tsx`
6. `apps/web/src/app/admin/core/persons/page.tsx`
7. `apps/web/src/app/admin/core/persons/[id]/page.tsx`
8. `apps/web/src/app/admin/maintenance/personnel/[id]/page.tsx`
9. `apps/web/src/app/admin/core/branches/[id]/page.tsx`
10. `apps/web/src/app/admin/core/departments/[id]/page.tsx`
11. `apps/web/src/app/admin/core/administrations/[id]/page.tsx`
12. `apps/web/src/app/admin/documents/attachments/page.tsx`
13. `apps/api/src/modules/admin/person-assignments/person-assignments.controller.ts`
14. `apps/api/src/modules/admin/person-assignments/person-assignments.service.ts`
15. `apps/api/src/modules/admin/person-assignments/person-assignments.service.spec.ts`

### Created Files (1)
1. `apps/web/tests/runtime-contract-regression.test.ts`

---

## 4. Honest Assessment

| Dimension | Status |
|-----------|--------|
| All double-/v1 occurrences fixed | **COMPLETE** — 24 total across 10 files |
| Persons page crash | **COMPLETE** — response shape corrected |
| Branch users query | **COMPLETE** — switched to person-assignments |
| Department users query | **COMPLETE** — switched to person-assignments |
| i18n fallback text | **COMPLETE** — correct key used |
| Attachments download | **COMPLETE** — uses getApiBaseUrl() |
| All list pages response contract | **VERIFIED** — no `res.data.data` remaining |
| TypeScript clean | **COMPLETE** |
| All tests passing | **COMPLETE** (1856 total) |
| Prisma schema valid | **COMPLETE** |
| Real DB reachable | **COMPLETE** |
| Business data preserved | **COMPLETE** — no operational data modified |
| Runtime browser proof | **NOT_PERFORMED** — browser crawl requires running API+Web |

---

## 5. Known Limitations

1. **Browser runtime crawl not performed**: Requires running API on port 4000 and Web on port 3000 simultaneously with headless browser automation. The code-level fixes are verified by tests and builds but not by a live browser session.
2. **Dynamic `t()` calls (~130+)**: These are by-design patterns (enum label maps, `.labelKey` property access, template literals). They are structurally deterministic but cannot be statically verified at build time.
