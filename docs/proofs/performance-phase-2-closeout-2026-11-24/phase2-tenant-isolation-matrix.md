# Phase 2 Formal Tenant-Isolation Matrix

Generated: 2026-11-23T23:42:01.732Z

Source evidence: phase2-closeout-gates.json (PASS=126 FAIL=0 scripted), code inspection of Phase 2 DTOs/controllers/services.

| Case | Result | Evidence | Code/Design note |
|---|---|---|---|
| foreign KPI definition | PASS | C2 GET /performance/kpis/{c1KpiId} => 404; C1/C2 list companyId scoped | KpisService scopes by ctx.companyId; CurrentActiveContext authoritative |
| foreign employee preview | PASS | C2 preview C1 employee => 404; C1 preview C2 employee => 404 | PreviewPerformanceKpiDto: operationalPersonId,kpiCode,dateFrom,dateTo,evidenceLimit only |
| foreign evidence source ID | PASS | C1 preview evidence sourceIds verified C1-owned in downtime_logs.companyId; no GET evidence-by-id endpoint (404/405) | POST /performance/kpis/preview only; no evidence-id lookup endpoint |
| foreign MachineResponsibilityAssignment | PASS / N/A_BY_DESIGN for direct ID probing | No DTO/controller accepts responsibility assignment ID; C2 preview C1 person denied | DTO has no responsibility assignment field |
| foreign ProductionRun | PASS | C2 PROD_OEE preview evidence run IDs verified C2-owned in production_runs.companyId | Service scopes production runs by ctx.companyId and attributed person |
| foreign MaintenanceRequest | PASS | Evidence requestId ownership checked against maintenance_requests.companyId = C1 | Evidence context from tenant-scoped query |
| foreign MaintenanceTask/execution evidence | PASS | Evidence executionId ownership checked against maintenance_tasks.companyId = C1 | Evidence context from tenant-scoped query |
| foreign production target/standard | N/A_BY_DESIGN | Preview DTO has no target/standard ID fields | DTO fields: operationalPersonId,kpiCode,dateFrom,dateTo,evidenceLimit |
| companyId body spoof | PASS | POST preview with companyId=C2 => 403; POST create KPI with companyId=C2 => 400/403 | DTO validation/tenant guard rejects cross-context body tenant fields |
| branchId body spoof | PASS | POST preview with branchId=C2 => 400/403; POST create KPI with branchId=C2 => 400/403 | Branch from active context, not body |
| C2 actor probing C1 evidence IDs | PASS | C2 preview of C1 person denied; no evidence-by-id endpoint exists; GET preview => 404/405 | Evidence only accessible through tenant-scoped preview response |
| KPI list tenant isolation | PASS | C1 list companyIds={C1 only}; C2 list companyIds={C2 only} | KpisService.findAll scoped by ctx.companyId |
| coverage tenant isolation | PASS | C1 coverage has no C2-only KPI IDs; C2 has no C1-only KPI IDs | Coverage service queries by ctx.companyId/branchId |
| search/filter tenant leakage | PASS (covered by list/coverage scoping) | List/coverage use companyId filter; no unscoped Phase 2 search path | All Phase 2 list/coverage queries scoped by ctx.companyId |

## Verdict

`	ext
RUNTIME_TENANT_ISOLATION=PASS
CROSS_TENANT_EVIDENCE_LEAKS=0
BODY_TENANT_OVERRIDE_BYPASS=0
`

Notes: N/A_BY_DESIGN cases have no corresponding API surface/DTO field; code evidence cited. Runtime negative probes executed on disposable clone.