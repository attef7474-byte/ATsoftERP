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


## Final Closeout Addendum (2026-11-24)
- `ROUTE_FIX_PERSISTED_IN_REMOTE=YES` (feature branch merged to main; `/production/operational-people` used).
- `PRISMA_FORMAT_DETERMINISTIC=PASS`.
- `FULL API SUITE PASS` (277 suites, 5415 tests, 0 failed).
- `FULL WEB SUITE PASS` (140 suites, 2608 tests, 0 failed).
- `KPI_COVERAGE_RECONCILIATION=PASS` for controlled fixture set; `PAGINATION_COUNTS=NOT_SUPPORTED_BY_CURRENT_CONTRACT` (supported filters PASS).
- `PRODUCTION_BACKUP=PASS`, `PRODUCTION_PHASE2_MIGRATION=PASS`, data integrity counts unchanged.
- `DEPLOYED_RUNTIME_CODE_SHA == PERFORMANCE_PHASE_2_MAIN_COMMIT=PASS` (1a74a549).
- `API_HEALTH=PASS`, `WEB_HEALTH=PASS`, `DATABASE_CONNECTIVITY=PASS`, `PROXY_HEALTH=PARTIAL` (Caddy running/443 listening; localhost HTTPS handshake proof from PS5.1 failed; no config change).
- `PRODUCTION_BROWSER_PROOF=PASS` (read-only), `PRODUCTION_OBSOLETE_CORE_OPERATIONAL_PEOPLE_REQUESTS=0`.
- Inspection pitfalls register checks applied: P05, P07, P08, P09, P12, P16, P17 (and route-contract baseline/secret handling awareness). No new register entries added.
