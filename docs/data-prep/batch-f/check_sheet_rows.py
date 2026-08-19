#!/usr/bin/env python3
"""Get first admin and dept row with all fields."""
import json, sys
from pathlib import Path

BATCH_E = Path(__file__).resolve().parent.parent / "batch-e"
sys.stdout.reconfigure(encoding='utf-8')

with open(BATCH_E / "core_sheets_data.json", "r", encoding="utf-8") as f:
    sheets = json.load(f)

# Admin sheet
admin_sheet = sheets.get("05_الإدارات", {})
print("=== ADMIN SHEET STRUCTURE ===")
print("  keys: %s" % list(admin_sheet.keys()))
if 'rows' in admin_sheet and len(admin_sheet['rows']) > 0:
    row = admin_sheet['rows'][0]
    print("  first row: %s" % row)

# Dept sheet
dept_sheet = sheets.get("06_الأقسام", {})
print()
print("=== DEPT SHEET STRUCTURE ===")
print("  keys: %s" % list(dept_sheet.keys()))
if 'rows' in dept_sheet and len(dept_sheet['rows']) > 0:
    row = dept_sheet['rows'][0]
    print("  first row: %s" % row)

# Branch sheet
branch_sheet = sheets.get("04_الفروع", {})
print()
print("=== BRANCH SHEET STRUCTURE ===")
print("  keys: %s" % list(branch_sheet.keys()))
if 'rows' in branch_sheet and len(branch_sheet['rows']) > 0:
    row = branch_sheet['rows'][0]
    print("  first row: %s" % row)

# Company sheet
company_sheet = sheets.get("03_الشركات", {})
print()
print("=== COMPANY SHEET STRUCTURE ===")
print("  keys: %s" % list(company_sheet.keys()))
if 'rows' in company_sheet and len(company_sheet['rows']) > 0:
    row = company_sheet['rows'][0]
    print("  first row: %s" % row)

# Persons sheet
persons_sheet = sheets.get("37_الأشخاص_التشغيليون", {})
print()
print("=== PERSONS SHEET STRUCTURE ===")
print("  keys: %s" % list(persons_sheet.keys()))
if 'rows' in persons_sheet and len(persons_sheet['rows']) > 0:
    row = persons_sheet['rows'][0]
    print("  first row: %s" % row)

# Maintenance sheet
mnt_sheet = sheets.get("24_كادر_الصيانة", {})
print()
print("=== MAINTENANCE SHEET STRUCTURE ===")
print("  keys: %s" % list(mnt_sheet.keys()))
if 'rows' in mnt_sheet and len(mnt_sheet['rows']) > 0:
    row = mnt_sheet['rows'][0]
    print("  first row: %s" % row)
