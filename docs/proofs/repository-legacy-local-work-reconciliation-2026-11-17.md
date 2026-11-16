# PHASE 2 — LEGACY LOCAL WORK RECONCILIATION REPORT

Client date: **2026-11-17, Asia/Aden**. Scope: audit all known local-only work, validate finished work, preserve unique WIP and remove only proven redundant artifacts. No new application behavior was authored during reconciliation.

## 1. Decision

**LEGACY_LOCAL_WORK_RECONCILED_WITH_INTENTIONAL_WIP_RETAINED**.

All 21 original dirty/untracked items are committed and pushed in three separate workstreams. The unique Docker experiment remains archived in its original stash. No unknown unpublished source work remains among the audited items. No Production deployment, database write, schema/migration, new endpoint, route or permission was introduced by this phase.

## 2. Starting Git State

Branch main; HEAD/origin/main `4e4dce44604edb8617cfcc2ebc0e7968656ccfe4`; ahead/behind 0/0; 14 modified + 7 untracked files; index empty. Initial porcelain, full diff-name/stat inventories, tags, branches, stash, worktrees and ignored dry-run are preserved in ignored `.tmp/legacy-reconciliation-20261117/initial.json`. Every original file's byte SHA256 still matches after recovery.

| Initial state | Path | Final disposition |
| --- | --- | --- |
| ·M | `apps/api/src/common/i18n/api-messages.ts` | COMMITTED_AND_PUSHED / Employee |
| ·M | `apps/api/src/modules/admin/person-registrations/dto/create-person-registration.dto.ts` | COMMITTED_AND_PUSHED / Employee |
| ·M | `apps/api/src/modules/admin/person-registrations/person-registrations.service.spec.ts` | COMMITTED_AND_PUSHED / Employee |
| ·M | `apps/api/src/modules/admin/person-registrations/person-registrations.service.ts` | COMMITTED_AND_PUSHED / Employee |
| ·M | `apps/web/.env.example` | COMMITTED_AND_PUSHED / Mobile |
| ·M | `apps/web/next.config.mjs` | COMMITTED_AND_PUSHED / Mobile |
| ·M | `apps/web/src/app/admin/core/persons/page.tsx` | COMMITTED_AND_PUSHED / Employee |
| ·M | `apps/web/src/components/f9/F9Lookup.tsx` | COMMITTED_AND_PUSHED / Employee |
| ·M | `apps/web/src/lib/api.ts` | COMMITTED_AND_PUSHED / Mobile |
| ·M | `apps/web/src/lib/i18n/locales/ar/core.ts` | COMMITTED_AND_PUSHED / Employee |
| ·M | `apps/web/src/lib/i18n/locales/ar/validation.ts` | COMMITTED_AND_PUSHED / Employee |
| ·M | `apps/web/src/lib/i18n/locales/en/core.ts` | COMMITTED_AND_PUSHED / Employee |
| ·M | `apps/web/src/lib/i18n/locales/en/validation.ts` | COMMITTED_AND_PUSHED / Employee |
| ·M | `apps/web/tests/person-registrations-unified-page.behavior.test.ts` | COMMITTED_AND_PUSHED / Employee |
| ?? | `apps/api/src/modules/admin/person-registrations/dto/create-person-registration.dto.spec.ts` | COMMITTED_AND_PUSHED / Employee |
| ?? | `apps/web/src/lib/person-registration-validation.ts` | COMMITTED_AND_PUSHED / Employee |
| ?? | `apps/web/tests/mobile-lan-login.test.ts` | COMMITTED_AND_PUSHED / Mobile |
| ?? | `apps/web/tests/person-registration-save.test.ts` | COMMITTED_AND_PUSHED / Employee |
| ?? | `docs/proofs/employee-create-silent-save-repair-2026-11-10.md` | COMMITTED_AND_PUSHED / Employee |
| ?? | `docs/proofs/mobile-lan-login-repair-2026-11-10.md` | COMMITTED_AND_PUSHED / Mobile |
| ?? | `docs/proofs/production-release-operational-closeout-2026-11-10.md` | COMMITTED_AND_PUSHED / Production proof |

## 3. Main / origin Status

Fetched origin/main before recovery. Initial release and documentation commits c4bc7484 / 4e4dce44 were already published; no dirty print source remained. The user's Phase 2 authorization closes the Git prerequisite. The existing print closeout honestly retains native print gates as NOT_VERIFIED; this phase neither edits that proof nor re-certifies native printing. Released history is preserved as an ancestor of the recovered work. Source-closeout HEAD = origin/main = `1a65a6512c718851b82836ab6e063d58474abccb`. No reset, restore, rebase, merge or force push.

## 4. Employee Work

EMPLOYEE_READY_TO_COMMIT → COMMITTED_AND_PUSHED. Fifteen exact paths preserve visible nested validation errors, localized form summary/focus, duplicate-click protection, active-branch defaults and enforcement, valid DTO/name/email/date contracts and duplicate-login feedback. F9Lookup's shared change is optional required-field presentation only, used by this flow; its selection contract is preserved. AR/EN changes are employee-only. No mixed Mobile/Print hunks were staged. All 18 original deployed source/test/config/dependency hashes match the historical employee gate; five dependency/test-configuration paths were already included in released main and were not staged again.

## 5. Employee Tests / Decision

Fresh focused API: 2 suites / 59 tests PASS. Fresh Employee Web: 2 suites / 77 tests PASS. API/Web typechecks and i18n PASS. The historical proof records real disposable-clone success/rollback/tenant/permission evidence and owner feedback **ظهرت رسائل التحقق بوضوح**. This phase checked the recorded evidence and ran fresh tests; it did not recreate employees or claim a new live success flow. Historical 2026-11-10 deployment is not a claim about today's clean-print deployment.

## 6. Mobile Login Work

MOBILE_READY_TO_COMMIT → COMMITTED_AND_PUSHED. Five exact paths preserve same-origin browser /api/v1 requests and the fixed server-side rewrite to 127.0.0.1:4000. Browser host/IP and HTTPS remain the page origin; explicit deployment override remains supported. No wildcard CORS, TLS bypass, authentication-cookie weakening, credential, password-policy, permission or tenant-guard change. The explicitly requested LAN HTTP origin stays HTTP; this is not a new HTTPS guarantee. .env.example contains public guidance only.

## 7. Mobile Tests / Decision

Fresh mobile suite: 16/16 PASS, including HTTPS/LAN origins, actual rewrite configuration, bearer transport, application/network errors, actual Login/AuthProvider navigation and session restore. Combined focused Web: 3 suites / 93 tests. The historical real-network/clone proof and owner answer **نجح الجوال والتحديث، والحاسوب يعمل** are retained; no new real-user login was attempted during reconciliation.

## 8. Production Closeout Proof

PRODUCTION_PROOF_READY_TO_COMMIT → COMMITTED_AND_PUSHED separately. The 2026-11-10 document preserves the release-concurrency repair at ancestor 54e3706f and its historical readback: 8 RELEASED orders, 8 frozen snapshots / 56 lines, zero runs. All 24 files in its historical SHA256 manifest match. Dates, recorded tests/deployment and scope agree with the artifact evidence. Current production orders were not reread or changed; dated historical observations are not presented as a new business-state certification.

## 9. Docker Stash

DOCKER_STASH_KEEP_ARCHIVED. Retained `stash@{0}` = `7af3a0e7d9d088063aefad72740f203f448c1595`, base `41a21a15a9de0af8607db8d6b438b07893c01d59`. Fully inspected four-file / 177-line experiment; no untracked stash parent. Current main has empty files at those Docker paths, so the stash contains unique work. Only recorded pause rationale is its message: paused Docker deployment experiment before release tag.

The approved baseline remains Windows services, not Docker. The experiment lacks current root-workspace install/lockfile context, Prisma configuration/native Windows SQL-adapter handling and a valid browser API build-time setting; COPY of the app build context also needs a deliberate secret exclusion review. Compose passwords/JWT use environment references; its fallback connection-string template also references the password variable. No secret values were published. Database volume and configurable host ports exist but were not run or certified. Recovery requires a separate Docker task. No stash pop/apply/drop.

## 10. Local Tag

TAG_SHOULD_PUSH → published exactly `atsoft-erp-org-detail-i18n-runtime-final`. Existing annotated marker targets `470a3476af2215d49d9fde0cedfb117d8385fd3b`, an ancestor of origin/main. Its name matches the organization-detail i18n repair. Six neighboring organization/i18n markers were already remote. No new tag was created or moved; no push --tags.

## 11. Worktrees

Eight registered at start (seven additional, not the six expected in the prompt). All paths existed. Git prune dry-run selected none. Six old Temp paths were deeper-audited: all tracked source already absent, index unchanged, no modified/new source, zero unique commits, only .git pointers and two generated Prisma-engine binaries left on disk. Resolved absolute targets were checked inside Windows Temp, with no junction traversal. A written proof preceded normal Git worktree removal; --force addressed only the already-missing tracked files. Main and clean Kilo worktrees remain.

| Original path | HEAD | Audit / disposition |
| --- | --- | --- |
| `C:/Users/attef/PycharmProjects/Trae/ATsofterp` | `4e4dce44` | Main workspace; KEPT. |
| `C:/Users/attef/.local/share/kilo/worktree-pool/atsofterp-45373347fd87/continuous-diadem` | `4e4dce44` | Clean detached useful worktree; KEPT. |
| `C:/Users/attef/AppData/Local/Temp/ATsofterp-COST-R2D-B1-20260907T034615/worktree` | `20c5e1ec` | All tracked files already absent; no staged/modified/new source; zero unique commits. SAFE_REMOVED with Git; branches kept. |
| `C:/Users/attef/AppData/Local/Temp/ATsofterp-COST-R2D-B1-FINAL-20260914/worktree` | `74587e69` | All tracked files already absent; no staged/modified/new source; zero unique commits. SAFE_REMOVED with Git; branches kept. |
| `C:/Users/attef/AppData/Local/Temp/ATsofterp-COST-R2D-B2-FINAL-20260915/worktree` | `06649668` | All tracked files already absent; no staged/modified/new source; zero unique commits. SAFE_REMOVED with Git; branches kept. |
| `C:/Users/attef/AppData/Local/Temp/ATsofterp-COST-R2D-B3-P1-20260922/worktree` | `a4549eea` | All tracked files already absent; no staged/modified/new source; zero unique commits. SAFE_REMOVED with Git; branches kept. |
| `C:/Users/attef/AppData/Local/Temp/ATsofterp-P1-DEFECT-REPAIR-20260923/worktree` | `e3336b03` | All tracked files already absent; no staged/modified/new source; zero unique commits. SAFE_REMOVED with Git; branches kept. |
| `C:/Users/attef/AppData/Local/Temp/opencode/atsofterp-keysafe-wt` | `20c5e1ec` | All tracked files already absent; no staged/modified/new source; zero unique commits. SAFE_REMOVED with Git; branches kept. |

## 12. Local Branches

All seven remain preserved, merged into origin/main with zero unique commits. No remote branch deletion. No branch cleanup was required for reconciliation.

| Branch | HEAD | State |
| --- | --- | --- |
| `cost-r2d-b1-closeout-20260907` | `20c5e1ec` | Merged; zero unique commits; KEPT as historical ref |
| `cost-r2d-b1-final-20260914` | `74587e69` | Merged; zero unique commits; KEPT as historical ref |
| `cost-r2d-b2-final-20260915` | `06649668` | Merged; zero unique commits; KEPT as historical ref |
| `cost-r2d-b3-p1-20260922` | `a4549eea` | Merged; zero unique commits; KEPT as historical ref |
| `main` | `4e4dce44` | Merged; zero unique commits; KEPT as historical ref / active |
| `maintenance-workflow-r2` | `c5540708` | Merged; zero unique commits; KEPT as historical ref |
| `production-phase1-defect-repair-d1-d4-20260923` | `e3336b03` | Merged; zero unique commits; KEPT as historical ref |

## 13. Ignored Files

git clean -ndX was dry-run only. Each listed ignored class is intentionally local, not a commit candidate. No actual clean.

| Class | Treatment |
| --- | --- |
| ENVIRONMENT_SECRETS | Ignored/untracked/unstaged .env and .env.production retained unread; token and QA-session files retained private. |
| BUILD_OUTPUT | Live apps/web/.next and apps/api/dist protected; historical rebuildable copies retained. This phase-only validation build safely removed after success. |
| TEMP_RELEASE_BACKUPS | Latest production rollback and older recovery copies retained. |
| LOGS | Historical release, investigation and runtime logs retained. |
| DATABASE_BACKUPS | All audited database backups retained; no automatic retention deletion. |
| CACHE | Dependencies, generated JS, tsbuildinfo and local caches intentionally local; no broad clean. |
| PROOF_RUNTIME_ARTIFACTS | All historical .tmp evidence, ignored screenshots, local proof scripts/documents retained. |
| LOCAL_TOOLS_CONFIGURATION_OR_STORAGE | Assistant/editor rules and settings, storage and local helpers retained; no source publication or speculative deletion. |

## 14. Environment Files

.env and .env.production exist, are ignored, not tracked and not staged. Their contents were not read, printed, changed or deleted. No real environment file entered any phase commit; only the reviewed public apps/web/.env.example belongs to Mobile.

## 15. Database Backups

| Location | BAK count | Bytes | Oldest–newest date (recorded mtime) |
| --- | --- | --- | --- |
| `backups` | 8 | 588382208 | 2026-08-24–2026-10-12 |
| `tools/backup/backups` | 4 | 241696768 | 2026-07-31–2026-09-02 |
| `docs/data-prep/batch-f` | 1 | 56344576 | 2026-08-19–2026-08-19 |

Total: 13 BAK files / 886423552 bytes in these audited locations. KEEP. No backup retention policy authorizes deletion. Other historical evidence/backup paths under .tmp are retained as well.

## 16. .tmp / Rollback Artifacts

Initial .tmp inventory: 197 immediate entries, approximately 8.72 GiB, excluding linked dependency targets. All were classified in artifact-audit.json. Preserve current viable release-rollback-20261117_012849, rollback-api-dist-20261117_013341 and rollback-web-next-20261117_013341, including old Web BUILD_ID LmD8PG0EskgFuceC1hhfl. No old backup or rollback directory was removed. The new phase-only validation build was separately proven disposable and removed after successful validation; logs/results/manifest hashes remain.

## 17. Logs

Historical production/release, rollback and investigation logs retained. Fresh test/build/guard logs remain under ignored .tmp/legacy-reconciliation-20261117. They are local evidence, not committed application content.

## 18. Build Outputs

Live apps/web/.next and apps/api/dist untouched. Production Web BUILD_ID remains **pq83D9HcJWQzLNXiKbKhe**. Anonymous GET /login and API /health returned 200; unauthenticated auth/contexts returned 401. No service restart/deploy. Isolated copied-source Web build exited 0, compiled successfully and generated 194/194 static pages. Windows webpack-cache and EPERM standalone trace-copy warnings were recorded; the isolated standalone package is not deployment-certified.

## 19. Files Removed

Only the six audited Temp worktree skeletons (.git pointers and two generated Prisma engines; tracked source was already absent) plus this phase's disposable validation build. Validation build removal: 5107 files / 166810482 bytes; one dependency junction unlinked without traversing its target. Exact manifests and guards are in worktree-removal-proof/results.json and validation-build-removal-proof/result.json. No valuable source, backup, secret, historical evidence or current runtime artifact deleted.

## 20. Worktrees Pruned

Six registrations removed with git worktree remove --force after proof; zero removed by git worktree prune. No speculative prune. All branch refs preserved.

## 21. Stashes Dropped / Retained

Dropped 0; retained 1 unique Docker WIP stash at unchanged object 7af3a0e7d9d088063aefad72740f203f448c1595.

## 22. Tags Pushed / Retained / Removed

Pushed the one audited historical tag. Removed/moved 0. No other tags pushed. Final remote-tag equality is checked after the documentation push.

## 23. Commits Created

| SHA | Purpose |
| --- | --- |
| 8a376f7477e55058c58a14421d20bdb5fb36443e | docs(production): preserve operational release closeout evidence |
| 01db70062d990c0c6bfdaee4dca2d0a1066d7ff6 | fix(employee): preserve person registration silent-save repair |
| 1a65a6512c718851b82836ab6e063d58474abccb | fix(auth): preserve same-origin LAN login transport |
| Commit containing this document | docs(repo): close legacy local work reconciliation |

No application source was edited during reconciliation; the existing finished work was preserved byte-for-byte.

## 24. Push Results

Three workstream commits pushed normally and independently: 4e4dce44 → 8a376f74 → 01db7006 → 1a65a651. Exact historical tag push succeeded. This documentation-only commit is the final normal push. No force push.

## 25. Full Regression

After all source commits: API **219 suites / 4735 tests PASS**; Web **123 suites / 2322 tests PASS**; zero failed/pending/skipped tests. Fresh API/Web typechecks PASS. Isolated Web build PASS (194/194). i18n PASS: 7069 EN / 7069 AR synchronized. Route contract PASS: 1185 backend routes / 1167 matches, 0 unresolved/mismatched. Credentials/raw-key/UI-baseline/permission-UI gates PASS. Diff checks PASS. No schema change; no migration or Prisma generation required. Historical runtime proof remains historical; no new business-record creation was necessary for repository recovery.

## 26. Final HEAD

The documentation-only commit containing this proof, whose parent/source boundary is 1a65a6512c718851b82836ab6e063d58474abccb. Its non-recursive SHA is recorded in the final response and ignored final-git.json after push.

## 27. Final origin/main

Equal to the final documentation commit. Post-push remote-readback verifies this; source checkpoint was already synchronized at 1a65a6512c718851b82836ab6e063d58474abccb.

## 28. Ahead / Behind

Source checkpoint 0 / 0; final documentation checkpoint must also read 0 / 0 before reporting closure. No intentionally unpublished local commits.

## 29. Remaining Dirty Files

Original items: 0. Source checkpoint porcelain was empty. This proof is the sole final documentation addition and is committed separately; final porcelain is verified after push. All original 21 file hashes remain unchanged from initial audit.

## 30. Remaining Stashes

One explicitly retained Docker WIP stash. Known content and recovery requirements; no unknown stash.

## 31. Remaining Worktrees

Two: main workspace and clean detached Kilo worktree at 4e4dce44. The latter is a preserved useful tool-managed checkout, not an unpublished feature branch.

## 32. Remaining Local-Only Tags

Zero expected after the exact tag push, verified against remote refs after final push. No deletion used to achieve equality.

## 33. Ignored Local Data Retained

Real env/token/session secrets, dependencies/caches, storage, historical builds/logs/proofs, 13 audited database backups and all rollback points remain intentionally local. These are excluded from Git. No recursive .tmp clean or blanket artifact deletion.

## 34. Production Deployment Required

**PRODUCTION_DEPLOYMENT_REQUIRED = YES** for recovered Employee/Mobile code. The current Production artifacts were built from clean print release c4bc7484 and deliberately excluded those formerly dirty repairs. Their deployment on 2026-11-10 was historical and does not make them part of the 2026-11-17 clean build. This phase authorizes Git recovery, not automatic deployment. Existing running build remains unchanged.

## 35. Final Repository Hygiene State

All prior local-only items classified. Finished work is durable on origin/main; unique Docker WIP is KEPT_AS_ARCHIVE; six redundant Temp worktrees and the disposable validation build are SAFE_REMOVED; remaining local configuration, cache, secrets, evidence, backups and rollback are IGNORED_AND_INTENTIONALLY_LOCAL. No unknown unpublished source among audited work. No known validation failures; build warnings and native-runtime observation limits are explicit.

## 36. Next Authorized Phase

**NEXT_AUTHORIZED_PHASE = NONE**. Stop after reconciliation. Employee/Mobile Production deployment requires separate authorization.

Local audit/evidence entry point: [classification](../../.tmp/legacy-reconciliation-20261117/classification.json), [initial inventory](../../.tmp/legacy-reconciliation-20261117/initial.json), [worktree audit](../../.tmp/legacy-reconciliation-20261117/local-audit.json), [historical artifact verification](../../.tmp/legacy-reconciliation-20261117/evidence-verification.json), [artifact retention](../../.tmp/legacy-reconciliation-20261117/artifact-audit.json), [quality gates](../../.tmp/legacy-reconciliation-20261117/quality.json), [Production sentinels](../../.tmp/legacy-reconciliation-20261117/production-sentinel.json). Detailed machine evidence is intentionally ignored/local and contains no published credentials.
