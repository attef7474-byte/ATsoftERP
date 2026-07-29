# Handover Document 4: Frontend Guide

## 1. Frontend Technology

- **Framework**: Next.js (TypeScript), App Router
- **UI Components**: Custom components + shadcn/ui
- **State Management**: React hooks, API service layer
- **i18n**: React Context provider with 13 file pairs (EN/AR)
- **Grids**: `AdminDataGrid` (rich feature set) and `DataTable` (simple)
- **Build**: `npm run build` (includes type checking)
- **Dev**: `npm run dev` (hot reload)

## 2. Maintenance Page Inventory (~45-55 pages)

All pages live under `apps/web/src/app/admin/maintenance/`:

```
maintenance/
├── machines/                        # Machine list + detail + CRUD
│   ├── page.tsx
│   ├── new/page.tsx
│   └── [id]/page.tsx
├── machine-categories/
│   └── page.tsx
├── machine-parts/
│   └── page.tsx
├── machine-components/
│   └── page.tsx
├── machine-documents/
│   └── page.tsx
├── requests/                       # Maintenance requests list + detail
│   ├── page.tsx
│   ├── new/page.tsx
│   └── [id]/page.tsx
├── tasks/
│   ├── page.tsx
│   └── [id]/page.tsx
├── spare-parts/                    # Spare parts catalog
│   ├── page.tsx
│   ├── new/page.tsx
│   └── [id]/page.tsx
├── spare-part-request-lines/
│   └── page.tsx
├── stock-issue/                    # Stock issuance
│   ├── page.tsx
│   ├── new/page.tsx
│   └── [id]/page.tsx
├── repair-orders/                  # Repairable spare parts
│   ├── page.tsx
│   ├── new/page.tsx
│   └── [id]/page.tsx
├── preventive-maintenance/         # PM plans
│   ├── page.tsx
│   ├── new/page.tsx
│   └── [id]/page.tsx
├── schedules/
│   ├── page.tsx
│   ├── new/page.tsx
│   └── [id]/page.tsx
├── checklists/
│   ├── page.tsx
│   └── [id]/page.tsx
├── checklists-executions/
│   ├── page.tsx
│   └── [id]/page.tsx
├── boms/                           # BOM management
│   ├── page.tsx
│   ├── new/page.tsx
│   └── [id]/page.tsx
├── preventive-spare-part-plans/
│   ├── page.tsx
│   ├── new/page.tsx
│   └── [id]/page.tsx
├── personnel/
│   └── page.tsx
├── dashboard/
│   └── page.tsx
├── reliability/
│   └── page.tsx
├── reports/
│   └── page.tsx
├── downtime/
│   └── page.tsx
├── settings/
│   ├── page.tsx
│   ├── operation-types/page.tsx
│   ├── cost-centers/page.tsx
│   ├── production-lines/page.tsx
│   └── sla/page.tsx
└── installed-parts/
    └── page.tsx
```

## 3. Route Conventions

```
/admin/maintenance/<domain>/          # List page
/admin/maintenance/<domain>/new       # Create page
/admin/maintenance/<domain>/[id]      # Detail/Edit page
```

All routes are protected by auth guards at the layout level.

## 4. UI Component Library

| Component | Usage |
|-----------|-------|
| `AdminDataGrid` | Rich data tables with inline editing, filters, export, column visibility |
| `DataTable` | Simple read-only tables with pagination |
| `FormDialog` | Modal-based CRUD forms |
| `PageHeader` | Consistent page header with breadcrumbs |
| `StatusBadge` | Status indicators with color coding |
| `SearchInput` | Search with debounce |

## 5. i18n System

- **Provider**: React Context (`I18nProvider` in layout)
- **File pairs**: 13 TS files × 2 languages = 26 files
- **Total keys**: ~2,977 per language
- **Key files**:

```
apps/web/src/lib/i18n/locales/
├── en/
│   ├── common.ts
│   ├── auth.ts
│   ├── navigation.ts
│   ├── settings.ts
│   ├── maintenance.ts
│   ├── inventory.ts
│   ├── validation.ts
│   ├── api-messages.ts
│   ├── spare-parts.ts
│   ├── repair-orders.ts
│   ├── stock-issue.ts
│   ├── numbering.ts
│   └── dashboard.ts
└── ar/
    └── (same structure)
```

- **API i18n**: `api-messages.ts` contains ~46 keys for API error messages
- **Fallback**: Raw key returned if translation not found

## 6. CRUD Patterns

There are two competing patterns:

### Modal-based (older, core entities)
- Uses `useCrudList` hook
- CRUD in modal dialogs (`FormDialog`)
- Used for: machine categories, spare parts, personnel, settings

### Standalone pages (newer entities)
- Dedicated `/new` and `/[id]` pages
- Full-page forms with validation
- Used for: machines, requests, repair orders, stock issue

### Pattern to use for new work
Follow the standalone page pattern for new entities. The next planned batch (UI-QA) aims to standardize these patterns.

## 7. State Management

- **API calls**: Centralized service layer (`apps/web/src/lib/services/`)
- **Local state**: React `useState` / `useReducer`
- **Form state**: Controlled components with validation
- **No Redux/Zustand**: Not used in current codebase

## 8. Sidebar Navigation

Maintenance section has 17 children under `/admin/maintenance/`:

1. Dashboard
2. Machines
3. Machine Categories
4. Machine Parts
5. Machine Components
6. Maintenance Requests
7. Tasks
8. Spare Parts
9. Spare Part Requests
10. Stock Issue
11. Repair Orders
12. Preventive Maintenance
13. Schedules
14. Checklists
15. BOMs
16. Personnel
17. Reports

## 9. Auth/Permission UI Guards

- **Layout guard**: `auth()` function redirects to login if unauthenticated
- **Permission guard**: `checkPermission()` utility hides buttons/links
- **API guard**: Backend `@RequirePermission()` decorator enforces at endpoint level

## 10. Build & Development

```powershell
# Development
cd apps/web && npm run dev

# Build (with type checking)
cd apps/web && npm run build

# Lint
cd apps/web && npm run lint
```
