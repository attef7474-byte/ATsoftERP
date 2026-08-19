import json
import os

BASE = os.path.dirname(os.path.abspath(__file__))
INPUT = os.path.join(BASE, "core_sheets_data.json")

with open(INPUT, "r", encoding="utf-8") as f:
    data = json.load(f)


def save(name, rows):
    path = os.path.join(BASE, name)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(rows, f, ensure_ascii=False, indent=2)
    print(f"  -> {name}: {len(rows)} rows saved")


# 1. Job Titles
save("job_titles.json", data["36_المسميات_الوظيفية"]["rows"])

# 2. Operational Persons
save("persons.json", data["37_الأشخاص_التشغيليون"]["rows"])

# 3. Person Assignments
save("assignments.json", data["38_تعيينات_الأشخاص"]["rows"])

# 4. Supervisor Hierarchy
save("supervisors.json", data["39_التسلسل_الإداري"]["rows"])

# 5. Maintenance Personnel
save("maintenance_personnel.json", data["24_كادر_الصيانة"]["rows"])

# 6. Machine Responsibilities v2
save("machine_responsibilities.json", data["40_مسؤوليات_الصيانة_v2"]["rows"])

# 7. Departments: non-READY or non-OPERATIONAL
dept_rows = data["06_الأقسام"]["rows"]
dept_non_ready = [
    r for r in dept_rows
    if r.get("mapping_status") != "READY" or r.get("classification") != "OPERATIONAL"
]
save("dept_non_ready.json", dept_non_ready)

# 8. Import Readiness - NOT in core_sheets_data.json (only in sheet_inventory.json metadata)
print("\n  [SKIP] 43_import_readiness: not in core_sheets_data.json (only metadata in sheet_inventory.json)")

import sys
sys.stdout.reconfigure(encoding='utf-8')

print("\n=== SUMMARY ===")

print(f"\n1. job_titles.json: {len(data['36_المسميات_الوظيفية']['rows'])} rows")
for r in data["36_المسميات_الوظيفية"]["rows"]:
    print(f"   {r['code']}: {r['name']} [{r['category']}] review={r['review_status']}")

print(f"\n2. persons.json: {len(data['37_الأشخاص_التشغيليون']['rows'])} rows")
for r in data["37_الأشخاص_التشغيليون"]["rows"]:
    dup = "*" if r["identity_review_status"] == "DUPLICATE_NAME_REVIEW" else " "
    print(f"   {dup}{r['code']}: {r['name']} [{r['identity_review_status']}]")

print(f"\n3. assignments.json: {len(data['38_تعيينات_الأشخاص']['rows'])} rows")
mapping_counts = {}
for r in data["38_تعيينات_الأشخاص"]["rows"]:
    ms = r["mapping_status"]
    mapping_counts[ms] = mapping_counts.get(ms, 0) + 1
for k, v in sorted(mapping_counts.items()):
    print(f"   {k}: {v}")

print(f"\n4. supervisors.json: {len(data['39_التسلسل_الإداري']['rows'])} rows (EMPTY)")

print(f"\n5. maintenance_personnel.json: {len(data['24_كادر_الصيانة']['rows'])} rows")
mstatus = {}
for r in data["24_كادر_الصيانة"]["rows"]:
    ms = r["mapping_status"]
    mstatus[ms] = mstatus.get(ms, 0) + 1
for k, v in sorted(mstatus.items()):
    print(f"   {k}: {v}")

print(f"\n6. machine_responsibilities.json: {len(data['40_مسؤوليات_الصيانة_v2']['rows'])} rows")
rstatus = {}
for r in data["40_مسؤوليات_الصيانة_v2"]["rows"]:
    ms = r["mapping_status"]
    rstatus[ms] = rstatus.get(ms, 0) + 1
for k, v in sorted(rstatus.items()):
    print(f"   {k}: {v}")

print(f"\n7. dept_non_ready.json: {len(dept_non_ready)} rows out of {len(dept_rows)} total")
for r in dept_non_ready:
    print(f"   {r['code']}: {r['name']} [class={r['classification']}] [mapping={r['mapping_status']}]")

print(f"\n8. import_readiness.json: SKIPPED (sheet 43 not in core_sheets_data.json)")
