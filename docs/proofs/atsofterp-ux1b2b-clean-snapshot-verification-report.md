# ATsofterp UX-1B-2B — Clean Committed Snapshot Verification Report

Task: ATsofterp UX-1B-2B — Clean Committed Snapshot Verification (read-only).
Purpose: prove that committed snapshot `5a04297fe8b451d65bbfabe6af6d438e4561f3fb` is independently complete, buildable, testable, and free from any dependency on unrelated untracked files present in the primary working tree.

## 1. Status

`COMPLETED — CLEAN SNAPSHOT VERIFIED`

## 2. Primary repository path

`C:\Users\attef\PycharmProjects\Trae\ATsofterp`

## 3. Primary branch and HEAD

- Branch: `main`
- HEAD: `5a04297fe8b451d65bbfabe6af6d438e4561f3fb` (equals target commit)
- HEAD subject: `feat(maintenance-operations): harden workflows and tenant scope`
- Ahead of `origin/main` by 4 commits; no local commit beyond the target.

## 4. Target commit and parent

- Target commit: `5a04297fe8b451d65bbfabe6af6d438e4561f3fb`
- Target parent: `6f72b3598f41cc0cff048369bb3db07326a06a9c`
- Parent verified via `git rev-parse 5a04297^`.

## 5. Commit-message verification

- `git log -1 --format=%s 5a04297` = `feat(maintenance-operations): harden workflows and tenant scope` — matches required message.
- Commit reachable from `main` (HEAD == target).

## 6. Primary initial Git status

`git status --short` before verification (identical after cleanup):

```
?? apps/api/src/common/operational-context/operational-context-required.decorator.ts
?? apps/api/src/modules/users/
?? docs/proofs/atsofterp-ux1b1-checkpoint-report.md
?? proof-token.txt
?? tools/health/probe-buttons.mjs
```

- Staged files: none.
- Modified tracked files: none.
- Branch status: `## main...origin/main [ahead 4]`.

## 7. Primary pre-existing untracked files

- `apps/api/src/modules/users/` (4 files: `users.controller.ts`, `users.module.ts`, `users.service.ts`, `dto/list-users-query.dto.ts`) — foreign module, not part of the commit.
- `apps/api/src/common/operational-context/operational-context-required.decorator.ts` — foreign untracked decorator.
- `docs/proofs/atsofterp-ux1b1-checkpoint-report.md` — unrelated untracked checkpoint report.
- `proof-token.txt` — unrelated untracked file.
- `tools/health/probe-buttons.mjs` — unrelated untracked diagnostic script.

SHA-256 fingerprints recorded before verification and re-verified unchanged after cleanup (see section 45).

## 8. Existing worktree continuation result

The temporary verification worktree created by the prior session was still present, registered, detached at the target commit, clean, with valid junctions and no foreign files. The task continued from the focused-test resume point without recreating the worktree.

## 9. Temporary worktree path

`C:\Users\attef\PycharmProjects\Trae\ATsofterp-verify-5a04297`

## 10. Detached HEAD result

- `git -C <worktree> rev-parse HEAD` = `5a04297fe8b451d65bbfabe6af6d438e4561f3fb`.
- `git -C <worktree> symbolic-ref -q HEAD` empty (detached).
- Registered in `git worktree list --porcelain` as detached.

## 11. Clean worktree result

- `git -C <worktree> status --short` empty for the entire verification (source untouched).
- HEAD equals target commit at creation and at end.

## 12. Foreign Users-module absence

`apps/api/src/modules/users/` did not exist in the temporary worktree (verified `Test-Path` = False; also absent from `git ls-files`).

## 13. Foreign decorator absence

`apps/api/src/common/operational-context/operational-context-required.decorator.ts` did not exist in the temporary worktree (verified `Test-Path` = False). `git grep` over the committed tree for `operational-context-required`, `modules/users`, `proof-token`, `ux1b1-checkpoint-report`, `probe-buttons` returned zero matches outside `docs/proofs`/`tools/health`.

## 14. Dependency junction strategy

Option A — task-created directory junctions inside the temporary worktree pointing to the primary repository's existing `node_modules` directories. No package or lockfile modification; no new packages; no `npm ci` needed.

## 15. Junction paths and targets

| Junction (in worktree) | Target (primary, untouched) | Verified |
|---|---|---|
| `<worktree>\node_modules` | `C:\Users\attef\PycharmProjects\Trae\ATsofterp\node_modules` | LinkType Junction, target exists |
| `<worktree>\apps\api\node_modules` | `C:\Users\attef\PycharmProjects\Trae\ATsofterp\apps\api\node_modules` | LinkType Junction, target exists |
| `<worktree>\apps\web\node_modules` | `C:\Users\attef\PycharmProjects\Trae\ATsofterp\apps\web\node_modules` | LinkType Junction, target exists |

## 16. Temporary environment strategy

None required. The committed Prisma schema defines `datasource db { provider = "sqlserver" }` with no `url = env(...)` reference, so `prisma validate` ran without any environment file or process-local variable. No `.env` file was created in the temporary worktree at any point.

## 17. Previously completed i18n result

PASS — 3493 EN keys = 3493 AR keys, 14 namespaces registered in both locales, no empty values, all 6467 literal `t()` keys resolve.

## 18. Previously completed raw-key result

PASS — canonical translator usage verified; no raw translation-key render introduced by the snapshot. (18 pre-existing dynamic `t()` interpolation sites reported as WARN with safe fallback contract — baseline, not snapshot defects.)

## 19. Focused UX-1B-2B tests

Command: `npx jest --config <worktree>\apps\api\jest.config.js --runInBand --testPathPattern "(downtime-logs.service|maintenance-tasks.service|maintenance-request-assignments.service|maintenance-requests.service)\.spec\.ts$"`

Result: **4 suites passed / 4 total, 51 tests passed / 51 total** — matches accepted evidence.

## 20. Tenant-isolation tests

51 focused tests include **12 tenant-isolation tests** (verified by test-name inspection): downtime-logs 4, maintenance-requests 3, maintenance-tasks 3, maintenance-request-assignments 2. All passed.

## 21. UX-1A regressions

`http-exception.filter.spec.ts` + `validation-error-transformer.spec.ts`: **2 suites, 21/21 PASS**.

## 22. UX-1B-1 regressions

`administrations`, `branches`, `departments`, `roles`, `users` (committed admin module) service suites: **5 suites, 48/48 PASS**. The foreign untracked Users module was not used.

## 23. UX-1B-2A regressions

`machine-assets-canonical-errors.spec.ts` (machines, machine categories/components/documents/parts canonical errors, CUID delete-route regressions): **1 suite, 35/35 PASS**.

## 24. Permission tests

`permissions.guard.spec.ts` + `permission-synchronization.spec.ts` + `maintenance-permissions-consistency.spec.ts`: **3 suites, 25/25 PASS**.

## 25. Full runnable API tests

Command: `npx jest --config <worktree>\apps\api\jest.config.js --runInBand` (all discovered suites).

Result: **16 suites passed, 187 tests passed / 187 total** — matches accepted evidence (187 PASS).

## 26. Eighteen empty-suite result

18 zero-byte spec suites fail-to-run with "no tests found/must contain at least one test" — pre-existing baseline, unchanged, not modified, not counted as snapshot defects. Total discovered: 34 suites (16 runnable + 18 empty).

## 27. Web tests

Command: `npx jest --config <worktree>\apps\web\tests\jest.config.js --ci --runInBand`

Result: **4 suites passed, 51/51 PASS** — matches accepted evidence.

## 28. API TypeScript result

Command: `npx tsc --noEmit -p <worktree>\apps\api\tsconfig.json`

Result: **exit code 0, zero errors**. No errors from `src/modules/users/` (module absent), no errors from the untracked decorator (absent), no errors in committed UX-1B-2B files. This is the decisive check proving the previous primary-tree `tsc` failure was caused solely by the foreign untracked module.

## 29. API production build

Command: `npx tsc -p <worktree>\apps\api\tsconfig.json`

Result: **exit code 0, PASS**. Output `apps\api\dist\src\main.js` produced inside the temporary worktree only.

## 30. Web TypeScript result

Command: `npx tsc --noEmit -p <worktree>\apps\web\tsconfig.json`

Result: **exit code 0, PASS**.

## 31. Web production build

Command: `next build <worktree>\apps\web` (via workspace-local `next` bin through the junction).

Result: **exit code 0, PASS**. Full route table emitted; 272 route directories produced under `<worktree>\apps\web\.next\server\app`; build output confined to the temporary worktree.

## 32. Prisma validation

Command: `npx prisma validate --schema <worktree>\apps\api\prisma\schema.prisma`

Result: **schema valid, exit code 0**. No database connection, no migrations, no seeds, no mutation. No schema or migration file changed by the commit (verified `git diff parent..commit -- apps/api/prisma` empty).

## 33. Final i18n result

Rerun at completion: PASS — 3493 EN = 3493 AR, 14 namespaces, no empty values, 6467 literal keys resolve.

## 34. Final raw-key result

Rerun at completion: PASS (18 dynamic `t()` WARN sites, baseline).

## 35. Git diff check

`git -C <worktree> diff --check` exit code 0. `git diff --name-only` empty — no committed source modification.

## 36. Final temporary-worktree status

`git -C <worktree> status --short` empty. Only ignored task artifacts present: `apps/api/dist/`, `apps/web/.next/`, `apps/web/tsconfig.tsbuildinfo`, and the three `node_modules` junctions (all git-ignored).

## 37. Committed-source integrity

No committed file was modified, added, or removed in the temporary worktree during the entire verification.

## 38. Snapshot defect result

**No committed-snapshot defects found.** All committed-source validations passed with zero errors.

## 39. Environment limitation result

None. The only shell-wrapper working-directory restriction was worked around with absolute paths (`git -C`, full config paths); it did not affect any validation.

## 40. Relationship to accepted 38/38 runtime proof

The previously accepted UX-1B-2B runtime proof (38 PASS / 0 FAIL: request lifecycle, workflow superset, canonical errors EN + Arabic wire text, tasks, assignments, downtime normalization, attachments, print aliases, activity, 5 tenant-isolation denials, fixtures cleaned) is referenced as historical evidence. Per task rules it was not rerun; this task is clean compile/build/test verification only.

## 41. Junction cleanup

All three task-created junctions removed by deleting only the junction entries (no recursive deletion, targets untouched and verified present).

## 42. Temporary environment cleanup

No temporary environment file was created; nothing to remove.

## 43. Worktree removal

`git -C C:\Users\attef\PycharmProjects\Trae\ATsofterp worktree remove "C:\Users\attef\PycharmProjects\Trae\ATsofterp-verify-5a04297"` — removed after collecting all evidence, followed by `git worktree prune`. Path no longer exists and no longer registered.

## 44. Primary final Git status

Identical to initial status (section 6): only the 5 pre-existing untracked items plus the new verification report `docs/proofs/atsofterp-ux1b2b-clean-snapshot-verification-report.md` (untracked, not staged). No tracked file modified, no file staged.

## 45. Original untracked files preserved

All 5 pre-existing untracked items re-verified present with unchanged SHA-256 hashes after cleanup:

- `proof-token.txt` — unchanged
- `docs/proofs/atsofterp-ux1b1-checkpoint-report.md` — unchanged
- `tools/health/probe-buttons.mjs` — unchanged
- `apps/api/src/common/operational-context/operational-context-required.decorator.ts` — unchanged
- `apps/api/src/modules/users/` (4 files) — unchanged

## 46. Database mutation confirmation

No database mutation performed: no `prisma migrate reset/db push/migrate dev/migrate deploy/db seed`, no runtime fixtures, no writes of any kind. `prisma validate` is read-only.

## 47. No commit confirmation

No commit created.

## 48. No push confirmation

No push performed.

## 49. No tag confirmation

No tag created or moved.

## 50. Final decision

**UX-1B-2C MAY BEGIN.**

The committed snapshot `5a04297fe8b451d65bbfabe6af6d438e4561f3fb` is independently complete: i18n 3493/3493 PASS, raw-key PASS, focused UX-1B-2B tests 51/51 (incl. 12 tenant-isolation), UX-1A 21/21, UX-1B-1 48/48, UX-1B-2A 35/35, permission tests 25/25, full runnable API tests 187/187 (18 pre-existing zero-byte suites documented baseline), web tests 51/51, API `tsc --noEmit` exit 0, API build PASS, web `tsc --noEmit` PASS, web build PASS, `prisma validate` PASS, `git diff --check` exit 0. The prior API type/build failure is proven to originate exclusively from the unrelated untracked primary-tree files, which are absent from the clean snapshot.

## Appendix — Snapshot inspection evidence

- `git ls-files`: 3485 committed files; no real `.env` tracked (only `.env.example` files), no `.bak`, no `proof-token.txt`.
- Commit stat: 34 files changed (+2116/−409); no Prisma schema/migration, no new `@Permissions(...)` keys (diff-grep empty), no new route decorators (`@Get/@Post/@Patch/@Put/@Delete` additions grep empty).
- Committed artifacts present: `docs/proofs/atsofterp-ux1b2b-checkpoint-report.md`, `docs/proofs/atsofterp-ux1b2b-maintenance-operations-migration-report.md`, `tools/health/ux1b2b-proof.ps1`.
- All relative imports of the 34 changed `.ts/.tsx` files resolve within the committed tree (automated resolution check: zero missing).
- Environment: Node v22.17.1, npm 11.16.0, Prisma 7.8.0.
