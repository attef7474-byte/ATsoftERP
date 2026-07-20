# Current Release Scope

> Batch 39 — Approved modules and their completion status

## Approved Modules

| # | Module | Status | Related Batches | Known Limitations |
|---|--------|--------|-----------------|-------------------|
| 1 | Auth (login, JWT, change password) | COMPLETE | 36, 37, 38 | None |
| 2 | Access Control (users, roles, permissions) | COMPLETE | 36, 38 | None |
| 3 | Companies / Branches / Departments | COMPLETE | 28, 36, 38 | None |
| 4 | Dashboard (summary, KPIs, operations) | COMPLETE | 28, 36, 37 | None |
| 5 | Alerts / Notifications | COMPLETE | 28, 36, 38 | None |
| 6 | Settings | COMPLETE | 28, 36 | Some settings require seed data |
| 7 | Audit | COMPLETE | 28, 36, 38 | None |
| 8 | Attachments | COMPLETE | 28, 36, 38 | None |
| 9 | Warehouses | COMPLETE | 29, 36, 38 | None |
| 10 | Warehouse Locations | COMPLETE | 29, 36 | None |
| 11 | Products | COMPLETE | 29, 36, 38 | None |
| 12 | Inventory Balances | COMPLETE | 29, 36, 38 | None |
| 13 | Inventory Movements | COMPLETE | 29, 36, 38 | None |
| 14 | Inventory Counts | COMPLETE | 29, 31, 36, 38 | None |
| 15 | Machines / Assets | COMPLETE | 30, 36, 38 | None |
| 16 | Machine Parts | COMPLETE | 30, 36 | None |
| 17 | Machine Documents | COMPLETE | 30, 36 | None |
| 18 | Maintenance Dashboard | COMPLETE | 31, 36, 38 | None |
| 19 | Maintenance Requests | COMPLETE | 31, 36, 38 | None |
| 20 | Maintenance Tasks | COMPLETE | 31, 36, 38 | None |
| 21 | Preventive Maintenance | COMPLETE | 31, 36, 38 | None |
| 22 | Downtime Logs | COMPLETE | 31, 36, 38 | None |
| 23 | Barcode / QR | COMPLETE_WITH_LIMITATION | 32, 36, 38 | Print is browser print-to-PDF |
| 24 | Reports (CSV export, Excel export, print) | COMPLETE_WITH_LIMITATION | 33, 36, 37, 38 | PDF is browser print-to-PDF, not server-side |
| 25 | Unified Search / F9 | COMPLETE_WITH_LIMITATION | 34, 36, 37, 38 | None |
| 26 | Flutter Mobile Source | SOURCE_EXISTS | 35 | Flutter SDK unavailable locally; APK not validated |
| 27 | Backup / Restore / Runtime Tools | COMPLETE | 24, 27, 37 | SQL Server tools required |

## Excluded Domains

The following domains are explicitly excluded from the current release:
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
- Multi-currency
- Multi-company
- Cloud/Docker/PostgreSQL

See `rejected-domains-current-release.md` for details.
