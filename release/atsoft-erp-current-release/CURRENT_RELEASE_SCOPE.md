# Current Release Scope — ATsoft ERP

> Approved modules for the current release

## Included

| Module | Status | Batches | Notes |
|--------|--------|---------|-------|
| Auth (login, JWT, change password) | COMPLETE | 36, 37, 38 | JWT + bcrypt |
| Access Control (users, roles, permissions) | COMPLETE | 23, 36, 38 | Permission guard, matrix view |
| Core (companies, branches, departments) | COMPLETE | 28, 36 | Organization tree |
| Dashboard | COMPLETE | 28, 31 | Summary cards, KPIs |
| Alerts | COMPLETE | 28, 36 | Active alerts list |
| Notifications | COMPLETE | 28, 36 | Notification rules |
| Settings | COMPLETE | 28 | Appearance, language, security, audit, numbering, notification rules |
| Audit | COMPLETE | 28 | User activity, login history |
| Attachments | COMPLETE | 28 | Upload, view |
| Warehouses | COMPLETE | 29 | CRUD, tree view |
| Warehouse locations | COMPLETE | 29 | Per-warehouse locations |
| Products | COMPLETE | 29 | CRUD, categories, tree |
| Inventory balances | COMPLETE | 29 | Stock levels |
| Inventory movements | COMPLETE | 29 | Transaction log |
| Inventory counts | COMPLETE | 15, 29 | Plan, execute, reconcile |
| CMMS / Maintenance dashboard | COMPLETE | 31 | KPIs, open requests, overdue |
| Machines / Assets | COMPLETE | 30 | CRUD, card view |
| Machine parts | COMPLETE | 30 | Parts catalog |
| Machine documents | COMPLETE | 30 | Upload, organize |
| Maintenance requests | COMPLETE | 16, 31 | CRUD, workflow, checklist |
| Maintenance tasks | COMPLETE | 16, 31 | Assign, complete |
| Preventive maintenance | COMPLETE | 16, 31 | Schedules, execution, calendar |
| Downtime logs | COMPLETE | 31 | Log, analysis |
| Barcodes / QR | COMPLETE | 32 | Records, templates, generate, scan, print labels |
| Reports | COMPLETE | 33, 36 | Inventory, maintenance, barcodes, export CSV/Excel, print-to-PDF |
| Unified Search (F9) | COMPLETE | 34 | Cross-module search |
| Backup/restore runtime tools | COMPLETE | 24, 27 | SQL Server backup, health/smoke checks |
| Flutter mobile source | COMPLETE_WITH_DOCUMENTED_LIMITATION | 35 | Source exists, SDK not available on dev machine |
| Documentation and training | COMPLETE | 39 | User manual, admin guide, training package |

## Excluded

The following are explicitly excluded from the current release:

| Domain | Reason |
|--------|--------|
| Sales | User-rejected for current release |
| Purchasing | User-rejected for current release |
| Finance / Accounting | User-rejected for current release |
| HR / Employees | User-rejected for current release |
| AI / Assistant | User-rejected for current release |
| IoT / Gateway | User-rejected for current release |
| BI / Analytics | User-rejected for current release |
| Forecasting | User-rejected for current release |
| Workflows | User-rejected for current release |
| Import/Export Designer | User-rejected for current release |
| Print Template Designer | User-rejected for current release |
| Cloud / Docker / PostgreSQL | Architecture constraint — Windows local runtime + SQL Server only |
