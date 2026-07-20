# Release Archive Report

> Batch 40 — Release archive creation

## Archive Details

| Field | Value |
|-------|-------|
| Archive path | `release/ATsoftERP-current-release-final.zip` |
| Archive size | 225,230 bytes (~220 KB) |
| Included folder | `release/atsoft-erp-current-release/` all contents |
| Compression | ZIP (PowerShell Compress-Archive) |

## Included Contents

- 7 release package root files (START_HERE.md, README.md, RELEASE_MANIFEST.md, FINAL_ACCEPTANCE_REPORT.md, CURRENT_RELEASE_SCOPE.md, KNOWN_LIMITATIONS.md, REJECTED_DOMAINS.md)
- `docs/` — Full documentation (49+ files)
- `scripts/` — Health, backup, runtime scripts
- `proof/` — Batch 37, 38, 39, 40 proof files
- `source-summary/` — Architecture overview

## Excluded

| Item | Status |
|------|--------|
| node_modules | Not included ✅ |
| .env files | Not included ✅ |
| .git directory | Not included ✅ |
| Build caches (.next, dist) | Not included ✅ |
| Secrets | Not included ✅ |
| Temporary files | Not included ✅ |

## File Checksum

Applied to individual package files in CHECKSUMS.sha256.

## Note

The GitHub repository at the final release tag (`atsoft-erp-current-release-final`) is the authoritative source of truth. The ZIP archive is a convenience extract for distribution.
