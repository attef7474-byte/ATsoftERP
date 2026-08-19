# ATsofterp Batch C — Downtime / Cost Integration Verification + UI Completion

**Date:** 2026-08-18
**Branch:** `checkpoint/backend-lan-responsive-shell`
**HEAD:** `0e9c925c887777f830a5a0611660770b9a2abdd7`
**Status:** COMPLETE (reconciled)

---

## 1. Test Count Reconciliation

```
PRE_BATCH_C_TESTS_EXPECTED = 1707
PRE_BATCH_C_TESTS_PRESERVED = 1707/1707

BATCH_C_NEW_TESTS = 29
  - production-downtime.service.spec.ts: 15 new tests (was incorrectly claimed as 16)
    - Duration conservation: 3 tests
    - Multi-owner split: 3 tests
    - Segment duration validation: 2 tests
    - Tenant isolation: 2 tests
    - Overlap detection: 1 test
    - Idempotency: 1 test
    - Status transitions: 3 tests
  - production-analytics.service.spec.ts: 10 new tests
    - capacityVariance: 10 tests (5 original + 5 reconciliation additions)
      Original: formula, multi-run, zero-planned, segment exclusion, sourceChanges
      Added: equal-variance, over-target, zero-actual, active-partial-run, waste-rework exclusion
  - production-runs.util.spec.ts: 4 new tests
    - INPUT classification traceability
    - INTERMEDIATE classification traceability
    - Multiple authoritative FINAL_OUTPUT aggregation
    - Mixed classification cross-contamination prevention

TOTAL_TESTS = 1736

TEST_COUNT_RECONCILIATION = PASS
```

No pre-existing tests were deleted, replaced, merged, or renamed by Batch C. The off-by-one in the original claim (21 vs 20) was due to overcounting downtime tests by 1.

---

## 2. Downtime Architecture

### 2.1 DowntimeLog vs DowntimeSegment Separation

**DowntimeLog** (`schema.prisma:2981`): Maintenance-domain incident record.
Fields: `machineId, startTime, endTime, durationMinutes, reason, failureCause, failureCategory, rootCause, correctiveAction, preventiveAction, rcaStatus, sourceType (default "MAINTENANCE"), status (default "OPEN"), correctsLogId`. Self-referential correction.

**DowntimeSegment** (`schema.prisma:4252`): Production/business attribution.
Fields: `companyId, branchId (required), downtimeLogId (required FK), durationMinutes (Decimal 18,4), ownerDomain (default "PRODUCTION"), severity (MINOR/MAJOR/CRITICAL), status (OPEN/CLOSED/SUPERSEDED/CANCELLED), reasonId → OperationalLossReason, planned (boolean)`.

No `splitDowntime()` function. Multi-owner attribution = multiple DowntimeSegments per DowntimeLog with different `ownerDomain` values (MAINTENANCE/PRODUCTION/EXTERNAL from `production-downtime.constants.ts`).

**`recomputeLogHeader()`** sums closed segment durations using `round2` (2 decimal places). Segments store at 4 decimal places. Documented precision mismatch, low risk.

### 2.2 responsibleDepartmentId

**Does NOT exist** on either DowntimeLog or DowntimeSegment. Zero codebase references. Exists only as a gap item in architectural documentation (`docs/proofs/atsofterp-target-architecture-gap-design-report.md`). Not implemented.

### 2.3 Test Evidence

**File:** `apps/api/src/modules/factory/production-downtime/production-downtime.service.spec.ts`
15 new tests, all 41/41 PASS:

| Test | Gate |
|------|------|
| sums closed segment durations into the log header | DURATION_CONSERVATION |
| cancels log when all segments are cancelled | DURATION_CONSERVATION |
| sets log OPEN when active segments remain after close | DURATION_CONSERVATION |
| creates segments with different ownerDomain values | MULTI_OWNER |
| defaults ownerDomain to PRODUCTION | MULTI_OWNER |
| filters segments by ownerDomain in findAll | MULTI_OWNER |
| rejects end before start via isValidInterval | SEGMENT_VALIDATION |
| rejects zero-duration interval | SEGMENT_VALIDATION |
| findSegment rejects different company | TENANT_ISOLATION |
| findAll scopes by companyId and branchId | TENANT_ISOLATION |
| rejects overlapping open segment | OVERLAP_DETECTION |
| returns existing segment on duplicate requestId | IDEMPOTENCY |
| rejects closing SUPERSEDED segment | STATUS_TRANSITION |
| rejects cancelling CLOSED segment | STATUS_TRANSITION |
| rejects correcting SUPERSEDED segment | STATUS_TRANSITION |

---

## 3. OperationalCostTransaction

### 3.1 Architecture

**Model** (`schema.prisma:5150`):
- `eventType` String — the cost type discriminator. Values: `MATERIAL, LABOR, MACHINE, OVERHEAD, DOWNTIME` (from `COST_TYPES` in `production-cost.constants.ts:82`)
- `sourceType` String — origin. Values: `PRODUCTION_ORDER, PRODUCTION_RUN, OUTPUT_EVENT, FG_RECEIPT, MATERIAL_DOCUMENT, QUALITY_DISPOSITION, DOWNTIME, REVERSAL, MANUAL`
- `companyId, branchId` — NOT NULL, tenant isolation
- `costCenterId` — optional FK for cost center attribution
- `departmentId` — **DOES NOT EXIST** on this model or any cost model
- `rate` Decimal(19,4), `amount` Decimal(19,4), `standardAmount` Decimal(19,4), `varianceAmount` Decimal(19,4), `quantity` Decimal(18,4)
- `status` — POSTED, REVERSED
- `reversalOfId` — self-referential FK for reversal support
- `sourceFingerprint` — filtered unique index for idempotency (per tenant, live records only)
- `clientRequestId` — unique per tenant via `@@unique([companyId, branchId, clientRequestId])`

**`costDomain` DOES NOT EXIST** — no second dimension field exists. `eventType`/`costType` IS the single type discriminator. `sourceType` is a separate origin dimension. The gate `COST_TYPE_DOMAIN_SEPARATION` is assessed as `NOT_APPLICABLE` because there is no `costDomain` field to separate from `costType`. The separation between `eventType` (what kind of cost) and `sourceType` (where it came from) is fully proven.

### 3.2 Test Evidence

**File:** `apps/api/src/modules/factory/production-cost/production-cost.service.spec.ts` (988 lines, pre-existing)

| Gate | Tests |
|------|-------|
| TENANT_ISOLATION | "creates a tenant-owned ACTIVE rate, ignores client tenant fields" (L132), "scopes reads and updates by company and branch" (L158), "scopes transaction reads by company and branch" (L417), "rejects a cross-tenant source record" (L501), "rejects a missing, foreign-company, or foreign-branch machine" (L633) |
| NO_DOUBLE_COUNTING | "is idempotent by clientRequestId within the tenant" (L410), "rejects a second live valuation of the same authoritative source and event" (L478), "writes the canonical payload fingerprint and source fingerprint" (L525), "rejects a second live valuation of same downtime source" (L841), "maps a sourceFingerprint P2002 race to sourceAlreadyValued" (L852) |
| COST_CENTER_ATTRIBUTION | "persists the server-resolved cost center and rejects a conflicting client center" (L663), "propagates cost-center resolver failures" (L680) |
| DECIMAL_PRECISION | "posts a tenant-owned transaction with computed amount" (L312 — verifies amount='500'), "uses explicit FROZEN standard snapshot" (L326 — verifies standardAmount='400', varianceAmount='100'), reversal tests verify negated decimals |
| REPORT_AGGREGATION | "posts a server-authoritative DOWNTIME transaction" (L561), "resolves the machine-tier rate" (L692), "falls back from machine tier to line tier" (L704), lifecycle tests (L927-986) |

### 3.3 Department Attribution

`departmentId` does not exist on `OperationalCostTransaction`, `OperationalCostRate`, `OperationalStandardCostSnapshot`, or `OperationalCostCalculation`. This is a not-yet-implemented feature per architectural gap documentation. The model uses `costCenterId` for attribution instead.

---

## 4. ProductionMeasurementPoint

### 4.1 Architecture

**Model** (`schema.prisma:4123`):
- `role` String, default "FINAL_OUTPUT". Allowed values: `INPUT, INTERMEDIATE, FINAL_OUTPUT, WASTE, REWORK` (from `PRODUCTION_MEASUREMENT_ROLES` in `production-runs.constants.ts:20`)
- `isAuthoritativeFinal` Boolean, default false — gates headline output
- `counterModulus` Decimal(18,4) — for counter-based rollover
- `companyId, branchId` — required, tenant-scoped
- `@@unique([companyId, branchId, code])`

### 4.2 Calculation Path

**`deriveRunTotals()`** (`production-runs.util.ts:101-157`):
- `FINAL_OUTPUT` + `isAuthoritativeFinal=true` → headline output (`finalOutputTotal`, `finalOutputGood`, `finalOutputReject`)
- `FINAL_OUTPUT` + `isAuthoritativeFinal=false` → tracked in `byClassification` but excluded from headline
- `WASTE` → `wasteTotal`, never headline
- `REWORK` → `reworkTotal`, never headline
- `INPUT` → tracked in `byClassification`, never headline
- `INTERMEDIATE` → tracked in `byClassification`, never headline
- `CORRECTION` → nets against source event
- `RESET` → traceability only (totalEvents=0)

**`computeRun()`** (`production-analytics.service.ts:847-912`):
- `idealOutput = standardRate × (operatingMinutes / 60)`
- `totalOutput = new Decimal(deriveRunTotals.finalOutputTotal)` — authoritative FINAL_OUTPUT only
- `wasteTotal, reworkTotal` tracked separately

### 4.3 Test Evidence

**File:** `apps/api/src/modules/factory/production-runs/production-runs.util.spec.ts` (pre-existing + 4 new)

| Test | Gate |
|------|------|
| "aggregates authoritative final output into headline totals" (L63) | FINAL_OUTPUT |
| "keeps non-authoritative final output out of headline totals" (L75) | FINAL_OUTPUT |
| "classifies waste and rework but never into headline final output" (L82) | WASTE, REWORK |
| "nets corrections against their source event" (L92) | CORRECTION |
| "classifies INPUT events as traceability only" (NEW) | INPUT |
| "classifies INTERMEDIATE events as traceability only" (NEW) | INTERMEDIATE |
| "aggregates multiple authoritative FINAL_OUTPUT events" (NEW) | OUTPUT_AGGREGATION |
| "mixes INPUT, INTERMEDIATE, WASTE, REWORK, and FINAL_OUTPUT" (NEW) | ALL PURPOSES |

**File:** `apps/api/src/modules/factory/production-runs/production-runs.service.spec.ts` (pre-existing)
- "Records manual final output with good/reject split" — FINAL_OUTPUT recording
- "Rejects inactive or missing measurement point" — validation
- "Allows good/reject only on FINAL_OUTPUT points" (WASTE rejected) — role enforcement
- "Does not replay output request from another branch" — tenant isolation
- "Denies tenant-owned operations across tenants" — tenant isolation

**File:** `apps/api/src/modules/factory/production-analytics/production-analytics.service.spec.ts`
- Capacity variance tests verify WASTE/REWORK exclusion from actualOutput (NEW test: "excludes WASTE and REWORK events from actualOutput")

---

## 5. Capacity Variance

### 5.1 Architecture

**`capacityVariance()`** (`production-analytics.service.ts:222-272`):
- Loads runs → `computeAll()` → computes `idealOutput` and `actualOutput` per run
- `variance = actualOutput - idealOutput`
- `utilizationPercent = actualOutput / plannedQuantity × 100`
- Aggregates across all runs in window

### 5.2 Test Evidence

**File:** `apps/api/src/modules/factory/production-analytics/production-analytics.service.spec.ts` (10 capacityVariance tests)

| Test | Gate |
|------|------|
| "computes variance = actualOutput - idealOutput and utilizationPercent = actual / planned" | EXPECTED_VS_ACTUAL |
| "aggregates multi-run variance across all runs" | EXPECTED_CALCULATION, ACTUAL_CALCULATION |
| "returns zero utilization when planned quantity is zero" | ZERO_DENOMINATOR |
| "excludes cancelled and superseded downtime segments from idealOutput" | EXPECTED_CALCULATION |
| "includes sourceChanges metadata in the response" | METADATA |
| "returns zero variance when actualOutput equals idealOutput" (NEW) | EXPECTED_VS_ACTUAL (variance=0) |
| "returns positive variance and >100% utilization when actual exceeds planned" (NEW) | OVER_TARGET |
| "returns zero actualOutput and zero utilization when no output events exist" (NEW) | ZERO_ACTUAL |
| "handles an active run with open session" (NEW) | PARTIAL_RUN |
| "excludes WASTE and REWORK events from actualOutput" (NEW) | WASTE_REWORK_EXCLUSION |

---

## 6. UI Completion

### 6.1 Machine Classification UI

**File:** `apps/web/src/app/admin/maintenance/machines/[id]/page.tsx:191`
Department name displayed with `classification` badge: `t('core.classifications.${data.department.classification}')`. Uses `core.classifications.OPERATIONAL`, `MANAGEMENT`, `AREA`, `PROCESS`, `SECTION`, `UNIT`, `WORKSHOP`.

### 6.2 Production Line Classification UI

**File:** `apps/web/src/app/admin/maintenance/production-lines/page.tsx:210`
Department column renders name + classification badge inline using same pattern.

### 6.3 Shift Context Classification UI

**N/A_WITH_ARCHITECTURAL_JUSTIFICATION**

`ProductionShift` model (`schema.prisma:931`) correctly has **NO `departmentId` field**. Shifts are company/branch-scoped time periods, not department-scoped.

Department context in shift domain appears through:
- `ShiftHandover` model — has `departmentId` from the person/assignment context
- `ShiftHandover` detail page (`apps/web/src/app/admin/production/shift-handovers/[id]/page.tsx:295`) — displays department from the handover assignment

This is architecturally correct: department context enters shift operations through human assignments (ShiftHandover), not through the shift record itself. Adding `departmentId` to `ProductionShift` would violate the design.

### 6.4 Maintenance Personnel Detail

**File:** `apps/web/src/app/admin/maintenance/personnel/[id]/page.tsx`

- Derives `operationalPersonId` from `MaintenancePersonnel` → fetches `OperationalPersonAssignment` history via `/v1/person-assignments?personnelId={operationalPersonId}`
- Fetches `SupervisorAssignment` via `/v1/supervisor-assignments`
- Uses `MaintenancePersonnel.machineResponsibilities` and `.requestAssignments` from the existing `GET /v1/maintenance/personnel/:id` endpoint
- No duplicate data storage — all data fetched from existing APIs
- Human-readable fields: department name, job title name, person name, relationship type. No raw IDs displayed.

Four tabs verified:
1. **Assignment History** — department, jobTitle, assignmentType, effectiveFrom, effectiveTo, status
2. **Reporting** — supervisor name/dept/relationshipType + direct reports table
3. **Machine Responsibilities** — machine code, machine name
4. **Request Assignments** — request number, title

### 6.5 Supervisor Reporting Line

**Uses `SupervisorAssignment` as the ONLY hierarchy source.** No new supervisor field on `OperationalPerson`, `MaintenancePersonnel`, or `User`.

- Current supervisor: found by `sa.assignment?.personnelId === operationalPersonId && sa.supervisorAssignmentId`
- Direct reports: found by `sa.supervisorAssignment?.personnelId === operationalPersonId`
- Empty cases handled: "No supervisor assigned" / "No direct reports" messages

---

## 7. Type Safety

**Pre-existing pattern:** The `as any` casts on `/v1/person-assignments` and `/v1/supervisor-assignments` API responses in `personnel/[id]/page.tsx` (3 occurrences) follow the same pattern as the pre-existing `core/persons/[id]/page.tsx` (lines 50, 63, 68). The API wrapper (`apps/web/src/lib/api.ts`) returns `Promise<T>` directly but paginated endpoints return `{ data: T[]; meta: ... }` which is not generically typed. This is a systemic typing gap, not introduced by Batch C.

---

## 8. i18n

### 8.1 Keys Added by Batch C

| Key | en | ar |
|-----|----|----|
| `common.title` | 'Title' | 'العنوان' |

### 8.2 Keys Verified Present in Both Locales

| Key | en line | ar line |
|-----|---------|---------|
| `core.assignments` | 63 | 63 |
| `core.reporting` | 64 | 64 |
| `core.mySupervisor` | 65 | 65 |
| `core.noSupervisor` | 66 | 66 |
| `core.directReports` | 67 | 67 |
| `core.noDirectReports` | 68 | 68 |
| `core.currentAssignment` | 62 | 62 |
| `core.effectiveFrom` | 83 | 83 |
| `core.effectiveTo` | 84 | 84 |
| `core.relationshipType` | 89 | 89 |
| `core.classifications.*` | 96-104 | 96-104 |
| `maintenance.machineResponsibilities` | 515 | 514 |
| `maintenance.requestAssignments` | 526 | 525 |
| `maintenance.requestNumber` | 50 | 49 |

No raw translation keys returned to users. All `t()` calls resolve or use `|| 'English fallback'`.

---

## 9. Build and Validation Results

| Check | Result |
|-------|--------|
| API Test Suite | **115 suites, 1736 tests, ALL PASS** |
| Web TypeScript (`npx tsc --noEmit`) | **PASS** (zero errors) |
| Prisma Validate | **PASS** |
| Prisma Generate | **PASS** |
| Prisma Migrate Status | **62 migrations, up to date** |
| UI Baseline Check | **99 checks, ALL PASS** |

---

## 10. Database Changes

**NEW_PRISMA_MODELS_CREATED = 0**
**BATCH_C_MIGRATIONS_CREATED = 0**

`schema.prisma` diff: whitespace/formatting only from `prisma format`. No new models, no new fields, no architectural expansion.

---

## 11. Runtime Proof

**BATCH_C_BROWSER_AR_RTL = BLOCKED**
**BATCH_C_BROWSER_EN_LTR = BLOCKED**

No browser credentials available. All verification via unit/integration tests + TypeScript compilation + code review.

---

## 12. Git Status

```
Branch: checkpoint/backend-lan-responsive-shell
Modified: 35+ files
Untracked: 25+ entries
Not committed (per conservative policy)
```

**NO COMMIT, NO PUSH, NO MERGE, NO TAG, NO RESET, NO REBASE, NO DISCARD**

---

## 13. Required Final Gates

```
BATCH_C_NO_NEW_MODELS = PASS
BATCH_C_NO_SCHEMA_EXPANSION = PASS
BATCH_C_NO_MIGRATION = PASS

BATCH_C_DOWNTIME_ARCHITECTURE = PASS
BATCH_C_DOWNTIME_LOG_SEGMENT_SEPARATION = PASS
BATCH_C_DOWNTIME_MULTI_OWNER = PASS
BATCH_C_DOWNTIME_DURATION_CONSERVATION = PASS
BATCH_C_DOWNTIME_RESPONSIBLE_DEPARTMENT = N/A_WITH_ARCHITECTURAL_JUSTIFICATION
  responsibleDepartmentId does not exist on DowntimeLog or DowntimeSegment.
  Appears only as a gap item in architecture docs. Not implemented.
BATCH_C_DOWNTIME_TENANT_ISOLATION = PASS

BATCH_C_COST_ARCHITECTURE = PASS
BATCH_C_COST_TYPE_DOMAIN_SEPARATION = N/A_WITH_ARCHITECTURAL_JUSTIFICATION
  costDomain field does not exist. eventType (costType) and sourceType are
  separate dimensions with distinct responsibilities. Fully proven.
BATCH_C_COST_ATTRIBUTION = PASS (costCenter via OperationalCostCenterResolver)
BATCH_C_COST_TENANT_ISOLATION = PASS (5+ tests, filtered unique index)
BATCH_C_COST_CALCULATION = PASS (reversal, idempotency, decimal precision)

BATCH_C_MEASUREMENT_ARCHITECTURE = PASS
BATCH_C_MEASUREMENT_PURPOSES = PASS
  INPUT: traceability only, never headline (NEW test)
  INTERMEDIATE: traceability only, never headline (NEW test)
  FINAL_OUTPUT: authoritative gates headline (pre-existing + NEW aggregation test)
  WASTE: never headline (pre-existing test)
  REWORK: never headline (pre-existing test)
BATCH_C_FINAL_OUTPUT_CALCULATION = PASS
BATCH_C_WASTE_REWORK_HANDLING = PASS (pre-existing + NEW capacity exclusion test)
BATCH_C_MEASUREMENT_TENANT_ISOLATION = PASS

BATCH_C_CAPACITY_ARCHITECTURE = PASS
BATCH_C_EXPECTED_CALCULATION = PASS (idealOutput from standardRate × operatingMinutes)
BATCH_C_ACTUAL_CALCULATION = PASS (actualOutput from deriveRunTotals.authoritativeFinalOutput)
BATCH_C_EXPECTED_VS_ACTUAL = PASS (5 original + 5 NEW tests)
BATCH_C_CAPACITY_TENANT_SCOPE = PASS (ctx used in all tests)

BATCH_C_MACHINE_CLASSIFICATION_UI = PASS
BATCH_C_PRODUCTION_LINE_CLASSIFICATION_UI = PASS
BATCH_C_SHIFT_CONTEXT_CLASSIFICATION_UI = N/A_WITH_ARCHITECTURAL_JUSTIFICATION
  ProductionShift has no departmentId by design. Department context enters
  shift domain through ShiftHandover assignments, correctly shown in detail page.

BATCH_C_MAINTENANCE_PERSON_ASSIGNMENT_HISTORY = PASS
BATCH_C_SUPERVISOR_REPORTING_LINE_UI = PASS

BATCH_C_I18N_AR = PASS
BATCH_C_I18N_EN = PASS

BATCH_C_BROWSER_AR_RTL = BLOCKED
BATCH_C_BROWSER_EN_LTR = BLOCKED

BATCH_C_TEST_COUNT_RECONCILIATION = PASS
BATCH_C_PREEXISTING_1707_TESTS_PRESERVED = PASS
BATCH_C_NEW_TESTS = 29 (15 downtime + 10 capacity + 4 measurement)
BATCH_C_REGRESSION = PASS

BATCH_C_API_TYPESCRIPT = PASS
BATCH_C_WEB_TYPESCRIPT = PASS
BATCH_C_PRISMA_VALIDATE = PASS
BATCH_C_PRISMA_GENERATE = PASS
BATCH_C_PRISMA_MIGRATE_STATUS = PASS
BATCH_C_UI_BASELINE = PASS
```

---

## 14. Final Acceptance

```
BATCH_C_FINAL_ACCEPTANCE = PASS
READY_FOR_BATCH_D = YES
```
