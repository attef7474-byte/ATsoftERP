# Phase 4 Discovery — Proactive Reliability Monitoring & Spare-Part Life Alerts

Date: 2026-11-20  
Repository: ATsofterp  
Scope: read-only discovery before any Phase 4 source change. Baseline `main` @ `71c73f8b6946e92b80af34b652ef13f4889457e3`, clean tree, ahead/behind `0/0`.

## PHASE 4 DISCOVERY

| Capability | Classification | Evidence / decision |
|---|---|---|
| 1. Alert generation authority | **EXISTS — REUSE** | `apps/api/src/modules/factory/maintenance/maintenance-reliability/reliability-alert-calculations.ts` — pure `deriveAlerts()` consumes canonical `ReliabilityRow` from `installed-part-reliability.service.ts`; no second calculator. |
| 2. Persisted vs computed alerts | **EXISTS — REUSE (computed)** | Alerts are derived on each GET. `MachineInstalledPart.alertThresholdReached` exists but no alert table exists. No persistence added for Phase 4; action status is derived from linked documents. |
| 3. Alert types | **PARTIAL — EXTEND** | Five existing: `LIFE_APPROACHING_DUE`, `LIFE_DUE`, `LIFE_OVERDUE`, `REPEATED_PREMATURE_FAILURE`, `HIGH_REPLACEMENT_FREQUENCY`. `PREMATURE_FAILURE` singular does not exist; `prematureFailureCount` and data-quality/detail already expose single early failures. Adding a sixth active type would duplicate the same evidence; not added. |
| 4. Severity rules | **PARTIAL — EXTEND** | Type allows `LOW/MEDIUM/HIGH/CRITICAL`; base map currently `LOW/MEDIUM/HIGH/HIGH/MEDIUM` and criticality raises one tier. Align base to `MEDIUM/HIGH/CRITICAL/HIGH/MEDIUM` per required example, keeping one central authority and cap at `CRITICAL`. |
| 5. Recommended action rules | **EXISTS — REUSE** | Central `RECOMMENDED_ACTION` map: `INSPECT`, `REPLACE`, `DIAGNOSE_REPEATED_FAILURE`, `CONDITION_CHECK`, all localized. No second vocabulary introduced. |
| 6. Recommended date rules | **EXISTS — REUSE** | `recommendedDate = expectedExpiryDate`; canonical calculator returns date only for DAYS and `null` for HOURS/CYCLES (no fabricated forecast). |
| 7. Criticality rules | **EXISTS — REUSE** | `criticalityOf()` uses component `CRITICAL` and `SparePart.isCritical`, source exposed as `criticalitySource`. No duplicate model. |
| 8. Reliability summary cards | **PARTIAL — EXTEND** | Installed parts has populations/active/near/overdue/premature; alerts has total/approaching/due/overdue/repeated/frequency. Add total installed, normal, warning, due, expired, without-life cards without removing advanced metrics. |
| 9. Installed-part filters | **EXISTS — REUSE** | machine, component, spare part, line, status, life status, manufacturer, critical, early-failure, approaching-EOL. `component` is absent on alerts and will be added there. |
| 10. Installed-part metrics | **EXISTS — REUSE** | service life, expected-life progress/band, failures, premature count, replacements, MTBF, MTTR, repeated flag, timeline detail. |
| 11. Plan-creation integration | **PARTIAL — EXTEND** | `GET /maintenance/reliability/alerts/planning-candidate` + query-param prefill into canonical `/admin/maintenance/schedules` form exists. Preserve; pass alert id for action detection. |
| 12. Maintenance-request integration | **MISSING — ADD** | No alert→request bridge. Add minimal POST using canonical `MaintenanceRequestsService.create` with deterministic source token, dedupe, audit, permission `maintenance-request:create`. |
| 13. Acknowledgement | **NOT REQUIRED** | No acknowledgement state exists; no persistence requested as mandatory. Action status is derived from real linked documents; no fake ACKNOWLEDGED state. |
| 14. Suppression/dismissal | **NOT REQUIRED** | Avoided: would need persisted state and could hide unresolved critical evidence. |
| 15. Duplication prevention | **EXISTS — REUSE + PARTIAL — EXTEND** | Derived alert IDs are deterministic (`installedPartId:type`, `machine:sparePart:type`). Schedule duplicate guard exists in canonical form. Add request duplicate guard by deterministic source token. |
| 16. Audit | **PARTIAL — EXTEND** | Canonical `AuditService` exists. Request creation already audits `CREATE`; Phase 4 adds a dedicated `CREATE_MAINTENANCE_REQUEST_FROM_ALERT` audit record. No read-refresh audits. |
| 17. Permissions | **EXISTS — REUSE** | `maintenance-reliability:read`, `maintenance-request:create`, `maintenance-schedule:create` are already seeded. No cosmetic keys added. |
| 18. Exact missing UX | **MISSING — ADD** | Alert grid lacks remaining value and action status; details modal lacks catalog-vs-applied life, readings, serial/batch, failure history, stock context, installed-part/replacement links, request link, and request button. Installed-parts summary lacks the six required simple cards. |
| 19. Exact missing backend logic | **MISSING — ADD** | Alert detail endpoint, derived action-status endpoint, request-from-alert endpoint, warehouse-scoped stock context, severity alignment, sort priority. |
| 20. Migrations | **NOT REQUIRED** | No new persisted alert/workflow table. No schema change; Phase 3 migration remains latest (`20261120150000_add_spare_part_default_expected_life`). |

## Existing capabilities verified in current main

- Authority chain: `deriveAlerts()` → `InstalledPartReliabilityService.buildRows()` → `reliability-calculations.ts` → Phase 3 `computeExpectedLifeState()` / `DUE_PROGRESS_THRESHOLD`.
- Evidence-backed failure detection only (`classifyTermination`, `classifyPremature`, `isRepeatedEarlyFailure`); replacement alone is never a failure.
- High replacement frequency is config-gated via `SystemSetting` group `reliability-alerts`; absent threshold → NOT_ELIGIBLE, no fabricated conclusion.
- Alert endpoints: `GET /maintenance/reliability/alerts`, `/summary`, `/data-quality`, `/planning-candidate`, all `maintenance-reliability:read`.
- Server-side pagination and filters; derived alerts are deterministic and stable across refreshes.
- Tenant scope is enforced by `InstalledPartReliabilityService` machine scope (`companyId`, branch/null) and line access assertion.
- Notification subsystem exists (`MaintenanceNotificationService`) but no scheduler/cron exists; without persisted transition state, adding notifications would risk spam. Phase 4 does not add threshold notifications.
- No stock mutation anywhere in reliability services; stock is read-only `InventoryBalance` joined through `SparePart.productId` and scoped `Warehouse`.
- Tests exist: `reliability-alert-calculations.spec.ts`, `reliability-alerts.service.spec.ts`, `installed-part-reliability.service.spec.ts`, web `reliability-alerts-preventive-planning.test.ts`.

## Gap decision summary

Phase 4 is a **consolidation and action bridge**, not a new subsystem:
1. Reuse derived alerts; align severity/ordering centrally.
2. Add read-only detail/action-status/stock context derived from canonical data.
3. Add canonical maintenance-request creation with dedupe and audit.
4. Extend existing pages in place; keep server pagination and existing filters.
5. No migration, no new permission, no alert table, no notification spam risk, no stock writes.
