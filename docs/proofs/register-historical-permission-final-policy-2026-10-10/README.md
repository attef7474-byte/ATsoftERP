# REGISTER HISTORICAL PERMISSION — FINAL POLICY REPORT

Status of this report: **FINAL**. Evidence captured read-only from production `ATsoftERP_DB` and preserved in this directory.

## 1. Decision

**POLICY_FINALIZED.**

`maintenance-task:registerHistorical` stays a **SUPER_ADMIN_ONLY** capability in production. No role qualifies for an explicit grant, so **zero production role-permission grants were applied**. This matches the previously released decision: the workflow redesign shipped with `registerHistorical` reachable only through the `SUPER_ADMIN` role-code bypass in `PermissionsGuard`. The evidence below re-verifies that expectation against live production data, pins it with a focused authorization test, and documents the invariant.

## 2. Git Identity

- Branch: `main`
- HEAD before this task: `612cb44c09b373c8ee7e25bfd663c7f8b4ec39b7` (unchanged during the DB evidence phase)
- origin/main: identical (0 ahead / 0 behind)
- Working tree before report: clean except one new file `apps/api/src/modules/auth/register-historical-permission.spec.ts` (the focused authorization pin)

## 3. Permission Definition

| Field | Value |
|---|---|
| Key | `maintenance-task:registerHistorical` |
| Module | `maintenance-task` |
| Action | `registerHistorical` |
| Seed source | `apps/api/prisma/seed/seed-cmms-permission-keys.ts:217` (`{ key: "maintenance-task:registerHistorical", module: "maintenance-task", action: "registerHistorical" }`) |
| Web catalogue | `apps/web/src/lib/permissions/permission-catalogue.ts:217` (`registerHistorical: { ar: 'تسجيل عمل منفذ سابقاً', en: 'Register performed work' }`) |
| Frontend gate | `apps/web/src/components/maintenance/execution-form.tsx:39` — `canHistorical = isSuperAdmin \|\| !!permissions?.permissions.includes('maintenance-task:registerHistorical')` |
| Endpoint | `POST /api/v1/maintenance/tasks/register-historical` |
| Enforced via | `@UseGuards(JwtAuthGuard, PermissionsGuard)` + `@Permissions('maintenance-task:registerHistorical')` |

Production row (read-only, 2026-10-10):

```json
{ "id": "cmv2v6lsq0000z495zoavwkiq", "key": "maintenance-task:registerHistorical",
  "module": "maintenance-task", "action": "registerHistorical", "status": "ACTIVE" }
```

Alias scan on `historical|backdate|backfill|register` returned only this row — no near-duplicate keys exist. The permission row exists and is ACTIVE, so the key is enforceable and nothing needs seeding repair (the owned-permission row was created as part of the prior release; this policy task does not create or edit it).

## 4. Production Role Inventory

Read-only enumeration of `ATsoftERP_DB` (DB_ID 8), 2026-10-10: 721 permissions, 13 roles, 288 role_permissions rows.

| Role code | Name | System | Status | Users | Grants |
|---|---|---|---|---|---|
| `SUPER_ADMIN` | Super Administrator | yes | ACTIVE | 1 | 17 |
| `E2E_ROLE` | مهندس / فني صيانة (Maintenance Engineer / Technician) | no | ACTIVE | 2 | 228 |
| `CATALOG_ADMIN` | مسؤول الكتالوجات الفنية | no | ACTIVE | 0 | 20 |
| `PERSONNEL_ADMIN` | مسؤول شؤون الموظفين والتنظيم | no | ACTIVE | 0 | 17 |
| `TEST_VIEWER` | Test Viewer Role | no | ACTIVE | 0 | 3 |
| `TEST_WAREHOUSE` | امين مخزن | no | ACTIVE | 0 | 3 |
| `ROLE-1787573285953` | QA-SYS-ROLE-1787573285953-EDITED | no | ACTIVE | 0 | 0 |
| `ROLE-1787573406138` | QA-SYS-ROLE-1787573406138-EDITED | no | ACTIVE | 0 | 0 |
| `ROLE-1787573773251` | QA-SYS-ROLE-1787573773251-EDITED | no | ACTIVE | 0 | 0 |
| `ROLE-1787575182832` | QA-SYS-ROLE-1787575182832-EDITED | no | ACTIVE | 0 | 0 |
| `ROLE-1787575951227` | QA-SYS-ROLE-1787575951227-EDITED | no | ACTIVE | 0 | 0 |
| `ROLE-1787582197369` | QA-SYS-ROLE-1787582197369-EDITED | no | ACTIVE | 0 | 0 |
| `TEST_VIEWER2` | Test Viewer Role 2 | no | ACTIVE | 0 | 0 |

Full per-role permission sets: `production-role-inventory-before.json`.

## 5. Historical-Authority Matrix

For each ACTIVE role, effective authority is computed by the exact `PermissionsGuard` semantics (lines 33–46): activate-roles only, `SUPER_ADMIN` shortcut, ACTIVE permission rows only. Result — `effective-authorization.json`:

| Role | Holds `registerHistorical` key | SUPER_ADMIN bypass | Effective grant |
|---|---|---|---|
| `SUPER_ADMIN` | no | yes | **YES** |
| `E2E_ROLE` | no | no | NO |
| `CATALOG_ADMIN` | no | no | NO |
| `PERSONNEL_ADMIN` | no | no | NO |
| `TEST_VIEWER` | no | no | NO |
| `TEST_WAREHOUSE` | no | no | NO |
| All 6 QA/empty roles | no | no | NO |

Current `registerHistorical` holders across all `role_permissions`: **0 rows**. Only the guard bypass makes the route reachable today.

## 6. E2E_ROLE Decision

**NOT_ELIGIBLE** — no grant.

- Name/identity: Maintenance Engineer / Technician (مهندس / فني صيانة), the sole operational maintenance role with real users (2: `atef@atsofterp.com`, `e2e-test3@example.com`).
- It holds the full execution ability set the policy treats as a mis-privilege signal: `maintenance-task:create/update/start/join/complete/cancel/assign/parts.issue/downtime.close`, `maintenance-request-parts:*`, `maintenance-part-accountability:*`, etc. (228 grants).
- It does **not** hold `maintenance-task:registerHistorical`, and there is no administrative/supervisory evidence for the role in the production role catalogue, seed source, or R4R least-privilege reconciliation (which classified E2E_ROLE as an execution role and pinned it to least privilege).
- Therefore granting it would violate the stated rule "registerHistorical must NOT be implied by technician/engineer/execution abilities."

The 226→228 grant-count drift versus the 2026-10-06 R4R capture was observed but is out of scope; neither of the two additional grants is `registerHistorical` (0 holders).

## 7. Final Grant Policy

**SUPER_ADMIN_ONLY.**

- `registerHistorical` is granted to no explicit role.
- Reachable only via the intentional `SUPER_ADMIN` role-code bypass in `permissions.guard.ts:36`.
- In the future, if an owner nominates an explicit administrative/supervisory role, it must be granted in one reviewed, idempotent, transactional upsert (role_permissions + audit row) and proven end-to-end before use.

## 8. Production Grants Applied

**None.** Mutation count = 0. No new permission rows, no role_permissions rows, no role changes, no user changes, no schema/migration changes.

## 9. Authorization Proof

Effective authorization was computed read-only against live production grants (not hardcoded), replicating the guard: `effective-prove.cjs` (preserved in `.tmp/register-historical/`):

- By role: only `SUPER_ADMIN` → `granted: true`. All 12 other roles → `granted: false`.
- By ACTIVE user: only `admin@atsofterp.com` (SUPER_ADMIN) → `granted: true`. `atef@atsofterp.com` (E2E_ROLE) and `e2e-test3@example.com` (E2E_ROLE) → `granted: false`. All other ACTIVE users have no roles → `granted: false`.

## 10. Route Protection Proof

`apps/api/src/modules/factory/maintenance/maintenance-tasks/maintenance-tasks.controller.ts`:

- Controller-level `@UseGuards(JwtAuthGuard, PermissionsGuard)`.
- Route `@Post('register-historical')` is bound with `@Permissions('maintenance-task:registerHistorical')` and delegates to `service.registerHistorical`.
- `registerHistorical` service method (service line 397) is invoked from exactly this one controller route; grep finds no other call site in `apps/api/src`.

Pinned by `apps/api/src/modules/auth/register-historical-permission.spec.ts` (7 tests, PASS).

## 11. No Permission Bypass Proof

- `MaintenanceTaskCreateDto`/`UpdateMaintenanceTaskDto` carry **no** `startedAt`/`completedAt`/`workPerformed`/`participantUserIds`/`downtimeStartedAt`. The create/update/start/complete/assign routes cannot write backdated execution sessions.
- Only `RegisterHistoricalExecutionDto` accepts the backdating fields, and it is bound exclusively to the `register-historical` route that requires the key.
- `start`/`join`/`complete` compute timestamps server-side (`new Date()`), so no client timestamp can reach session/history rows through execution routes.
- Service spec `maintenance-tasks.service.spec.ts` already proves the route cannot be used as a parts-issue or return-to-service backdoor ("permission cannot be bypassed by embedding parts in completion", "returns-to-service in completion" — 45 tests PASS).
- The seed-contract guardrail `r4r-permission-seed-contract.spec.ts` (PASS) fails the build if `maintenance-task:registerHistorical` is enforced but unseeded, so the enforced key can never silently become a permanent 403.

## 12. Business Sentinels

Read-only snapshot taken with the role inventory (no mutations):

| Sentinel | Count |
|---|---|
| `maintenance_requests` | 13 |
| `maintenance_work_orders` | 4 |
| `maintenance_tasks` | 0 |
| `inventory_movements` | 61 |
| `inventory_balances` | 11 |

Because zero mutations were applied, these counts were not re-read after the policy work; there is nothing to compare.

## 13. Production Mutation Summary

| Item | Value |
|---|---|
| Permissions created | 0 |
| Permissions edited | 0 |
| role_permissions created/edited/deleted | 0 |
| Roles created/edited/deleted | 0 |
| Users / user_roles changed | 0 |
| Schema / migration changes | 0 |
| Source (runtime) changes | 0 |
| Audit rows written | 0 |
| Backup taken | no (no write operations performed) |

## 14. Git Final State

- HEAD remains `612cb44c09b373c8ee7e25bfd663c7f8b4ec39b7` on `main`; origin/main identical.
- Changed files from this policy task: `apps/api/src/modules/auth/register-historical-permission.spec.ts` (new, untracked, the authorization pin).
- New evidence: `docs/proofs/register-historical-permission-final-policy-2026-10-10/README.md` (+ `production-role-inventory-before.json`, `effective-authorization.json`).
- Runtime scripts: `.tmp/register-historical/enumerate.cjs`, `.tmp/register-historical/effective-prove.cjs`, `.tmp/register-historical/before.json`, `.tmp/register-historical/effective-authorization.json`.
- `git diff --check`: clean. No commit was created (not requested).

## 15. Deferred Items

- Granting `registerHistorical` to an explicit role: **requires an owner nomination** of a clearly eligible admin/supervisory role; none exists today.
- The E2E_ROLE grant-count drift (226 recorded 2026-10-06 → 228 observed now) is flagged as a separate audit note, not part of this policy.
- Pre-existing, unrelated, untouched: ordinary maintenance user/deleted company, Applicability I/J, historical QA fresh-replay gap, 17 legacy checksum anomalies.

## 16. Final Closure

`REGISTER_HISTORICAL_PERMISSION_POLICY_CLOSED`

- Decision: `SUPER_ADMIN_ONLY`.
- Evidence: production read-only enumeration + effective-authorization matrix + source route/seed pins + focused authorization test (7/7 PASS) + seed-contract guardrail (PASS) + service route-backdoor tests (45/45 PASS).
- Production impact: **zero mutations**.
- Git: HEAD unchanged; one new policy-pin spec + this evidence directory as the deliverable.