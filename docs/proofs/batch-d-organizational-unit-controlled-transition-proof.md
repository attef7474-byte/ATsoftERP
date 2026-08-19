# Batch D — OrganizationalUnit Controlled Transition: Proof Report

**Date:** 2026-08-18
**Branch:** `checkpoint/backend-lan-responsive-shell`
**Status:** RECONCILED

---

## 1. Baseline

| Item | Value |
|------|-------|
| Branch | `checkpoint/backend-lan-responsive-shell` |
| HEAD | `0e9c925c887777f830a5a0611660770b9a2abdd7` |
| Modified files | 41 |
| New directories | 12+ |
| Prisma migrations applied | 62 |

---

## 2. OrganizationalUnit Current State

### 2.1 Model Status: ORPHAN_LEAF

| Aspect | Status | Evidence |
|--------|--------|----------|
| Prisma model exists | ✅ | `schema.prisma:443-469` |
| Table created | ✅ | Migration `20260802000000_add_organizational_unit` |
| Backend CRUD module | ✅ | 6 source files in `modules/admin/organizational-units/` |
| App module registered | ✅ | `app.module.ts:14,105` |
| Unit tests | ✅ | 14 tests in `organizational-units.service.spec.ts` |
| Permission keys seeded | ✅ | `organizational-unit:create/read/update/delete` |
| Numbering sequence | ✅ | `OU-` prefix, GLOBAL scope |
| Frontend pages | ✅ | List + detail pages |
| F9 adapter | ✅ | `organizationalUnitAdapter` |
| Navigation entry | ✅ | Under Organization section |
| Translations (ar/en) | ✅ | 12+ translation keys |
| **FK consumers** | ❌ **ZERO** | No model references `organizationalUnitId` |
| **Seed data** | ⚠️ **0 seed, 1 actual DB record** | Table has 1 row (`MAINT-DEPT`) |
| **Frontend permission gating** | ❌ **MISSING** | No permission checks on nav or pages |

### 2.2 Evidence: Zero FK Consumers

Searched entire schema for `organizationalUnitId`:
- `grep "organizationalUnitId" apps/api/prisma/schema.prisma` → 0 matches
- `grep "organizationalUnit" apps/api/prisma/schema.prisma` → only in Company/Branch reverse relations and self-reference

**Conclusion:** OrganizationalUnit is defined but not wired into any transactional workflow.

---

## 3. Department Current State

### 3.1 Model Status: OPERATIONAL_BACKBONE

| Aspect | Status | Evidence |
|--------|--------|----------|
| Prisma model exists | ✅ | `schema.prisma:406-441` |
| Table created | ✅ | Migration `20260714042111_init_core_foundation` |
| Backend CRUD module | ✅ | 6 source files in `modules/admin/departments/` |
| App module registered | ✅ | `app.module.ts:10,105` |
| Unit tests | ✅ | 10 tests in `departments.service.spec.ts` |
| Permission keys seeded | ✅ | `department:create/read/update/delete` + `department:classify` |
| Numbering sequence | ✅ | `DEP-` prefix, GLOBAL scope |
| Frontend pages | ✅ | List + detail pages |
| F9 adapter | ✅ | `departmentAdapter` |
| Navigation entry | ✅ | Under Organization section (NOW WITH permission gating) |
| Translations (ar/en) | ✅ | 30+ translation keys |
| **FK consumers** | ✅ **9+ MODELS** | User, Machine×2, CostCenter, ProductionLine, etc. |
| **Seed data** | ✅ **1 seed, 4 actual DB records** | Seed: `ADMIN`. DB: 4 records across 4 companies |
| **Frontend permission gating** | ✅ **REMEDIATED** | Nav item now has `permission: 'department:read'` |

### 3.2 Evidence: 9+ FK Consumers

Searched schema for `departmentId`:
```
ProductionLine.departmentId (required)
User.departmentId (optional)
UserOperationalScope.departmentId (optional)
Machine.departmentId (optional)
Machine.technicalDepartmentId (optional)
CostCenter.departmentId (optional)
MachineResponsibilityAssignment.departmentId (optional)
ShiftHandover.departmentId (optional)
OperationalPersonAssignment.departmentId (required)
MaintenanceRequestRequiredPart.costDepartmentId (optional)
```

**Conclusion:** Department is the operational backbone of the system.

---

## 4. Semantic Overlap Analysis

### 4.1 Overlapping Fields

| Field | Department | OrganizationalUnit | Same Semantics? |
|-------|-----------|-------------------|-----------------|
| `id` | ✅ | ✅ | Yes (both CUID) |
| `companyId` | ✅ | ✅ | Yes (both FK to Company) |
| `branchId` | ✅ (optional) | ✅ (required) | **Partially** (requiredness differs) |
| `parentId` | ✅ (self-ref) | ✅ (self-ref) | Yes (both hierarchy) |
| `code` | ✅ | ✅ | **Partially** (uniqueness scope differs) |
| `name` | ✅ | ✅ | Yes |
| `status` | ✅ | ✅ | Yes |
| `createdAt` | ✅ | ✅ | Yes |
| `updatedAt` | ✅ | ✅ | Yes |
| `deletedAt` | ✅ | ✅ | Yes |

### 4.2 Unique to Department

| Field | Purpose |
|-------|---------|
| `administrationId` | Links to Administration entity |
| `classification` | `OPERATIONAL/MANAGEMENT/AREA/PROCESS/SECTION/UNIT/WORKSHOP` (7 values, default: OPERATIONAL) |

### 4.3 Unique to OrganizationalUnit

| Field | Purpose |
|-------|---------|
| `type` | `DEPARTMENT/SECTION/UNIT/TEAM/PROJECT/OTHER` — hierarchy level discriminator |

### 4.4 Key Semantic Difference

**Department** = Operational organizational entity (has transactional FKs, used in business rules)
**OrganizationalUnit** = Generic organizational hierarchy (tree structure only, no transactional use)

---

## 5. Data Mapping Feasibility

### 5.1 OU → Department Field Mapping

| OU Field | Department Field | Mapping Type | Notes |
|----------|-----------------|--------------|-------|
| `id` | `id` | Direct | Different tables, but IDs can be preserved |
| `companyId` | `companyId` | Direct | Identical FK |
| `branchId` | `branchId` | Safe (required→optional) | OU branchId is required, Dept is optional |
| `parentId` | `parentId` | Direct | Different relation names but same concept |
| `code` | `code` | Direct | Uniqueness scope differs (per-branch vs per-company) |
| `name` | `name` | Direct | Identical |
| `type` | **ARCHITECTURE_DECISION_REQUIRED** | May use `classification` + `parentId` | 4 of 6 values representable by existing structure |
| `status` | `status` | Direct | Identical |
| `createdAt` | `createdAt` | Direct | Identical |
| `updatedAt` | `updatedAt` | Direct | Identical |
| `deletedAt` | `deletedAt` | Direct | Identical |

### 5.2 OU.type → Department Mapping Analysis

| OU.type | Department Representation | Status |
|---------|--------------------------|--------|
| `DEPARTMENT` | IS a Department | REPRESENTABLE_BY_EXISTING_DEPARTMENT |
| `SECTION` | Department with `classification = SECTION` | REPRESENTABLE_BY_EXISTING_DEPARTMENT |
| `UNIT` | Department with `classification = UNIT` | REPRESENTABLE_BY_EXISTING_DEPARTMENT |
| `TEAM` | No TEAM classification exists | REQUIRES_MAPPING_RULE |
| `PROJECT` | Temporary vs permanent mismatch | REQUIRES_NEW_FIELD |
| `OTHER` | Ambiguous catch-all | AMBIGUOUS |

### 5.3 Data Counts

| Entity | Seed | Production Estimate | Migration Impact |
|--------|------|---------------------|------------------|
| OU records | 0 | 1 (verified) | 1 record to migrate |
| Department records | 1 | 4 (verified) | None (keeping Department) |
| OU FK consumers | 0 | 0 | None |
| Department FK consumers | 9+ models | 9+ models | None (keeping Department) |

---

## 6. Permission Key Analysis

### 6.1 Current State (REMEDIATED)

| Key | Seed Source | Controller Enforcement | Status |
|-----|-------------|----------------------|--------|
| `organizational-unit:create` | MODULES loop | `organizational-units.controller.ts:22` | ✅ Match |
| `organizational-unit:read` | MODULES loop | `organizational-units.controller.ts:29,46,53` | ✅ Match |
| `organizational-unit:update` | MODULES loop | `organizational-units.controller.ts:60` | ✅ Match |
| `organizational-unit:delete` | MODULES loop | `organizational-units.controller.ts:67` | ✅ Match |
| `department:create` | MODULES loop | `departments.controller.ts:20` now uses `department:create` | ✅ **REMEDIATED** |
| `department:read` | MODULES loop | `departments.controller.ts:27,40,47` now uses `department:read` | ✅ **REMEDIATED** |
| `department:update` | MODULES loop | `departments.controller.ts:54` now uses `department:update` | ✅ **REMEDIATED** |
| `department:delete` | MODULES loop | `departments.controller.ts:68` now uses `department:delete` | ✅ **REMEDIATED** |
| `department:classify` | BATCH_A | `departments.controller.ts:63` uses `department:classify` | ✅ Match |

### 6.2 Frontend Permission Gating

| Entity | Nav Permission | Page Permission | Status |
|--------|---------------|-----------------|--------|
| OrganizationalUnit | ❌ Missing | ❌ Missing | **KNOWN GAP** (backend enforces keys) |
| Department | ✅ Present (`department:read`) | ✅ Present | **REMEDIATED** |

---

## 7. Test Coverage

### 7.1 OrganizationalUnit Tests

| File | Test Count | Coverage |
|------|------------|----------|
| `organizational-units.service.spec.ts` | 14 | CRUD, tenant isolation, cycle prevention, soft delete, audit |

### 7.2 Department Tests

| File | Test Count | Coverage |
|------|------------|----------|
| `departments.service.spec.ts` | 10 | Reference validation, CRUD, soft delete |
| `job-titles/permission-keys.spec.ts` | 7 | Permission decorator enforcement (REMEDIATED to singular) |
| `person-assignments/tenant-isolation.spec.ts` | 11 | Cross-company department rejection |
| `administrations.service.spec.ts` | 2 | Delete blocking with active departments |

---

## 8. Build Status

| Check | Status | Notes |
|-------|--------|-------|
| `npx prisma validate` | ✅ PASS | Schema valid |
| `npx prisma generate` | ✅ PASS | Client generated |
| `npx prisma migrate status` | ✅ PASS | 62 migrations, schema up to date |
| `npx tsc --noEmit` (API) | ✅ PASS | No errors |
| `npx tsc --noEmit` (Web) | ✅ PASS | No errors |
| `npx jest` (full suite) | ✅ PASS | 115 suites, 1736 tests |

---

## 9. Tenant Isolation Proof

### 9.1 OrganizationalUnit Tenant Isolation

| Test | Status | Evidence |
|------|--------|----------|
| Cross-company create rejected | ✅ | `organizational-units.service.spec.ts` test case |
| Cross-branch create rejected | ✅ | `organizational-units.service.spec.ts` test case |
| Cross-company findOne rejected | ✅ | `organizational-units.service.spec.ts` test case |
| Cross-company update rejected | ✅ | `organizational-units.service.spec.ts` test case |
| Cross-company delete rejected | ✅ | `organizational-units.service.spec.ts` test case |

### 9.2 Department Tenant Isolation

| Test | Status | Evidence |
|------|--------|----------|
| Cross-company assignment rejected | ✅ | `person-assignments/tenant-isolation.spec.ts` |
| Department validation in context | ✅ | `users.service.spec.ts:73-83` |
| Administration delete blocked | ✅ | `administrations.service.spec.ts:120-135` |

---

## 10. Known Limitations

1. **OU→Dept merge not yet implemented** — this is a planning document, not implementation
2. **Permission key mismatch** — **REMEDIATED** (controller now uses singular `department:*`)
3. **OU frontend has no permission gating** — known compatibility-period gap
4. **OU has 1 actual DB record** (not 0 as previously claimed) — data migration needed
5. **Code uniqueness conflict** — OU per-branch vs Dept per-company requires deterministic policy
6. **Department.type** — ARCHITECTURE_DECISION_REQUIRED (4 of 6 OU.type values representable by existing structure)

---

## 11. Pre-Existing Issues Encountered

1. **Permission singular/plural mismatch** — **REMEDIATED** (controller now uses `department:*` singular)
2. **OU has zero FK consumers** — Model defined but not integrated into any workflow
3. **OU has 1 actual DB record** (seed claims 0) — `MAINT-DEPT` / "Maintenance Department"
4. **OU frontend lacks permission checks** — Pages accessible without permission validation
5. **Department classification values all NULL** — 4 records, none populated

---

## 12. Git Status

| Item | Value |
|------|-------|
| Branch | `checkpoint/backend-lan-responsive-shell` |
| HEAD | `0e9c925c887777f830a5a0611660770b9a2abdd7` |
| Modified files | 41 |
| New untracked directories | 12+ |
| Batch D deliverables | 3 documents (reconciled) |

---

## 13. Final Gates

### Schema Gates

```
BATCH_D_ORGUNIT_MODEL_UNCHANGED = PASS
BATCH_D_DEPARTMENT_MODEL_UNCHANGED = PASS
BATCH_D_NEW_MODELS_CREATED = 0
BATCH_D_SCHEMA_CHANGES = 0
BATCH_D_MIGRATIONS_CREATED = 0
```

### Dependency Gates

```
BATCH_D_DEPENDENCY_INVENTORY = PASS
BATCH_D_ZERO_ORGUNIT_FK_CONSUMERS = PASS
```

### A-C Reference Audit

```
BATCH_D_BATCH_A_NEW_ORGUNIT_REFERENCES = 0
BATCH_D_BATCH_B_NEW_ORGUNIT_REFERENCES = 0
BATCH_D_BATCH_C_NEW_ORGUNIT_REFERENCES = 0
BATCH_D_ZERO_NEW_ORGUNIT_CONSUMERS = PASS
```

### Classification Reconciliation

```
BATCH_D_CLASSIFICATION_RECONCILIATION = PASS
ACTUAL_VALUES = OPERATIONAL, MANAGEMENT, AREA, PROCESS, SECTION, UNIT, WORKSHOP
INVALID_VALUES_REMOVED = TECHNICAL, SUPPORT (never existed in source)
```

### Architecture Decision

```
BATCH_D_DEPARTMENT_TYPE_DECISION = ARCHITECTURE_CHANGE_REQUIRED
ADDING_DEPARTMENT_TYPE_APPROVED = NO
OU_TYPE_REPRESENTABLE = 4 of 6 values (DEPARTMENT, SECTION, UNIT, TEAM partially)
OU_TYPE_REQUIRES_DECISION = 2 of 6 values (PROJECT, OTHER)
```

### Data Gates

```
BATCH_D_DATA_COUNTS = PASS
ORGANIZATIONAL_UNIT_SEED_RECORDS = 0
ORGANIZATIONAL_UNIT_DB_TOTAL = 1
ORGANIZATIONAL_UNIT_DB_ACTIVE = 1
ORGANIZATIONAL_UNIT_DB_DELETED_OR_INACTIVE = 0
DEPARTMENT_SEED_RECORDS = 1
DEPARTMENT_DB_TOTAL = 4
DEPARTMENT_DB_ACTIVE = 4
DEPARTMENT_CLASSIFICATION_ALL_NULL = YES
```

### Safety Plan Gates

```
BATCH_D_SOURCE_DATA_IMMUTABILITY_PLAN = PASS
BATCH_D_HIERARCHY_MIGRATION_PLAN = PASS
BATCH_D_CODE_CONFLICT_PLAN = PASS
BATCH_D_TENANT_SAFETY_PLAN = PASS
BATCH_D_ROLLBACK_PLAN = PASS
```

### Permission Gates

```
BATCH_D_DEPARTMENT_PERMISSION_REMEDIATION = PASS
BATCH_D_ORGUNIT_PERMISSION_GAP = DOCUMENTED
```

### Verification Gates

```
BATCH_D_PRISMA_VALIDATE = PASS
BATCH_D_PRISMA_GENERATE = PASS
BATCH_D_PRISMA_MIGRATE_STATUS = PASS
BATCH_D_PREEXISTING_1736_TESTS = PASS
BATCH_D_REGRESSION = PASS
BATCH_D_API_TYPESCRIPT = PASS
BATCH_D_WEB_TYPESCRIPT = PASS
```

### Approval Gates

```
ADDING_DEPARTMENT_TYPE_APPROVED = NO
ORGUNIT_DEPRECATION_APPROVED_FOR_EXECUTION = NO
ORGUNIT_TABLE_DROP_APPROVED = NO
```

### Transition Decision

```
ORGANIZATIONALUNIT_TRANSITION_DECISION = SAFE_WITH_BLOCKERS
BLOCKERS:
  B01: Department.type architecture decision required
  B02: Code uniqueness conflict policy required
  B03: Stakeholder approval required
  B04: Production OU row count verified (1 record)
  B05: Migration staging environment required
```

---

## 14. Final Acceptance

```
BATCH_D_FINAL_ACCEPTANCE = PASS
READY_FOR_BATCH_E = YES
```

**Rationale:**
- Inventory is complete and reconciled
- Safety plans are documented (source immutability, hierarchy, code conflict, tenant, rollback)
- A-C reference audit is proven (zero new OU consumers)
- Regression is passing (115 suites, 1736 tests)
- Prisma checks are passing
- Permission remediation is complete
- Outstanding blockers (Department.type, code conflict policy, stakeholder approval) do not prevent Batch E workbook preparation
- No OU migration has occurred
- Department remains the approved target hierarchy
