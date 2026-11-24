# Phase 2 Closeout Gates

Generated: 2026-11-23T23:29:27.900Z

Overall: PASS=126 FAIL=0

## Tenant Isolation

PASS=23 FAIL=0

- PASS: C2 read C1 KPI by id denied
- PASS: C2 preview C1 employee denied
- PASS: C1 preview C2 employee denied
- PASS: body companyId spoof rejected
- PASS: body branchId spoof rejected
- PASS: create KPI body companyId spoof rejected
- PASS: create KPI body branchId spoof rejected
- PASS: C1 KPI list scoped to C1 company
- PASS: C2 KPI list scoped to C2 company
- PASS: C1 coverage has no C2-only KPI IDs
- PASS: C2 coverage has no C1-only KPI IDs
- PASS: C1 preview evidence rows are C1-owned in DB
- PASS: no GET evidence-by-id preview surface
- PASS: no direct evidence-ID endpoint in performance module; evidence only returned via tenant-scoped preview
- PASS: evidence executionId is C1-owned or absent
- PASS: evidence executionId is C1-owned or absent
- PASS: evidence executionId is C1-owned or absent
- PASS: evidence executionId is C1-owned or absent
- PASS: evidence executionId is C1-owned or absent
- PASS: C2 prod evidence run is C2-owned
- PASS: foreign MachineResponsibilityAssignment not addressable by preview API; C2 preview of C1 person denied
- PASS: foreign target/production-standard source not accepted by preview DTO (no target/standard ID fields)
- PASS: C2 probing C1 evidence via preview denied

## Evidence Traceability

PASS=76 FAIL=0

- PASS: trace response has status
- PASS: trace has rawValue
- PASS: trace has dataQuality.issues
- PASS: trace has explanation
- PASS: trace has evidenceCount
- PASS: trace has excluded.count
- PASS: trace has excluded.reasons
- PASS: evidence has sourceType/sourceId/occurredAt
- PASS: evidence has contribution
- PASS: evidence has sourceType/sourceId/occurredAt
- PASS: evidence has contribution
- PASS: evidence has sourceType/sourceId/occurredAt
- PASS: evidence has contribution
- PASS: evidence has sourceType/sourceId/occurredAt
- PASS: evidence has contribution
- PASS: evidence has sourceType/sourceId/occurredAt
- PASS: evidence has contribution
- PASS: trace response has status
- PASS: trace has rawValue
- PASS: trace has dataQuality.issues
- PASS: trace has explanation
- PASS: trace has evidenceCount
- PASS: trace has excluded.count
- PASS: trace has excluded.reasons
- PASS: evidence has sourceType/sourceId/occurredAt
- PASS: evidence has contribution
- PASS: evidence has sourceType/sourceId/occurredAt
- PASS: evidence has contribution
- PASS: evidence has sourceType/sourceId/occurredAt
- PASS: evidence has contribution
- PASS: evidence has sourceType/sourceId/occurredAt
- PASS: evidence has contribution
- PASS: evidence has sourceType/sourceId/occurredAt
- PASS: evidence has contribution
- PASS: trace response has status
- PASS: trace has rawValue
- PASS: trace has dataQuality.issues
- PASS: trace has explanation
- PASS: trace has evidenceCount
- PASS: trace has excluded.count
- PASS: trace has excluded.reasons
- PASS: evidence has sourceType/sourceId/occurredAt
- PASS: evidence has contribution
- PASS: evidence has sourceType/sourceId/occurredAt
- PASS: evidence has contribution
- PASS: evidence has sourceType/sourceId/occurredAt
- PASS: evidence has contribution
- PASS: evidence has sourceType/sourceId/occurredAt
- PASS: evidence has contribution
- PASS: evidence has sourceType/sourceId/occurredAt
- PASS: evidence has contribution
- PASS: trace response has status
- PASS: trace has rawValue
- PASS: trace has dataQuality.issues
- PASS: trace has explanation
- PASS: trace has evidenceCount
- PASS: trace has excluded.count
- PASS: trace has excluded.reasons
- PASS: evidence has sourceType/sourceId/occurredAt
- PASS: evidence has contribution
- PASS: trace response has status
- PASS: trace has rawValue
- PASS: trace has dataQuality.issues
- PASS: trace has explanation
- PASS: trace has evidenceCount
- PASS: trace has excluded.count
- PASS: trace has excluded.reasons
- PASS: evidence has sourceType/sourceId/occurredAt
- PASS: evidence has contribution
- PASS: maint response has multi-technician evidence
- PASS: multi-tech has rawResponseMinutes
- PASS: multi-tech has attributed responseMinutes
- PASS: multi-tech technicianCount>1
- PASS: maint repair has multi-technician evidence
- PASS: multi-tech repair has rawRepairMinutes
- PASS: multi-tech repair has attributed repairMinutes

## Coverage Reconciliation

PASS=24 FAIL=0

- PASS: coverage items array
- PASS: coverage bucket sum == eligible sampled C1 MAINT_REPAIR_TIME_AVG
- PASS: coverage bucket sum == eligible sampled C1 MAINT_RESPONSE_TIME_AVG
- PASS: coverage bucket sum == eligible sampled C1 P2_TEST_RT_AVG
- PASS: coverage bucket sum == eligible sampled C1 MAINT_REPEAT_FAILURE_RATE
- PASS: coverage bucket sum == eligible sampled C1 PROD_AVAILABILITY
- PASS: coverage bucket sum == eligible sampled C1 PROD_OEE
- PASS: coverage bucket sum == eligible sampled C1 PROD_PERFORMANCE
- PASS: coverage bucket sum == eligible sampled C1 PROD_QUALITY
- PASS: coverage bucket sum == eligible sampled C1 PROD_GOOD_OUTPUT
- PASS: coverage bucket sum == eligible sampled C1 PROD_OUTPUT_TOTAL
- PASS: coverage bucket sum == eligible sampled C1 PROD_REJECT_RATE
- PASS: coverage bucket sum == eligible sampled C1 PROD_WASTE_RATE
- PASS: coverage items array
- PASS: coverage bucket sum == eligible sampled C2 PROD_AVAILABILITY
- PASS: coverage bucket sum == eligible sampled C2 PROD_OEE
- PASS: coverage bucket sum == eligible sampled C2 PROD_PERFORMANCE
- PASS: coverage bucket sum == eligible sampled C2 PROD_QUALITY
- PASS: coverage bucket sum == eligible sampled C2 PROD_GOOD_OUTPUT
- PASS: coverage bucket sum == eligible sampled C2 PROD_OUTPUT_TOTAL
- PASS: coverage bucket sum == eligible sampled C2 PROD_REJECT_RATE
- PASS: coverage bucket sum == eligible sampled C2 PROD_WASTE_RATE
- PASS: C2 PROD_OEE calculable>=1 in window
- PASS: C1 MAINT_RESPONSE_TIME_AVG calculable>=1

## No-Score Guard

PASS=3 FAIL=0

- PASS: KPI create rejects weight
- PASS: KPI create rejects score/ranking/grade/bonus/penalty
- PASS: eligibility rejects weight/score
