# Batch E — Data-Prep & Import-Prep Decision Register

## Manifest v3.1 Counts (Final — Post Stakeholder Decisions)

| Bucket | Count |
|--------|-------|
| TOTAL_RECORDS | 307 |
| NEW_READY (CREATE) | 286 |
| REUSE_EXISTING | 2 |
| SKIPPED_WITH_STAKEHOLDER_APPROVAL | 19 |
| BLOCKED | 0 |
| AMBIGUOUS | 0 |
| MANUAL_DECISION | 0 |
| **BUCKET_SUM** | **307** |
| RECONCILIATION | PASS |

### Resolved Blockers (was 57, now 0)

| Former Blocker Code | Was | Now | Resolution |
|---------------------|-----|-----|------------|
| E007_PERSON_DUPLICATE_REVIEW | 4 | 0 | D01/D02: KEEP_AS_SEPARATE_PERSONS |
| E009_EFFECTIVE_FROM_MISSING | 23 | 0 | D03-B: MIGRATION_CUTOVER_DATE = 2026-08-19 |
| E009_START_DATE_MISSING | 20 | 0 | D03-B: MIGRATION_CUTOVER_DATE = 2026-08-19 |
| E011_MAINTENANCE_PERSON_PLACEHOLDER | 7 | 0 | D04-C: EXCLUDE_FROM_BATCH_F |
| E007_MAINTENANCE_PERSON_AMBIGUOUS | 3 | 0 | D05: APPROVED_MAPPINGS |
| **TOTAL** | **57** | **0** | |

---

## Auto-Approved Data Prep Decisions

| ID | Date | Decision | Status | Notes |
|----|------|----------|--------|-------|
| E-D001 | 2026-08-18 | Company CO_01 reuses existing DB record COM-000001 | APPROVED | Exact match |
| E-D002 | 2026-08-18 | Branch BR_01 reuses existing DB record HQ | APPROVED | Exact match |
| E-D003 | 2026-08-18 | Branches BR_02/BR_03/BR_04 to CREATE | APPROVED | New branches |
| E-D004 | 2026-08-18 | 40 administrations to CREATE (codes don't match DB) | APPROVED | No reuse |
| E-D005 | 2026-08-18 | 152 departments to CREATE (codes don't match DB) | APPROVED | No reuse |
| E-D006 | 2026-08-18 | 29 job titles to CREATE | APPROVED | No existing job titles |
| E-D007 | 2026-08-18 | Department classification: 128 OPERATIONAL, 8 PROCESS, 16 SECTION | APPROVED | Production hierarchy |
| E-D008 | 2026-08-18 | Supervisor hierarchy: no data to import | APPROVED | Sheet 39 empty |
| E-D009 | 2026-08-18 | No production import in Batch E | APPROVED | Data prep only |

## Manifest v2.0 Bug Corrections

| ID | Issue | Correction | Records Affected |
|----|-------|------------|-----------------|
| E-D010 | Generator read `link_status` (nonexistent) for MaintenancePersonnel | Corrected to read `mapping_status` | 15 |
| E-D011 | Generator read `dedup_status` (nonexistent) for OperationalPerson | Corrected to read `identity_review_status` | 23 |
| E-D012 | MachineResponsibilityAssignment field named `startDate` not `effectiveFrom` | Preserved correct field name in manifest | 20 |

---

## Stakeholder Decisions (APPROVED 2026-08-19)

| ID | Choice | Decision | Records Affected | Result |
|----|--------|----------|-----------------|--------|
| D01 | B | KEEP_AS_SEPARATE_PERSONS | EMP-0009, EMP-0105 (+ 2 maint. links) | All 4 persons become CREATE. 2 maint. links resolved in D05. |
| D02 | B | KEEP_AS_SEPARATE_PERSONS | EMP-0010, EMP-0104 (+ 1 maint. link) | All 4 persons become CREATE. 1 maint. link resolved in D05. |
| D03 | B | USE_APPROVED_MIGRATION_CUTOVER_DATE | 43 records (23 assignments + 20 machine resp.) | effectiveFrom/startDate = 2026-08-19. All 43 become CREATE. NOT actual employment start date. |
| D04 | C | EXCLUDE_FROM_BATCH_F | 7 BR_02 placeholder maintenance records | SKIPPED_WITH_STAKEHOLDER_APPROVAL. Classification: SKIPPED_WITH_STAKEHOLDER_APPROVAL. Reason: REAL_PERSON_DATA_NOT_AVAILABLE. |
| D05 | APPROVED | APPROVED_MAPPINGS | MNT_0009→EMP-0009, MNT_0104→EMP-0104, MNT_0105→EMP-0105 | All 3 become CREATE. Evidence: matching role/specialty, matching code pattern, matching scope. |
| D06 | A | APPROVE_READY_LINKS | MNT_0002→EMP-0002, MNT_0008→EMP-0008, MNT_0102→EMP-0102, MNT_0103→EMP-0103, MNT_0202→EMP-0202 | All 5 confirmed CREATE. |
| D07 | APPROVED | APPROVED_MACHINE_RESPONSIBILITY_DEPENDENCY_SKIPS | 12 MachineResponsibilityAssignment records (RSP_BR_01_STORE, RSP_BR_02_CH_MNT, all RSP_BR_03_*, all RSP_BR_04_*) | Reclassified from CREATE → SKIPPED_WITH_STAKEHOLDER_APPROVAL. Reason: SOURCE_DOES_NOT_PROVE_MAINTENANCE_PERSONNEL_DEPENDENCY. Narrow v3.1 reconciliation. |

---

## Final Entity-Level Breakdown

| Entity | Total | CREATE | REUSE | SKIP | BLOCKED |
|--------|-------|--------|-------|------|---------|
| Company | 1 | 0 | 1 | 0 | 0 |
| Branch | 4 | 3 | 1 | 0 | 0 |
| Administration | 40 | 40 | 0 | 0 | 0 |
| Department | 152 | 152 | 0 | 0 | 0 |
| JobTitle | 29 | 29 | 0 | 0 | 0 |
| OperationalPerson | 23 | 23 | 0 | 0 | 0 |
| OperationalPersonAssignment | 23 | 23 | 0 | 0 | 0 |
| SupervisorAssignment | 0 | 0 | 0 | 0 | 0 |
| MaintenancePersonnel | 15 | 8 | 0 | 7 | 0 |
| MachineResponsibilityAssignment | 20 | 8 | 0 | 12 | 0 |
| **Totals** | **307** | **286** | **2** | **19** | **0** |

---

## Stakeholder Sign-Off

```
STAKEHOLDER_SIGNOFF = APPROVED
Approved date: 2026-08-19
Approved migration cutover date: 2026-08-19
```
