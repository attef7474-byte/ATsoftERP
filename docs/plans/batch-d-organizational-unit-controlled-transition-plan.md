# Batch D — OrganizationalUnit Controlled Transition Plan

**Date:** 2026-08-18
**Branch:** `checkpoint/backend-lan-responsive-shell`
**Status:** RECONCILED

---

## Executive Summary

OrganizationalUnit and Department are both organizational hierarchy models, but they serve fundamentally different purposes. After full discovery analysis, **the recommended direction is to retire OrganizationalUnit and consolidate into Department**. OU is an orphan with zero downstream FK consumers, while Department is the operational backbone used by 9+ transactional models.

**However, this plan contains ARCHITECTURE_DECISION_REQUIRED items.** No migration is authorized until:
- Department.type architecture decision is resolved
- Code uniqueness conflict policy is approved
- Stakeholder approval exists
- Actual OU DB row count is known (currently: 1 record)

---

## 0. Actual Data Counts (Verified)

| Entity | Seed | Database Total | Active | Deleted/Inactive |
|--------|------|----------------|--------|------------------|
| OrganizationalUnit | 0 | **1** | **1** | **0** |
| Department | 1 | **4** | **4** | **0** |

**OU record:** `MAINT-DEPT` / "Maintenance Department" (type: DEPARTMENT, company: cmrl31uuy0000ok959hdjnca6)

---

## 1. Decision Matrix

| Criterion | Merge OU→Dept | Merge Dept→OU | Keep Separate |
|-----------|--------------|---------------|---------------|
| FK migration effort | **None** (OU has 0 FKs) | **9+ models** to migrate | None |
| Schema risk | **Low** (add fields to Dept) | **High** (add FKs to OU, move data) | None |
| Code risk | **Medium** (retire OU module) | **High** (rewrite all dept consumers) | **Low** (just fix permissions) |
| Data risk | **Low** (1 OU record to migrate) | **High** (move 4 dept records + FKs) | None |
| Semantic fit | **Good** (Dept is operational) | **Poor** (OU is generic tree) | Confusing (duplication) |
| **Recommendation** | **RECOMMENDED DIRECTION** | Not recommended | Not recommended |

---

## 2. Recommended Direction: Merge OU → Department

### 2.1 Rationale

1. **OrganizationalUnit has zero FK consumers** — retiring it requires no FK migration
2. **Department is the operational backbone** — 9+ models depend on it
3. **OU has 1 actual DB record** — minimal data migration
4. **OU's `branchId` is required** while Department's is optional — safe to keep Department's optional behavior
5. **Department has 4 actual DB records** — no conflict with OU's 1 record

### 2.2 ARCHITECTURE_DECISION_REQUIRED: Department.type

**Current proposal:** Add `type` field to Department with values `DEPARTMENT/SECTION/UNIT/TEAM/PROJECT/OTHER`

**Architecture v2 standardization:** Department uses `classification` (not `type`) for operational categorization.

### 2.3 OU.type → Department Mapping Analysis

| OU.type Value | Department Representation | Classification |
|---------------|--------------------------|----------------|
| `DEPARTMENT` | **REPRESENTABLE_BY_EXISTING_DEPARTMENT** — this IS a Department | Use `classification` for operational role |
| `SECTION` | **REPRESENTABLE_BY_EXISTING_DEPARTMENT** — Department.parentId hierarchy supports sections | Use `classification = SECTION` |
| `UNIT` | **REPRESENTABLE_BY_EXISTING_DEPARTMENT** — Department.parentId hierarchy supports units | Use `classification = UNIT` |
| `TEAM` | **REQUIRES_MAPPING_RULE** — no TEAM classification exists | Could add to classification enum, or use parentId hierarchy |
| `PROJECT` | **REQUIRES_NEW_FIELD** — projects are temporary, Departments are permanent | ARCHITECTURE_DECISION_REQUIRED |
| `OTHER` | **AMBIGUOUS** — catch-all with no clear Department equivalent | ARCHITECTURE_DECISION_REQUIRED |

**Assessment:** 4 of 6 OU.type values are representable by existing Department structure (parentId hierarchy + classification). Only `TEAM` and `PROJECT` require architecture decisions.

### 2.4 What Changes (Pending Architecture Decision)

| Change | Status | Dependency |
|--------|--------|------------|
| Add `type` field to Department model | **ARCHITECTURE_DECISION_REQUIRED** | Stakeholder approval |
| Migrate 1 OU record → Department | Planned | Architecture decision + conflict policy |
| Retire OrganizationalUnit module (backend) | Planned | Data migration complete |
| Retire OrganizationalUnit frontend | Planned | Backend retirement complete |
| Fix permission key singular/plural mismatch | **REMEDIATED** | None (done) |
| Add OU→Dept redirect routes | Planned | Module retirement |

---

## 3. Detailed Migration Plan

### Phase 0: Pre-Migration Requirements (BLOCKERS)

Before any migration can proceed:

- [ ] **B01:** Architecture decision on Department.type field
- [ ] **B02:** Code uniqueness conflict policy approved
- [ ] **B03:** Stakeholder approval for OU deprecation
- [ ] **B04:** Production OU row count verified
- [ ] **B05:** Migration staging environment available

### Phase 1: Schema Changes (Safe, Additive) — PENDING

#### Step 1.1: Add `type` field to Department (if approved)

```prisma
model Department {
  // ... existing fields ...
  type String @default("DEPARTMENT")  // NEW: only if ARCHITECTURE_DECISION_REQUIRED is resolved
  // ... rest ...
}
```

**Migration SQL:**
```sql
ALTER TABLE [departments] ADD [type] NVARCHAR(1000) NOT NULL DEFAULT 'DEPARTMENT';
CREATE INDEX [departments_type_idx] ON [departments]([type]);
```

### Phase 2: Data Migration — PENDING

#### Source Data Mapping Structure

```
oldOrganizationalUnitId | sourceCompanyId | sourceBranchId | sourceCode | sourceName | targetDepartmentId | targetCode | confidence | mappingReason
```

#### Step 2.1: Load OU rows read-only

```sql
SELECT id, companyId, branchId, code, name, type, status, parentId
FROM organizational_units
WHERE deletedAt IS NULL;
```

#### Step 2.2: Validate no cycles in OU hierarchy

```sql
-- Recursive CTE to detect cycles
WITH hierarchy AS (
  SELECT id, parentId, 0 AS depth
  FROM organizational_units
  WHERE deletedAt IS NULL AND parentId IS NULL
  UNION ALL
  SELECT ou.id, ou.parentId, h.depth + 1
  FROM organizational_units ou
  JOIN hierarchy h ON ou.parentId = h.id
  WHERE ou.deletedAt IS NULL
)
SELECT id, MAX(depth) AS maxDepth
FROM hierarchy
GROUP BY id
HAVING MAX(depth) > 100;  -- unreasonable depth = cycle
```

#### Step 2.3: Topologically order roots → children

```sql
-- Order: roots first (parentId IS NULL), then children by depth
WITH ordered AS (
  SELECT id, parentId, code, name, type,
    CASE WHEN parentId IS NULL THEN 0 ELSE 1 END AS sort_order
  FROM organizational_units
  WHERE deletedAt IS NULL
)
SELECT * FROM ordered ORDER BY sort_order, code;
```

#### Step 2.4: Create target Departments (read-only mapping, no source mutation)

For each OU row:
1. Check if matching Department exists (by code within company)
2. If exists: map to existing Department (confidence: EXACT_EXISTING_DEPARTMENT_MATCH)
3. If not exists: plan new Department creation (confidence: NEW_DEPARTMENT_REQUIRED)
4. If code conflict: plan code rename (confidence: TARGET_CODE_RENAME_REQUIRED)

**NO source OU rows are modified.** All transformations are on target side only.

#### Step 2.5: Verify parent/child counts

```sql
-- Source OU parent/child counts
SELECT parentId, COUNT(*) AS child_count
FROM organizational_units
WHERE deletedAt IS NULL
GROUP BY parentId;

-- Target Department parent/child counts (after migration)
SELECT parentId, COUNT(*) AS child_count
FROM departments
WHERE deletedAt IS NULL AND type = 'DEPARTMENT'  -- or whatever filter
GROUP BY parentId;
```

#### Step 2.6: Verify tenant boundaries

```sql
-- Ensure no cross-company hierarchy
SELECT ou.id, ou.companyId, parent.companyId AS parent_company_id
FROM organizational_units ou
JOIN organizational_units parent ON ou.parentId = parent.id
WHERE ou.companyId != parent.companyId;
```

#### Step 2.7: Compare source vs target hierarchy

```sql
-- Final comparison: source OU count vs target Department count (new records only)
SELECT
  (SELECT COUNT(*) FROM organizational_units WHERE deletedAt IS NULL) AS source_ou_count,
  (SELECT COUNT(*) FROM departments WHERE deletedAt IS NULL AND type = 'DEPARTMENT') AS target_dept_count;
```

### Phase 3: Backend Code Changes — PENDING

#### Step 3.1: Update Department DTO (if type field approved)

```typescript
// create-department.dto.ts
export class CreateDepartmentDto {
  // ... existing fields ...
  @IsOptional()
  @IsIn(['DEPARTMENT', 'SECTION', 'UNIT', 'TEAM', 'PROJECT', 'OTHER'])
  @ApiProperty({ default: 'DEPARTMENT' })
  type?: string;
}
```

#### Step 3.2: Retire OrganizationalUnit Module

- Remove `organizational-units/` directory
- Remove from `app.module.ts` imports
- Remove from seed MODULES array
- Remove numbering sequence `ORGANIZATIONAL_UNIT`
- Add redirect: `GET /v1/organizational-units` → `GET /v1/departments?type=...` (temporary)

### Phase 4: Frontend Code Changes — PENDING

#### Step 4.1: Retire OrganizationalUnit Frontend

- Remove `organizational-units/` pages
- Remove from navigation
- Remove F9 adapter
- Remove type definitions
- Remove translations
- Add redirect from OU routes to Department routes

### Phase 5: Test Updates — PENDING

#### Step 5.1: Remove OrganizationalUnit Tests

- Remove `organizational-units.service.spec.ts`

---

## 4. Code Uniqueness Conflict Policy

### 4.1 Semantic Difference

| Table | Uniqueness | Scope |
|-------|-----------|-------|
| `organizational_units` | `[branchId, code]` | Per-branch |
| `departments` | `[companyId, code]` | Per-company |

### 4.2 Conflict Detection

```sql
-- Find OUs whose code conflicts with existing Departments in same company
SELECT ou.id, ou.companyId, ou.branchId, ou.code, d.id AS existing_dept_id
FROM organizational_units ou
JOIN departments d ON ou.companyId = d.companyId AND ou.code = d.code
WHERE ou.deletedAt IS NULL AND d.deletedAt IS NULL;
```

### 4.3 Deterministic Conflict Policy

| Scenario | Policy | Action |
|----------|--------|--------|
| NO_CONFLICT | OU code unique within company | Create new Department with same code |
| EXACT_EXISTING_DEPARTMENT_MATCH | OU.code matches existing Dept.code AND same company | Map OU to existing Department |
| AMBIGUOUS_DUPLICATE | Multiple OUs in same company have same code | **BLOCKED** — requires manual resolution |
| TARGET_CODE_RENAME_REQUIRED | OU.code conflicts with existing Dept.code | Plan auditable rename with reason |

### 4.4 Rename Rules

- Never silently rename source data
- Any rename must be planned and auditable
- Rename format: `{original_code}_{branch_suffix}` (e.g., `MAINT-DEPT_HQ`)
- Log all renames in migration audit table

---

## 5. Hierarchy Migration Safety

### 5.1 Process

1. Load all OU rows read-only
2. Validate no cycles (recursive CTE)
3. Topologically order roots → children
4. Map/create root Departments (parentId = NULL)
5. Map/create child Departments using mapped parentDepartmentId
6. Verify parent/child counts match
7. Verify tenant boundaries (no cross-company hierarchy)
8. Verify hierarchy depth (max reasonable depth: 10 levels)
9. Compare source vs target hierarchy structure

### 5.2 Self-FK Ordering

OU uses self-referential `parentId`. A single INSERT of all rows will NOT satisfy self-FK ordering. Must:
1. Insert roots first (parentId IS NULL)
2. Insert children with mapped parentDepartmentId
3. Verify no orphaned records

---

## 6. Rollback Plan

### If schema migration fails:
```sql
-- Rollback: remove type field
DROP INDEX [departments_type_idx];
ALTER TABLE [departments] DROP COLUMN [type];
```

### If code migration fails:
- Revert git changes
- OU module is still functional (independent)

### If data migration fails:
- OU table is preserved until Phase 6
- Can re-run data migration after fixing issues

---

## 7. Compatibility Period

### During transition (Phases 1-5):
- Both OU and Department endpoints remain active
- OU endpoints return data from Department (with type filter)
- Frontend redirects OU routes to Department routes
- No breaking changes

### After transition (Phase 6):
- OU module fully removed
- OU table dropped (separate migration, after verification period)
- All references point to Department

---

## 8. Future Migration: OrganizationalUnit Table Drop

After compatibility period (recommend 2-4 weeks):

```sql
-- Phase 6: Drop OU table (separate migration, after full verification)
DROP TABLE [organizational_units];
```

**Prerequisites:**
- All OU data migrated to Department
- All code references updated
- All tests passing
- Production verification complete
- Stakeholder approval for table drop

---

## 9. Risk Register

| # | Risk | Probability | Impact | Mitigation |
|---|------|-------------|--------|------------|
| R1 | OU code conflicts with Dept code during merge | Medium | Medium | Deterministic conflict policy with auditable renames |
| R2 | Permission key mismatch causes auth failures | **REMEDIATED** | None | Controller now uses singular `department:*` |
| R3 | Frontend OU routes break during transition | Low | Medium | Temporary redirect rules |
| R4 | Department `type` field not backward compatible | Low | Low | Default value ensures existing records unaffected |
| R5 | OU table has unexpected data | Low | Medium | Read-only mapping with verification queries |
| R6 | Search indexing breaks | Low | Medium | Update search.service.ts department definition |
| R7 | OU hierarchy has cycles | Low | High | Cycle detection via recursive CTE before migration |
| R8 | Cross-company hierarchy violation | Low | High | Tenant boundary verification query |

---

## 10. Timeline

| Phase | Effort | Dependencies | Status |
|-------|--------|-------------|--------|
| Phase 0: Pre-Migration Requirements | — | Stakeholder approval | **BLOCKED** |
| Phase 1: Schema Changes | 1 hour | Phase 0 | PENDING |
| Phase 2: Data Migration | 2 hours | Phase 1 | PENDING |
| Phase 3: Backend Changes | 3 hours | Phase 1 | PENDING |
| Phase 4: Frontend Changes | 3 hours | Phase 3 | PENDING |
| Phase 5: Test Updates | 2 hours | Phase 3 | PENDING |
| Phase 6: Table Drop (future) | 1 hour | Verification period | PENDING |
| **Total** | **~12 hours** | | |

---

## 11. Success Criteria

- [ ] Department model has `type` field (if approved)
- [ ] All existing Department FKs still work
- [ ] All OU data migrated to Department (1 record)
- [ ] OU module retired (backend + frontend)
- [ ] Permission keys consistent (singular form)
- [ ] All tests passing (1736 baseline preserved)
- [ ] No breaking API changes during transition
- [ ] Search indexing works for Department with type
- [ ] Arabic/English translations updated
- [ ] RTL/LTR rendering verified
- [ ] Hierarchy migration verified (parent/child counts match)
- [ ] Tenant boundaries verified (no cross-company hierarchy)
- [ ] Code uniqueness conflicts resolved (auditable)
