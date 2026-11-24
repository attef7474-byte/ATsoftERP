# Phase 2 Coverage Reconciliation

## Scope
Controlled-fixture reconciliation on fresh disposable clone `ATsoftERP_P2BROWSER_20261124B` (COPY_ONLY backup of `ATsoftERP_DB`, Phase 2 migration applied once with `sqlcmd -I`). Coverage endpoint: `GET /api/v1/performance/kpis/coverage`.

## Controlled fixtures (company cmrvaph2200009g95oj1o8m1j)
- Profile: `p2c_prof1` (P2CLOSE_PROF, MAINTENANCE, ACTIVE), JOB_TITLE mapping to `p2c_jt1`.
- Eligible KPI with handler: `MAINT_RESPONSE_TIME_AVG` (`p2c_kpi_rt`, ACTIVE).
- Eligible KPI with handler but no applicable maintenance personnel: `MAINT_REPEAT_FAILURE_RATE` (`p2c_kpi_rfr`, ACTIVE) -> NOT_APPLICABLE.
- Eligible KPI with no registered handler: `P2C_NO_HANDLER_KPI` (`p2c_kpi_nosrc`, ACTIVE) -> SOURCE_UNAVAILABLE.
- Employees (all mapped to profile via same job title): `p2c_emp_calc` (calculable via direct execution session + downtime response timestamps), `p2c_emp_ins` (insufficient data / no attributed events), `p2c_emp_amb` (attribution ambiguous / missing user link).

## Filtered reconciliation (kpiCode=MAINT_RESPONSE_TIME_AVG, dateFrom=2026-11-01, dateTo=2026-11-23)
Expected buckets: CALCULABLE=1, INSUFFICIENT_DATA=1, NOT_APPLICABLE=0, ATTRIBUTION_AMBIGUOUS=1, SOURCE_UNAVAILABLE=0, CONFIGURATION_MISSING=0. EligibleEmployeesSampled=3.
API result: same as expected. `SUM_BUCKETS == eligibleEmployeesSampled` (3==3). **PASS**.

## Profile-filtered reconciliation (performanceProfileId=p2c_prof1, same period)
- MAINT_REPEAT_FAILURE_RATE: CALCULABLE=0, INSUFFICIENT=0, NOT_APPLICABLE=3, AMBIGUOUS=0, SOURCE_UNAVAILABLE=0, CONFIG_MISSING=0, sampled=3, sum==3. **PASS** (not applicable by personnel/attribution contract).
- MAINT_RESPONSE_TIME_AVG: 1/1/0/1/0/0, sampled=3, sum==3. **PASS**.
- P2C_NO_HANDLER_KPI: CALCULABLE=0, INSUFFICIENT=0, NOT_APPLICABLE=0, AMBIGUOUS=0, SOURCE_UNAVAILABLE=3, CONFIG_MISSING=0, sampled=3, sum==3. **PASS**.

## Supported filters runtime proof
`dateFrom,dateTo,kpiCode,performanceProfileId` - PASS (observed in filtered responses).

## Not supported by current contract
`page,limit,status` - **NOT_SUPPORTED_BY_CURRENT_CONTRACT**. Coverage service contract accepts dateFrom/dateTo/kpiCode/performanceProfileId; no pagination/status filter parameters are implemented. Not fabricated.

## CONFIGURATION_MISSING
Structurally 0 in current active-KPI-only coverage contract for active/eligible KPI definitions with registered handlers; represented by SOURCE_UNAVAILABLE when no handler is registered. No missing config was fabricated; contract behavior documented.

## Status
`KPI_COVERAGE_RECONCILIATION=PASS` for controlled fixture set. `PAGINATION_COUNTS=NOT_SUPPORTED_BY_CURRENT_CONTRACT` (sum/bucket reconciliation PASS where applicable).
