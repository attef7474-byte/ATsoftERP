# Handover Document 1: Maintenance Domain Architecture Overview

## 1. System Context

ATsoft ERP is a comprehensive enterprise resource planning system with a maintenance management (CMMS) module as one of its operational domains. The maintenance domain handles machine management, spare parts, work requests, preventive maintenance, stock issuance, repair workflows, and cost tracking — all integrated with core ERP services (auth, permissions, numbering, audit, inventory, notifications).

The maintenance module operates within the current approved release scope and does **not** depend on Finance, Purchasing, Sales, or HR modules.

## 2. High-Level Architecture (Textual)

```
Browser (Next.js) ──HTTP/JSON──> API (NestJS) ──Prisma ORM──> SQL Server 2016
        │                             │
        ▼                             ▼
   i18n Context              Permission Guards
   (EN / AR)                 JWT Auth
                             Audit Module
                             Numbering Service
```

- **Frontend**: Next.js (TypeScript), ~250 pages total, ~45-55 maintenance pages
- **Backend**: NestJS (TypeScript), 76 registered modules, 36 maintenance-related
- **ORM**: Prisma (schema.prisma)
- **Database**: SQL Server 2016 Express (127.0.0.1:50079, DB=ATsoftERP_DB)
- **Auth**: JWT Bearer tokens with role-based permission guards

## 3. Module Inventory

| Category | Count |
|----------|-------|
| Registered backend modules (total) | 76 |
| Maintenance-related modules | 36 |
| Controllers | 34 |
| Estimated endpoints | ~345 |
| Frontend maintenance pages | ~45-55 |

### Key Maintenance Modules

- Machine Management (categories, machines, parts, components, documents)
- Maintenance Requests & Tasks
- Checklists & Executions
- Schedules & Preventive Maintenance
- Spare Parts (with condition balance)
- Stock Issue (spare part issuance)
- Installed Parts & Replacement History
- Repair Orders (repairable spare parts workflow)
- BOM & BOM Versions
- Preventive Spare Part Plans
- Personnel & Assignments
- Dashboards & Reports
- Cost Centers, Production Lines, Operation Types, SLA

## 4. Frontend Overview

- **Framework**: Next.js (TypeScript)
- **Total pages**: ~250
- **Maintenance route prefix**: `/admin/maintenance/*`
- **UI components**: `AdminDataGrid` (rich), `DataTable` (simple)
- **i18n**: React Context, 13 file pairs × 2 languages, ~2,977 keys each
- **CRUD patterns**: modal-based (`useCrudList`) vs standalone pages
- **Sidebar**: 17 maintenance children under maintenance section

## 5. Key Integration Points

| System | Integration |
|--------|-------------|
| Auth | JWT-based `@Auth()` decorator on all protected endpoints |
| Permissions | RBAC via `@RequirePermission()` decorator, seed-based |
| Numbering | `NumberingService.generateNumberAtomic()` for all generated codes |
| Audit | `AuditService` logs all create/update/delete/status-change operations |
| Inventory | `InventoryBalance` (Product-based), `InventoryMovement` for stock transactions |
| Notifications | MaintenanceNotification module (registered, 0 controller endpoints currently) |
| i18n | API returns `messageKey` + localized `message` for user-facing errors |

## 6. Technology Stack

| Layer | Technology |
|-------|------------|
| Backend runtime | Node.js 18+, NestJS (TypeScript) |
| Frontend | Next.js (TypeScript), React |
| ORM | Prisma |
| Database | SQL Server 2016 Express |
| Auth | JWT (jsonwebtoken + passport) |
| Testing | Jest (backend), Playwright (frontend — screenshots disabled) |
| Linting | ESLint, Prettier |
| Package manager | npm (workspaces) |
| Version control | Git |

## 7. Development Environment

- **OS**: Windows (local only, Docker forbidden)
- **Editor**: VS Code
- **Terminal**: PowerShell 7+
- **Database client**: sqlcmd
- **API dev**: `cd apps/api && npm run start:dev`
- **Web dev**: `cd apps/web && npm run dev`
- **Build**: `cd apps/api && npm run build` / `cd apps/web && npm run build`

## 8. Directory Structure (Maintenance Modules)

```
apps/api/src/
├── maintenance/
│   ├── machine-categories/
│   ├── machines/
│   ├── machine-parts/
│   ├── machine-components/
│   ├── machine-documents/
│   ├── maintenance-requests/
│   ├── maintenance-tasks/
│   ├── maintenance-schedules/
│   ├── preventive-maintenance/
│   ├── checklists/
│   ├── checklist-executions/
│   ├── downtime-logs/
│   ├── spare-parts/
│   ├── component-spare-parts/
│   ├── machine-spare-parts/
│   ├── spare-part-request-lines/
│   ├── stock-issue/
│   ├── installed-parts-replacement/
│   ├── repair-orders/
│   ├── b-(bom)/
│   ├── personnel/
│   ├── responsibility-assignments/
│   ├── request-assignments/
│   ├── part-accountability/
│   ├── request-parts/
│   ├── request-costs/
│   ├── dashboard/
│   ├── reliability/
│   ├── operation-types/
│   ├── cost-centers/
│   ├── production-lines/
│   └── ...
├── inventory/
│   ├── balances/
│   ├── movements/
│   └── ...
├── numbering/
├── audit/
├── auth/
└── ...

apps/web/src/
└── app/admin/maintenance/
    ├── machines/
    ├── requests/
    ├── spare-parts/
    ├── repair-orders/
    ├── plans/
    ├── checklists/
    ├── personnel/
    ├── settings/
    └── ...
```

## 9. Architectural Decisions

1. **Numbering Centralization**: All generated codes use `NumberingService.generateNumberAtomic()` — transaction-safe, no direct `numberSequence` access outside the service.
2. **Condition Balance as Side Ledger**: `SparePartConditionBalance` and `SparePartConditionMovement` track spare part conditions without modifying `InventoryBalance` (which remains Product-based).
3. **No Double Deduction**: Stock is deducted once on actual issue. Planning/reservation does not deduct.
4. **Blocked Warehouses**: Maintenance spare part issue uses `SPARE_PART` warehouse only. `PRODUCT` and `RAW_MATERIAL` warehouses are blocked.
5. **No Accounting/Purchasing Integration**: Stock issues do not create accounting journals or purchase orders. Cost reporting is operational only.
6. **API i18n**: All user-facing API errors return `messageKey` + localized `message` (Arabic primary, English fallback).
7. **Immutable Codes**: Generated numbers/codes are never editable after creation. Preview does not consume numbers.
8. **Migration Safety**: All schema changes via `sqlcmd` scripts only. `prisma db push`, `prisma migrate dev`, `prisma migrate reset` forbidden.

## 10. Security Model

- **Authentication**: JWT Bearer tokens via `@Auth()` guard
- **Authorization**: Permission-based via `@RequirePermission()` decorator
- **Secrets**: Never printed, committed, or exposed in logs/reports
- **API Errors**: Never leak stack traces, SQL errors, Prisma exceptions, or internal file paths
- **Rate Limiting**: Not currently implemented (future enhancement)
- **CORS**: Configured for development origins
