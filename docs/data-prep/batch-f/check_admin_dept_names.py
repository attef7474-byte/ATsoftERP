#!/usr/bin/env python3
"""Check core sheets for admin/dept names."""
import json, sys
from pathlib import Path

BATCH_E = Path(__file__).resolve().parent.parent / "batch-e"
sys.stdout.reconfigure(encoding='utf-8')

with open(BATCH_E / "core_sheets_data.json", "r", encoding="utf-8") as f:
    sheets = json.load(f)

# Admin sheet
admin_sheet = sheets.get("05_الإدارات", {})
print("=== ADMINISTRATIONS ===")
print("  type=%s" % type(admin_sheet).__name__)
if isinstance(admin_sheet, dict):
    for k, v in list(admin_sheet.items())[:3]:
        print("  %s: %s" % (k, repr(v)[:120]))
elif isinstance(admin_sheet, list):
    for r in admin_sheet[:2]:
        print("  %s" % {k: v for k, v in r.items() if 'name' in k.lower() or 'code' in k.lower()})

# Department sheet
dept_sheet = sheets.get("06_الأقسام", {})
print()
print("=== DEPARTMENTS ===")
print("  type=%s" % type(dept_sheet).__name__)
if isinstance(dept_sheet, dict):
    for k, v in list(dept_sheet.items())[:3]:
        print("  %s: %s" % (k, repr(v)[:120]))
elif isinstance(dept_sheet, list):
    for r in dept_sheet[:2]:
        print("  %s" % {k: v for k, v in r.items() if 'name' in k.lower() or 'code' in k.lower()})

# Check if there's a names mapping file
import os
for f in os.listdir(BATCH_E):
    if 'name' in f.lower() or 'map' in f.lower():
        print()
        print("Found mapping file: %s" % f)
