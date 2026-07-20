# Release Manifest — ATsoft ERP Current Release

## Release Information

| Field | Value |
|-------|-------|
| Release name | ATsoft ERP Current Release |
| Release date | 2026-07-20 |
| Final commit | `97b795b` |
| Final release tag | `atsoft-erp-current-release-final` |
| Final batch tag | `atsoft-erp-batch40-final-release-package-acceptance-handover` |
| Source of truth | GitHub repository at release tag |

## Included Modules

- Auth (login, JWT, password change)
- Access Control (users, roles, permissions)
- Core (companies, branches, departments)
- Dashboard (summaries, KPIs)
- Alerts
- Notifications
- Settings (appearance, language, security, audit, numbering, notification rules)
- Audit (user activity, login history)
- Attachments (upload, view)
- Warehouses
- Warehouse locations
- Products
- Product categories
- Inventory balances
- Inventory movements
- Inventory counts (plan, execute, reconcile)
- CMMS / Maintenance dashboard
- Machines / Assets
- Machine parts
- Machine documents
- Maintenance requests (CRUD, workflow, checklist, cost, print)
- Maintenance tasks (assign, complete)
- Preventive maintenance (schedules, execution, calendar)
- Downtime logs (analysis, by-machine)
- Barcodes / QR (records, templates, generate, scan, print jobs)
- Reports (inventory, maintenance, barcodes, notifications, audit, assets, partners, parts, user activity)
- Unified Search (F9)
- Backup/restore runtime tools
- Flutter mobile source (SDK limitation)

## Excluded Modules

The following modules exist as source stubs but are NOT imported, mounted, or functional:

- Sales
- Purchasing
- Finance / Accounting
- HR / Employees
- AI / Assistant
- IoT / Gateway
- BI / Analytics
- Forecasting
- Workflows
- Import/Export Designer
- Print Template Designer

## Included Documentation

- `docs/release/` — Release notes, scope, limitations, rejected domains, handover checklist
- `docs/user-manual/` — End-user guide (10 files)
- `docs/admin-guide/` — Administrator guide (9 files)
- `docs/operations/` — Quick reference cards (5 files)
- `docs/training/` — Training package (9 files)
- `docs/mobile/` — Mobile access guide (3 files)
- `docs/api/` — API documentation (3 files)
- `docs/qa/` — QA/security documentation (3 files)

## Included Proof

- `docs/screenshots/batch37-production-runtime-health-smoke-browser-proof-completion/`
- `docs/screenshots/batch38-full-qa-regression-permissions-security-closure/`
- `docs/screenshots/batch39-documentation-user-manual-training-package/`
- `docs/screenshots/batch40-final-release-package-acceptance-handover/`

## Included Scripts

- `tools/health/health-check.ps1`
- `tools/health/smoke-check.ps1`
- `tools/backup/backup-sqlserver.ps1`
- `tools/backup/verify-backup.ps1`
- `tools/backup/restore-test-sqlserver.ps1`

## Validation Summary

| Check | Result |
|-------|--------|
| prisma validate | PASS |
| prisma generate | PASS |
| build:api | PASS |
| typecheck | PASS |
| build:web (124 pages) | PASS |
| i18n check (1917 keys) | PASS |
| API regression | 99/99 PASS (Batch 38) |
| Permission checks | 93/93 PASS (Batch 38) |
| Browser pages | 14/14 PASS (Batch 38) |
| Package safety scan | PASS |

## Package Contents

| Path | Description |
|------|-------------|
| START_HERE.md | Starting point |
| README.md | System overview |
| RELEASE_MANIFEST.md | This file |
| FINAL_ACCEPTANCE_REPORT.md | Acceptance summary |
| CURRENT_RELEASE_SCOPE.md | Approved scope |
| KNOWN_LIMITATIONS.md | Documented limitations |
| REJECTED_DOMAINS.md | Rejected domains |
| CHECKSUMS.sha256 | File checksums |
| docs/ | Documentation copies |
| scripts/ | Runtime/health scripts |
| proof/ | Batch screenshots/docs |
| source-summary/ | Source architecture summary |

## Checksum Reference

See `CHECKSUMS.sha256` for individual file checksums.
