# Source Architecture Summary — ATsoft ERP

> Overview of the source code architecture for the current release

## Repository Structure

atsofterp/
├── apps/
│   ├── api/          # NestJS backend
│   │   └── src/
│   │       ├── modules/      # Feature modules
│   │       ├── common/       # Shared guards, decorators, filters
│   │       └── prisma/       # Prisma service
│   └── web/          # Next.js frontend
│       └── src/
│           └── app/
│               └── admin/    # Admin panel pages
├── packages/
│   └── shared/       # Shared types, DTOs
├── tools/
│   ├── health/       # Health/smoke check scripts
│   ├── backup/       # Backup/restore scripts
│   ├── runtime/      # Runtime scripts
│   └── installer/    # Installer scripts
├── docs/             # Documentation
└── release/          # Release packages

## Backend (NestJS)

- Framework: NestJS with Express
- ORM: Prisma 7.8.0 with SQL Server
- Auth: JWT (JwtAuthGuard) + bcrypt
- Permissions: PermissionsGuard with role/permission decorators
- Validation: class-validator + class-transformer
- API prefix: /api/v1
- Swagger: /api/docs

### Active Modules

- AuthModule — login, JWT issuance
- UsersModule — user CRUD
- RolesModule — role CRUD
- PermissionsModule — permission listing, matrix
- CompaniesModule — company CRUD
- BranchesModule — branch CRUD
- DepartmentsModule — department CRUD
- DashboardModule — dashboard KPIs
- AlertsModule — alert management
- NotificationsModule — notification rules
- SettingsModule — system settings
- AuditModule — audit logging
- AttachmentsModule — file attachments
- WarehousesModule — warehouse CRUD
- LocationsModule — location CRUD
- ProductCategoriesModule — category tree
- ProductsModule — product CRUD
- InventoryModule — balances, movements, counts
- MachinesModule — machine/asset CRUD
- MachinePartsModule — parts catalog
- MachineDocumentsModule — document management
- MaintenanceDashboardModule — maintenance KPIs
- MaintenanceRequestsModule — request CRUD, workflow
- MaintenanceTasksModule — task CRUD, assignment
- PreventiveMaintenanceModule — schedules, execution
- DowntimeLogsModule — downtime logging, analysis
- BarcodesModule — barcode records, templates, scans
- ReportsModule — report generation, export
- SearchModule — unified F9 search

### Inactive Module Stubs (not imported)

- SalesModule
- PurchasingModule
- FinanceModule
- HrModule
- AiModule
- IotModule
- BiModule
- ForecastingModule
- WorkflowsModule
- ImportExportModule
- PrintTemplatesModule

## Frontend (Next.js)

- Framework: Next.js 15.5.20 App Router
- Styling: Tailwind CSS
- i18n: Custom i18n with 1917 keys (en/ar)
- State: React hooks, server components
- Auth: JWT stored in localStorage

### Admin Pages (124)

access/ (permissions, roles, users)
alerts/
barcodes/ (records, templates, generate, scan, print, labels)
core/ (companies, branches, departments)
dashboard/
documents/ (attachments)
inventory/ (warehouses, locations, products, categories, balances, movements, counts, adjustments)
maintenance/ (dashboard, machines, parts, documents, requests, tasks, preventive, downtime, schedules)
notifications/
profile/
reports/ (inventory, maintenance, barcodes, audit, assets, partners, parts, user activity)
search/
settings/ (appearance, language, security, audit, company, notification-rules, numbering)

## Database (SQL Server)

- Instance: WINCC (port 50079)
- Database: ATsoftERP_DB
- ORM: Prisma 7.8.0
- No Sales, Purchasing, Finance, HR, AI, IoT, BI, Forecasting, Workflow, Import/Export, Print Template models

## Mobile

- Flutter source at apps/mobile/
- Flutter SDK not available on dev machine
- See KNOWN_LIMITATIONS.md

## Key Tags

- atsoft-erp-current-release-final
- atsoft-erp-batch40-final-release-package-acceptance-handover
