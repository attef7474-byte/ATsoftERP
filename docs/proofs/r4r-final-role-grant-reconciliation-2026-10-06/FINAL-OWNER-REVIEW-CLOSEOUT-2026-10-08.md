# R4R Final Owner-Review Closeout — Runtime Restore & Evidence Persistence

Run date: 2026-10-08
Status: **READY_FOR_OWNER_REVIEW_BEFORE_COMMIT** — no commit, no push, no tag performed.

This document is the final, sanitized closeout for the R4R Group 1 (personnel) vertical slice and
the production-runtime restore that followed the authenticated read-only browser proof.
Companion artifact: `browser-proof.json` in this directory (sanitized; contains no credentials).

---

## 1. API Production Restore

| Item | Value |
|---|---|
| Previous API process | temporary dev harness `ts-node src/main.ts` (PID 2764), started only to satisfy browser CORS for the localhost proof |
| Build command | `npm run build:api` (= `tsc` in `apps/api`, `outDir: ./dist`) |
| Pre-build hygiene | `apps/api/dist` was removed **before** the final build so no stale compiled output survived (a stale `maintenance-stock-issue.controller.js` from the deleted source file was found in the first build) |
| Build exit code | **0** |
| Fresh dist verification | `dist/src/main.js` present; `dist/.../person-registrations/*.js` present; `dist/.../spare-part-issues/*.js` present; `dist/.../maintenance-stock-issue/maintenance-stock-issue.controller.js` **absent** (correct); compiled `person-registrations.module.js` contains `imports: [security_module_1.SecurityModule, audit_module_1.AuditModule]`; 4351 files emitted |
| Process stopped | **only** the temporary ts-node API (PID 2764). No Caddy, SQL Server, database, permissions, users, or data touched |
| API runtime | NSSM Windows service **`ATsoftERP_API`** (existing production supervisor, left as-is) |
| New API PID | 22496 (`node.exe dist\src\main.js`) |
| Service AppDirectory | `C:\Users\attef\PycharmProjects\Trae\ATsofterp\apps\api` |
| Service environment | `PORT=4000`, `NODE_ENV=production` (NSSM `AppEnvironmentExtra`) |
| Runtime mode | **production dist** — not ts-node, not `start:dev` |
| CORS state | **No development allow-all override remains.** `CORS_ORIGINS` unset in production ⇒ `app.enableCors({ origin:false })`; probe with `Origin: http://localhost:3000` returned an empty `Access-Control-Allow-Origin` (i.e. CORS disabled, not `*`) |
| Startup warnings (expected in production) | `CORS_ORIGINS is not set — CORS is disabled`, `Swagger is disabled (SWAGGER_ENABLED not set)` |
| `GET /api/v1/health` | **200** `{"status":"ok",...}` |
| Stale-build/runtime mismatch | none — the running process was started from the freshly built `dist` and was confirmed by route probing (§2) |

No `prisma migrate deploy` and no `prisma migrate resolve` was executed. No database write of any
kind was performed during the restore.

---

## 2. Production Smoke (restored runtime)

| Check | Unauthenticated | Authenticated (existing approved session token, via request header only) | Verdict |
|---|---|---|---|
| `GET /api/v1/health` | 200 | — | PASS |
| `GET /api/v1/auth/me` | — | 200 | PASS |
| `GET /api/v1/person-registrations` | **401** (route registered, auth enforced) | **200** (2816 bytes) | PASS |
| `GET /api/v1/spare-part-issues` | **401** (route registered, auth enforced) | **200** (65 bytes) | PASS |
| `GET /api/v1/factory/maintenance/maintenance-stock-issue` | **404** | — | PASS (legacy removed route unavailable) |
| `GET /api/v1/factory/maintenance/maintenance-stock-issue/*` | **404** | — | PASS (legacy removed route unavailable) |
| `GET /api/v1/machine-installed-parts` | **404** | — | no such surface exposed |

| Web reachability | Result |
|---|---|
| `https://dell/` | 200 |
| `https://dell/login` | 200 |
| `https://dell/admin/core/persons` | 200 |
| `https://dell/api/v1/health` (same-origin proxy) | 200 |
| `http://localhost:3000/login` | 200 |

The token was supplied only as an `Authorization: Bearer` request header. It was **not** echoed,
printed, logged, persisted, or embedded in any URL, artifact, or this document.

**No production record was created, edited, or deleted. All smoke calls were GET requests.**

---

## 3. Evidence — What Is Proven (final verified state)

### 3.1 Group 1 canonical backend + unified frontend
- Canonical module `apps/api/src/modules/admin/person-registrations/` (controller + service + DTOs),
  registered in `PersonRegistrationsModule`.
- Unified frontend workspace `apps/web/src/app/admin/core/persons/page.tsx` (single screen for
  employees / users / maintenance personnel, with `personal-information`,
  `organization-assignment`, `maintenance-capability`, `system-login`, `roles-access` sections).
- Legacy maintenance-personnel surface routes create → `/admin/core/persons`.
- Unified navigation label `navigation.persons` (en/ar) + `core.registerPerson` (en/ar).

### 3.2 Canonical GET / POST / PATCH person-registrations integration
- `GET /api/v1/person-registrations` → 200 with the allowed operational context (4 real records:
  `EMP-0000001` … `EMP-0000004`). No fake/demo rows exist or were created.
- Create via `POST`, update of the **same** record via `PATCH /:id` (project pattern).
- Negative control proven: adding a speculative `api.post('/employees', …)` broke 2 tests; reverted.

### 3.3 Transaction / rollback / tenant / auth-preservation proof
- Service-level transaction with rollback assertions, permission allow/deny, tenant isolation, and
  authentication-preservation after write (automated tests, see §3.7).
- Backend operational-context headers (`x-active-company-id`, `x-active-branch-id`) are enforced
  server-side (`operationalContext.headersRequired` / `operationalContext.invalidRelationship`).

### 3.4 Full test counts

| Suite | Suites | Tests | Result |
|---|---|---|---|
| API (`npm run test` in `apps/api`) | 183 | **3659** | all PASS |
| Web (`jest --config apps/web/tests/jest.config.js`) | 52 | **1285** | all PASS (1284 → 1285 after D-B) |
| Group 1 focused (`person-registrations-unified-page.behavior.test.ts` 16 + `r4r-group1-unified-workspace.test.ts` 18) | — | **34** | PASS |

### 3.5 Group 1 behavioral / negative-control tests
- `apps/web/tests/person-registrations-unified-page.behavior.test.ts` executes the page callbacks and
  rendered tree, asserting `mapRecordToForm` reads the **real** API field names
  (`login`, `maintenanceCapability`) plus a negative test that legacy `user` /
  `maintenancePersonnel` keys are ignored.
- `apps/web/tests/r4r-group1-unified-workspace.test.ts` static-source guard (18 tests).
- `apps/api/src/modules/auth/r4r-permission-seed-contract.spec.ts` and
  `r4r-least-privilege.spec.ts` seed/guard contract tests.

### 3.6 Authenticated read-only browser proof
Harness: Playwright 1.61.1 against web `http://localhost:3000` → API `http://localhost:4000/api/v1`.
Full result JSON persisted as `browser-proof.json` alongside this document.

- `AUTHENTICATED_BROWSER_SESSION = PASS`
- `LOGIN_FORM_UI = NOT_EXERCISED_IN_THIS_FINAL_RUN`
- EN `/admin/core/persons` → HTTP 200, `dir=ltr`, heading `Employees, Users & Maintenance
  Personnel`, real row `EMP-#######` present; `GET person-registrations` = 200
- Existing-record edit form (read-only): sections `personal-information`,
  `organization-assignment`, `maintenance-capability`, `system-login` all visible;
  `roles-access` visible when System-Access toggled (authorized); Personal Information prefilled
  (value `حنظل`); maintenance + login toggles **enabled** (permission-aware for SUPER_ADMIN)
- `BROWSER_WRITE_PATH = NOT_EXERCISED_TO_AVOID_PRODUCTION_DATA_MUTATION`
- `WRITE_PATH_AUTOMATED_PROOF = PASS` (service transaction/rollback/permission/tenant/
  auth-preservation + Group 1 behavior + canonical POST/PATCH negative-control tests)
- `NON_SUPER_ADMIN_BROWSER_AUTH_PROOF = BLOCKED_MISSING_AUTHORIZED_CREDENTIALS`

### 3.7 AR RTL / EN LTR proof
- EN: `dir=ltr`, heading `Employees, Users & Maintenance Personnel`, raw CUIDs **0**, raw
  translation keys **0**, page errors **0**.
- AR: `dir=rtl`, heading `الموظفون والمستخدمون وكادر الصيانة`, raw CUIDs **0**, raw translation
  keys **0**, row present.

### 3.8 Groups 2–4 regression / smoke
`/admin/maintenance/machine-categories`, `/admin/maintenance/operation-types`,
`/admin/maintenance/spare-parts`, `/admin/maintenance/machine-parts`,
`/admin/maintenance/spare-part-issues`, `/admin/maintenance/requests`,
`/admin/core/supervisor-assignments` — every route: **HTTP 200, `dir=ltr`, raw CUIDs 0, raw
translation keys 0, new 4xx/5xx 0, new console errors 0, page errors 0**.

### 3.9 `users.loginHistory.view` state (unchanged, OPEN)
Row exists and is ACTIVE in production (`cmuw470q60000b095gvlt6txk`), **holders = 0**.
Enforced by `user-activity.controller.ts` for `GET /users/:id/activity` and
`GET /users/:id/login-history`. Owner must nominate the holding role; creating the row + grant is a
separate reviewed transaction with an audit row. No grant was guessed here.

Live permission inventory re-verified read-only: `permissions` **718**, `roles` **13**,
`role_permissions` **286**; `operational-person:create` holders 1,
`maintenance-personnel:create` holders 1, `user:create` holders 0.

---

## 4. Data-State Classifications (read-only re-verified 2026-10-08)

### 4.1 MachineComponent
`machine_components`: **7 total / 0 live / 7 soft-deleted** (soft-delete column `deletedAt`).

### 4.2 Users context classification
`users`: **11 total / 7 live**.
- All **7 live** users have both company and branch populated — **0 live rows with null company,
  0 live rows with null branch**.
- **3 rows** carry a null company; all three are soft-deleted.
- Active contexts for `SUPER_ADMIN`: default company `cmrvaph2200009g95oj1o8m1j` /
  branch `cmrvaph4100019g95kisacppa`; second `cmum3jqh8001mf495zaankx05` /
  `cmum5dwmo0000ro95qq4day18`. The admin's own legacy company (`cmrl31uuy…`) is **not** an allowed
  context; `currentContextStatus = SELECTION_REQUIRED`.

### 4.3 MachineInstalledPart — physical-schema integrity gap
Classification: **`PHYSICAL_SCHEMA_INTEGRITY_GAP / PRISMA-DB CONSTRAINT MISMATCH`** (NOT migration drift).

| Fact | Value |
|---|---|
| `machine_installed_parts` table exists | yes |
| rows | **0** |
| outgoing FKs from `machine_installed_parts` | **0** |
| inbound FK | `machine_installed_part_readings_installedPartId_fkey` only |
| orphans | 0 |

This matches the baseline migration SQL
(`20260731000000_baseline_installed_parts_repair_bom_condition_tables`), which creates the table with
indexes only and no outgoing foreign keys, while the Prisma schema implies constraints. Requires a
dedicated reviewed reconciliation task; no DDL was executed here.

`spare_parts`: 11 rows. `machine_parts`: 889 rows (167 with null company).

---

## 5. Migration State — APPLIED_OUT_OF_LEDGER retained

`_prisma_migrations`: **99** rows; latest
`20260923000000_repair_widen_audit_details` (finished 2026-09-24).

The following three migrations exist on disk but are **absent from the migration ledger** and remain
classified **APPLIED_OUT_OF_LEDGER**:

1. `20261001010000_r4n_machine_part_canonical_spare_part`
2. `20261001100000_r4o_machine_part_tenant_ownership`
3. `20261001100100_r4o_isolate_verified_qa_spare_parts`

**`prisma migrate resolve` was NOT executed in this stage.** No `prisma migrate deploy` either.
Migration-ledger reconciliation is deferred to a separate reviewed task after owner review.

---

## 6. Defects Discovered and Fixed (both fixed and regression-tested)

### D-A — `PersonRegistrationsModule` missing `AuditModule` dependency
- Symptom: API failed to boot with `UnknownDependenciesException … AuditService at index [1] …
  PersonRegistrationsModule`.
- Fix: `PersonRegistrationsModule` now imports `AuditModule`
  (verified in compiled dist: `imports: [security_module_1.SecurityModule, audit_module_1.AuditModule]`).
- Verified: production API boots and serves health/protected routes (§1, §2).

### D-B — Frontend expected `user` / `maintenancePersonnel`, canonical API returns `login` / `maintenanceCapability`
- Symptom: the unified workspace read the wrong field names, so the grid System-Access and
  Maintenance-Capability columns always rendered "No" and edit-prefill never hydrated
  login/maintenance data.
- Fix: `apps/web/src/app/admin/core/persons/page.tsx` now uses the real contract
  (`PersonLoginView`; list columns read `d.login` / `d.maintenanceCapability`;
  `mapRecordToForm` reads `detail.login` / `detail.maintenanceCapability`).
- Regression: `apps/web/tests/person-registrations-unified-page.behavior.test.ts` updated to assert
  the real field shape, **plus** a negative test asserting legacy `user`/`maintenancePersonnel` keys
  are ignored. Web suite 52 suites / 1285 tests PASS after the change; web typecheck exit 0; web
  production build exit 0.

---

## 7. Security / Sanitization Record

Persisted evidence was scanned and contains **no**:
passwords, bearer tokens, JWTs, session cookies, authorization headers, credential-bearing URLs,
temporary harness source, or machine/user secrets. `R4R_TOKEN` is **not** persisted anywhere in the
repository. `browser-proof.json` in this directory was verified clean (0 matches for
`Bearer|eyJ|token|password|cookie|Authorization|R4R_TOKEN|admin@`).

---

## 8. Gates Run After Restore

- API production build (`npm run build:api`) → exit **0**
- API health + authenticated read-only smoke → PASS (§2)
- Web health/smoke → PASS (§2)
- Credential scan (`npm run credentials:check`) → PASS (see §8b)
- `git diff --check` → clean
- `git status --short` → see owner report

No source-code change was made during the restore/evidence step itself, so no test suite was rerun
beyond the two that D-B had already invalidated-and-restored earlier in the session.

## 9. Git State

Branch: `main` · HEAD: `c5540708` · **No commit. No push. No tag.**
Working tree carries the uncommitted R4R changeset (modified + untracked R4R modules/tests/proofs).
