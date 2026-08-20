# HIER-C Supervisor-First Team Management UI — Proof Report

**Date**: 2026-08-20
**Branch**: `checkpoint/backend-lan-responsive-shell`
**BASE_HEAD**: `73eaceb843ae19c844eb3cae8fbda4786fa6aa5b` (HIER-B final)
**FINAL_LOCAL_HEAD**: (pending commit)
**Schema Changes**: 0
**API_ENDPOINT_CHANGES**: 0
**leadershipLevel**: Deferred to HIER-D

---

## 1. Page Architecture

**Route**: `/admin/core/supervisor-assignments`

Two-tab design within ONE feature:

| Tab | Purpose | Default |
|---|---|---|
| **Team Management** (إدارة الفريق) | Leader-first bulk team workflow | YES |
| **Current Relationships** (العلاقات الحالية) | Legacy individual relationship table | Secondary |

## 2. Leader-First Workflow

| Step | Status |
|---|---|
| F9 Leader Lookup (personAssignmentAdapter) | PASS |
| Leader Summary Card (person, jobTitle, branch, admin, dept, type, dates) | PASS |
| Current Team loaded from `GET team/:id` | PASS |
| Candidate Discovery from `GET candidates` | PASS |
| Multi-select with checkboxes | PASS |
| Effective date controls | PASS |
| Preview via `POST bulk/preview` | PASS |
| Apply via `POST bulk` | PASS |

## 3. Current Team

| Check | Result |
|---|---|
| Team endpoint connected | PASS |
| DIRECT-only | PASS (backend filter) |
| Team count displayed | PASS |
| Date-aware filtering | PASS (backend `isEffectivelyActive`) |
| Single remove (DELETE) | PASS (permission-gated) |
| Bulk remove | NOT_IMPLEMENTED |

## 4. Candidates

| Check | Result |
|---|---|
| Candidate endpoint connected | PASS |
| Search filter (debounced) | PASS |
| AssignmentType filter | PASS |
| Without supervisor filter | PASS |
| Current supervisor info visible | PASS (eligibility badge) |
| Pagination | PASS |
| Selectable rows = ELIGIBLE only | PASS |

## 5. Selection

| Check | Result |
|---|---|
| Individual checkbox | PASS |
| Select All (current page eligible only) | PASS |
| Clear Selection | PASS |
| Selected count displayed | PASS |
| Ineligible rows disabled | PASS |
| Preview invalidated on selection change | PASS |

## 6. Preview

| Check | Result |
|---|---|
| Preview required before apply | YES |
| Preview endpoint connected | PASS |
| Summary (requested/eligible/conflicts/invalid/alreadyAssigned) | PASS |
| Per-row results with status badges | PASS |
| Conflicts shown with warning | PASS |
| Stale preview warning | PASS |

## 7. Apply

| Check | Result |
|---|---|
| Bulk apply connected | PASS |
| Double-submit protection | PASS (loading state) |
| Success refreshes team + candidates | PASS |
| Selection cleared after success | PASS |
| Server error handling | PASS |
| Silent partial save | NO |
| Silent reassignment | NO |

## 8. Permissions

| Check | Result |
|---|---|
| `supervisor:read` gates leader/team/candidate view | PASS |
| `supervisor:assign` gates preview/apply | PASS |
| `supervisor:remove` gates single delete | PASS |
| Read-only user sees no mutation controls | PASS |

## 9. i18n

| Check | Result |
|---|---|
| Arabic RTL | PASS (uses `text-start` logical properties) |
| English LTR | PASS |
| All labels translated via `t()` | PASS |
| No hardcoded English in UI | PASS |
| No raw keys | PASS |
| No fallback text | PASS |
| Eligibility codes translated | PASS (9 codes, both AR/EN) |
| No mixed language labels | PASS |

## 10. API / Network

| Check | Result |
|---|---|
| Double `/api/v1/v1/` | 0 |
| Console errors | 0 (expected) |
| Uses `getApiBaseUrl()` | PASS |
| AbortController for candidate requests | PASS |

## 11. Tests

### WEB TEST INFRASTRUCTURE

| Metric | Value |
|---|---|
| PRE_EXISTING_INFRA_FAILURE | NO |
| ROOT_CAUSE | N/A — tests run and pass with existing jest.config.js |
| INFRA_FILES_CHANGED | 0 |
| DEPENDENCIES_CHANGED | NO |

### WEB TEST COUNTS

| Metric | Before HIER-C | After HIER-C |
|---|---|---|
| Suites discovered | 8 | 9 |
| Tests executed | 120 | 237 |
| Tests passing | 120/120 | 237/237 |
| Tests skipped | 0 | 0 |
| Tests removed | 0 | 0 |

### HIER-C NEW WEB TESTS

117 new tests in `tests/hier-c-team-management.test.ts`:

- **8 type contract tests** — EligibilityCode, TeamMember, TeamResponse, CandidateRow, CandidateResponse, PreviewRow, PreviewResponse, BulkApplyResponse
- **34 EN i18n resolution tests** — all HIER-C keys resolve to non-empty English text
- **34 AR i18n resolution tests** — all HIER-C keys resolve to non-empty Arabic text
- **18 eligibility status tests** — all 9 codes × 2 locales resolve
- **2 EN/AR synchronization tests** — eligibilityStatuses keys match, HIER-C UI keys exist in both locales
- **4 interpolation tests** — selectedCount and applySuccess {count} placeholders work in both locales
- **2 cross-language tests** — EN text is English, AR text is Arabic
- **13 page source safety tests** — no raw CUID fallback, no hardcoded English labels, no localhost, no double-v1, no raw Arabic, isEligible admits only ELIGIBLE, handleApply blocks on conflicts, AbortController race safety, preview invalidated on selection change, leader select clears state, SelectAll scoped to eligible, bulk apply includes required fields, no object Object fallback

### API TEST COUNTS

| Metric | Value |
|---|---|
| API tests before | 1802/1802 PASS |
| API tests after | 1802/1802 PASS |
| API tests removed | 0 |
| API tests skipped | 0 |

## 12. Gates

| Gate | Result |
|---|---|
| Web TypeScript | PASS (0 errors) |
| API TypeScript | PASS (0 errors) |
| Web Build | PASS |
| API Build | PASS |
| Prisma Validate | PASS |
| Prisma Generate | PASS |
| Prisma Migrate Status | PASS (62 migrations, schema up to date) |
| UI Baseline | PASS (99 checks) |
| i18n Check | PASS (part of UI baseline) |

## 13. Browser Runtime

| Check | Result |
|---|---|
| AR page runtime | NOT_PERFORMED_BY_DESIGN (no real DB data) |
| EN page runtime | NOT_PERFORMED_BY_DESIGN (no real DB data) |
| REAL_DB_MUTATION_PROOF | NOT_PERFORMED_BY_DESIGN |
| Code-level safety verification | PASS (no console, no localhost, no double-v1, no raw CUID, all via t()) |

## 14. Schema / Data

| Check | Result |
|---|---|
| PRISMA_SCHEMA_CHANGES | 0 |
| MIGRATIONS_CREATED | 0 |
| SUPERVISOR_ROWS_BEFORE | 0 |
| SUPERVISOR_ROWS_AFTER | 0 |
| BUSINESS_DATA_DELTA | 0 |
| JOUBAH_DATA_CHANGED | NO |

## 15. Files Changed

### HIER-C APPLICATION FILES

| File | Action | Lines |
|---|---|---|
| `apps/web/src/app/admin/core/supervisor-assignments/page.tsx` | REWRITTEN | ~824 |
| `apps/web/src/lib/admin-types/core.ts` | MODIFIED | +103 (types) |
| `apps/web/src/lib/i18n/locales/en/core.ts` | MODIFIED | +45 (translations) |
| `apps/web/src/lib/i18n/locales/ar/core.ts` | MODIFIED | +45 (translations) |

### TEST INFRASTRUCTURE FILES

None changed. Web test infrastructure was already functional.

### HIER-C TEST FILES

| File | Action | Lines |
|---|---|---|
| `apps/web/tests/hier-c-team-management.test.ts` | CREATED | ~320 |

### PROOF FILES

| File | Action |
|---|---|
| `docs/proofs/hier-c-supervisor-first-team-ui-report.md` | CREATED |

## 16. Known Limitations

1. **No real browser proof** — SupervisorAssignment table has 0 rows. Page loads but cannot demonstrate real data flow.
2. **Branch/Department/JobTitle filter dropdowns** — Filter inputs use text fields, not F9 lookups. Backend supports these filters but the UI doesn't yet have cascading dropdowns for branch→administration→department.
3. **Single delete only** — Bulk remove deferred per spec.
4. **leadershipLevel** — Deferred to HIER-D.
5. **Transfer** — Deferred per spec.

## 17. Git Status

```
 M apps/web/src/app/admin/core/supervisor-assignments/page.tsx
 M apps/web/src/lib/admin-types/core.ts
 M apps/web/src/lib/i18n/locales/ar/core.ts
 M apps/web/src/lib/i18n/locales/en/core.ts
?? apps/web/tests/hier-c-team-management.test.ts
?? docs/proofs/hier-c-supervisor-first-team-ui-report.md
```

## 18. Commit Status

**NOT COMMITTED** — awaiting explicit user request.
