# PERMISSION_COVERAGE_REGISTER — Phase 6

Status: `RESOLVED` — all Phase 6 permission hard gates met and verified on 2026-11-21.
Baseline: `origin/main` `1fce7f1e2a00fe16200e27f0a1cadb1500048c2e`.
Created: 2026-11-21.
Rule: stable canonical keys; defined, seeded, role-assignable, backend-enforced, frontend-applied, translated where displayed, and tested for allowed/denied roles.

## 1. Entry-gate counts

| Metric | Count | Evidence |
| --- | ---: | --- |
| Distinct seeded keys in authoritative code parser | 792 | `apps/api/src/modules/auth/r4r-permission-seed-contract.spec.ts` parser |
| Distinct backend-enforced controller keys | 668 | Full constant-resolved controller scan |
| Controllers | 211 | Static scan |
| HTTP route methods | 1248 | Static scan |
| Routes without decorator | 27 | Health/auth/service-level-enforced routes only |
| Enforced-but-unseeded accepted legacy keys | 61 | `r4r-permission-seed-contract.spec.ts:52-82` |
| Unexpected enforced-but-unseeded keys | 0 | R4R contract assertion |
| Seeded-but-never-enforced keys | 206 | Static set difference; dead grant surface |
| Frontend gating keys | 348 | Static scan; all map to seeded or enforced keys |
| Known UI/backend permission mismatches | 0 | Static reconciliation |
| Critical backend actions without guard | 0 | Route or service-level guard matrix |
| Production DB permission rows | 767 / 767 active / 767 distinct | Read-only DB count; 2026-11-21 |

Runtime DB count differs from the static 792-key catalogue because standalone seed scripts have not all been executed in the deployed database. This is a deployment/seed reconciliation gap, not evidence that the catalogue is smaller.

## 2. Hard gates

| Gate | Baseline | Required |
| --- | ---: | ---: |
| Enforced-but-unseeded | 61 | 0 |
| Critical backend actions without guard | 0 | 0 |
| Known UI/backend permission mismatches | 0 | 0 |

## 3. Enforced-but-unseeded key ledger

Source: `apps/api/src/modules/auth/r4r-permission-seed-contract.spec.ts:52-82`.

### 3.1 Plural/singular core synonyms — 23

* `administrations:create|read|update|delete`
* `branches:create|read|update|delete`
* `companies:create|read|update|delete`
* `roles:create|read|update|delete`
* `permissions:read`
* `productionLines:create|read|update|delete|activate|deactivate`

Resolution: seed these aliases as canonical enforced keys; retain singular legacy keys for compatibility; update R4R allowlist to empty.

### 3.2 Platform/feature keys — 38

* `alerts.view`
* `attachments:view|create|update|delete|download`
* `audit:read`
* `dashboard.view`, `dashboard.operations.view`
* `notifications:read|delete|dispatch|mark-read`
* `settings:read|create|update`
* `settings.language.view|manage`, `settings.security.view|manage`, `settings.notifications.view|manage`
* `maintenance-schedule:history.view`, `maintenance-task:myTasks.view|overdue.view`
* 13 `maintenance.dashboard.*` keys

Resolution: seed in main catalogue; `audit:read` is Phase 6-critical because audit CSV export depends on it. Maintenance dashboard keys may be seeded in shared governance without changing maintenance workflow behavior; workflow logic remains deferred to the parallel agent.

## 4. Critical-action guard matrix

| Action | Guard location | Seeded at baseline | Phase 6 action |
| --- | --- | --- | --- |
| Master-data Excel template/export/validate/import/errors | `master-data-excel.service.ts:28-35` via `PermissionCheckService.assertAll` | Yes for four entity families | Add controller-level decorator or documented service-guard contract; preserve tenant check |
| Generic report CSV/XLSX export | `reports.controller.ts:321-349` | Yes, but requires all three report-read keys | Keep ALL semantics until ownership confirms ANY; add typed DTO and audit |
| Operations report export | `operations-reports.controller.ts:35-41` | Yes, standalone seed only | Add keys to main catalogue |
| Production analytics export | `production-analytics.controller.ts:114-120` | Yes | Verify main seed presence |
| Reliability export | `operational-reliability.controller.ts:35-41` | Yes | Verify main seed presence |
| Audit CSV export | `audit.controller.ts:40-52` | **No** — `audit:read` in 61-set | Seed `audit:read`; audit the export action |
| Inventory audit export | `inventory-audit.controller.ts:42-47` | Yes | Preserve |
| Posted transactions, approvals, reversals, status transitions | Controller decorators plus service assertions | Yes | Preserve; add regression assertions |
| Tenant/branch override | No dedicated override endpoint found | N/A | Document; no new override surface |

## 5. Synonyms and duplicates

| Canonical | Legacy/synonym | Status |
| --- | --- | --- |
| `machine:*` | `machines:*` | Repaired; regression pin exists |
| `product:*` | `products:*` | Both seeded; `products:*` enforced |
| singular core CRUD | plural core CRUD | Plural enforced/unseeded; must seed aliases |
| `attachment:*`, `audit-log:*`, `notification:*` | `attachments.*`, `audit:read`, `notifications:*` | Enforced aliases must be seeded |
| `reports.inventory:read` | `inventory:reports:*` | Dotted enforced; colon family unused |
| `inventory:audit:*` | `audit:read` | Separate audit surfaces; both must be seeded |

## 6. Frontend/access reconciliation

* Gate helpers: `apps/web/src/lib/permission-gate.ts`, `apps/web/src/lib/access-control.ts`.
* Navigation gating: `apps/web/src/components/admin/shell/navigation-data.ts`.
* Access pages use `translatePermissionKey`; no raw permission key is rendered.
* One minor fallback in `apps/web/src/lib/permissions/permission-catalogue.ts:491-506` returns the raw resource segment for unmapped resources; fix with humanized fallback.
* No dedicated `/forbidden` page; component-level `t('errors.forbidden')` is the established pattern.

## 7. Deferred to parallel personnel-maintenance agent

No service/controller mutation is proposed for:

* `person-registrations.service.ts`
* `person-assignments.service.ts`
* `users.service.ts`
* `employees.service.ts`
* `maintenance-personnel.service.ts`
* maintenance request/work-order visual-state and technician/team ownership files.

Seeding shared permission keys that those services read is allowed only if it does not change their workflow logic.

## 8. Closeout criteria

`enforced-but-unseeded = 0`, `critical backend actions without guard = 0`, `known UI/backend permission mismatches = 0`, R4R no-stale-allowlist assertion passes, and focused allow/deny tests exist for newly seeded keys.

## 9. Final evidence (2026-11-21)

| Gate | Required | Final | Evidence |
| --- | ---: | ---: | --- |
| Enforced-but-unseeded | 0 | 0 | 61 keys seeded by `apps/api/prisma/seed/seed-phase6-governance-permission-keys.ts`, wired into `apps/api/prisma/seed/seed.ts`; R4R stale allowlist emptied in `r4r-permission-seed-contract.spec.ts`. |
| Critical backend actions without guard | 0 | 0 | Route/service guard matrix unchanged for posted transactions/approvals; export paths guarded by existing read keys plus service-level `PermissionCheckService.assertAll`. |
| Known UI/backend permission mismatches | 0 | 0 | Static reconciliation unchanged; no new gating keys introduced without a seeded/enforced counterpart. |

Validation: `r4r-permission-seed-contract.spec.ts` and `seed-phase6-governance-permission-keys.spec.ts` pass; full API suite 257/257 suites and 5,243/5,243 tests green. The 61 seeded keys are additive aliases/feature keys; no workflow logic in the deferred personnel-maintenance services was changed. Production DB row count (767) still lags the 792-key static catalogue because legacy standalone seed scripts have not all been executed in the deployed database — tracked as a deployment/seed reconciliation item, not a Phase 6 code gate.
