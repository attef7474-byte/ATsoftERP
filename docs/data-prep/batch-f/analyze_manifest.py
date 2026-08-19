#!/usr/bin/env python3
"""Quick manifest analysis for import planning."""
import json
from pathlib import Path

MANIFEST = Path(__file__).resolve().parent.parent / "batch-e" / "batch-e-import-manifest.json"
with open(MANIFEST, "r", encoding="utf-8") as f:
    m = json.load(f)

# Administrations by branch
admins = m['entities']['Administration']['records']
print("=== ADMINISTRATIONS BY BRANCH ===")
admin_by_branch = {}
for a in admins:
    if a.get('action') == 'CREATE':
        br = a.get('branchCode', '?')
        admin_by_branch.setdefault(br, []).append(a)
        print("  %s: branch=%s, name=%s" % (a['businessKey'], br, a.get('nameAr', '')[:50]))

print()
print("=== DEPARTMENTS: adminCode distribution ===")
depts = m['entities']['Department']['records']
dept_by_admin = {}
for d in depts:
    if d.get('action') == 'CREATE':
        ac = d.get('administrationCode')
        dept_by_admin.setdefault(ac, []).append(d)

for ac, dlist in sorted(dept_by_admin.items()):
    print("  %s: %d departments" % (ac, len(dlist)))
    for dd in dlist[:3]:
        print("    %s: class=%s, name=%s" % (dd['businessKey'], dd.get('classification'), dd.get('nameAr', '')[:40]))
    if len(dlist) > 3:
        print("    ... and %d more" % (len(dlist) - 3))

print()
print("=== NULL DEPTCODE ASSIGNMENTS ===")
assigns = m['entities']['OperationalPersonAssignment']['records']
for a in assigns:
    if a.get('departmentCode') is None:
        print("  %s: person=%s, admin=%s, role=%s, branch=%s" % (
            a['businessKey'], a.get('personCode'), a.get('administrationCode'),
            a.get('roleKey'), a.get('branchCode')))

print()
print("=== NULL SCOPETYPE MACHINE RESPONSIBILITIES ===")
mras = m['entities']['MachineResponsibilityAssignment']['records']
for r in mras:
    if r.get('scopeType') is None:
        print("  %s: role=%s, branch=%s, machine=%s" % (
            r['businessKey'], r.get('responsibilityRole', ''), r.get('branchCode'), r.get('machineCode')))

print()
print("=== BRANCHES ===")
branches = m['entities']['Branch']['records']
for b in branches:
    print("  %s: action=%s, name=%s" % (b['businessKey'], b['action'], b.get('nameAr', '')[:50]))
