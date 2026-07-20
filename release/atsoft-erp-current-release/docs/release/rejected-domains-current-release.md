# Rejected Domains — Current Release

> Batch 39 — Domains explicitly excluded from the current release

## Rejected Domains

| # | Domain | Status | Mounted | Sidebar | API Exposed | Training Included | Reason |
|---|--------|--------|---------|---------|-------------|------------------|--------|
| 1 | Sales | USER_REJECTED_FOR_CURRENT_RELEASE | No | No | No | No | Excluded by current release decision |
| 2 | Purchasing | USER_REJECTED_FOR_CURRENT_RELEASE | No | No | No | No | Excluded by current release decision |
| 3 | Finance / Accounting | USER_REJECTED_FOR_CURRENT_RELEASE | No | No | No | No | Excluded by current release decision |
| 4 | HR / Employees | USER_REJECTED_FOR_CURRENT_RELEASE | No | No | No | No | Excluded by current release decision |
| 5 | AI / Assistant | USER_REJECTED_FOR_CURRENT_RELEASE | No | No | No | No | Excluded by current release decision |
| 6 | IoT / Gateway | USER_REJECTED_FOR_CURRENT_RELEASE | No | No | No | No | Excluded by current release decision |
| 7 | BI / Analytics | USER_REJECTED_FOR_CURRENT_RELEASE | No | No | No | No | Excluded by current release decision |
| 8 | Forecasting | USER_REJECTED_FOR_CURRENT_RELEASE | No | No | No | No | Excluded by current release decision |
| 9 | Workflows | USER_REJECTED_FOR_CURRENT_RELEASE | No | No | No | No | Excluded by current release decision |
| 10 | Import/Export Designer | USER_REJECTED_FOR_CURRENT_RELEASE | No | No | No | No | Excluded by current release decision |
| 11 | Print Template Designer | USER_REJECTED_FOR_CURRENT_RELEASE | No | No | No | No | Excluded by current release decision |

## Notes

- Some of these domains may have planning/design documents under `docs/` (e.g., `docs/22-purchasing.md`, `docs/23-sales.md`). These are historical artifacts from the early design phase and do **not** represent active features.
- These domains must not be activated, mounted, sidebar-linked, API-exposed, or trained on in the current release.
- Future activation requires explicit user approval in a separate release.

## Prohibited Technologies/Actions

| Technology/Action | Status |
|-------------------|--------|
| Docker | Prohibited — not used in current release |
| PostgreSQL | Prohibited — SQL Server only |
| pgAdmin | Prohibited — not used |
| prisma db push | Prohibited — must not be run against production |
| migrate reset | Prohibited — destructive |
| Database reset | Prohibited — destructive |
| Dropped tables | Prohibited — destructive |
| Any destructive DB action | Prohibited |

## Verification

- Batch 37 browser proof: 11/11 rejected domains absent from rendered pages
- Batch 38 regression: 11/11 rejected domains absent from API, sidebar, and web routes
- Exposed rejected domains: **0**
