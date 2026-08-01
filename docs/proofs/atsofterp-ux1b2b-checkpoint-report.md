# ATsofterp UX-1B-2B — Independent Git Checkpoint Report

- **Task**: UX-1B-2B Maintenance Requests, Tasks, Assignments, Downtime and Workflow hardening + tenant scope — independent local checkpoint commit.
- **Status**: `COMPLETED` (validation chain re-run; one foreign pre-existing untracked module causes an isolated API typecheck deviation — documented in §7, not checkpoint-relevant).
- **Date**: 2026-08-01

---

## 1. Repository and Starting State

| Item | Value |
|---|---|
| Repository path | `C:\Users\attef\PycharmProjects\Trae\ATsofterp` |
| Branch | `main` |
| Starting full SHA | `6f72b3598f41cc0cff048369bb3db07326a06a9c` |
| Starting commit message | `feat(maintenance-assets): migrate machine assets to shared ux foundation` |
| Parent SHA | `f515fc9df28219ac364758af5a61651bb02061db` |
| Ahead/behind | ahead 3 of `origin/main`, not behind |
| Staged files | none at start (`git diff --cached` empty) |
| Stash | `stash@{0}` (pre-existing `WIP on main: 2a7b641`, informational only, untouched) |
| Tags | existing project tags (informational only, untouched) |
| Running processes | API `:4000` and Web `:3000` servers running (informational; API dist built from batch code, health 200) |

Starting HEAD, message, and parent match the expected checkpoint exactly. No staged files at start.

## 2. Accepted Report Reviewed

`docs/proofs/atsofterp-ux1b2b-maintenance-operations-migration-report.md` read in full. Accepted evidence: runtime proof 38/38, focused specs 51/51 (incl. 12 tenant-isolation tests), full executed API tests 187 PASS (18 pre-existing zero-byte suites fail-to-run), web logic 51 PASS, i18n 3493/3493, API/Web builds passing, prisma validate passing, no schema/migration/permission-key/route changes, fixtures cleaned and verified.

## 3. Complete Dirty-File Classification

### Category A — Accepted UX-1B-2B (31 modified/added entries + this report)

Backend modified (10 files, paths under `apps/api/src/modules/factory/maintenance/`):

| File | Evidence |
|---|---|
| `apps/api/src/common/i18n/api-messages.ts` | Canonical error keys added (EN+AR), report §14.C |
| `downtime-logs/downtime-logs.controller.ts` | Active-context parameter + canonical errors |
| `downtime-logs/downtime-logs.service.ts` | Full canonical rewrite + machine-graph tenant scope + requestId null normalization |
| `maintenance-request-assignments/maintenance-request-assignments.controller.ts` | Active-context + canonical errors |
| `maintenance-request-assignments/maintenance-request-assignments.module.ts` | `AuditModule` import (DI fix) |
| `maintenance-request-assignments/maintenance-request-assignments.service.ts` | Reference validation + CREATE/UPDATE/CANCEL audit + tenant scope |
| `maintenance-requests/maintenance-requests.controller.ts` | Active-context + canonical errors |
| `maintenance-requests/maintenance-requests.service.ts` | `update` ctx-arg fix, workflow CREATE history, print aliases, `_count.items`, tenant scope |
| `maintenance-tasks/maintenance-tasks.controller.ts` | Active-context + canonical errors |
| `maintenance-tasks/maintenance-tasks.service.ts` | Prisma select+include 500 fix, tenant scope |

Backend added (4 spec files, 51 tests incl. 12 tenant-isolation, all non-empty, executed in focused run):
- `downtime-logs/downtime-logs.service.spec.ts` (14 tests)
- `maintenance-tasks/maintenance-tasks.service.spec.ts` (12 tests)
- `maintenance-request-assignments/maintenance-request-assignments.service.spec.ts` (8 tests)
- `maintenance-requests/maintenance-requests.service.spec.ts` (17 tests)

Frontend modified (17 files):
- `apps/web/src/app/admin/maintenance/downtime-logs/` — `page.tsx`, `new/page.tsx`, `[id]/page.tsx`, `[id]/edit/page.tsx`, `analysis/page.tsx`, `current/page.tsx` (canonical error handling, `code`/empty-requestId payload fixes, analysis `dateFrom/dateTo`, current `res.data || []`, classify dialog).
- `apps/web/src/app/admin/maintenance/requests/[id]/` — `page.tsx`, `attachments/page.tsx` (authenticated blob download + real API fields), `checklist/page.tsx`, `workflow/page.tsx` (superset consume + i18n labels).
- `apps/web/src/app/admin/maintenance/tasks/` — `page.tsx`, `new/page.tsx`, `[id]/page.tsx`, `[id]/assign/page.tsx`, `[id]/complete/page.tsx`, `[id]/edit/page.tsx` (canonical error handling).
- `apps/web/src/lib/i18n/locales/ar/maintenance.ts` and `en/maintenance.ts` (paired keys).

Docs/tools added (2 + this report):
- `docs/proofs/atsofterp-ux1b2b-maintenance-operations-migration-report.md` — the accepted proof report.
- `tools/health/ux1b2b-proof.ps1` — committed per repo convention: the already-tracked `tools/health/ux1b1-proof.mjs` (committed in the UX-1B-1 checkpoint) and `tools/health/ux1b2a-proof.mjs` (committed in the UX-1B-2A checkpoint) use the identical local demo-seed login (`admin@atsofterp.com` demo account); no production secrets, no tokens, no private data; creates `UX1B2B-*` temporary fixtures with automatic cleanup (attachment + probe file removed, downtime/task/assignment/request deleted, deletion verified); reusable; no debug sections; accurate comments.
- `docs/proofs/atsofterp-ux1b2b-checkpoint-report.md` — this file.

### Category B — Required Shared Dependency

None. All accepted files import only committed/staged project resources (verified: nothing in the batch imports an unstaged source file; the untracked `users/` module is not imported by anything except itself).

### Category C — Unrelated / Pre-existing / Foreign (leave unstaged)

- `docs/proofs/atsofterp-ux1b1-checkpoint-report.md` — pre-existing UX-1B-1 report, untouched.
- `tools/health/probe-buttons.mjs` — pre-existing generic diagnostic probe, untouched.
- `apps/api/src/modules/users/` (5 files: `users.controller.ts`, `users.module.ts`, `users.service.ts`, `dto/list-users-query.dto.ts`) — foreign untracked module, NOT part of UX-1B-2B (absent from the accepted report; created 2026-08-01 06:46–06:48, after the batch's last file was written at 06:41 and the report at 06:46:05); not wired into `app.module.ts` (dead code); **it alone breaks API `tsc`/build with 3 errors** (see §7). Left untouched and unstaged.
- `apps/api/src/common/operational-context/operational-context-required.decorator.ts` — foreign untracked (created 06:49:01, after the batch; imported only by the `users` module). Left untouched and unstaged.

### Category D — Sensitive / Never Stage

- `proof-token.txt` — untouched, untracked, unstaged.

### Category E — Suspicious

None among the batch files: no deletions (0 deleted files), no zero-byte files, no formatting-only rewrites, no empty/skipped/weakened tests (51 tests execute), no raw-key strings introduced.

### Category Counts

A: 34 entries (27 modified + 4 spec files + accepted report + proof script + this checkpoint report). B: 0. C: 4 (2 pre-existing + `users/` dir + decorator). D: 1. E: 0.

## 4. CUID Delete-Fix Verification

- All four in-scope DELETE handlers (`maintenance/requests/:id`, `maintenance/tasks/:id`, `maintenance/request-assignments/:id`, `maintenance/downtime-logs/:id`) previously used `ParseUUIDPipe({ version: '4' })`, always 400 for Prisma CUID ids; fixed to plain `@Param('id')` (report §14.A.1).
- Grep confirms **zero** `ParseUUIDPipe` occurrences in the four in-scope controllers; unused imports removed.
- Services still perform scoped record lookup with canonical not-found messageKeys (identical 404 for missing and foreign records — no existence oracle).
- Removal does not broaden tenant access (operational-context guard unchanged; ID only feeds scoped service lookup).
- Remaining out-of-scope controllers still using the pattern (schedules, spare-parts, cost-centers, production-lines, operation-types, personnel, checklist-items, part-accountability, responsibility-assignments, request-costs, request-parts) recorded — not modified, per excluded scope.
- Regression coverage: delete + transition guards tested in the 4 service specs; runtime proof exercises task delete and request delete + verified deletion.

## 5. Secret-Safety Review

Read-only pattern scan of all staging candidates (passwords, secrets, bearer tokens, API keys, connection strings, private keys, cert blocks, e-mail addresses): zero matches. The single hit — the demo login `admin@atsofterp.com`/`Admin@123456` in `ux1b2b-proof.ps1` — is the identical, already-committed seed-demo convention (`ux1b1-proof.mjs`, `ux1b2a-proof.mjs`). `proof-token.txt` remains untracked and unstaged.

## 6. Dependency and Integrity Review

- All new imports resolve for the batch (verified via full-project `tsc` output — zero errors reference any batch file; web `tsc` clean).
- EN/AR translation files pair (i18n check passes, 3493 = 3493).
- Controllers compile after `ParseUUIDPipe` removal and active-context parameter addition.
- No accepted file imports an unstaged source file.
- Jest config includes the four new specs (focused run executes them: 51/51).
- No package-script references to unstaged files.
- No Prisma schema/migration changed; no permission-key or endpoint-signature change (verified: no `prisma` diff, no new `@Permissions(` keys in the diff).
- No temporary fixture content in source/tests/proof output.
- `git diff --check` clean (exit 0; LF→CRLF conversion warnings only, same as baseline).

## 7. Validation Results

| Check | Result |
|---|---|
| Focused UX-1B-2B specs (4 suites) | 51/51 PASS (incl. 12 tenant-isolation tests) |
| Full executed API tests | 187 PASS / 18 pre-existing zero-byte spec suites fail-to-run (baseline, untouched) |
| Web logic tests | 51/51 PASS (4 suites) |
| i18n check | PASS — 3493 EN = 3493 AR, 14 namespaces, no empty values, 6467 literal keys resolve |
| raw-key check | PASS |
| API `tsc --noEmit` | **FAIL — 3 errors, all inside the foreign untracked `src/modules/users/*` module** (`../../../common/...` import path resolution, `skip`/`take` not on `ListUsersQueryDto`). Zero errors in any UX-1B-2B file. |
| API build (`tsc`) | **FAIL — same 3 foreign errors only.** API `dist` was already built from the batch code (dist service timestamps 06:29–06:38, matching batch end) and is running: health 200 on `:4000`. |
| Web `tsc --noEmit` | PASS |
| Web `next build` | PASS (full route table emitted) |
| Prisma validate | PASS (`prisma/schema.prisma` valid) |
| `git diff --check` | clean (exit 0, LF→CRLF warnings only) |

**Deviation explanation (documented, not checkpoint-relevant):** the untracked `apps/api/src/modules/users/` module (Category C) was created after the UX-1B-2B batch finished (files written 06:46–06:49 on 2026-08-01; the batch's last artifact, this task's accepted report, was written at 06:46:05). It is not imported by `app.module.ts` (dead code) and is not part of the accepted batch. It is the sole cause of the API `tsc`/build failure; every batch file type-checks clean (full-project `tsc` reports exactly 3 errors, all in `users/*`). Per checkpoint rules this is a pre-existing/unrelated failure: **documented, not fixed** — the module is left untouched and unstaged.

## 8. Runtime-Proof Consistency Review

Existing UX-1B-2B proof evidence reviewed (not rerun — per the checkpoint rules no rerun is required when evidence is intact and all batch-relevant tests/builds pass; the proof script was executed in the implementation batch and its fixtures were verified cleaned): accepted report §11 records **38 PASS / 0 FAIL**, covering machine discovery under the fixture context, full request lifecycle (OPEN→IN_PROGRESS→COMPLETED→CLOSED→soft-delete verified), workflow superset (transitions with from/to/permission + history incl. CREATE), canonical errors EN + real Arabic wire-level text (400, `maintenance.onlyInProgressCanComplete`), tasks lifecycle, assignment validation + audit, downtime with empty `requestId` normalization + guards, authenticated attachment upload/list/download/delete, print aliases, activity, and 5 tenant-isolation checks (company B: read/cancel/workflow/search/downtime-read all denied). Fixtures verified 0 remaining after cleanup.

## 9. Staged File List and Diff Statistics

Stage command: explicit `git add -- <path>` per file; no broad add commands.

- 27 modified tracked files
- 7 added files (4 spec files + accepted report + proof script + this checkpoint report)

Staged diff summary: `git diff --cached --stat` reviewed; the tracked modifications are concentrated in the 4 services/controllers + assignments module + `api-messages.ts` + 17 web pages + 2 locale files. Full staged diff reviewed with scope checks: no `.env`, no `.bak`, no `proof-token.txt`, no `users/` module, no decorator, no `probe-buttons.mjs`, no `ux1b1` report, no build output, no cache, no log, no secret, no unrelated maintenance domain, no Prisma schema/migration, no permission-key change, no endpoint-signature change, no deletion, no empty/skipped/weakened tests, no raw backend error exposure, no raw translation key, EN/AR translations paired, tests staged with tested source.

## 10. Commit

- Message: `feat(maintenance-operations): harden workflows and tenant scope`
- Exactly one local commit; no amend; no tag; no push.
- Parent: `6f72b3598f41cc0cff048369bb3db07326a06a9c`.
- If a git hook had modified files during commit, execution would stop for inspection; no auto-staging, no second commit.

## 11. Post-Commit State

- Final commit SHA: `Recorded after commit in the final OpenCode response`.
- `git status --short` after commit: only pre-existing untracked items remain (`proof-token.txt`, `docs/proofs/atsofterp-ux1b1-checkpoint-report.md`, `tools/health/probe-buttons.mjs`, `apps/api/src/modules/users/`, `apps/api/src/common/operational-context/operational-context-required.decorator.ts`) — left untouched and unstaged.
- Ahead/behind: ahead 4 of `origin/main` (no push).
- No `.bak`, `.env`, `proof-token.txt`, Prisma schema/migration, `users/` module, or out-of-scope fix tracked.

## 12. Confirmations

- No push performed.
- No tag created.
- No `git reset/clean/restore/checkout/switch/stash/pull/push/merge/rebase/amend` used; no `git add .`/`-A`/`--all`.
- `proof-token.txt` untouched, untracked, unstaged.
- No staging of excluded categories; no destructive git commands used.
- Remaining working tree left as-is (no clean).
- UX-1B-2C not started.
