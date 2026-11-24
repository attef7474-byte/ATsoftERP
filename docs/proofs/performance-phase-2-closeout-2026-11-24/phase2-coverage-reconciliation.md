# Phase 2 KPI Coverage Reconciliation

Generated: 2026-11-24T00:00:00Z

Source: phase2-closeout-gates.json

## Bucket-sum check

| Scope | KPI | eligible | calc | insuff | notApp | ambig | srcUnav | cfgMiss | sum==eligible |
|---|---|---:|---:|---:|---:|---:|---:|---:|---|
| C1 | MAINT_REPAIR_TIME_AVG | 13 | 2 | 8 | 0 | 3 | 0 | 0 | True |
| C1 | MAINT_RESPONSE_TIME_AVG | 13 | 2 | 8 | 0 | 3 | 0 | 0 | True |
| C1 | P2_TEST_RT_AVG | 13 | 0 | 0 | 0 | 0 | 13 | 0 | True |
| C1 | MAINT_REPEAT_FAILURE_RATE | 13 | 1 | 2 | 10 | 0 | 0 | 0 | True |
| C1 | PROD_AVAILABILITY | 1 | 0 | 1 | 0 | 0 | 0 | 0 | True |
| C1 | PROD_OEE | 1 | 0 | 1 | 0 | 0 | 0 | 0 | True |
| C1 | PROD_PERFORMANCE | 1 | 0 | 1 | 0 | 0 | 0 | 0 | True |
| C1 | PROD_QUALITY | 1 | 0 | 1 | 0 | 0 | 0 | 0 | True |
| C1 | PROD_GOOD_OUTPUT | 1 | 0 | 1 | 0 | 0 | 0 | 0 | True |
| C1 | PROD_OUTPUT_TOTAL | 1 | 0 | 1 | 0 | 0 | 0 | 0 | True |
| C1 | PROD_REJECT_RATE | 1 | 0 | 1 | 0 | 0 | 0 | 0 | True |
| C1 | PROD_WASTE_RATE | 1 | 0 | 1 | 0 | 0 | 0 | 0 | True |
| C2 | PROD_AVAILABILITY | 1 | 1 | 0 | 0 | 0 | 0 | 0 | True |
| C2 | PROD_OEE | 1 | 1 | 0 | 0 | 0 | 0 | 0 | True |
| C2 | PROD_PERFORMANCE | 1 | 1 | 0 | 0 | 0 | 0 | 0 | True |
| C2 | PROD_QUALITY | 1 | 1 | 0 | 0 | 0 | 0 | 0 | True |
| C2 | PROD_GOOD_OUTPUT | 1 | 1 | 0 | 0 | 0 | 0 | 0 | True |
| C2 | PROD_OUTPUT_TOTAL | 1 | 1 | 0 | 0 | 0 | 0 | 0 | True |
| C2 | PROD_REJECT_RATE | 1 | 1 | 0 | 0 | 0 | 0 | 0 | True |
| C2 | PROD_WASTE_RATE | 1 | 1 | 0 | 0 | 0 | 0 | 0 | True |

## Controlled expectations
- C1 MAINT_RESPONSE_TIME_AVG calculable>=1 PASS
- C2 PROD_OEE calculable>=1 PASS

## Gaps
- Full expected==API counts per controlled fixture/status bucket not completed on fresh clean fixture set.
- Pagination/filter behavior (profile/KPI/status/company/branch scope/page/limit) not proven.

`	ext
KPI_COVERAGE_RUNTIME=PASS (endpoint/buckets observed)
KPI_COVERAGE_RECONCILIATION=PARTIAL
PAGINATION_COUNTS=NOT_VERIFIED
`