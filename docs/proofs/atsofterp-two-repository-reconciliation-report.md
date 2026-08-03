# ATsofterp — Two-Repository Reconciliation Report (Canonical Checkpoint)

Date: 2026-08-03
Status: **CANONICAL_REPOSITORY_READY**

---

## 1. Purpose

Consolidate the accepted Phase 1.1 (Production Master Data) and Phase 1.2 (Production Shifts and Operational Assignments) work, plus the R1 inventory-movements tenant-isolation fix, into the canonical repository in preparation for the official Git checkpoint commit. This report records the reconciliation of the secondary safety repository into the canonical repository, with byte-exact identity verification.

---

## 2. Repository Paths

| Item | Path |
| --- | --- |
| Canonical repository | `C:\Users\attef\PycharmProjects\Trae\ATsofterp` |
| Secondary safety repository | `C:\Users\attef\PycharmProjects\Project\ATsoft_erp` |
| Stable external backup | `C:\Users\attef\PycharmProjects\ATsofterp-Reconciliation-Backup-20260803` |
| Working backup (temp) | `C:\Users\attef\AppData\Local\Temp\opencode\ATsofterp-Reconciliation-Backup-20260803` |

Canonical root confirmed via `git rev-parse --show-toplevel` → `C:/Users/attef/PycharmProjects/Trae/ATsofterp`.

---

## 3. HEAD of Both Repositories

- Canonical HEAD: `8eba533efec5b02d7986c86e2511a80938bac1a7` (branch `main`)
- Secondary HEAD: `8eba533efec5b02d7986c86e2511a80938bac1a7` (branch `main`)
- The two HEAD values are **identical** (verified from backup `HEAD.txt` snapshots of both repositories and from live `git rev-parse HEAD` in the canonical repository).

---

## 4. 3601/3601 SHA256 Identity Verification

The complete union of Git-managed files (tracked + untracked, non-ignored) was verified byte-exact between the canonical and secondary working trees:

- Tracked files (`git ls-files`): 3529
- Untracked non-ignored files (`git ls-files --others --exclude-standard`): 72
- **Union total: 3601**
- **Byte-identical (SHA256): 3601 / 3601**
- Mismatched hashes: **0**
- Files missing from canonical: **0**
- Files missing from secondary: **0**

A separate full working-tree scan (all files on disk excluding `.git` internals, `node_modules`, `.next`, `dist`, `.env*`, logs, build artifacts, and backup directories) produced the same result: identical file inventory on both sides (3566/3566 in-scope filesystem files) and **0 hash mismatches**.

Supporting evidence in the stable backup:

- `canonical-after-manifest.txt` / `secondary-after-manifest.txt` — 3529 entries each, identical path sets, generated after the copy phase.
- `canonical/canonical-manifest.txt` / `secondary/secondary-manifest.txt` — pre-copy manifests.
- Stored after-manifests record 17 differing hash lines (the tracked files modified during the reconciliation copy); a fresh re-hash of exactly those 17 files performed for this report confirms all 17 are byte-identical in both trees today, consistent with the recorded 48-file byte-exact re-copy step (CRLF artifacts from `git apply`, fixed via `Copy-Item -Force`).

---

## 5. Copied File Counts (per reconciliation log)

- Modified tracked files copied (patch): **18**
- New files copied (patch): **71** (4 additional identical files excluded)
- Files re-copied byte-exact to fix CRLF artifacts: **48**
- Files identical between the repositories before reconciliation: **3595** tracked
- Files differing before reconciliation: **18** tracked; **67** files existed only in the secondary (Phase 1.1/1.2 production work)
- Canonical pre-reconciliation dirty state: 5 modified + 2 untracked (all same-version as secondary)

---

## 6. Backup Location and Contents

Stable external backup: `C:\Users\attef\PycharmProjects\ATsofterp-Reconciliation-Backup-20260803`

Contents:

- `canonical/` — `branch.txt`, `HEAD.txt`, `git-status.txt`, `last-10-commits.txt`, `tracked-files.txt`, `untracked.txt`, `canonical-manifest.txt`, `working-diff.patch`
- `secondary/` — `branch.txt`, `HEAD.txt`, `git-status.txt`, `last-10-commits.txt`, `untracked.txt`, `secondary-manifest.txt`, `working-diff.patch`
- `canonical-after-manifest.txt`, `secondary-after-manifest.txt`

A working copy of the same snapshot set exists at `C:\Users\attef\AppData\Local\Temp\opencode\ATsofterp-Reconciliation-Backup-20260803`.

---

## 7. Exclusions

The reconciliation and this checkpoint explicitly exclude (never copied, never staged):

- `.env`, `.env.*`, `apps/api/.env` and all environment files
- Credentials, tokens, `proof-token.txt`, `token.txt`
- `node_modules/`, `.next/`, `dist/`, `build/`, `coverage/`, `test-results/`
- `storage/`, `uploads/`, runtime data, log files (`*.log`, `.server-runtime.*`, etc.)
- Local database backups (`tools/backup/backups/`), release archives
- `RECONCILIATION-SUMMARY.txt` at the repository root (evidence only, left unstaged, not part of the permanent project tree)
- Files from the external backup directories
- AI-assistant rule folders (`.clinerules/`, `.roo/`), `.codex/` pid/log files

---

## 8. Safety Guarantees During Reconciliation

- **No Git write operations**: no commit, no reset, no clean, no stash, no push, no merge, no tag in either repository.
- `git status --porcelain` after reconciliation: identical between the repositories (44/44 lines).
- HEAD unchanged in both repositories.
- The secondary repository was preserved untouched as a safety copy; all copies flowed **from** the secondary **into** the canonical.
- No secrets were copied or exposed.

---

## 9. Verification Chain

1. Pre-copy: backup snapshots + SHA256 manifests of both working trees.
2. Process check: no ATsofterp API/web/Playwright processes holding canonical locks (only secondary-started processes verified not running against canonical files).
3. Copy into canonical: 18 modified tracked files via patch, 71 new files via patch, then 48 files re-copied byte-exact (`Copy-Item -Force`) to remove CRLF artifacts introduced by `git apply`.
4. Post-copy: SHA256 manifests regenerated over the full union; path sets identical; fresh re-hash of all previously differing files confirms byte-identity.
5. This report: independent 3601/3601 SHA256 byte-identity re-verification executed on 2026-08-03 with 0 mismatches.

---

## 10. Final Result

**CANONICAL_REPOSITORY_READY**

The canonical repository `C:\Users\attef\PycharmProjects\Trae\ATsofterp` contains the complete accepted work for R1 (inventory-movements tenant-isolation fix), Phase 1.1 (Production Master Data), and Phase 1.2 (Production Shifts and Operational Assignments) including all database migrations, backend modules, permissions, numbering seeds, frontend pages, F9 adapters, i18n, tests, runtime proofs, browser proofs, and acceptance/validation reports. The working trees of the canonical and secondary repositories are byte-identical; the secondary repository remains untouched as a safety copy.
