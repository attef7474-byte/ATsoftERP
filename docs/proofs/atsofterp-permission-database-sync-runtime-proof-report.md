# ATsofterp Permission Database Synchronization and Runtime Authorization Proof

- Date: 2026-07-31
- Branch: `main` (unchanged, HEAD `23f9c65` — no commits made)
- Status: **COMPLETED**

---

## 1. Task Status

**COMPLETED** — all completion criteria verified against the real local SQL Server database and the real running API:

- [x] Canonical permission keys synchronized to the database (`installed-parts:read`, `maintenance-request:activity.view`, `maintenance-request:attachments.view`, `maintenance-request:print`).
- [x] Obsolete keys removed (`maintenance-request:activity`, `maintenance-request:attachments`, `maintenance-request:printData`) with role assignments re-pointed.
- [x] Database backup taken and CHECKSUM-verified before any write.
- [x] Targeted, narrowly-scoped, idempotent sync command (`npm run seed:permissions`).
- [x] Runtime authorization proven (authorized normal user / unauthorized normal user / obsolete-key user / unrelated-key user / SUPER_ADMIN).
- [x] Affected UI pages verified: no raw keys, translated loading/error/empty states, EN/AR parity, shared error dialog.
- [x] Frontend can resolve the guard `messageKey` (`auth.insufficientPermissions`) in the active UI language.
- [x] New tests (11) written and passing; existing 21 tests still passing.
- [x] No commit, no push, no migration, no schema change, no full re-seed.

---

## 2. Exact Scope Completed

1. **Shared, testable sync engine** — `apps/api/prisma/seed/permission-sync.ts` (`syncPermissionKeys`): runs inside a Prisma transaction; migrates obsolete keys to canonical keys (re-points `RolePermission` links, deletes obsolete rows), adds missing canonical/extra permissions, deduplicates the input list. `PERMISSION_MIGRATIONS` is the single source of truth for the 3 renamed keys.
2. **Targeted command** — `npm run seed:permissions --workspace apps/api` (script `seed:permissions` → `seed-cmms-permissions.ts`, which now delegates to the shared engine and then re-asserts the SUPER_ADMIN grant-all, preserving previous behavior).
3. **Read-only state reporter** — `npm run db:permission-state` (`permission-state-report.ts`): reports canonical/obsolete keys, linked roles, totals, duplicate keys/assignments. Used for before/after evidence.
4. **Database sync executed twice** (idempotency) on the real DB with before/after evidence saved to `docs/proofs/evidence/`.
5. **Runtime authorization proof** — `npm run proof:auth` (`apps/api/scripts/auth-permission-proof.ts`): temporary fixture role/user, real HTTP calls against the running API, real sync calls against the real DB, DB assertions, and `finally`-guaranteed fixture cleanup. 14/14 cases pass.
6. **UI verification** — `scripts/verify-permission-ui.mjs`: 6 affected pages/components scanned for the 7 raw keys, whole `apps/web/src` scanned for hardcoded denial text, EN/AR parity of `errors.permissionDenied` / `auth.insufficientPermissions` / `error-dialog`, error-modal structure checks, per-page state handling checks.
7. **i18n gap fixed** — added `auth.insufficientPermissions` to `en/common.ts` and `ar/common.ts` so the shared error dialog resolves the guard's `messageKey` in the active UI language instead of falling back to the backend-language message.
8. **Backup** — `tools/backup/backup-sqlserver.ps1` run (CopyOnly, no compression — SQL Server Express), CHECKSUM + `RESTORE VERIFYONLY` verified.
9. **`.gitignore`** — `tools/backup/backups/` added (user-approved) so backup artifacts can never be committed.

---

## 3. Files Created

| File | Purpose |
|---|---|
| `apps/api/prisma/seed/permission-sync.ts` | Shared, transactional permission sync engine + `PERMISSION_MIGRATIONS` + input dedup |
| `apps/api/prisma/seed/permission-state-report.ts` | Read-only DB state reporter (evidence tool) |
| `apps/api/src/modules/auth/permission-synchronization.spec.ts` | 11 unit tests with in-memory fake Prisma |
| `apps/api/scripts/auth-permission-proof.ts` | Runtime authorization proof (fixture + HTTP + cleanup) |
| `scripts/verify-permission-ui.mjs` | Static UI/i18n/error-dialog verification |
| `docs/proofs/evidence/pre-sync-permission-state.json` | Pre-sync DB evidence |
| `docs/proofs/evidence/post-sync-permission-state.json` | Post-sync DB evidence |
| `docs/proofs/evidence/sync-run-1.txt` | First sync run output |
| `docs/proofs/evidence/sync-run-2.txt` | Second sync run output (idempotency) |
| `docs/proofs/evidence/runtime-auth-proof.json` | Full 14-case runtime proof JSON (with 403 response bodies) |

## 4. Files Modified

| File | Change |
|---|---|
| `apps/api/prisma/seed/seed-cmms-permissions.ts` | Delegates to `syncPermissionKeys` (same behavior, shared engine) |
| `apps/api/package.json` | Added `seed:permissions`, `db:permission-state`, `proof:auth` scripts |
| `apps/web/src/lib/i18n/locales/en/common.ts` | Added `auth.insufficientPermissions` |
| `apps/web/src/lib/i18n/locales/ar/common.ts` | Added `auth.insufficientPermissions` |
| `.gitignore` | Added `tools/backup/backups/` (user-approved) |

## 5. Database Models or Migrations Changed

None. No Prisma migration, no `db push`, no reset, no schema change. The DB was changed only through the application-level sync engine (add/rename/delete of `permissions` rows and re-pointing of `role_permissions` rows inside one transaction).

## 6. API Endpoints Added or Changed

None. Endpoint permission keys were already corrected in the previous batch (verified: `GET /installed-parts` family → `installed-parts:read`; `GET /maintenance/requests/:id/activity` → `maintenance-request:activity.view`; `/attachments` → `maintenance-request:attachments.view`; `/print` → `maintenance-request:print`).

## 7. Frontend Routes Added or Changed

None. Affected pages verified read-only: `installed-parts/page.tsx`, `requests/[id]/activity|attachments|print/page.tsx`, `installed-parts-card.tsx`, `replacement-history-card.tsx`.

## 8. Permissions Added or Changed

- `installed-parts:read` — created in DB (was missing entirely).
- `maintenance-request:activity.view`, `maintenance-request:attachments.view`, `maintenance-request:print` — created in DB via migration of the obsolete keys; SUPER_ADMIN role links re-pointed.
- `maintenance-request:activity`, `maintenance-request:attachments`, `maintenance-request:printData` — deleted from DB (all links moved first).
- Frontend i18n keys added: `auth.insufficientPermissions` (en + ar). No new permission keys.

---

## 9. Tests Added and Results

### New: `permission-synchronization.spec.ts` — 11 tests, all passing
1. adds all missing canonical permissions to an empty database
2. keeps existing canonical permissions unchanged (zero additions)
3. migrates an obsolete key and re-points role assignments
4. does not modify unrelated permissions or role assignments
5. preserves the canonical row when canonical + obsolete coexist
6. is idempotent when executed twice (identical state)
7. deduplicates the extra-permission input list
8. merges assignments when the new key already exists pre-migration
9. migrates all three obsolete maintenance-request keys
10. reports accurate counts in a mixed scenario
11. `deduplicateExtraPermissions` keeps first occurrence

### Existing suites (all still passing)
- `permissions.guard.spec.ts` — 9 tests
- `inventory-routes.spec.ts` — 7 tests
- `maintenance-permissions-consistency.spec.ts` — 5 tests

**Focused result:** 4 suites, 32 tests, 0 failures.

## 10. Build and Validation Results

| Check | Result |
|---|---|
| `npx jest` (focused, 4 suites) | 32/32 pass |
| `npm run seed:permissions` run 1 | Added 1, migrated 3 — success |
| `npm run seed:permissions` run 2 | Added 0, migrated 0 — idempotent |
| `npx prisma validate` | Schema valid |
| API `tsc --noEmit` + `npm run build` | Clean, exit 0 |
| Web `tsc --noEmit` + `next build` | Clean, compiled successfully |
| `npm run i18n:check` | 3406 en / 3406 ar keys, fully synchronized |
| `scripts/verify-permission-ui.mjs` | All checks passed |
| `git diff --check` | Clean, exit 0 |

## 11. Runtime Proof Results

API started on `http://localhost:4000` (`GET /api/v1/health` → 200) against the real DB. Full evidence: `docs/proofs/evidence/runtime-auth-proof.json`.

| # | Case | Expected | Actual | Result |
|---|---|---|---|---|
| 1 | SUPER_ADMIN reads `/installed-parts` | 200 | 200 | PASS |
| 2 | Normal user, no permissions, reads `/installed-parts` | 403 | 403 | PASS |
| 3 | Normal user with ONLY obsolete key reads request activity | 403 | 403 | PASS |
| 4 | Normal user with only an unrelated key reads `/installed-parts` | 403 | 403 | PASS |
| 5 | Obsolete keys removed from DB after sync | none | none | PASS |
| 6 | Proof-role links re-pointed to the 3 canonical keys | 3 | 3 | PASS |
| 7 | Normal user with canonical key reads `/installed-parts` | 200 | 200 | PASS |
| 8–10 | Normal user opens request activity / attachments / print | 200/404 | 200 | PASS |
| 11–13 | SUPER_ADMIN opens request activity / attachments / print | 200/404 | 200 | PASS |
| 14 | Second sync run: no-op | added=0 migrated=0 | added=0 migrated=0 | PASS |

403 response contract captured at runtime (both denial cases):
```json
{"success":false,"statusCode":403,"message":["صلاحيات غير كافية"],"timestamp":"2026-07-31T18:30:09.23Z","messageKey":"auth.insufficientPermissions"}
```
The frontend `normalizeApiError` resolves `messageKey` through the active UI locale (`auth.insufficientPermissions` now in en + ar), falling back to the backend's localized message only if the key were ever missing.

### Database before/after evidence (real DB `ATsoftERP_DB` @ localhost:50079)

| Metric | Pre-sync | Post-sync |
|---|---|---|
| Total permissions | 474 | 475 |
| Total role_permissions | 480 | 481 |
| `installed-parts:read` | missing | present, ACTIVE, linked to SUPER_ADMIN |
| `maintenance-request:activity.view` | missing | present, ACTIVE, linked to SUPER_ADMIN |
| `maintenance-request:attachments.view` | missing | present, ACTIVE, linked to SUPER_ADMIN |
| `maintenance-request:print` | missing | present, ACTIVE, linked to SUPER_ADMIN |
| `maintenance-request:activity` | present (SUPER_ADMIN link) | removed, link re-pointed |
| `maintenance-request:attachments` | present (SUPER_ADMIN link) | removed, link re-pointed |
| `maintenance-request:printData` | present (SUPER_ADMIN link) | removed, link re-pointed |
| Duplicate keys / duplicate assignments | none | none |

Sync run 1: `Added 1 new permissions, migrated 3 keys` (1 role reassigned each — SUPER_ADMIN). Sync run 2: `Added 0, migrated 0`. The runtime proof additionally exercised the migration path with a temporary role holding obsolete-key links: the sync re-pointed exactly those 3 links, the user then received 200 on the protected endpoints, and all fixtures were deleted in `finally`.

### Backup
`tools/backup/backups/ATsoftERP_DB_20260731_211617.bak` — 40,615,936 bytes, `BACKUP DATABASE ... CHECKSUM` + `RESTORE VERIFYONLY WITH CHECKSUM` both successful, metadata written (`.meta.json`). Taken CopyOnly (no compression: SQL Server Express). Directory added to `.gitignore`; file is untracked and will not be committed. Restore procedure: `restore-test-sqlserver.ps1`/`verify-backup.ps1` in `tools/backup/` with the same `-Server -Database` arguments.

## 12. Tenant-Isolation Proof

No tenant-scope logic was changed by this batch. The permission system is global by design (permissions/roles are not tenant-owned); tenant isolation is enforced by `ActiveContextInterceptor` + `ActiveContextValidator` + `AllowedContextResolver`, which were exercised at runtime during the proof: every authenticated request carried `x-active-company-id`/`x-active-branch-id` (DEFAULT company / HQ branch) and context validation succeeded; the fixture user (companyId/branchId set, no scope rows) used the legacy user-assignment grant path, and SUPER_ADMIN used the SUPER_ADMIN grant path. Cross-company ID manipulation was not part of this batch (previous batch covered permission routes; no new tenant-owned entities were introduced).

## 13. Known Limitations

- `installed-parts:read` could not be "migrated" from a legacy key because no legacy key existed for it; roles that need it must be granted it through the existing role-permission management (the proof demonstrated the exact behavior: without the link the user gets 403, with the link 200).
- The 403 `message` array in the raw API response is localized by the backend per request language; the frontend dialog shows the UI-language text via `messageKey`. A UI session in English with a backend response in Arabic would still show English text because the key now resolves in the UI locale.
- The full `jest` run still reports 18 failing suites — all pre-existing empty/failing spec files (see section 14); the 4 focused suites (32 tests) are the task-relevant gate.

## 14. Pre-existing Issues Encountered

- 18 pre-existing spec files fail to run (empty or invalid): `condition-evaluator`, `template-rendering`, `request-notifications/*` (4), `request-policy/*` (3), `workflow-engine/*` (3), `auth.service`, `roles.guard`, `business-rules.service`, `hr-requests.service`, `mqtt-message.parser`, `numbering.helpers`. Not touched.
- `tools/backup/backup-config.json` does not exist (only the example); backup requires explicit `-Server -Database -OutputDir` parameters.
- SQL Server instance is Express Edition → backup compression must be disabled (`-NoCompression`).
- `backup-sqlserver.ps1`'s relative `-OutputDir` is resolved server-side; absolute paths must be used.
- The backend guard `messageKey` (`auth.insufficientPermissions`) was missing from web locale files (fixed in this batch, section 2.7).
- Web `check-i18n.mjs` does not scan `error-dialog.ts`/`workspace.ts` namespaces (pre-existing check limitation); parity for `error-dialog.ts` is asserted by `verify-permission-ui.mjs` instead.

## 15. Git Status

- Branch: `main`; HEAD: `23f9c65` (unchanged); no commits made.
- This batch's changes: `.gitignore` (M), `apps/api/package.json` (M), `apps/api/prisma/seed/seed-cmms-permissions.ts` (M), `apps/web/src/lib/i18n/locales/en|ar/common.ts` (M), plus untracked: `apps/api/prisma/seed/permission-sync.ts`, `permission-state-report.ts`, `apps/api/scripts/`, `apps/api/src/modules/auth/permission-synchronization.spec.ts`, `scripts/verify-permission-ui.mjs`, `docs/proofs/evidence/`.
- Pre-existing uncommitted work from the previous batch (untouched): `AGENTS.md`, `permissions.guard.spec.ts`, inventory-adjustments controller/module, inventory controller/service, deleted `create-stock-adjustment.dto.ts`, web counts page, `package-lock.json`, `apps/api/jest.config.js`, `seed-cmms-permission-keys.ts`, `inventory-routes.spec.ts`, `maintenance-permissions-consistency.spec.ts`, `docs/agent-rules/`, 3 previous proof reports, `opencode.json`, `proof-token.txt`.
- Backup file `tools/backup/backups/ATsoftERP_DB_20260731_211617.bak` (+ `.meta.json`) is git-ignored and untracked.
- `git diff --check`: clean.

## 16. Commit and Tag Status

Not requested; no commit, push, merge, tag, or branch operation was performed. The backup file and all evidence artifacts are preserved on disk.
