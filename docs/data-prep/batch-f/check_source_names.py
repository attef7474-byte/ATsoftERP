#!/usr/bin/env python3
"""Check what fields are in the source data files for names."""
import json, sys
from pathlib import Path

BATCH_E = Path(__file__).resolve().parent.parent / "batch-e"
sys.stdout.reconfigure(encoding='utf-8')

# Check core sheets for name columns
with open(BATCH_E / "core_sheets_data.json", "r", encoding="utf-8") as f:
    sheets = json.load(f)

print("=== CORE SHEETS ===")
for name, data in sheets.items():
    if isinstance(data, list) and len(data) > 0:
        first = data[0]
        if isinstance(first, dict):
            print("  %s: %d rows, cols=%s" % (name, len(data), list(first.keys())[:8]))
    else:
        print("  %s: %s" % (name, type(data).__name__))

# Check persons.json for names
with open(BATCH_E / "persons.json", "r", encoding="utf-8") as f:
    persons = json.load(f)
print()
print("=== PERSONS (sample) ===")
for p in persons[:3]:
    print("  keys=%s" % list(p.keys()))
    print("  sample=%s" % {k: v for k, v in p.items() if k in ['code', 'name', 'nameAr', 'nameEn', 'role', 'specialty']})
    break

# Check maintenance_personnel.json
with open(BATCH_E / "maintenance_personnel.json", "r", encoding="utf-8") as f:
    maint = json.load(f)
print()
print("=== MAINTENANCE PERSONNEL (sample) ===")
for p in maint[:3]:
    print("  keys=%s" % list(p.keys()))
    print("  sample=%s" % {k: v for k, v in p.items() if k in ['code', 'name', 'role', 'specialty', 'personLinked']})
    break

# Check machine_responsibilities.json
with open(BATCH_E / "machine_responsibilities.json", "r", encoding="utf-8") as f:
    mr = json.load(f)
print()
print("=== MACHINE RESPONSIBILITIES (sample) ===")
for r in mr[:3]:
    print("  keys=%s" % list(r.keys()))
    break

# Check job_titles.json
with open(BATCH_E / "job_titles.json", "r", encoding="utf-8") as f:
    jt = json.load(f)
print()
print("=== JOB TITLES (sample) ===")
for t in jt[:3]:
    print("  keys=%s" % list(t.keys()))
    print("  sample=%s" % {k: v for k, v in t.items() if k in ['code', 'name', 'nameAr', 'nameEn', 'category']})
    break

# Check dept_classification_analysis.json for dept names
with open(BATCH_E / "dept_classification_analysis.json", "r", encoding="utf-8") as f:
    dca = json.load(f)
print()
print("=== DEPT CLASSIFICATION ANALYSIS (type) ===")
print("  type=%s" % type(dca).__name__)
if isinstance(dca, dict):
    print("  keys=%s" % list(dca.keys())[:10])
elif isinstance(dca, list) and len(dca) > 0:
    print("  len=%d, sample keys=%s" % (len(dca), list(dca[0].keys())[:10]))
