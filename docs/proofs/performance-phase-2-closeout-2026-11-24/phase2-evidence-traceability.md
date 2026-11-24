# Phase 2 Evidence Traceability Artifact

Generated: 2026-11-24T00:00:00Z

Source: phase2-closeout-gates.json

## Required fields

| KPI | status | rawValue | evidenceCount | excluded.count | excluded.reasons | dataQuality.issues | explanation |
|---|---|---:|---:|---:|---|---|---|
| maint_response | CALCULABLE | 10.4 | 5 | 2 | {"missingTimestamps": 1, "splitAcrossTechnicians": 1} | [] | 5 eligible downtime events attributed by direct execution session. Average response time = 10.4 minu |
| maint_repair | CALCULABLE | 41.67 | 6 | 1 | {"splitAcrossTechnicians": 1} | [] | 6 eligible downtime events attributed by direct execution session. Average repair time = 41.67 minut |
| maint_repeat | CALCULABLE | 0 | 6 | 2 | {"outsideResponsibilityWindow": 2} | [] | 0 repeat-failure events out of 6 eligible responsible-asset downtime events. Repeat failure rate = 0 |
| prod_oee | CALCULABLE | 85.5 | 1 | 0 | {} | [] | OEE calculated from 1 attributed production runs using canonical production analytics formula. Raw v |
| prod_output | CALCULABLE | 180 | 1 | 0 | {} | [] | Total output summed across 1 attributed production runs. Raw value = 180. |

## Evidence item fields

Representative evidence includes sourceType, sourceId, occurredAt, contribution, context. sourceNumber is not exposed by Phase 2 preview evidence contract; sourceId is authoritative.

SOURCE_NUMBER_NOT_AVAILABLE_BY_SOURCE_MODEL

## Multi-technician

- maint_response: {"responseMinutes": 10, "rawResponseMinutes": 20, "technicianCount": 2}
- maint_repair: {"repairMinutes": 20, "rawRepairMinutes": 40, "technicianCount": 2}

`	ext
EVIDENCE_TRACEABILITY=PASS
`
