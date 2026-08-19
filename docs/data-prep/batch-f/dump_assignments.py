#!/usr/bin/env python3
"""Check assignments.json personnel_code field."""
import json, sys
from pathlib import Path

BATCH_E = Path(__file__).resolve().parent.parent / "batch-e"
sys.stdout.reconfigure(encoding='utf-8')

with open(BATCH_E / "assignments.json", "r", encoding="utf-8") as f:
    assigns = json.load(f)

print("=== ALL ASSIGNMENTS ===")
for a in assigns:
    print("  person=%s, dept=%s, admin=%s, job=%s, branch=%s, type=%s, from=%s" % (
        a.get('personnel_code'), a.get('department_code'), a.get('administration_code'),
        a.get('job_title_code'), a.get('branch_code'), a.get('assignment_type'),
        a.get('effective_from')))
