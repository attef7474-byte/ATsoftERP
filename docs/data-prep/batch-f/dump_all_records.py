#!/usr/bin/env python3
"""Get all persons, maintenance, and machine responsibility records for import."""
import json, sys
from pathlib import Path

BATCH_E = Path(__file__).resolve().parent.parent / "batch-e"
sys.stdout.reconfigure(encoding='utf-8')

# Persons
with open(BATCH_E / "persons.json", "r", encoding="utf-8") as f:
    persons = json.load(f)
print("=== ALL PERSONS ===")
for p in persons:
    print("  %s: name=%s, category=%s, active=%s" % (p['code'], p['name'], p.get('category'), p.get('is_active')))

# Maintenance personnel (only CREATE)
with open(BATCH_E / "maintenance_personnel.json", "r", encoding="utf-8") as f:
    maint = json.load(f)
print()
print("=== MAINTENANCE PERSONNEL (all) ===")
for r in maint:
    code = r.get('maintenance_person_code', '?')
    op_code = r.get('operational_person_code')
    jt = r.get('job_title_code')
    person_linked = r.get('employee_name_reference')
    status = r.get('mapping_status', '')
    print("  %s: op=%s, jt=%s, person_ref=%s, status=%s" % (code, op_code, jt, person_linked, status))

# Machine responsibilities
with open(BATCH_E / "machine_responsibilities.json", "r", encoding="utf-8") as f:
    mr = json.load(f)
print()
print("=== MACHINE RESPONSIBILITIES (all) ===")
for r in mr:
    print("  %s: branch=%s, scope=%s, machine=%s, dept=%s, line=%s, mnt=%s, role=%s, primary=%s" % (
        r['code'], r.get('branch_code'), r.get('scope_type'),
        r.get('machine_code'), r.get('department_code'), r.get('production_line_code'),
        r.get('maintenance_personnel_code'), r.get('responsibility_role'), r.get('is_primary')))

# Also check assignments.json
with open(BATCH_E / "assignments.json", "r", encoding="utf-8") as f:
    assigns = json.load(f)
print()
print("=== ASSIGNMENTS (sample) ===")
for a in assigns[:3]:
    print("  keys=%s" % list(a.keys()))
    print("  sample=%s" % {k: a.get(k) for k in ['person_code','department_code','administration_code','job_title_code','branch_code','assignment_type','effective_from','effective_to']})
    break
