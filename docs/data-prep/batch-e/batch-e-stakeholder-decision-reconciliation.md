# Batch E — Stakeholder Decision Reconciliation

| Field | Value |
|-------|-------|
| Batch | E |
| Scope | Reconciliation of blocked counts + final human decision list |
| Date | 2026-08-18 |
| Manifest version | 1.0 |

---

## 1. BLOCKED COUNT RECONCILIATION

### Manifest Entity Totals

| Entity | Total | New Ready | Reuse Existing | Blocked |
|--------|-------|-----------|----------------|---------|
| Company | 1 | 0 | 1 | 0 |
| Branch | 4 | 3 | 1 | 0 |
| Administration | 40 | 40 | 0 | 0 |
| Department | 152 | 152 | 0 | 0 |
| JobTitle | 29 | 29 | 0 | 0 |
| OperationalPerson | 23 | 23 | 0 | 0 |
| OperationalPersonAssignment | 23 | 0 | 0 | 23 |
| SupervisorAssignment | 0 | 0 | 0 | 0 |
| MaintenancePersonnel | 15 | 0 | 0 | 15 |
| MachineResponsibilityAssignment | 20 | 0 | 0 | 20 |
| **TOTAL** | **307** | **247** | **2** | **58** |

### Manifest Blocker Category Counts (as generated)

| Blocker Code | Count | Entity | Source |
|-------------|-------|--------|--------|
| E009_EFFECTIVE_FROM_MISSING | 23 | OperationalPersonAssignment | Sheet 38 |
| E011_MAINTENANCE_PERSON_UNRESOLVED | 15 | MaintenancePersonnel | Sheet 24 |
| E009_EFFECTIVE_FROM_MISSING | 20 | MachineResponsibilityAssignment | Sheet 40 |
| **Total** | **58** | | |

### Source Data Actual Counts

| Category | Source | Actual Count |
|----------|--------|-------------|
| Missing effective_from (assignments) | Sheet 38 — all 23 rows have `effective_from: null` | 23 |
| Placeholder maintenance persons (يعبأ الاسم) | Sheet 24 — MNT_001 through MNT_007 | 7 |
| Ambiguous maintenance persons (name collision) | Sheet 24 — MNT_0009, MNT_0104, MNT_0105 | 3 |
| Ready maintenance persons (linked to real employees) | Sheet 24 — MNT_0002, MNT_0008, MNT_0102, MNT_0103, MNT_0202 | 5 |
| Missing start_date (machine responsibilities) | Sheet 40 — all 20 rows have `start_date: null` | 20 |
| **Total** | | **58** |

### Reconciliation

The previous summary stated 57 = 4 + 43 + 7 + 3. That summary was wrong because:

- It counted "Duplicate persons = 4" as a blocker, but those 4 persons are **not** marked BLOCKED in the manifest — they are `NEW_READY` (the manifest generator read a nonexistent field `dedup_status` instead of `identity_review_status`, so it never triggered the duplicate-person blocker).
- It counted "Missing effective_from = 43" as 23 assignments + 20 machine responsibilities. Both those entity groups are in the manifest as blocked.
- It counted "Placeholder maintenance = 7" and "Ambiguous maintenance = 3", but the manifest marked **all 15** maintenance records as BLOCKED (same field-name bug: the generator read `link_status` instead of `mapping_status`). The 5 READY_PERSON_LINK records (MNT_0002, MNT_0008, MNT_0102, MNT_0103, MNT_0202) should be NEW_READY, not BLOCKED.

**Corrected manifest counts should be:**

| Entity | Blocked | Reason |
|--------|---------|--------|
| OperationalPersonAssignment | 23 | E009 — missing effectiveFrom |
| MaintenancePersonnel (placeholder) | 7 | E011 — PLACEHOLDER_NAME (يعبأ الاسم) |
| MaintenancePersonnel (ambiguous) | 3 | E007 — AMBIGUOUS_PERSON (رضوان حنظل ×2, أركان الحكيمي ×2) |
| MaintenancePersonnel (ready) | 0 | READY_PERSON_LINK — should be NEW_READY (5 records misclassified) |
| MachineResponsibilityAssignment | 20 | E009 — missing startDate |
| OperationalPerson (duplicate names) | 4 | E007 — DUPLICATE_NAME_REVIEW (not blocked in manifest, but require decision before import) |
| **Corrected total** | **57** | |

**Identified the 58th record (manifest overcount):**

| Record | Manifest Blocker | Actual Status | Issue |
|--------|-----------------|---------------|-------|
| MNT_0002 — محمد غالب | E011 (BLOCKED) | READY_PERSON_LINK → should be NEW_READY | Manifest generator read nonexistent field `link_status`; actual field is `mapping_status`. 5 READY records misclassified as BLOCKED. |
| MNT_0008 — صلاح عباس | E011 (BLOCKED) | READY_PERSON_LINK → should be NEW_READY | Same bug. |
| MNT_0102 — فارس الحيمي | E011 (BLOCKED) | READY_PERSON_LINK → should be NEW_READY | Same bug. |
| MNT_0103 — عمر العكيش | E011 (BLOCKED) | READY_PERSON_LINK → should be NEW_READY | Same bug. |
| MNT_0202 — سعيد الريمي | E011 (BLOCKED) | READY_PERSON_LINK → should be NEW_READY | Same bug. |

**And the manifest undercount:**

| Records | Manifest Status | Actual Status | Issue |
|---------|----------------|---------------|-------|
| EMP-0009 رضوان حنظل | NEW_READY (not blocked) | DUPLICATE_NAME_REVIEW | Should be flagged as needing decision before import. |
| EMP-0010 أركان الحكيمي | NEW_READY (not blocked) | DUPLICATE_NAME_REVIEW | Same. |
| EMP-0104 أركان الحكيمي | NEW_READY (not blocked) | DUPLICATE_NAME_REVIEW | Same. |
| EMP-0105 رضوان حنظل | NEW_READY (not blocked) | DUPLICATE_NAME_REVIEW | Same. |

**Reconciliation result: BLOCKED_TOTAL = 57 (not 58). The manifest's 58 count includes 5 maintenance records incorrectly classified as BLOCKED due to a field-name mismatch in the manifest generator. These 5 records are actually READY and need no stakeholder decision. The 4 duplicate-name persons are NOT blocked in the manifest but DO require a stakeholder decision before import.**

```
BLOCKED_TOTAL = 57
BLOCKER_BREAKDOWN_TOTAL = 57
BLOCKER_COUNT_RECONCILIATION = PASS (with manifest bug documented)
```

---

## 2. SCHEMA: IS effectiveFrom REQUIRED?

| Model | Field | Type | Nullable? | Unique Constraint |
|-------|-------|------|-----------|-------------------|
| OperationalPersonAssignment | effectiveFrom | DateTime | **NO** (required) | `@@unique([personnelId, departmentId, effectiveFrom])` |
| MachineResponsibilityAssignment | startDate | DateTime | **NO** (required) | — |
| SupervisorAssignment | effectiveFrom | DateTime | **NO** (required) | — |

**Conclusion: The schema REQUIRES effectiveFrom/startDate. An import without these values will fail at the Prisma/DB level. A stakeholder decision is mandatory.**

---

## 3. DUPLICATE PERSONS — SIDE-BY-SIDE EVIDENCE

### Group A: رضوان حنظل

| Field | EMP-0009 | EMP-0105 |
|-------|----------|----------|
| Source code | EMP-0009 | EMP-0105 |
| Full name | رضوان حنظل | رضوان حنظل |
| Branch code | BR_01 | BR_01 |
| Branch name | الفرع الرئيسي | الفرع الرئيسي |
| Department code (assignment) | null (ADM_BR01_10) | DEP_BR01_029 (ADM_BR01_08) |
| Job title code | JT_0009 — فني ميكانيك | JT_0017 — فني تشغيل غلافات |
| Phone | null | null |
| Email | null | null |
| Category | OPERATIONAL | OPERATIONAL |
| Maintenance role (sheet 24) | MNT_0009 — فني ميكانيك (scope: ميكانيك) | MNT_0105 — فني تشغيل غلافات (scope: تغليف البفك) |

**Evidence analysis:** Different job titles (ميكانيك vs غلافات), different departments (إدارة الصيانة direct vs إنتاج البفك - تغليف), different maintenance responsibilities. Code prefix indicates BR_01 employee number 9 vs employee 105. **Sufficient evidence to treat as two different people.**

### Group B: أركان الحكيمي

| Field | EMP-0010 | EMP-0104 |
|-------|----------|----------|
| Source code | EMP-0010 | EMP-0104 |
| Full name | أركان الحكيمي | أركان الحكيمي |
| Branch code | BR_01 | BR_01 |
| Branch name | الفرع الرئيسي | الفرع الرئيسي |
| Department code (assignment) | DEP_BR01_020 (ADM_BR01_06) | DEP_BR01_027 (ADM_BR01_08) |
| Job title code | JT_0010 — رئيس قسم صيانة الشيبس | JT_0017 — فني تشغيل غلافات |
| Phone | null | null |
| Email | null | null |
| Category | OPERATIONAL | OPERATIONAL |
| Maintenance role (sheet 24) | (none) | MNT_0104 — فني تشغيل غلافات (scope: تغليف الشيبس) |

**Evidence analysis:** Different job titles (رئيس قسم vs فني), different departments (المخازن/warehouses vs إنتاج الشيبس - تغليف). Code prefix indicates BR_01 employee number 10 vs employee 104. **Sufficient evidence to treat as two different people.**

---

## 4. MISSING effectiveFrom — POLICY DECISION

**23 assignment records** and **20 machine responsibility records** (total 43 records) have no effectiveFrom/startDate.

**Schema requirement:** `effectiveFrom DateTime` is **NOT nullable**. The unique constraint `@@unique([personnelId, departmentId, effectiveFrom])` means effectiveFrom is part of the identity of an assignment. The DB will reject a NULL value.

**Current API/service behavior:** The create-assignment service and controller require effectiveFrom in the DTO (it is a required `DateTime` field with no `@default`).

### Stakeholder choices:

| Choice | Description | Impact |
|--------|-------------|--------|
| **A — Supply actual dates** | Stakeholder provides effectiveFrom per assignment from HR records | All 43 records become importable. Most accurate. Requires data collection effort. |
| **B — Approved cutover date** | Stakeholder approves a single date (e.g., 2026-01-01 or 2026-08-18) applied to all current-state assignments | All 43 records importable. Legally satisfies the schema. Common for migration scenarios where historical dates are unavailable. Must be documented as a migration convention. |
| **C — Exclude from Batch F** | These 43 records are skipped entirely | 23 person-assignments and 20 machine-responsibilities not imported. Persons still created. No assignments = no visible org structure. Significant functionality gap. |

---

## 5. PLACEHOLDER MAINTENANCE RECORDS (7 records)

| # | Source Row | Code | Placeholder Value | Job Title | Branch | Scope | Machine/Line/Dept Ref | Why unresolved |
|---|-----------|------|-------------------|-----------|--------|-------|----------------------|----------------|
| 1 | Row 2 | MNT_001 | يعبأ الاسم | مدير الصيانة (JT_0002) | BR_02 فرع البطاط | كل الأقسام | — | Template row; no real person named |
| 2 | Row 3 | MNT_002 | يعبأ الاسم | رئيس قسم صيانة الشيبس (JT_0022) | BR_02 فرع البطاط | صيانة الشيبس | — | Template row; no real person named |
| 3 | Row 4 | MNT_003 | يعبأ الاسم | رئيس قسم صيانة البفك (JT_0023) | BR_02 فرع البطاط | صيانة البفك | — | Template row; no real person named |
| 4 | Row 5 | MNT_004 | يعبأ الاسم |مسؤول الخراطة والتفريز (JT_0024) | BR_02 فرع البطاط | الخراطة والتفريز | — | Template row; no real person named |
| 5 | Row 6 | MNT_005 | يعبأ الاسم | مشرف صيانة خط تصنيع (JT_0025) | BR_02 فرع البطاط | تصنيع | — | Template row; no real person named |
| 6 | Row 7 | MNT_006 | يعبأ الاسم | مشرف صيانة خط تغليف (JT_0026) | BR_02 فرع البطاط | تغليف | — | Template row; no real person named |
| 7 | Row 8 | MNT_007 | يعبأ الاسم | فني صيانة (JT_0027) | BR_02 فرع البطاط | يعبأ الخط/الماكينة | — | Template row; no real person named |

**Decision choices:**
- **ASSIGN_EXISTING_PERSON** — Link to an existing person from the 23-person roster (if stakeholder can identify who fills each role)
- **PROVIDE_NEW_REAL_PERSON** — Stakeholder supplies real names/codes for these 7 positions at BR_02
- **EXCLUDE_FROM_IMPORT** — Skip these 7 records; BR_02 maintenance structure imported without named personnel

---

## 6. AMBIGUOUS MAINTENANCE MATCHES (3 records)

### MNT_0009 — فني ميكانيك

| Candidate | Person Code | Evidence For | Evidence Against |
|-----------|-------------|-------------|-----------------|
| **رضوان حنظل (A)** | EMP-0009 | Job title: فني ميكانيك (JT_0009). Assigned to ADM_BR01_10 (إدارة الصيانة). Maintenance scope: ميكانيك. Branch: BR_01. | Code suffix _009 matches employee 9 |
| **رضوان حنظل (B)** | EMP-0105 | Same name, same branch BR_01. | Job title: فني تشغيل غلافات (JT_0107). Assigned to DEP_BR01_029 (إنتاج البفك - تغليف). Different specialty entirely. |

**Recommendation:** Assign to EMP-0009 (فني ميكانيك matches the maintenance role exactly). Evidence: same specialty, same branch, code pattern matches.

### MNT_0104 — فني تشغيل غلافات (تغليف الشيبس)

| Candidate | Person Code | Evidence For | Evidence Against |
|-----------|-------------|-------------|-----------------|
| **أركان الحكيمي (A)** | EMP-0010 | Same name, same branch BR_01. | Job title: رئيس قسم صيانة الشيبس (JT_0010). Dept: DEP_BR01_020 (المخازن). Different role level. |
| **أركان الحكيمي (B)** | EMP-0104 | Job title: فني تشغيل غلافات (JT_0017). Assigned to DEP_BR01_027 (إنتاج الشيبس - تغليف). Maintenance scope: تغليف الشيبس. | Code suffix _0104 matches employee 104. |

**Recommendation:** Assign to EMP-0104 (فني تشغيل غلافات matches the maintenance role exactly). Evidence: same specialty, same department, code pattern matches.

### MNT_0105 — فني تشغيل غلافات (تغليف البفك)

| Candidate | Person Code | Evidence For | Evidence Against |
|-----------|-------------|-------------|-----------------|
| **رضوان حنظل (A)** | EMP-0009 | Same name, same branch BR_01. | Job title: فني ميكانيك (JT_0009). Different specialty. |
| **رضوان حنظل (B)** | EMP-0105 | Job title: فني تشغيل غلافات (JT_0017). Assigned to DEP_BR01_029 (إنتاج البفك - تغليف). Maintenance scope: تغليف البفك. | Code suffix _0105 matches employee 105. |

**Recommendation:** Assign to EMP-0105 (فني تشغيل غلافات matches exactly). Evidence: same specialty, same department (بفك تغليف), code pattern matches.

---

## 7. THE 58th BLOCKER — IDENTIFICATION

The manifest reports 58 blocked records. The actual blocker breakdown totals 57. The discrepancy:

| Issue | Overcount | Undercount | Net |
|-------|-----------|------------|-----|
| 5 READY_PERSON_LINK maintenance records misclassified as BLOCKED (manifest generator read `link_status` instead of `mapping_status`) | +5 | | |
| 4 DUPLICATE_NAME_REVIEW persons not flagged as blocked in manifest (generator read `dedup_status` instead of `identity_review_status`) | | -4 | |
| **Net discrepancy** | | | **+1** |

**The 58th record is the manifest generation bug: 5 maintenance records (MNT_0002, MNT_0008, MNT_0102, MNT_0103, MNT_0202) are classified BLOCKED in the manifest but are actually READY.** These require no stakeholder decision. The manifest should be corrected to show `blocked: 10` for MaintenancePersonnel (not 15), and the 4 duplicate-name persons should be added as requiring decision.

---

## 8. READINESS STATE

```
BATCH_E_PREPARATION_COMPLETE = PASS
STAKEHOLDER_SIGNOFF = PENDING
BATCH_E_FINAL_ACCEPTANCE = BLOCKED (57 records require decisions)
READY_FOR_BATCH_F = NO
```

---

## 9. STAKEHOLDER DECISION SUMMARY

| ID | Entity | Source | Affected Records | Decision Required | Choices |
|----|--------|--------|-----------------|-------------------|---------|
| **D01** | OperationalPerson (duplicate group: رضوان حنظل) | Sheet 37, rows 10+20; Sheet 24 rows 11+15 | 2 persons + 2 maintenance links | Are EMP-0009 and EMP-0105 the same person or two different people? | A) MERGE_AS_SAME_PERSON — keep one person record, consolidate assignments. B) KEEP_AS_SEPARATE_PERSONS — import both as distinct. C) INSUFFICIENT_EVIDENCE — request more info. |
| **D02** | OperationalPerson (duplicate group: أركان الحكيمي) | Sheet 37, rows 11+19; Sheet 24 row 14 | 2 persons + 1 maintenance link | Are EMP-0010 and EMP-0104 the same person or two different people? | A) MERGE_AS_SAME_PERSON. B) KEEP_AS_SEPARATE_PERSONS. C) INSUFFICIENT_EVIDENCE. |
| **D03** | OperationalPersonAssignment + MachineResponsibilityAssignment | Sheets 38+40 | 43 records (23 assignments + 20 machine responsibilities) | How to handle missing effectiveFrom/startDate? Schema requires a DateTime; NULL is rejected. | A) Supply actual dates per record. B) Approve a single cutover date for all current-state records. C) Exclude these 43 records from Batch F. |
| **D04** | MaintenancePersonnel (BR_02 placeholders) | Sheet 24, rows 2–8 | 7 records | These are template placeholders (يعبأ الاسم) with no real person. How to resolve? | A) ASSIGN_EXISTING_PERSON — link to a known employee from the 23-person roster. B) PROVIDE_NEW_REAL_PERSON — stakeholder supplies real names. C) EXCLUDE_FROM_IMPORT — skip these 7; BR_02 maintenance operates without named roles in the system. |
| **D05** | MaintenancePersonnel (ambiguous matches) | Sheet 24, rows 11,14,15 | 3 records | Confirm which person code each maintenance role links to. (Recommendations above based on specialty match.) | A) Accept recommended mapping (MNT_0009→EMP-0009, MNT_0104→EMP-0104, MNT_0105→EMP-0105). B) Override with different assignment. C) EXCLUDE_FROM_IMPORT. |
| **D06** | MaintenancePersonnel (READY records — manifest bug fix) | Sheet 24, rows 9,10,12,13,16 | 5 records | These 5 records are READY_PERSON_LINK but manifest misclassified them. Confirm they should proceed as NEW_READY (no decision needed, just manifest correction). | A) Confirm READY — no decision needed. B) Hold for review. |

### Compact answer format

```
D01 — رضوان حنظل duplicate group (2 affected persons) — choose A/B/C
D02 — أركان الحكيمي duplicate group (2 affected persons) — choose A/B/C
D03 — effectiveFrom policy (43 affected records) — choose A/B/C
D04 — BR_02 placeholder maintenance (7 affected records) — choose A/B/C
D05 — ambiguous maintenance matches (3 affected records) — choose A/B/C
D06 — READY maintenance records (5 affected records) — choose A/B
```

**Total records requiring stakeholder decision: 60** (4 persons + 43 date-dependent + 7 placeholder + 3 ambiguous + 3 duplicate-linked maintenance). Of these, D06 is a confirmation only (5 records already READY).

---

## 10. BLOCKED RECORD INVENTORY BY SOURCE SHEET

### Sheet 24 — كادر_الصيانة (Maintenance Personnel) — 10 genuinely blocked

| Row | Code | Name Ref | Blocker | Decision ID |
|-----|------|----------|---------|-------------|
| 2 | MNT_001 | يعبأ الاسم | E011_PLACEHOLDER | D04 |
| 3 | MNT_002 | يعبأ الاسم | E011_PLACEHOLDER | D04 |
| 4 | MNT_003 | يعبأ الاسم | E011_PLACEHOLDER | D04 |
| 5 | MNT_004 | يعبأ الاسم | E011_PLACEHOLDER | D04 |
| 6 | MNT_005 | يعبأ الاسم | E011_PLACEHOLDER | D04 |
| 7 | MNT_006 | يعبأ الاسم | E011_PLACEHOLDER | D04 |
| 8 | MNT_007 | يعبأ الاسم | E011_PLACEHOLDER | D04 |
| 11 | MNT_0009 | رضوان حنظل | E007_AMBIGUOUS | D05 |
| 14 | MNT_0104 | أركان الحكيمي | E007_AMBIGUOUS | D05 |
| 15 | MNT_0105 | رضوان حنظل | E007_AMBIGUOUS | D05 |

### Sheet 37 — الأشخاص التشغيون (Persons) — 4 require decision

| Row | Code | Name | Blocker | Decision ID |
|-----|------|------|---------|-------------|
| 10 | EMP-0009 | رضوان حنظل | E007_DUPLICATE | D01 |
| 11 | EMP-0010 | أركان الحكيمي | E007_DUPLICATE | D02 |
| 19 | EMP-0104 | أركان الحكيمي | E007_DUPLICATE | D02 |
| 20 | EMP-0105 | رضوان حنظل | E007_DUPLICATE | D01 |

### Sheet 38 — تعيينات الأشخاص (Assignments) — 23 blocked

| Row | Person Code | Blocker | Decision ID |
|-----|-------------|---------|-------------|
| 2 | EMP-0001 | E009_EFFECTIVE_FROM_MISSING | D03 |
| 3 | EMP-0002 | E009_EFFECTIVE_FROM_MISSING | D03 |
| 4 | EMP-0003 | E009_EFFECTIVE_FROM_MISSING | D03 |
| 5 | EMP-0004 | E009_EFFECTIVE_FROM_MISSING | D03 |
| 6 | EMP-0005 | E009_EFFECTIVE_FROM_MISSING | D03 |
| 7 | EMP-0006 | E009_EFFECTIVE_FROM_MISSING | D03 |
| 8 | EMP-0007 | E009_EFFECTIVE_FROM_MISSING | D03 |
| 9 | EMP-0008 | E009_EFFECTIVE_FROM_MISSING | D03 |
| 10 | EMP-0009 | E009_EFFECTIVE_FROM_MISSING | D03 |
| 11 | EMP-0010 | E009_EFFECTIVE_FROM_MISSING | D03 |
| 12 | EMP-0011 | E009_EFFECTIVE_FROM_MISSING | D03 |
| 13 | EMP-0012 | E009_EFFECTIVE_FROM_MISSING | D03 |
| 14 | EMP-0013 | E009_EFFECTIVE_FROM_MISSING | D03 |
| 15 | EMP-0014 | E009_EFFECTIVE_FROM_MISSING | D03 |
| 16 | EMP-0101 | E009_EFFECTIVE_FROM_MISSING | D03 |
| 17 | EMP-0102 | E009_EFFECTIVE_FROM_MISSING | D03 |
| 18 | EMP-0103 | E009_EFFECTIVE_FROM_MISSING | D03 |
| 19 | EMP-0104 | E009_EFFECTIVE_FROM_MISSING | D03 |
| 20 | EMP-0105 | E009_EFFECTIVE_FROM_MISSING | D03 |
| 21 | EMP-0201 | E009_EFFECTIVE_FROM_MISSING | D03 |
| 22 | EMP-0202 | E009_EFFECTIVE_FROM_MISSING | D03 |
| 23 | EMP-0301 | E009_EFFECTIVE_FROM_MISSING | D03 |
| 24 | EMP-0401 | E009_EFFECTIVE_FROM_MISSING | D03 |

### Sheet 40 — مسؤوليات الصيانة_v2 (Machine Responsibilities) — 20 blocked

| Row | Code | Scope | Blocker | Decision ID |
|-----|------|-------|---------|-------------|
| 2 | RSP_BR_01_MNT_MANAGER | null (اعتماد/متابعة) | E009_START_DATE_MISSING | D03 |
| 3 | RSP_BR_01_CH_MNT | DEPARTMENT: إنتاج الشيبس | E009_START_DATE_MISSING | D03 |
| 4 | RSP_BR_01_PF_MNT | DEPARTMENT: إنتاج البفك | E009_START_DATE_MISSING | D03 |
| 5 | RSP_BR_01_LATHE | DEPARTMENT: الخراطة والتفريز | E009_START_DATE_MISSING | D03 |
| 6 | RSP_BR_01_STORE | null (صرف واستلام) | E009_START_DATE_MISSING | D03 |
| 7 | RSP_BR_02_MNT_MANAGER | null (اعتماد/متابعة) | E009_START_DATE_MISSING | D03 |
| 8 | RSP_BR_02_CH_MNT | DEPARTMENT: إنتاج الشيبس | E009_START_DATE_MISSING | D03 |
| 9 | RSP_BR_02_PF_MNT | DEPARTMENT: إنتاج البفك | E009_START_DATE_MISSING | D03 |
| 10 | RSP_BR_02_LATHE | DEPARTMENT: الخراطة والتفريز | E009_START_DATE_MISSING | D03 |
| 11 | RSP_BR_02_STORE | null (صرف واستلام) | E009_START_DATE_MISSING | D03 |
| 12 | RSP_BR_03_MNT_MANAGER | null (اعتماد/متابعة) | E009_START_DATE_MISSING | D03 |
| 13 | RSP_BR_03_CH_MNT | DEPARTMENT: إنتاج الشيبس | E009_START_DATE_MISSING | D03 |
| 14 | RSP_BR_03_PF_MNT | DEPARTMENT: إنتاج البفك | E009_START_DATE_MISSING | D03 |
| 15 | RSP_BR_03_LATHE | DEPARTMENT: الخراطة والتفريز | E009_START_DATE_MISSING | D03 |
| 16 | RSP_BR_03_STORE | null (صرف واستلام) | E009_START_DATE_MISSING | D03 |
| 17 | RSP_BR_04_MNT_MANAGER | null (اعتماد/متابعة) | E009_START_DATE_MISSING | D03 |
| 18 | RSP_BR_04_CH_MNT | DEPARTMENT: إنتاج الشيبس | E009_START_DATE_MISSING | D03 |
| 19 | RSP_BR_04_PF_MNT | DEPARTMENT: إنتاج البفك | E009_START_DATE_MISSING | D03 |
| 20 | RSP_BR_04_LATHE | DEPARTMENT: الخراطة والتفريز | E009_START_DATE_MISSING | D03 |
| 21 | RSP_BR_04_STORE | null (صرف واستلام) | E009_START_DATE_MISSING | D03 |

---

## 11. ADDITIONAL NOTE: SCOPE UNRESOLVED MACHINE RESPONSIBILITIES

8 of the 20 machine responsibility records have `scope_type: null` (no department, no machine, no production line assigned). These are the MNT_MANAGER and STORE roles per branch. Even if dates are supplied, the scope must be resolved before import. This is a secondary dependency within D03.

| Row | Code | Branch | Role | Scope Issue |
|-----|------|--------|------|-------------|
| 2 | RSP_BR_01_MNT_MANAGER | BR_01 | اعتماد/متابعة | No scope — is this a department-level or branch-level assignment? |
| 6 | RSP_BR_01_STORE | BR_01 | صرف واستلام | No scope — which warehouse/department? |
| 7 | RSP_BR_02_MNT_MANAGER | BR_02 | اعتماد/متابعة | Same |
| 11 | RSP_BR_02_STORE | BR_02 | صرف واستلام | Same |
| 12 | RSP_BR_03_MNT_MANAGER | BR_03 | اعتماد/متابعة | Same |
| 16 | RSP_BR_03_STORE | BR_03 | صرف واستلام | Same |
| 17 | RSP_BR_04_MNT_MANAGER | BR_04 | اعتماد/متابعة | Same |
| 21 | RSP_BR_04_STORE | BR_04 | صرف واستلام | Same |
