# 05 — Route → Page File → API → Permissions Map

## Coverage Confirmation

Every route listed in `navigation-data.ts` was verified to have a corresponding frontend page file (directory + `page.tsx`):

| Group | Routes | Page exists | Notes |
|-------|--------|-------------|-------|
| Core | 4 | 4/4 | — |
| Access | 3 | 3/3 | — |
| Inventory | 14 | 14/14 | — |
| Barcodes | 11 | 11/11 | — |
| Reports | 25 | 25/25 | — |
| Maintenance | 25 | 25/25 | `installed-parts` and `spare-part-conditions` are at `/admin/` root |
| Documents | 1 | 1/1 | — |
| System | 10 | 10/10 | — |
| Standalone | 6 | 6/6 | Dashboard, Search, Alerts, Notifications, Messaging |
| **Total** | **99** | **99/99** | |

## API Endpoint Coverage

All navigation routes correspond to backend controllers verified during previous audits:

| Frontend Group | Backend Modules |
|---------------|-----------------|
| Core | CompaniesModule, BranchesModule, AdministrationsModule, DepartmentsModule |
| Access | AuthModule, UsersModule, RolesModule, PermissionsModule |
| Inventory | InventoryModule, MovementsModule, AdjustmentsModule, BalancesModule, LocationsModule, CountsModule, ReconciliationModule, LocksModule, GovernanceModule |
| Barcodes | BarcodesModule, BarcodeJobsModule, BarcodeScansModule, BarcodeTemplatesModule |
| Reports | (view-only, data served by respective domain modules) |
| Maintenance | MachinesModule, SparePartsModule, RequestsModule, TasksModule, SchedulesModule, BOMModule, RepairOrdersModule, InstalledPartsModule, SLAModule, ReliabilityModule, CalendarModule, DowntimeModule, AccountabilityModule, PersonnelModule |
| Documents | AttachmentsModule |
| System | SystemSettingsModule, CompanyProfileModule, LanguageModule, AppearanceModule, SecurityModule, NumberingModule, NotificationRulesModule, AuditModule |
| Standalone | SearchModule, AlertsModule, NotificationsModule, MessagingModule |

## Permission Architecture

- No sidebar-level permission filtering is implemented in `sidebar.tsx`
- All nav items are visible to all authenticated users
- Individual pages check permissions via `crud-permissions.ts` helper
- `GET /auth/permissions` loads all user permissions at login
- Permission guards are at the API controller level, not the frontend nav level

**Key finding**: The sidebar currently shows all 99 items to every user regardless of their role/permissions. Future cleanup should add role-based nav filtering.

## Path Irregularities Found

| Nav Item | Route | Issue |
|----------|-------|-------|
| Installed Parts | `/admin/installed-parts` | Should be `/admin/maintenance/installed-parts` |
| Spare Part Conditions | `/admin/spare-part-conditions` | Should be `/admin/maintenance/spare-part-conditions` |
| MTTR | `/admin/maintenance/reliability/mttr` | Contains `/reliability/` segment but no corresponding parent "Reliability" nav item |
| Alerts icon | Uses `dashboard` icon | Should use a dedicated `alert` icon |
| Barcode overview | `/admin/barcodes` (group parent href) | Overlaps with group's parent href `#` for click-toggle groups |

## Group Parent Href Convention

Most groups use `href: '#'` to make the group header toggle its children:
- Groups using `#`: Core, Access, Inventory, Barcodes, Reports, Maintenance, Documents, System
- But Barcodes group has a child `barcode-overview` with `href: '/admin/barcodes'` — the group itself has `href: '#'`. This is inconsistent with the convention. Other groups don't have a "home" child that matches the group's natural URL.
