#!/usr/bin/env python3
"""Dump manifest record field names and sample values."""
import json, sys
from pathlib import Path

MANIFEST = Path(__file__).resolve().parent.parent / "batch-e" / "batch-e-import-manifest.json"
with open(MANIFEST, "r", encoding="utf-8") as f:
    m = json.load(f)

sys.stdout.reconfigure(encoding='utf-8')

for etype in ['Company','Branch','Administration','Department','JobTitle','OperationalPerson','OperationalPersonAssignment','MaintenancePersonnel','MachineResponsibilityAssignment']:
    recs = m['entities'][etype]['records']
    create_recs = [r for r in recs if r.get('action')=='CREATE']
    reuse_recs = [r for r in recs if r.get('action')=='REUSE_EXISTING']
    skip_recs = [r for r in recs if r.get('action')=='SKIP']
    samples = create_recs[:1] or reuse_recs[:1] or skip_recs[:1]
    if samples:
        r = samples[0]
        print("=== %s (%d records: %d CREATE, %d REUSE, %d SKIP) ===" % (etype, len(recs), len(create_recs), len(reuse_recs), len(skip_recs)))
        for k, v in r.items():
            val = repr(v)
            if len(val) > 100:
                val = val[:100] + "..."
            print("  %s: %s" % (k, val))
        print()
