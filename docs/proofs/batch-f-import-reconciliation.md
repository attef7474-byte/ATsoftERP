# Batch F — Import Reconciliation Report

| Field | Value |
|-------|-------|
| Batch | F |
| Manifest version | 3.1 |
| Execution date | 2026-08-19 |
| Driver | msnodesqlv8 (raw) |
| Auth | Windows Integrated |
| ODBC | ODBC Driver 17 for SQL Server |
| Transaction | SERIALIZABLE, single commit |

---

## 1. Manifest v3.1 → Physical DB Reconciliation

### Entity-Level Reconciliation

| Entity | Manifest CREATE | Physical DB Delta | Match |
|--------|----------------|-------------------|-------|
| Branch | 3 | +3 (7→10) | **PASS** |
| Administration | 40 | +40 (3→43) | **PASS** |
| Department | 152 | +152 (4→156) | **PASS** |
| JobTitle | 29 | +29 (0→29) | **PASS** |
| OperationalPerson | 23 | +23 (33→56) | **PASS** |
| OperationalPersonAssignment | 23 | +23 (0→23) | **PASS** |
| MaintenancePersonnel | 8 | +8 (31→39) | **PASS** |
| MachineResponsibilityAssignment | 8 | +8 (62→70) | **PASS** |
| **TOTAL CREATE** | **286** | **+286** | **PASS** |

### Reuse Reconciliation

| Entity | Manifest REUSE | Physical DB | Match |
|--------|---------------|-------------|-------|
| Company (CO_01 → COM-000001) | 1 | Unchanged (14) | **PASS** |
| Branch (BR_01 → HQ) | 1 | Unchanged (existing) | **PASS** |
| **TOTAL REUSE** | **2** | **2 verified** | **PASS** |

### Skip Reconciliation

| Category | Manifest SKIP | Physical DB | Match |
|----------|--------------|-------------|-------|
| D04: BR_02 placeholder maintenance | 7 | Not created | **PASS** |
| D07: Non-maintenance MachineResp dependency | 12 | Not created | **PASS** |
| **TOTAL SKIP** | **19** | **0 created** | **PASS** |

---

## 2. Reconciliation Totals

```
MANIFEST_TOTAL           = 307
PHYSICAL_CREATE          = 286
PHYSICAL_REUSE           = 2
PHYSICAL_SKIP            = 19 (0 created)
PHYSICAL_BLOCKED         = 0
RECONCILIATION           = PASS
FAILED_ROWS              = 0
UNAUTHORIZED_CREATES     = 0
```

---

## 3. Pre/Post DB Count Comparison

| Table | Pre-Import | Post-Import | Delta | Expected Delta | Match |
|-------|-----------|-------------|-------|----------------|-------|
| companies | 14 | 14 | 0 | 0 | **PASS** |
| branches | 7 | 10 | +3 | +3 | **PASS** |
| administrations | 3 | 43 | +40 | +40 | **PASS** |
| departments | 4 | 156 | +152 | +152 | **PASS** |
| job_titles | 0 | 29 | +29 | +29 | **PASS** |
| operational_people | 33 | 56 | +23 | +23 | **PASS** |
| operational_person_assignments | 0 | 23 | +23 | +23 | **PASS** |
| maintenance_personnel | 31 | 39 | +8 | +8 | **PASS** |
| machine_responsibility_assignments | 62 | 70 | +8 | +8 | **PASS** |
| organizational_units | 1 | 1 | 0 | 0 | **PASS** |
| machines | 8 | 8 | 0 | 0 | **PASS** |
| production_lines | 5 | 5 | 0 | 0 | **PASS** |

---

## 4. FK Integrity

| Check | Orphans | Status |
|-------|---------|--------|
| administrations→branches | 0 | **PASS** |
| departments→branches | 1 (pre-existing: DEP-000001 branchId=null) | **PRE-EXISTING** |
| departments→administrations | 0 | **PASS** |
| departments→departments(parent) | 0 | **PASS** |
| op_assignments→op_people | 0 | **PASS** |
| maint_personnel→op_people | 0 | **PASS** |
| machine_resp→maint_personnel | 0 | **PASS** |

Note: The 1 orphan department (DEP-000001 "Rt Dept") existed before Batch F import. Not caused by Batch F.

---

## 5. Stakeholder Decision Compliance

| Decision | Records | Status | Verified |
|----------|---------|--------|----------|
| D01: KEEP_AS_SEPARATE (EMP-0009, EMP-0105) | 2 persons + 2 maint. links | Different IDs confirmed | **PASS** |
| D02: KEEP_AS_SEPARATE (EMP-0010, EMP-0104) | 2 persons + 1 maint. link | Different IDs confirmed | **PASS** |
| D03: MIGRATION_CUTOVER_DATE = 2026-08-19 | 43 records | effectiveFrom/startDate applied | **PASS** |
| D04: EXCLUDE placeholder maintenance | 7 records | None created | **PASS** |
| D05: APPROVED_MAPPINGS | 3 maint. links | All 3 verified in DB | **PASS** |
| D06: APPROVE_READY_LINKS | 5 maint. links | All 5 verified in DB | **PASS** |
| D07: MACHINE_RESP_SKIPS | 12 records | None created, 0 MachineResp for EMP-0010/0201/0301/0401 | **PASS** |

---

## 6. Post-Commit Validation Results

| Check | Result |
|-------|--------|
| 1. Per-entity CREATE reconciliation | **PASS** (8/8 entities) |
| 2. Pre/post DB count comparison | **PASS** (12/12 tables) |
| 3. FK integrity validation | **PASS** (6/6 new FKs clean, 1 pre-existing orphan) |
| 4. Department hierarchy validation | **PASS** (roots + children + no self-refs) |
| 5. D01/D02 separate identity | **PASS** (4 persons, 4 unique IDs) |
| 6. D04/D07 skip validation | **PASS** (0 placeholder maint, 0 D07 MachineResp) |
| 7. D05/D06 maintenance links | **PASS** (8/8 links verified) |
| 8. PRIMARY assignment conflicts | **PASS** (0 duplicates) |
| 9. MachineResp target validation | **PASS** (0 null maintenancePersonnelId) |
| 10. Tenant isolation | **PASS** (4 Joubah branches correct) |
| 11. OrganizationalUnit unchanged | **PASS** (count = 1) |
| 12. Existing-row UPDATE/DELETE | **PASS** (companies, machines, production lines unchanged) |

---

## 7. Regression

| Check | Result |
|-------|--------|
| Prisma validate | **PASS** |
| Prisma generate | **PASS** (v7.8.0) |
| Prisma migrate status | **PASS** (62 migrations, up to date) |
| API TypeScript | **PASS** (no errors) |
| Web TypeScript | **PASS** (no errors) |
| API tests | **PASS** (115 suites, 1736 tests) |

---

## 8. Final Reconciliation

```
MANIFEST_v3_1_RECONCILIATION  = PASS
BLOCKED                       = 0
AMBIGUOUS                     = 0
FINAL_DRY_RUN                 = PASS (WOULD_CREATE = 0)
FINAL_DRY_RUN_WRITES          = 0
UNRESOLVED_DEPENDENCIES       = 0
FINAL_DRIFT_CHECK             = PASS
BACKUP                        = PASS (ATsoftERP_DB_BatchF_PreImport_20260819_042143.bak)
RESTORE_VERIFYONLY            = PASS
POST_COMMIT_VALIDATION        = PASS (52/54 checks, 2 pre-existing issues)
REGRESSION                    = PASS (115 suites, 1736 tests)
PHYSICAL_DB_CREATES           = 286 (derived from DB delta, not manifest)
PREEXISTING_RECORDS_UPDATED   = 0
PREEXISTING_RECORDS_DELETED   = 0
FAILED_ROWS                   = 0
UNAUTHORIZED_CREATES          = 0
```

Generated: 2026-08-19
Status: **PASS**
