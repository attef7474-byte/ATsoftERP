#!/usr/bin/env python3
"""
Batch F — Build null resolution map for the importer.
Determines how to resolve 14 null departmentCode assignments
and 8 null scopeType machine responsibility assignments.
"""
import json
from pathlib import Path

BATCH_E = Path(__file__).resolve().parent.parent / "batch-e"
MANIFEST = BATCH_E / "batch-e-import-manifest.json"

with open(MANIFEST, "r", encoding="utf-8") as f:
    m = json.load(f)

# Build admin -> departments mapping
depts = m['entities']['Department']['records']
admin_depts = {}
for d in depts:
    if d.get('action') == 'CREATE':
        ac = d.get('administrationCode')
        if ac:
            admin_depts.setdefault(ac, []).append(d['businessKey'])

# For each admin, pick the FIRST department as the "catch-all"
admin_first_dept = {}
for ac, dlist in admin_depts.items():
    admin_first_dept[ac] = sorted(dlist)[0]

print("=== ADMIN -> FIRST DEPARTMENT (catch-all for null deptCode) ===")
for ac in sorted(admin_first_dept):
    print("  %s -> %s" % (ac, admin_first_dept[ac]))

# Resolve null departmentCode assignments
assigns = m['entities']['OperationalPersonAssignment']['records']
print()
print("=== NULL DEPARTMENT RESOLUTION ===")
dept_resolution = {}
for a in assigns:
    if a.get('departmentCode') is None:
        admin = a.get('administrationCode')
        person = a.get('personCode', a['businessKey'])
        if admin and admin in admin_first_dept:
            resolved = admin_first_dept[admin]
            dept_resolution[a['businessKey']] = resolved
            print("  %s: admin=%s -> dept=%s" % (person, admin, resolved))
        else:
            # EMP-0011: no admin, assign to ADM_BR01_01's first dept
            fallback = admin_first_dept.get('ADM_BR01_01', 'DEP_BR01_001')
            dept_resolution[a['businessKey']] = fallback
            print("  %s: NO ADMIN -> fallback dept=%s (ADM_BR01_01)" % (person, fallback))

# Resolve null scopeType machine responsibilities
mras = m['entities']['MachineResponsibilityAssignment']['records']
print()
print("=== NULL SCOPETYPE RESOLUTION ===")
scope_resolution = {}
for r in mras:
    if r.get('scopeType') is None:
        role = r.get('responsibilityRole', '')
        branch = r.get('branchCode', '')
        key = r['businessKey']
        br_num = branch.replace('BR_', '')

        if 'MNT_MANAGER' in key or 'manager' in role.lower():
            # Use maintenance admin's first dept
            maint_admin = 'ADM_BR%s_10' % br_num
            dept = admin_first_dept.get(maint_admin, 'DEP_BR%s_034' % br_num)
            scope_resolution[key] = {'scopeType': 'DEPARTMENT', 'departmentCode': dept}
            print("  %s: MNT_MANAGER -> scope=DEPARTMENT, dept=%s" % (key, dept))
        elif 'STORE' in key or 'store' in role.lower():
            # Use spare parts warehouse dept (ADM_BRXX_06 -> first dept)
            store_admin = 'ADM_BR%s_06' % br_num
            dept = admin_first_dept.get(store_admin, 'DEP_BR%s_020' % br_num)
            scope_resolution[key] = {'scopeType': 'DEPARTMENT', 'departmentCode': dept}
            print("  %s: STORE -> scope=DEPARTMENT, dept=%s" % (key, dept))
        else:
            print("  %s: UNKNOWN ROLE '%s' -> CANNOT RESOLVE" % (key, role))

# Write resolution map
output = {
    'departmentResolution': dept_resolution,
    'scopeResolution': scope_resolution,
    'adminFirstDept': admin_first_dept,
}
out_path = Path(__file__).parent / "null-resolution-map.json"
with open(out_path, "w", encoding="utf-8") as f:
    json.dump(output, f, indent=2, ensure_ascii=False)
print()
print("Resolution map written to: %s" % out_path)
print("  departmentResolution entries: %d" % len(dept_resolution))
print("  scopeResolution entries: %d" % len(scope_resolution))
