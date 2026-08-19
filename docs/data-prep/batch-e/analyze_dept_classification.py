#!/usr/bin/env python3
"""
Department Classification Analysis
Reads core_sheets_data.json, extracts all 152 departments from sheet 06_الأقسام,
groups them by branch and administration, identifies parent-child relationships,
assigns classifications, and saves the analysis to dept_classification_analysis.json.
"""

import json
import sys
import io
from collections import defaultdict

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

INPUT_PATH = r"C:\Users\attef\PycharmProjects\Trae\ATsofterp\docs\data-prep\batch-e\core_sheets_data.json"
OUTPUT_PATH = r"C:\Users\attef\PycharmProjects\Trae\ATsofterp\docs\data-prep\batch-e\dept_classification_analysis.json"


def main():
    with open(INPUT_PATH, "r", encoding="utf-8") as f:
        data = json.load(f)

    departments = data["06_الأقسام"]["rows"]
    administrations = {a["code"]: a for a in data["05_الإدارات"]["rows"]}

    print(f"Total departments loaded: {len(departments)}")

    # Build records with classification
    records = []
    code_set = {d["code"] for d in departments}

    for dept in departments:
        src_classification = dept.get("classification", "OPERATIONAL")
        parent_code = dept.get("parent_code")

        # Derive classification:
        # 1. If parent_code is set => SECTION (child of a parent department)
        # 2. If classification == "PROCESS" in source => PROCESS (parent group)
        # 3. Otherwise => OPERATIONAL (standalone)
        if parent_code and parent_code in code_set:
            classification = "SECTION"
        elif src_classification == "PROCESS":
            classification = "PROCESS"
        else:
            classification = "OPERATIONAL"

        records.append({
            "code": dept["code"],
            "name": dept["name"],
            "branch_code": dept["branch_code"],
            "administration_code": dept["administration_code"],
            "parent_code": parent_code,
            "classification": classification,
            "src_classification": src_classification,
            "mapping_status": dept.get("mapping_status"),
            "status": dept.get("status"),
        })

    # Classification summary
    classification_summary = defaultdict(int)
    for r in records:
        classification_summary[r["classification"]] += 1

    # Group by branch
    by_branch = defaultdict(lambda: {"count": 0, "administrations": defaultdict(int)})
    for r in records:
        by_branch[r["branch_code"]]["count"] += 1
        by_branch[r["branch_code"]]["administrations"][r["administration_code"]] += 1

    # Group by administration
    by_administration = defaultdict(lambda: {
        "branch_code": None,
        "admin_name": None,
        "count": 0,
        "classifications": defaultdict(int),
        "departments": [],
    })
    for r in records:
        adm = by_administration[r["administration_code"]]
        adm["branch_code"] = r["branch_code"]
        adm["admin_name"] = administrations.get(r["administration_code"], {}).get("name", "UNKNOWN")
        adm["count"] += 1
        adm["classifications"][r["classification"]] += 1
        adm["departments"].append(r["code"])

    # Parent-child map
    parent_child_map = defaultdict(list)
    for r in records:
        if r["parent_code"] and r["parent_code"] in code_set:
            parent_child_map[r["parent_code"]].append(r["code"])

    # Convert defaultdicts for JSON serialization
    by_branch_serializable = {}
    for branch_code, info in sorted(by_branch.items()):
        by_branch_serializable[branch_code] = {
            "count": info["count"],
            "administrations": dict(sorted(info["administrations"].items())),
        }

    by_admin_serializable = {}
    for adm_code, info in sorted(by_administration.items()):
        by_admin_serializable[adm_code] = {
            "branch_code": info["branch_code"],
            "admin_name": info["admin_name"],
            "count": info["count"],
            "classifications": dict(info["classifications"]),
            "departments": info["departments"],
        }

    output = {
        "total_departments": len(records),
        "classification_summary": dict(classification_summary),
        "by_branch": by_branch_serializable,
        "by_administration": by_admin_serializable,
        "parent_child_map": dict(parent_child_map),
        "records": records,
    }

    with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False, indent=2)

    print(f"Analysis saved to: {OUTPUT_PATH}")
    print()

    # Print summary table
    print("=" * 80)
    print(f"{'DEPARTMENT CLASSIFICATION ANALYSIS':^80}")
    print("=" * 80)
    print()

    print(f"Total Departments: {len(records)}")
    print()
    print("Classification Summary:")
    print(f"  {'PROCESS':<15} {classification_summary.get('PROCESS', 0):>5}")
    print(f"  {'SECTION':<15} {classification_summary.get('SECTION', 0):>5}")
    print(f"  {'OPERATIONAL':<15} {classification_summary.get('OPERATIONAL', 0):>5}")
    print()

    print("By Branch:")
    print(f"  {'Branch':<10} {'Depts':>6} {'Administrations'}")
    print(f"  {'-'*10} {'-'*6} {'-'*40}")
    for branch_code in sorted(by_branch_serializable.keys()):
        info = by_branch_serializable[branch_code]
        admin_count = len(info["administrations"])
        print(f"  {branch_code:<10} {info['count']:>6} {admin_count:>5} administrations")
    print()

    print("By Administration:")
    print(f"  {'Admin Code':<18} {'Admin Name':<25} {'Count':>5} {'PROCESS':>8} {'SECTION':>8} {'OPR':>5}")
    print(f"  {'-'*18} {'-'*25} {'-'*5} {'-'*8} {'-'*8} {'-'*5}")
    for adm_code in sorted(by_admin_serializable.keys()):
        info = by_admin_serializable[adm_code]
        cls = info["classifications"]
        print(f"  {adm_code:<18} {info['admin_name']:<25} {info['count']:>5} "
              f"{cls.get('PROCESS', 0):>8} {cls.get('SECTION', 0):>8} {cls.get('OPERATIONAL', 0):>5}")
    print()

    if parent_child_map:
        print("Parent-Child Relationships:")
        for parent, children in sorted(parent_child_map.items()):
            parent_rec = next((r for r in records if r["code"] == parent), None)
            parent_name = parent_rec["name"] if parent_rec else "UNKNOWN"
            print(f"  {parent} ({parent_name})")
            for child in children:
                child_rec = next((r for r in records if r["code"] == child), None)
                child_name = child_rec["name"] if child_rec else "UNKNOWN"
                print(f"    -> {child} ({child_name})")
        print()

    # Show all PROCESS departments
    process_depts = [r for r in records if r["classification"] == "PROCESS"]
    if process_depts:
        print("PROCESS Departments (parent groups):")
        for r in process_depts:
            children = parent_child_map.get(r["code"], [])
            print(f"  {r['code']:<25} {r['name']:<30} {r['branch_code']:<8} {r['administration_code']:<18} children={len(children)}")
        print()

    # Show all SECTION departments
    section_depts = [r for r in records if r["classification"] == "SECTION"]
    if section_depts:
        print("SECTION Departments (children under parent):")
        for r in section_depts:
            print(f"  {r['code']:<25} {r['name']:<30} parent={r['parent_code']}")
        print()

    print("Done.")


if __name__ == "__main__":
    main()
