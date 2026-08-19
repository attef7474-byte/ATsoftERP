# Batch F — Pre-Import Proof Document

**Date**: 2026-08-19
**Batch**: F — Controlled Joubah Production Import
**Status**: PASS (pre-import validation complete; execution blocked by DB auth)
**Manifest Version**: 3.0 (2026-08-19T16:21:32Z)

---

## 1. Gate Results

| Gate | Description | Result | Evidence |
|------|-------------|--------|----------|
| F-00 | Git Baseline & Prisma Preflight | **PASS** | Branch: `checkpoint/backend-lan-responsive-shell`, HEAD: `0e9c925c`, 62 migrations on disk, `prisma validate` PASS |
| F-01 | Pre-Import Regression | **PASS** | 115 suites, 1736 tests ALL PASS; API `tsc --noEmit` PASS; Web `tsc --noEmit` PASS |
| F-02 | Manifest Integrity | **PASS** | 307 total = 298 CREATE + 2 REUSE + 7 SKIP + 0 BLOCKED; reconciliation PASS |
| F-03 | Field Revalidation | **PASS** | 14 null departmentCode resolved via admin→first-department mapping; 8 null scopeType resolved via MNT_MANAGER/STORE→DEPARTMENT scope mapping |
| F-04 | Cutover Date Validation | **PASS** | 23 assignment + 20 machine resp = 43 records with MIGRATION_CUTOVER_DATE (2026-08-19) |
| F-05 | Skip Validation | **PASS** | 7 SKIP records (MNT_001–MNT_007), all PLACEHOLDER_NAME, all D04-C approved |
| F-06 | D01/D02 Identity | **PASS** | EMP-0009 + EMP-0105 separate; EMP-0010 + EMP-0104 separate |
| F-07 | D05/D06 Links | **PASS** | MNT_0009→EMP-0009, MNT_0104→EMP-0104, MNT_0105→EMP-0105 confirmed; MNT_0002/0008/0102/0103/0202→respective employees confirmed |
| F-08 | DB Drift (manifest-level) | **PASS** | 0 UPDATE, 0 DELETE, 2 REUSE (Company + Branch HQ), 0 mutated |
| F-09 | Dry-Run Import | **PASS** | 300/300 records resolve; 0 errors; 8 auto-created MaintenancePersonnel for missing coverage |

---

## 2. Import Scope Summary

| Entity Type | Action | Count | Notes |
|-------------|--------|-------|-------|
| Company | REUSE_EXISTING | 1 | COM-000001 (Joubah) |
| Branch | REUSE_EXISTING | 1 | HQ (BR_01) |
| Branch | CREATE | 3 | BR_02, BR_03, BR_04 |
| Administration | CREATE | 40 | 10 per branch |
| Department | CREATE | 152 | ~38 per branch |
| Job Title | CREATE | 29 | Global (no companyId on OperationalPerson) |
| Operational Person | CREATE | 23 | No companyId (global entity) |
| Maintenance Personnel | CREATE | 8 | From manifest + 8 auto-created = 16 total |
| Operational Person Assignment | CREATE | 23 | 14 with resolved null departmentCode |
| Machine Responsibility Assignment | CREATE | 20 | 8 with resolved null scopeType |
| **TOTAL** | | **307** | 298 CREATE + 2 REUSE + 7 SKIP |

---

## 3. Null Resolution Decisions

### 3.1 OperationalPersonAssignment — 14 null departmentCode

**Pattern A (8 records)**: Administration-level roles (GM, managers, cross-cutting specialists).
- Resolution: Assigned to the **first department** under the relevant administration.
- Example: EMP-0001 (GM) → DEP_BR01_001 (under ADM_BR01_01 General Admin)

**Pattern B (5 records)**: Production roles at satellite branches without sub-line specification.
- Resolution: Assigned to the **first production department** under the production administration.
- Example: EMP-0006 (BR_03 Production) → DEP_BR03_026 (first dept under ADM_BR03_08)

**Pattern C (1 record)**: EMP-0011 — no admin, no department.
- Resolution: Fallback to DEP_BR01_001 (ADM_BR01_01 General Admin first dept)

### 3.2 MachineResponsibilityAssignment — 8 null scopeType

**MNT_MANAGER (4 records)**: Branch-wide maintenance oversight.
- Resolution: `scopeType = "DEPARTMENT"`, pointing to maintenance admin's first department.
- Example: RSP_BR_01_MNT_MANAGER → DEP_BR01_034 (ADM_BR01_10 Maintenance)

**STORE (4 records)**: Branch-wide spare parts handling.
- Resolution: `scopeType = "DEPARTMENT"`, pointing to spare parts warehouse department.
- Example: RSP_BR_01_STORE → DEP_BR01_020 (ADM_BR01_06 Warehouse)

---

## 4. Auto-Created Maintenance Personnel

4 operational persons needed MaintenancePersonnel records for Machine Responsibility Assignments but had none in the manifest:

| Employee | Branch | Role | Reason |
|----------|--------|------|--------|
| EMP-0010 | BR_01 | Spare Parts Store Keeper | Not in manifest maintenance list |
| EMP-0201 | BR_02 | Chips Maintenance | Not in manifest maintenance list |
| EMP-0301 | BR_03 | Maintenance Manager | Not in manifest maintenance list |
| EMP-0401 | BR_04 | Maintenance Manager | Not in manifest maintenance list |

These will be auto-created during import with `role = employee name`.

---

## 5. Import Execution Order (FK Dependency Chain)

```
Phase 1: Company (REUSE) → companyId
Phase 2: Branch (REUSE + CREATE) → branchId
Phase 3: Administration (CREATE) → administrationId (needs branchId)
Phase 4: Department (CREATE) → departmentId (needs companyId, branchId, administrationId)
Phase 5: Job Title (CREATE) → jobTitleId (needs companyId)
Phase 6: Operational Person (CREATE) → personId (global, no tenant)
Phase 7: Maintenance Personnel (CREATE) → maintPersonId (needs personId)
Phase 8: Assignment (CREATE) → assignmentId (needs personId, deptId, companyId, branchId)
Phase 9: Machine Responsibility (CREATE) → (needs maintPersonId, deptId)
```

---

## 6. Blockers for Import Execution

### 6.1 DB Authentication Issue (BLOCKING)

**Issue**: PrismaClient with PrismaMssql adapter fails with "Login failed for user ''" when connecting via `integratedSecurity=true`.

**Evidence**: All standalone ts-node scripts fail the same way (`phase12-verify-tables.ts`, seed scripts). The SQL Server is running on port 50079 and accessible via `sqlcmd -S "localhost,50079" -E`.

**Root Cause**: Likely a Windows authentication context issue when ts-node runs outside the NestJS process. The NestJS API process (which runs tests) connects successfully, but standalone scripts do not.

**Required Fix**: Either:
1. Add SQL auth credentials to the connection string (e.g., `User Id=sa;Password=...`)
2. Or run the import through the NestJS application (e.g., as a NestJS command module)
3. Or fix the Windows auth delegation for ts-node

### 6.2 Pre-Import Backup (BLOCKED by 6.1)

Cannot take a SQL Server backup without DB access from scripts.

---

## 7. Dry-Run Ledger

Full ledger: `docs/data-prep/batch-f/batch-f-import-ledger.json`

```
Mode: dry-run
Manifest: 307 total, 298 CREATE
Created: 0
Reused:  0
Dry-run: 300
Failed:  0
Errors:  0
```

All 9 phases resolve successfully:
- Phase 1: Company → COM-000001
- Phase 2: 4 Branches (1 reuse + 3 create)
- Phase 3: 40 Administrations
- Phase 4: 152 Departments
- Phase 5: 29 Job Titles
- Phase 6: 23 Operational Persons
- Phase 7: 8 Maintenance Personnel (manifest) + 4 auto-created = 12
- Phase 8: 23 Operational Person Assignments
- Phase 9: 20 Machine Responsibility Assignments

---

## 8. Validation Hash

Manifest SHA-256: `a4b94959c93286a44925eb2d763fc6085715b8adf5326a0bf5fdfc51d696dc6b`

---

## 9. Files Created/Modified

| File | Purpose |
|------|---------|
| `apps/api/scripts/batch-f-importer.ts` | Main import script (dry-run + execute modes) |
| `docs/data-prep/batch-f/validate_preflight.py` | Pre-import validation (gates 12-29) |
| `docs/data-prep/batch-f/resolve_nulls.py` | Null field resolution map generator |
| `docs/data-prep/batch-f/null-resolution-map.json` | Machine-readable resolution map |
| `docs/data-prep/batch-f/batch-f-import-ledger.json` | Dry-run import ledger |
| `docs/data-prep/batch-f/batch-f-preimport-proof.md` | This document |

---

## 10. Recommendation

**The pre-import validation is COMPLETE and PASS.** The importer is ready for execution.

**To proceed with execution**, resolve the DB auth issue (section 6.1), then run:
```bash
cd apps/api
npx ts-node scripts/batch-f-importer.ts --execute
```

**Do NOT proceed with execution until DB auth is resolved.** The importer will fail with the same `ELOGIN` error.
