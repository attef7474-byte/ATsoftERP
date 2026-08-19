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
    "manifest_version": "1.0",
    "batch": "E",
    "generated_at": "2026-08-18T00:00:00Z",
    "source_workbook": "ATsoft_ERP_source.xlsx",
    "import_dependency_order": [
        "Company", "Branch", "Administration", "Department",
        "JobTitle", "OperationalPerson", "OperationalPersonAssignment",
        "SupervisorAssignment", "MaintenancePersonnel", "MachineResponsibilityAssignment"
    ],
    "entities": {}
}

# Company - 1 row, REUSE_EXISTING (COM-000001 exists)
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
manifest["entities"]["Company"] = {"total_rows": 1, "new_ready": 0, "reuse_existing": 1, "blocked": 0, "records": co_records}

# Branches - 4 rows
branch_rows = data["04_الفروع"]["rows"]
br_records = []
existing_branches = {"BR_01": "HQ"}
for i, r in enumerate(branch_rows):
    code = r["code"]
    if code in existing_branches:
        action = "REUSE_EXISTING"
        status = "EXISTING_EXACT"
        notes = "Branch already exists as " + existing_branches[code]
    else:
        action = "CREATE"
        status = "NEW_READY"
        notes = "New branch to create"
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
manifest["entities"]["Branch"] = {"total_rows": 4, "new_ready": 3, "reuse_existing": 1, "blocked": 0, "records": br_records}

# Administrations - 40 rows
admin_rows = data["05_الإدارات"]["rows"]
adm_records = []
existing_admins = {"HQ_GEN": True, "ADM-000001": True}
for i, r in enumerate(admin_rows):
    code = r["code"]
    if code in existing_admins:
        action = "REUSE_EXISTING"
        status = "EXISTING_EXACT"
        notes = "Administration already exists in DB"
    else:
        action = "CREATE"
        status = "NEW_READY"
        notes = "New administration to create"
    adm_records.append({
        "entityType": "Administration",
        "sourceSheet": "05_الإدارات",
        "sourceRow": i + 2,
        "action": action,
        "businessKey": code,
        "existingDbCode": code if code in existing_admins else None,
        "mappingStatus": status,
        "validationStatus": "VALID",
        "blockerCode": None,
        "notes": notes
    })
adm_new = sum(1 for r in adm_records if r["action"] == "CREATE")
adm_reuse = sum(1 for r in adm_records if r["action"] == "REUSE_EXISTING")
manifest["entities"]["Administration"] = {"total_rows": 40, "new_ready": adm_new, "reuse_existing": adm_reuse, "blocked": 0, "records": adm_records}

# Departments - 152 rows
dept_rows = data["06_الأقسام"]["rows"]
dep_records = []
existing_dept = {"DEPT-IT": True}
for i, r in enumerate(dept_rows):
    code = r["code"]
    ms = r.get("mapping_status", "")
    classification = r.get("classification", "OPERATIONAL")
    if code in existing_dept:
        action = "REUSE_EXISTING"
        status = "EXISTING_EXACT"
        notes = "Department already exists in DB"
    elif ms == "READY_DERIVED":
        action = "CREATE"
        status = "NEW_READY"
        notes = "Derived PROCESS parent department"
    elif ms == "READY":
        action = "CREATE"
        status = "NEW_READY"
        notes = "Ready for import"
    else:
        action = "CREATE"
        status = "NEW_READY"
        notes = "Mapping status: " + str(ms)
    dep_records.append({
        "entityType": "Department",
        "sourceSheet": "06_الأقسام",
        "sourceRow": i + 2,
        "action": action,
        "businessKey": code,
        "companyCode": r.get("company_code"),
        "branchCode": r.get("branch_code"),
        "administrationCode": r.get("administration_code"),
        "parentCode": r.get("parent_code"),
        "classification": classification,
        "existingDbCode": code if code in existing_dept else None,
        "mappingStatus": status,
        "validationStatus": "VALID",
        "blockerCode": None,
        "notes": notes
    })
dep_new = sum(1 for r in dep_records if r["action"] == "CREATE")
dep_reuse = sum(1 for r in dep_records if r["action"] == "REUSE_EXISTING")
manifest["entities"]["Department"] = {"total_rows": 152, "new_ready": dep_new, "reuse_existing": dep_reuse, "blocked": 0, "records": dep_records}

# JobTitles - 29 rows, all CREATE (none exist)
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
        "notes": "New job title, all need title standardization review"
    })
manifest["entities"]["JobTitle"] = {"total_rows": 29, "new_ready": 29, "reuse_existing": 0, "blocked": 0, "records": jt_records}

# OperationalPersons - 23 rows
person_records = []
for i, r in enumerate(persons):
    dup = r.get("dedup_status", "")
    if "DUPLICATE" in str(dup).upper():
        action = "BLOCKED"
        status = "POSSIBLE_DUPLICATE"
        blocker = "E007_PERSON_DUPLICATE_AMBIGUOUS"
        notes = "Duplicate name: " + str(dup)
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
manifest["entities"]["OperationalPerson"] = {"total_rows": 23, "new_ready": pers_new, "reuse_existing": 0, "blocked": pers_blocked, "records": person_records}

# PersonAssignments - 23 rows, all BLOCKED (missing effective_from)
assign_records = []
for i, r in enumerate(assignments):
    status_val = r.get("assignment_status", "")
    assign_records.append({
        "entityType": "OperationalPersonAssignment",
        "sourceSheet": "38_تعيينات_الأشخاص",
        "sourceRow": i + 2,
        "action": "BLOCKED",
        "businessKey": r.get("personnel_code") or r.get("person_code"),
        "companyCode": r.get("company_code"),
        "branchCode": r.get("branch_code"),
        "departmentCode": r.get("department_code"),
        "jobTitleCode": r.get("job_title_code"),
        "assignmentType": r.get("assignment_type", "PRIMARY"),
        "mappingStatus": "BLOCKED",
        "validationStatus": "BLOCKED",
        "blockerCode": "E009_EFFECTIVE_FROM_MISSING",
        "notes": "Missing effective_from date: " + str(status_val)
    })
manifest["entities"]["OperationalPersonAssignment"] = {"total_rows": 23, "new_ready": 0, "reuse_existing": 0, "blocked": 23, "records": assign_records}

# SupervisorAssignment - 0 rows
manifest["entities"]["SupervisorAssignment"] = {"total_rows": 0, "new_ready": 0, "reuse_existing": 0, "blocked": 0, "records": []}

# MaintenancePersonnel - 15 rows
mp_records = []
for i, r in enumerate(maint_pers):
    status = r.get("link_status", "")
    if "PLACEHOLDER" in str(status).upper():
        action = "BLOCKED"
        blocker = "E011_MAINTENANCE_PERSON_UNRESOLVED"
        notes = "Placeholder name, needs real person"
    elif "AMBIGUOUS" in str(status).upper():
        action = "BLOCKED"
        blocker = "E007_PERSON_DUPLICATE_AMBIGUOUS"
        notes = "Ambiguous person match: " + str(status)
    elif "READY" in str(status).upper():
        action = "CREATE"
        blocker = None
        notes = "Ready for person link"
    else:
        action = "BLOCKED"
        blocker = "E011_MAINTENANCE_PERSON_UNRESOLVED"
        notes = "Status: " + str(status)
    mp_records.append({
        "entityType": "MaintenancePersonnel",
        "sourceSheet": "24_كادر_الصيانة",
        "sourceRow": i + 2,
        "action": action,
        "businessKey": r.get("maintenance_person_code") or r.get("code"),
        "mappingStatus": "BLOCKED" if action == "BLOCKED" else "NEW_READY",
        "validationStatus": "BLOCKED" if action == "BLOCKED" else "VALID",
        "blockerCode": blocker,
        "notes": notes
    })
mp_ready = sum(1 for r in mp_records if r["action"] == "CREATE")
mp_blocked = sum(1 for r in mp_records if r["action"] == "BLOCKED")
manifest["entities"]["MaintenancePersonnel"] = {"total_rows": 15, "new_ready": mp_ready, "reuse_existing": 0, "blocked": mp_blocked, "records": mp_records}

# MachineResponsibilityAssignment - 20 rows
mr_records = []
for i, r in enumerate(machine_resp):
    mr_records.append({
        "entityType": "MachineResponsibilityAssignment",
        "sourceSheet": "40_مسؤوليات_الصيانة_v2",
        "sourceRow": i + 2,
        "action": "BLOCKED",
        "businessKey": r.get("code"),
        "companyCode": r.get("company_code"),
        "branchCode": r.get("branch_code"),
        "scopeType": r.get("scope_type") or r.get("proposed_scope_type"),
        "mappingStatus": "BLOCKED",
        "validationStatus": "BLOCKED",
        "blockerCode": "E009_EFFECTIVE_FROM_MISSING",
        "notes": "Missing person start date"
    })
manifest["entities"]["MachineResponsibilityAssignment"] = {"total_rows": 20, "new_ready": 0, "reuse_existing": 0, "blocked": 20, "records": mr_records}

with open('docs/data-prep/batch-e/batch-e-import-manifest.json', 'w', encoding='utf-8') as f:
    json.dump(manifest, f, ensure_ascii=False, indent=2)

print("Manifest written successfully")
for entity, edata in manifest["entities"].items():
    print("  " + entity + ": total=" + str(edata["total_rows"]) + " new_ready=" + str(edata["new_ready"]) + " reuse=" + str(edata["reuse_existing"]) + " blocked=" + str(edata["blocked"]))
