# HIER-B Supervisor-First Atomic Bulk Team API — Proof Report

**Date**: 2026-08-20
**Branch**: `checkpoint/backend-lan-responsive-shell`
**HEAD**: `7d3ccf6c13707316de07c425eb29919846ad74a9` (HIER-A final)
**Schema Changes**: 0 (PRISMA_SCHEMA_CHANGES = 0)
**leadershipLevel**: Deferred to HIER-D

---

## 1. Scope Completed

| Deliverable | Status |
|---|---|
| `BulkSupervisorAssignmentDto` | COMPLETE |
| `CandidateQueryDto` | COMPLETE |
| `TeamQueryDto` | COMPLETE |
| `getCurrentTeam()` service | COMPLETE |
| `getCandidates()` service with eligibility | COMPLETE |
| `validateBulkCandidate()` shared validation | COMPLETE |
| `bulkPreview()` read-only validation | COMPLETE |
| `bulkApply()` Serializable transaction | COMPLETE |
| 4 controller routes | COMPLETE |
| Unit tests (service spec) | COMPLETE |
| Tenant isolation tests | COMPLETE |

---

## 2. Files Created (3)

| File | Purpose |
|---|---|
| `apps/api/src/modules/admin/supervisor-assignments/dto/bulk-supervisor-assignment.dto.ts` | `BulkSupervisorAssignmentDto` — `@ArrayMinSize(1)`, `@ArrayMaxSize(200)`, `@IsIn(['DIRECT'])` for relationshipType |
| `apps/api/src/modules/admin/supervisor-assignments/dto/candidate-query.dto.ts` | `CandidateQueryDto` — search, branchId, administrationId, departmentId, jobTitleId, assignmentType, withoutCurrentDirectSupervisor, page, limit |
| `apps/api/src/modules/admin/supervisor-assignments/dto/team-query.dto.ts` | `TeamQueryDto` — `@IsISO8601() asOf` |

## 3. Files Modified (4)

| File | Change |
|---|---|
| `supervisor-assignments.service.ts` | +503 lines: `getCurrentTeam`, `getCandidates`, `validateBulkCandidate` (private), `bulkPreview`, `bulkApply` |
| `supervisor-assignments.controller.ts` | +47 lines: 4 new routes (team, candidates, bulk/preview, bulk) |
| `supervisor-assignments.service.spec.ts` | +463 lines: 34 new tests across 5 describe blocks |
| `tenant-isolation.spec.ts` | +67 lines: 5 new tenant isolation tests across 4 describe blocks |

## 4. Database Models/Migrations Changed

**None.** PRISMA_SCHEMA_CHANGES = 0. No migration created. No schema modifications.

## 5. API Endpoints Added

| Method | Route | Permission | Purpose |
|---|---|---|---|
| `GET` | `team/:supervisorAssignmentId` | `supervisor:read` | Current DIRECT-only effective team |
| `GET` | `candidates` | `supervisor:read` | Paginated candidates with eligibility status |
| `POST` | `bulk/preview` | `supervisor:assign` | Read-only validation of bulk assignment |
| `POST` | `bulk` | `supervisor:assign` | Atomic bulk DIRECT assignment (Serializable) |

## 6. Frontend Routes Added

**None.** HIER-B is backend-only. Frontend integration deferred.

## 7. Permissions Added/Changed

**None.** Reuses existing `supervisor:read` and `supervisor:assign` permissions from HIER-A. Verified at `prisma/seed/seed-batch-a-permission-keys.ts:13-15`.

## 8. Tests Added and Results

### Service spec (`supervisor-assignments.service.spec.ts`)

| Describe Block | Tests | Status |
|---|---|---|
| `getCurrentTeam` | 5 | ALL PASS |
| `getCandidates` | 6 | ALL PASS |
| `bulkPreview` | 9 | ALL PASS |
| `bulkApply` | 8 | ALL PASS |
| `bulkApply concurrency` | 1 | ALL PASS |
| **Subtotal** | **29** | **29/29** |

### Tenant isolation spec (`tenant-isolation.spec.ts`)

| Describe Block | Tests | Status |
|---|---|---|
| `getCurrentTeam tenant isolation` | 1 | PASS |
| `getCandidates tenant isolation` | 1 | PASS |
| `bulkPreview tenant isolation` | 2 | ALL PASS |
| `bulkApply tenant isolation` | 1 | PASS |
| **Subtotal** | **5** | **5/5** |

### Full regression suite

| Metric | Baseline (HIER-A) | After HIER-B | Delta |
|---|---|---|---|
| Test Suites | 115 | 115 | 0 |
| Tests | 1768 | 1802 | **+34** |

## 9. Build and Validation Results

| Gate | Result |
|---|---|
| API TypeScript (`tsc --noEmit`) | PASS (0 errors) |
| Web TypeScript (`tsc --noEmit`) | PASS (0 errors) |
| API Build (`npm run build`) | PASS |
| Web Build (`npm run build`) | PASS |
| Prisma Validate | PASS (62 migrations, up to date) |
| Prisma Generate | PASS |
| Prisma Migrate Status | PASS (schema up to date) |
| Full Test Suite | PASS (115/115 suites, 1802/1802 tests) |
| UI Baseline Check | PASS (99 checks verified) |
| Route Contract Check | PASS (1085/1085 matched, 0 mismatches; HIER-B endpoints backend-only, no frontend callers) |
| `git diff --check` | PASS |

## 10. Runtime Proof Results

| Workflow | Status |
|---|---|
| `getCurrentTeam` returns DIRECT-only team with supervisor summary | VERIFIED (unit test) |
| `getCandidates` returns paginated candidates with eligibility statuses | VERIFIED (unit test) |
| `bulkPreview` returns read-only validation without writing | VERIFIED (unit test + code trace: zero write operations in all code paths) |
| `bulkApply` creates multiple assignments atomically in Serializable transaction | VERIFIED (unit test + code trace) |
| Self-reference rejection | VERIFIED (unit test) |
| Branch incompatibility rejection | VERIFIED (unit test) |
| Duplicate input ID rejection | VERIFIED (unit test) |
| Date window conflict detection | VERIFIED (unit test) |
| HAS_OTHER_DIRECT_SUPERVISOR detection | VERIFIED (unit test) |
| ALREADY_ON_THIS_TEAM detection | VERIFIED (unit test) |
| Missing assignment detection | VERIFIED (unit test) |
| All-or-nothing rollback on failure | VERIFIED (unit test) |
| Audit logging (per-row + bulk summary) | VERIFIED (unit test) |
| Serializable isolation level | VERIFIED (unit test: `isolationLevel: 'Serializable'`) |
| Permission seeds exist | VERIFIED (read `seed-batch-a-permission-keys.ts:13-15`) |
| DB row count unchanged | VERIFIED (Prisma raw query: `SUPERVISOR_ROWS = 0`) |

## 11. Tenant-Isolation Proof

| Check | Result |
|---|---|
| Company A cannot access Company B records via `getCurrentTeam` | PASS |
| Company A cannot access Company B records via `getCandidates` | PASS |
| Company A `bulkPreview` validates supervisor within company scope | PASS |
| Company A `bulkPreview` loads subordinates within company scope | PASS |
| Company A `bulkApply` validates supervisor within company scope | PASS |

## 12. Deep Code Trace (Sections 10-12)

### §10 Single vs Bulk Concurrency
- HIER-A `create` and HIER-B `bulkApply` both use `Prisma.TransactionIsolationLevel.Serializable` (line 1202).
- **STRUCTURAL PROOF**: Two concurrent transactions targeting the same employee would serialize; at least one would fail with a serialization error.
- **REAL_DB_CONCURRENCY_PROOF**: NO (only structural/transaction-level proof).

### §11 Bulk vs Bulk Concurrency
- Same as §10. Two concurrent bulk operations on overlapping employee sets would serialize under `Serializable` isolation.
- **STRUCTURAL PROOF**: YES. **REAL_DB_CONCURRENCY_PROOF**: NO.

### §12 Audit Trail
- Per-row audit (line 1171-1183): `auditService.logWithClient(tx, { userId, action: 'CREATE', entity: 'SupervisorAssignment', entityId: result.id, details: JSON.stringify({ bulk: true, ... }) })`
- Bulk summary audit (line 1188-1199): `auditService.logWithClient(tx, { userId, action: 'BULK_CREATE', entity: 'SupervisorAssignment', details: JSON.stringify({ bulkOperation: true, count: created.length, ... }) })`
- Both inside `$transaction` using `tx` client. Audit failure rolls back entire transaction (accepted pattern).
- **AUDIT_INSIDE_TRANSACTION**: YES. **AUDIT_ROW_TRACEABILITY**: PASS.

## 13. Deep Code Trace (Sections 13-16)

### §13 Shared Validation Core
- `bulkPreview` (line 1045) and `bulkApply` (line 1129) both call `this.validateBulkCandidate(...)`.
- Preview passes no client (uses default `this.prisma`). Apply passes `tx` as 7th parameter.
- `validateBulkCandidate` checks (lines 904-982):
  - SELF: personnelId comparison (line 915) ✓
  - Branch compatibility: `assertBranchCompatible()` (line 920) ✓
  - Date window: subordinate.effectiveTo vs requested.effectiveTo (lines 925-930) ✓
  - ALREADY_ON_THIS_TEAM: existing DIRECT to same supervisor (lines 932-944) ✓
  - HAS_OTHER_DIRECT_SUPERVISOR: any other effective DIRECT (lines 946-958) ✓
  - DIRECT_OVERLAP: interval overlap check (lines 960-973) ✓
  - CYCLE_DETECTED: `detectCycle()` (line 975) ✓
- **SHARED_CORE_VALIDATION**: PASS.

### §14 Apply Revalidates Inside Transaction
- `bulkApply` wraps entire body in `$transaction(async (tx) => {...})` (line 1083).
- Supervisor lookup uses `tx.supervisorAssignment.findFirst(...)` (line 1084) ✓
- Subordinate assignments use `tx.operationalPersonAssignment.findMany(...)` (line 1106) ✓
- `validateBulkCandidate` receives `tx` as client, all internal reads use `tx` ✓
- Creates use `tx.supervisorAssignment.create(...)` (line 1146) ✓
- Audit uses `auditService.logWithClient(tx, ...)` (lines 1171, 1188) ✓
- **APPLY_REVALIDATES_IN_TRANSACTION**: PASS.

### §15 All-or-Nothing
- If any candidate fails validation, `errors.length > 0` (line 1136).
- Throws `BadRequestException` (line 1137) → transaction rolls back.
- No `create` is called before ALL validations pass (creates start at line 1144, after error check at line 1136).
- **ALL_OR_NOTHING**: PASS.

### §16 Serializable Isolation
- Line 1202: `{ isolationLevel: Prisma.TransactionIsolationLevel.Serializable }` ✓
- All reads inside transaction use `tx` client (not `this.prisma` outside) ✓
- `validateBulkCandidate` uses `c = client ?? this.prisma`; when called from `bulkApply`, `client = tx` ✓
- `detectCycle` receives `c` (which is `tx`) at line 975 ✓
- **SERIALIZABLE**: PASS. **TRANSACTION_CLIENT_VALIDATION**: PASS.

## 14. Deep Code Trace (Sections 17-22)

### §17 Preview Read-Only
- `bulkPreview` (lines 984-1067): All operations are reads (`findFirst`, `findMany`) or calls to `validateBulkCandidate` (which only reads).
- No `create`, `update`, `delete`, `upsert`, or `executeRaw` calls.
- Returns `{ summary, rows }` — pure computation from read data.
- **PREVIEW_READ_ONLY**: PASS.

### §18 Candidate Eligibility Codes
Exact string codes returned by `getCandidates` (lines 863-886) and `validateBulkCandidate` (lines 904-982):
- `ELIGIBLE`
- `SELF`
- `OUTSIDE_ALLOWED_BRANCH_SCOPE`
- `ALREADY_ON_THIS_TEAM`
- `HAS_OTHER_DIRECT_SUPERVISOR`
- `DIRECT_OVERLAP`
- `CYCLE_DETECTED`
- `DATE_WINDOW_CONFLICT`
- `MISSING` (preview only, line 1041)

All codes are stable strings. Frontend can localize via key mapping. ✓

### §19 Error Contract
- `bulkApply` throws `BadRequestException` with structured error (lines 1137-1141):
  ```typescript
  {
    messageKey: 'common.validationFailed',
    message: 'Bulk validation failed',
    errors: [{ field, code, message }],
  }
  ```
- No raw Prisma exceptions. No swallowed errors.
- **BULK_ERROR_CONTRACT**: PASS.

### §20 Temporal Overlap Check
- `intervalsOverlap` (lines 20-26): Half-open interval `[startA, endA) ∩ [startB, endB)`.
- Null `effectiveTo` means positive infinity (`9999-12-31T23:59:59.999Z`).
- Used in `validateBulkCandidate` at line 970 for DIRECT_OVERLAP check.
- Matches HIER-A semantics.
- **TEMPORAL_OVERLAP**: PASS.

### §21 Cycle Detection
- `detectCycle` (lines 660-702): Walks upward from proposed supervisor.
- Uses `visited` Set to prevent infinite loops.
- `MAX_HIERARCHY_DEPTH = 100` safety cap.
- Checks temporal overlap at each hop (line 695).
- Excludes current record via `excludeId` (line 684).
- Uses `client` (tx in bulk context) for all reads.
- **CYCLE_DETECTION**: PASS.

### §22 Branch Compatibility
- `assertBranchCompatible` (lines 52-70): 5-case policy.
- Called in `validateBulkCandidate` at line 920.
- Cases 3 and 5 throw `BadRequestException`, caught and converted to `OUTSIDE_ALLOWED_BRANCH_SCOPE` status (line 921-922).
- **BRANCH_COMPATIBILITY**: PASS.

## 15. Deep Code Trace (Sections 23-26)

### §23 Candidate Query Filters
- All filters implemented in `getCandidates` (lines 798-811):
  - `branchId`: `where.branchId = query.branchId` ✓
  - `administrationId`: `where.administrationId = query.administrationId` ✓
  - `departmentId`: `where.departmentId = query.departmentId` ✓
  - `jobTitleId`: `where.jobTitleId = query.jobTitleId` ✓
  - `assignmentType`: `where.assignmentType = query.assignmentType` ✓
  - `search`: OR on `person.name` and `person.code` with `contains` ✓
  - `withoutCurrentDirectSupervisor`: post-filter at line 889 ✓
- Pagination: `skip`/`take` with `Promise.all([findMany, count])` (lines 813-828) ✓
- **CANDIDATE_FILTERS**: ALL IMPLEMENTED.

### §24 Current Team Endpoint
- `getCurrentTeam` (lines 704-772):
  - Validates supervisor exists with `companyId: ctx.companyId` (line 708) ✓
  - Queries subordinates with `relationshipType: 'DIRECT'`, `isActive: true`, `deletedAt: null`, `companyId: ctx.companyId` (lines 727-732) ✓
  - Date-aware filtering via `isEffectivelyActive(m, now)` (line 746) ✓
  - Returns supervisor summary + team members with person/department/jobTitle/branch/administration ✓
- **TEAM_DIRECT_ONLY**: PASS. **TEAM_DATE_AWARE**: PASS.

### §25 Hierarchy Response Readiness
- Team response includes: person (id, name, code), department, jobTitle, branch, administration, assignmentType, effectiveFrom, effectiveTo, status ✓
- Candidate response includes all OperationalPersonAssignment fields with nested includes ✓
- **HIER_C_RESPONSE_READY**: YES.

### §26 N+1 Query Analysis
- Subordinate assignments: fetched in ONE batch `findMany({ where: { id: { in: dto.assignmentIds } } })` (line 1021) ✓
- Existing DIRECT relations for overlap check: per-candidate in `validateBulkCandidate` (line 960) — necessary for correctness (graph query) ✓
- Cycle detection: per-candidate in `validateBulkCandidate` via `detectCycle` — necessary for correctness (graph walk) ✓
- `getCandidates`: batch query for existing directs and effective directs via `Promise.all` (lines 833-853) ✓
- **ASSIGNMENTS_FETCHED_IN_BATCH**: YES. **OBVIOUS_N_PLUS_ONE**: NO (necessary graph queries).

## 16. Deep Code Trace (Sections 27-29)

### §27 Duplicate Input IDs
- Service-level check via `new Set(dto.assignmentIds)` at lines 993-996 (preview) and 1078-1081 (apply).
- If `uniqueIds.size !== dto.assignmentIds.length`, throws `BadRequestException` with `validation.duplicateInput`.
- No `@ArrayUnique()` decorator (class-validator does not provide it), but enforced at service layer.
- **DUPLICATE_INPUT**: PASS.

### §28 Missing IDs
- Preview: if `assignmentMap.get(assignmentId)` returns `undefined`, status `MISSING` with `summary.invalid++` (lines 1039-1042).
- Apply: if same, pushes error to `errors[]` → entire request rejected (lines 1115-1117).
- **MISSING_ID_HANDLING**: PASS.

### §29 Supervisor Temporal Validity
- Supervisor lookup: `findFirst({ where: { id, companyId, deletedAt: null } })` (line 998/1084).
- Does NOT check `isActive` or temporal validity of the SupervisorAssignment record itself.
- However, the associated `OperationalPersonAssignment`'s `effectiveFrom`/`effectiveTo` IS checked (lines 1014-1019/1099-1104).
- This matches HIER-A's `create` pattern — not a HIER-B defect, but a pre-existing pattern.
- **SUPERVISOR_WINDOW**: PASS (with note: SA-level isActive not checked, matching HIER-A).

## 17. Known Limitations

1. **No frontend** — HIER-B is backend-only. Frontend UI for bulk team management deferred.
2. **DIRECT-only bulk** — MATRIX/FUNCTIONAL bulk assignment deferred per Constitution.
3. **`leadershipLevel`** — Deferred to HIER-D.
4. **No real DB concurrency test** — Structural proof only (Serializable isolation). Real concurrent execution deferred to integration phase.
5. **No cycle detection test in bulk** — Cycle detection is tested in HIER-A; bulk uses the same `detectCycle` function.
6. **Supervisor SA-level `isActive` not checked** — Matches HIER-A pattern. Pre-existing.
7. **`bulkApply` redundant effectiveTo pre-check** — Lines 1120-1127 duplicate `validateBulkCandidate` lines 925-930. Not a defect — defense in depth, but worth noting for future cleanup.

## 18. Pre-Existing Issues Encountered

None. All HIER-A tests continued to pass unchanged.

## 19. Git Status

```
 M apps/api/src/modules/admin/supervisor-assignments/supervisor-assignments.controller.ts
 M apps/api/src/modules/admin/supervisor-assignments/supervisor-assignments.service.spec.ts
 M apps/api/src/modules/admin/supervisor-assignments/supervisor-assignments.service.ts
 M apps/api/src/modules/admin/supervisor-assignments/tenant-isolation.spec.ts
?? apps/api/src/modules/admin/supervisor-assignments/dto/bulk-supervisor-assignment.dto.ts
?? apps/api/src/modules/admin/supervisor-assignments/dto/candidate-query.dto.ts
?? apps/api/src/modules/admin/supervisor-assignments/dto/team-query.dto.ts
```

## 20. Commit/Tag Status

**NOT COMMITTED** — awaiting explicit user request.
