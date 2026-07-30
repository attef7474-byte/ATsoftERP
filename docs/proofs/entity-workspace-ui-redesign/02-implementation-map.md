# Implementation Map

## Reusable Components (`apps/web/src/components/entity/`)

| File | Purpose |
|------|---------|
| `index.ts` | Barrel export for all entity components |
| `entity-workspace-layout.tsx` | Main layout wrapper: content area + side drawer |
| `entity-page-header.tsx` | Gradient page header with icon badge |
| `entity-toolbar.tsx` | Action toolbar (search + grouped buttons) |
| `entity-detail-drawer.tsx` | Right-side detail drawer with internal nav and sections |
| `entity-drawer-nav.tsx` | Vertical navigation rail inside the drawer |
| `entity-empty-state.tsx` | Empty state with icon, title, optional description/action |
| `entity-status-badge.tsx` | Active/Inactive status badge |
| `entity-data-table.tsx` | Wrapper around AdminDataGrid with rounded container |

## Modified Files

| File | Description |
|------|-------------|
| `apps/web/src/components/admin/datagrid/body-row.tsx` | Row click guard — skips `button`, `a`, `input`, `select`, `textarea`, `[role="button"]`, `[data-no-row-open]` |
| `apps/web/src/app/globals.css` | +73 lines: workspace entity classes, drawer animation, section cards |
| `apps/web/src/app/admin/core/companies/page.tsx` | +273/-12: workspace layout, drawer with 5 sections |
| `apps/web/src/app/admin/core/branches/page.tsx` | +236/-12: workspace layout, drawer with 4 sections |
| `apps/web/src/app/admin/core/departments/page.tsx` | +160/-8: workspace layout, drawer with 2 sections |
| `apps/web/src/app/admin/access/users/page.tsx` | +172/-6: workspace layout, drawer with 3 sections |
| `apps/web/src/app/admin/inventory/warehouses/page.tsx` | +175/-5: workspace layout, drawer with 3 sections |
| `apps/web/src/lib/i18n/locales/en/workspace.ts` | New: workspace i18n namespace (EN) |
| `apps/web/src/lib/i18n/locales/ar/workspace.ts` | New: workspace i18n namespace (AR) |
| `apps/web/src/lib/i18n/locales/en/index.ts` | +1 line: register workspace namespace |
| `apps/web/src/lib/i18n/locales/ar/index.ts` | +1 line: register workspace namespace |

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

## Drawer Lifecycle

- Opens on row click (sets `selectedEntity` + `activeSection` + `drawerOpen`)
- Closes on route change (`pathname` or `searchParams` change)
- Closes if selected entity no longer exists in data (after delete)
- Closes via × button or drawer's internal close handler
- Section data fetched per-section on drawer open
- Loading state shown per section while data loads
