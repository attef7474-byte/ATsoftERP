# Sidebar Behavior Proof

## Accordion Auto-Collapse

- **Implementation**: `admin-shell.tsx` uses single `openGroup: string | null` state
- `toggleGroup(id)` sets `openGroup === id ? null : id` (toggle open/close, auto-close others)
- **Verified**: Clicking "التنظيم" opens it with 7 child items; clicking another group closes previous

## Route-Based Auto-Open

- `getActiveGroupId(pathname)` uses `routeGroupMap` prefix matching
- `useEffect` syncs `openGroup` with `activeGroupId` on route changes
- **Verified**: `/admin/inventory/warehouses` → Inventory group opens (14 items)
- **Verified**: `/admin/maintenance/requests` → Maintenance group opens (18 items)
- **Verified**: `/admin/core/companies` → Organization group opens (7 items)

## Active Item Highlighting

- `.sidebar-item.active` and `aria-current="page"` set on matching route
- **Verified**: 1 active item highlighted at any time

## Sidebar States

| State | Behavior |
|-------|----------|
| Expanded (default) | 272px, full group/section/item tree visible for active group |
| Collapsed | 72px, icon-only buttons, click opens expanded mode + correct group |

## RTL Support

- `dir="rtl"` on root when Arabic locale is active
- CSS variables adapt padding direction via logical properties where applicable
