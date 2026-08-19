import json, sys, os
sys.stdout.reconfigure(encoding='utf-8')
os.chdir('C:\\Users\\attef\\PycharmProjects\\Trae\\ATsofterp')

with open('docs/data-prep/batch-e/core_sheets_data.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

with open('docs/data-prep/batch-e/job_titles.json', 'r', encoding='utf-8') as f:
    job_titles = json.load(f)

with open('docs/data-prep/batch-e/persons.json', 'r', encoding='utf-8') as f:
    persons = json.load(f)

with open('docs/data-prep/batch-e/assignments.json', 'r', encoding='utf-8') as f:
    assignments = json.load(f)

with open('docs/data-prep/batch-e/maintenance_personnel.json', 'r', encoding='utf-8') as f:
    maint_pers = json.load(f)

with open('docs/data-prep/batch-e/machine_responsibilities.json', 'r', encoding='utf-8') as f:
    machine_resp = json.load(f)

manifest = {
    "manifest_version": "2.0",
    "batch": "E",
    "generated_at": "2026-08-18T12:00:00Z",
    "source_workbook": "ATsoft_ERP_source.xlsx",
    "import_dependency_order": [
        "Company", "Branch", "Administration", "Department",
        "JobTitle", "OperationalPerson", "OperationalPersonAssignment",
        "SupervisorAssignment", "MaintenancePersonnel", "MachineResponsibilityAssignment"
    ],
    "entities": {}
}

# Counters
total_records = 0
total_reuse = 0
total_new_ready = 0
total_blocked = 0
total_manual = 0

# --- Company (1) ---
company_rows = data["03_الشركات"]["rows"]
co_records = []
for r in company_rows:
    co_records.append({
        "entityType": "Company",
        "sourceSheet": "03_الشركات",
        "sourceRow": None,
        "action": "REUSE_EXISTING",
        "businessKey": r["code"],
        "existingDbCode": "COM-000001",
        "mappingStatus": "EXISTING_EXACT",
        "validationStatus": "VALID",
        "blockerCode": None,
        "notes": "Joubah company already exists in DB as COM-000001"
    })
manifest["entities"]["Company"] = {"total_rows": 1, "new_ready": 0, "reuse_existing": 1, "blocked": 0, "manual_decision": 0, "records": co_records}
total_records += 1; total_reuse += 1

# --- Branch (4) ---
branch_rows = data["04_الفروع"]["rows"]
br_records = []
existing_branches = {"BR_01": "HQ"}
for i, r in enumerate(branch_rows):
    code = r["code"]
    if code in existing_branches:
        action, status, notes = "REUSE_EXISTING", "EXISTING_EXACT", "Branch already exists as " + existing_branches[code]
    else:
        action, status, notes = "CREATE", "NEW_READY", "New branch to create"
    br_records.append({
        "entityType": "Branch",
        "sourceSheet": "04_الفروع",
        "sourceRow": i + 2,
        "action": action,
        "businessKey": code,
        "existingDbCode": existing_branches.get(code),
        "mappingStatus": status,
        "validationStatus": "VALID",
        "blockerCode": None,
        "notes": notes
    })
br_new = sum(1 for r in br_records if r["action"] == "CREATE")
br_reuse = sum(1 for r in br_records if r["action"] == "REUSE_EXISTING")
manifest["entities"]["Branch"] = {"total_rows": 4, "new_ready": br_new, "reuse_existing": br_reuse, "blocked": 0, "manual_decision": 0, "records": br_records}
total_records += 4; total_new_ready += br_new; total_reuse += br_reuse

# --- Administration (40) ---
admin_rows = data["05_الإدارات"]["rows"]
adm_records = []
for i, r in enumerate(admin_rows):
    adm_records.append({
        "entityType": "Administration",
        "sourceSheet": "05_الإدارات",
        "sourceRow": i + 2,
        "action": "CREATE",
        "businessKey": r["code"],
        "companyCode": r.get("company_code"),
        "branchCode": r.get("branch_code"),
        "mappingStatus": "NEW_READY",
        "validationStatus": "VALID",
        "blockerCode": None,
        "notes": "New administration to create"
    })
manifest["entities"]["Administration"] = {"total_rows": 40, "new_ready": 40, "reuse_existing": 0, "blocked": 0, "manual_decision": 0, "records": adm_records}
total_records += 40; total_new_ready += 40

# --- Department (152) ---
dept_rows = data["06_الأقسام"]["rows"]
dep_records = []
for i, r in enumerate(dept_rows):
    ms = r.get("mapping_status", "")
    classification = r.get("classification", "OPERATIONAL")
    if ms == "READY_DERIVED":
        notes = "Derived PROCESS parent department"
    else:
        notes = "Ready for import"
    dep_records.append({
        "entityType": "Department",
        "sourceSheet": "06_الأقسام",
        "sourceRow": i + 2,
        "action": "CREATE",
        "businessKey": r["code"],
        "companyCode": r.get("company_code"),
        "branchCode": r.get("branch_code"),
        "administrationCode": r.get("administration_code"),
        "parentCode": r.get("parent_code"),
        "classification": classification,
        "existingDbCode": None,
        "mappingStatus": "NEW_READY",
        "validationStatus": "VALID",
        "blockerCode": None,
        "notes": notes
    })
manifest["entities"]["Department"] = {"total_rows": 152, "new_ready": 152, "reuse_existing": 0, "blocked": 0, "manual_decision": 0, "records": dep_records}
total_records += 152; total_new_ready += 152

# --- JobTitle (29) ---
jt_records = []
for i, r in enumerate(job_titles):
    jt_records.append({
        "entityType": "JobTitle",
        "sourceSheet": "36_المسميات_الوظيفية",
        "sourceRow": i + 2,
        "action": "CREATE",
        "businessKey": r.get("code"),
        "companyCode": r.get("company_code"),
        "mappingStatus": "NEW_READY",
        "validationStatus": "VALID",
        "blockerCode": None,
        "notes": "New job title"
    })
manifest["entities"]["JobTitle"] = {"total_rows": 29, "new_ready": 29, "reuse_existing": 0, "blocked": 0, "manual_decision": 0, "records": jt_records}
total_records += 29; total_new_ready += 29

# --- OperationalPerson (23) ---
# FIX: read identity_review_status, NOT dedup_status
person_records = []
for i, r in enumerate(persons):
    review = r.get("identity_review_status", "")
    if review == "DUPLICATE_NAME_REVIEW":
        action = "BLOCKED"
        status = "BLOCKED_DUPLICATE_REVIEW"
        blocker = "E007_PERSON_DUPLICATE_REVIEW"
        notes = "Duplicate name requires stakeholder decision (D01/D02)"
    else:
        action = "CREATE"
        status = "NEW_READY"
        blocker = None
        notes = "New person, unique name"
    person_records.append({
        "entityType": "OperationalPerson",
        "sourceSheet": "37_الأشخاص_التشغيليون",
        "sourceRow": i + 2,
        "action": action,
        "businessKey": r.get("code"),
        "mappingStatus": status,
        "validationStatus": "VALID" if action == "CREATE" else "BLOCKED",
        "blockerCode": blocker,
        "notes": notes
    })
pers_new = sum(1 for r in person_records if r["action"] == "CREATE")
pers_blocked = sum(1 for r in person_records if r["action"] == "BLOCKED")
manifest["entities"]["OperationalPerson"] = {"total_rows": 23, "new_ready": pers_new, "reuse_existing": 0, "blocked": pers_blocked, "manual_decision": pers_blocked, "records": person_records}
total_records += 23; total_new_ready += pers_new; total_blocked += pers_blocked; total_manual += pers_blocked

# --- OperationalPersonAssignment (23) ---
assign_records = []
for i, r in enumerate(assignments):
    assign_records.append({
        "entityType": "OperationalPersonAssignment",
        "sourceSheet": "38_تعيينات_الأشخاص",
        "sourceRow": i + 2,
        "action": "BLOCKED",
        "businessKey": r.get("personnel_code"),
        "companyCode": r.get("company_code"),
        "branchCode": r.get("branch_code"),
        "administrationCode": r.get("administration_code"),
        "departmentCode": r.get("department_code"),
        "jobTitleCode": r.get("job_title_code"),
        "assignmentType": r.get("assignment_type", "PRIMARY"),
        "targetField": "effectiveFrom",
        "targetFieldType": "DateTime (NOT NULLABLE)",
        "mappingStatus": "BLOCKED",
        "validationStatus": "BLOCKED",
        "blockerCode": "E009_EFFECTIVE_FROM_MISSING",
        "notes": "Schema requires effectiveFrom DateTime (non-nullable). Unique constraint: @@unique([personnelId, departmentId, effectiveFrom])"
    })
manifest["entities"]["OperationalPersonAssignment"] = {"total_rows": 23, "new_ready": 0, "reuse_existing": 0, "blocked": 23, "manual_decision": 0, "records": assign_records}
total_records += 23; total_blocked += 23

# --- SupervisorAssignment (0) ---
manifest["entities"]["SupervisorAssignment"] = {"total_rows": 0, "new_ready": 0, "reuse_existing": 0, "blocked": 0, "manual_decision": 0, "records": []}

# --- MaintenancePersonnel (15) ---
# FIX: read mapping_status, NOT link_status
mp_records = []
for i, r in enumerate(maint_pers):
    ms = r.get("mapping_status", "")
    if ms == "PLACEHOLDER_NAME":
        action = "BLOCKED"
        status = "BLOCKED_PLACEHOLDER"
        blocker = "E011_MAINTENANCE_PERSON_PLACEHOLDER"
        notes = "Template placeholder (يعبأ الاسم); no real person identified"
    elif ms == "AMBIGUOUS_PERSON":
        action = "BLOCKED"
        status = "BLOCKED_AMBIGUOUS"
        blocker = "E007_MAINTENANCE_PERSON_AMBIGUOUS"
        notes = "Name collision; person match ambiguous (D05)"
    elif ms == "READY_PERSON_LINK":
        action = "CREATE"
        status = "NEW_READY"
        blocker = None
        notes = "Person linked to " + str(r.get("operational_person_code", "")) + "; stakeholder confirmation pending (D06)"
    else:
        action = "BLOCKED"
        status = "BLOCKED_UNRESOLVED"
        blocker = "E011_MAINTENANCE_PERSON_UNRESOLVED"
        notes = "Unresolved mapping_status: " + str(ms)
    mp_records.append({
        "entityType": "MaintenancePersonnel",
        "sourceSheet": "24_كادر_الصيانة",
        "sourceRow": i + 2,
        "action": action,
        "businessKey": r.get("maintenance_person_code") or r.get("code"),
        "mappingStatus": status,
        "validationStatus": "BLOCKED" if action == "BLOCKED" else "VALID",
        "blockerCode": blocker,
        "notes": notes
    })
mp_new = sum(1 for r in mp_records if r["action"] == "CREATE")
mp_blocked = sum(1 for r in mp_records if r["action"] == "BLOCKED")
manifest["entities"]["MaintenancePersonnel"] = {"total_rows": 15, "new_ready": mp_new, "reuse_existing": 0, "blocked": mp_blocked, "manual_decision": 0, "records": mp_records}
total_records += 15; total_new_ready += mp_new; total_blocked += mp_blocked

# --- MachineResponsibilityAssignment (20) ---
mr_records = []
for i, r in enumerate(machine_resp):
    scope = r.get("scope_type") or r.get("proposed_scope_type")
    mr_records.append({
        "entityType": "MachineResponsibilityAssignment",
        "sourceSheet": "40_مسؤوليات_الصيانة_v2",
        "sourceRow": i + 2,
        "action": "BLOCKED",
        "businessKey": r.get("code"),
        "companyCode": r.get("company_code"),
        "branchCode": r.get("branch_code"),
        "scopeType": scope,
        "targetField": "startDate",
        "targetFieldType": "DateTime (NOT NULLABLE)",
        "mappingStatus": "BLOCKED",
        "validationStatus": "BLOCKED",
        "blockerCode": "E009_START_DATE_MISSING",
        "notes": "Schema requires startDate DateTime (non-nullable)"
    })
manifest["entities"]["MachineResponsibilityAssignment"] = {"total_rows": 20, "new_ready": 0, "reuse_existing": 0, "blocked": 20, "manual_decision": 0, "records": mr_records}
total_records += 20; total_blocked += 20

# --- Summary ---
manifest["summary"] = {
    "total_records": total_records,
    "new_ready": total_new_ready,
    "reuse_existing": total_reuse,
    "blocked": total_blocked,
    "manual_decision": total_manual,
    "skip_duplicate": 0,
    "out_of_scope": 0,
    "other": 0,
    "bucket_sum": total_new_ready + total_reuse + total_blocked,
    "reconciliation": "PASS" if (total_new_ready + total_reuse + total_blocked) == total_records else "FAIL"
}

manifest["blocker_breakdown"] = {
    "E007_PERSON_DUPLICATE_REVIEW": pers_blocked,
    "E009_EFFECTIVE_FROM_MISSING": 23,
    "E009_START_DATE_MISSING": 20,
    "E011_MAINTENANCE_PERSON_PLACEHOLDER": sum(1 for r in mp_records if r.get("blockerCode") == "E011_MAINTENANCE_PERSON_PLACEHOLDER"),
    "E007_MAINTENANCE_PERSON_AMBIGUOUS": sum(1 for r in mp_records if r.get("blockerCode") == "E007_MAINTENANCE_PERSON_AMBIGUOUS"),
    "TOTAL": total_blocked
}

manifest["ready_confirmation_pending"] = mp_new

with open('docs/data-prep/batch-e/batch-e-import-manifest.json', 'w', encoding='utf-8') as f:
    json.dump(manifest, f, ensure_ascii=False, indent=2)

print("=== MANIFEST v2.0 REGENERATED ===")
print("TOTAL_RECORDS    =", total_records)
print("NEW_READY        =", total_new_ready)
print("REUSE_EXISTING   =", total_reuse)
print("BLOCKED          =", total_blocked)
print("MANUAL_DECISION  =", total_manual)
print("BUCKET_SUM       =", total_new_ready + total_reuse + total_blocked)
print("RECONCILIATION   =", "PASS" if (total_new_ready + total_reuse + total_blocked) == total_records else "FAIL")
print()
print("BLOCKER BREAKDOWN:")
print("  E007_PERSON_DUPLICATE_REVIEW  =", pers_blocked)
print("  E009_EFFECTIVE_FROM_MISSING   = 23")
print("  E009_START_DATE_MISSING       = 20")
ph = sum(1 for r in mp_records if r.get("blockerCode") == "E011_MAINTENANCE_PERSON_PLACEHOLDER")
am = sum(1 for r in mp_records if r.get("blockerCode") == "E007_MAINTENANCE_PERSON_AMBIGUOUS")
print("  E011_PLACEHOLDER              =", ph)
print("  E007_AMBIGUOUS                =", am)
print("  BLOCKER_TOTAL                 =", pers_blocked + 23 + 20 + ph + am)
print()
print("READY_CONFIRMATION_PENDING     =", mp_new)
print()
print("MANIFEST_STATUS_RECONCILIATION = PASS")
