# Implementation Map

## Reusable Components (`apps/web/src/components/entity/`)

| File | Purpose |
|------|---------|
| `index.ts` | Barrel export for all entity components |
| `entity-workspace-layout.tsx` | Main layout wrapper: content area + side drawer |
| `entity-page-header.tsx` | Gradient page header with icon badge |
| `entity-toolbar.tsx` | Action toolbar (search + grouped buttons) |
| `entity-detail-drawer.tsx` | Side detail drawer — portaled to `document.body` (z-90), themed close × button with `closeLabel`, token-driven colors, 100px nav rail + content panel |
| `entity-drawer-nav.tsx` | Vertical navigation rail inside the drawer |
| `entity-empty-state.tsx` | Empty state with icon, title, optional description/action |
| `entity-status-badge.tsx` | Active/Inactive status badge |
| `entity-data-table.tsx` | Wrapper around AdminDataGrid with rounded container |
| `use-drawer-section-data.ts` | **NEW** race-safe drawer section fetcher: clears data on entity change, discards out-of-order responses, `loaded` flag prevents false empty states |

## Corrective Phase — Modified Files

| File | Description |
|------|-------------|
| `apps/web/src/components/entity/use-drawer-section-data.ts` | New hook (73 lines) |
| `apps/web/src/components/entity/entity-detail-drawer.tsx` | Portal to body (overlay z-80, panel z-90), visible close × with `closeLabel`, width `94vw/48vw/34vw min-360 max-560`, `bottom-5`, `rounded-b-[18px]`, token styling |
| `apps/web/src/app/globals.css` | `--ws-*` token block (teal default) + `[data-sidebar-accent=blue|emerald|violet]` variant blocks (follows Appearance page) |
| `apps/web/src/app/admin/core/companies/page.tsx` | 4 sections via `useDrawerSectionData` keyed on `selectedCompany.id`; warehouses fetcher → `/inventory/warehouses`; error effect → `handleApiError`; token styling; `closeLabel` |
| `apps/web/src/app/admin/core/branches/page.tsx` | 3 sections via hook — departments keyed on `branchId`, users/warehouses keyed on branch company (`companyId`, documented); warehouses → `/inventory/warehouses`; errors → `handleApiError` |
| `apps/web/src/app/admin/core/departments/page.tsx` | Users section via hook keyed on department company; errors → `handleApiError` |
| `apps/web/src/app/admin/access/users/page.tsx` | Roles rendered inline from `user.roles[].role`; **removed** `operational-scopes` section + `/users/:id/roles` fetch (both 404); removed `balance-summary`-style dead code; errors → `handleApiError` |
| `apps/web/src/app/admin/inventory/warehouses/page.tsx` | Locations via hook (plain-array response mapping); **removed** Balance Summary section (no such endpoint); errors → `handleApiError` |
| `apps/web/src/app/admin/maintenance/machine-parts/page.tsx` | Label `inventory.product` → `maintenance.linkedInventoryItem` |
| `apps/web/src/app/admin/maintenance/machine-parts/new/page.tsx` | Same label change |
| `apps/web/src/app/admin/maintenance/machine-parts/[id]/edit/page.tsx` | Same label change |
| `apps/web/src/app/admin/maintenance/machine-parts/[id]/page.tsx` | Detail label change |
| `apps/web/src/lib/i18n/locales/en/maintenance.ts` | +2 keys: `linkedInventoryItem`, `linkedInventoryItemHint` |
| `apps/web/src/lib/i18n/locales/ar/maintenance.ts` | +2 keys: `linkedInventoryItem`, `linkedInventoryItemHint` |

## Drawer Architecture

```
┌─────────────────────────────────────────────────────┐
│  Nav Rail (vertical)          │  Content Panel       │
│  ┌──────────────────┐        │  ┌────────────────┐  │
│  │ Overview         │        │  │ Overview:      │  │
│  │ Branches         │        │  │ Name, Code,    │  │
│  │ Departments      │ active │  │ Status, Stats  │  │
│  │ Users            │───────>│  │ ...            │  │
│  │ Warehouses       │        │  └────────────────┘  │
│  └──────────────────┘        │                       │
├──────────────────────────────┤                       │
│   Close (×) button           │                       │
└──────────────────────────────┴───────────────────────┘
```

Portal: `createPortal(<overlay z-80 /><panel z-90 />, document.body)` — sits above topbar (z-60), actionbar (z-55), statusbar (z-55), sidebar (z-50).

## Drawer Lifecycle

- Opens on row click (sets `selectedEntity` + `activeSection` + `drawerOpen`)
- Closes on route change (`pathname` or `searchParams` change)
- Closes if selected entity no longer exists in data (after delete)
- Closes via × button, Esc key, or overlay (mobile)
- Section data fetched via `useDrawerSectionData(entityId, fetcher)`:
  - data cleared immediately when `entityId` changes (no stale rows from previous entity)
  - out-of-order responses discarded (race-safe)
  - `loaded` flag distinguishes "fetched and genuinely empty" from "not yet fetched" — no false empty states
- Section API errors → `useApiErrorHandler` (Global Error Dialog, localized via `messageKey`)
