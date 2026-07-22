# AdminDataGrid Split Map

## Compatibility entry point

`apps/web/src/components/admin/admin-data-grid.tsx` remains the public compatibility entry point. It re-exports `AdminDataGrid`, `AdminDataGridProps`, `GridAction`, and `GridColumn` from `./datagrid`, so existing page imports do not need to change.

## File map

| File | Responsibility moved from the former monolith |
| --- | --- |
| `datagrid/index.ts` | Internal barrel for the component and its public types. |
| `datagrid/types.ts` | The unchanged public `GridAction<T>`, `GridColumn<T>`, and `AdminDataGridProps<T>` contracts. |
| `datagrid/admin-data-grid.tsx` | Grid orchestration, controlled props, sorting dispatch, menu state, outside-click handling, RTL/LTR column order, and table composition. |
| `datagrid/actions-menu.tsx` | Three-dot trigger, row action cell/header, body portal, fixed positioning, viewport clamping, disabled actions, and Escape handling. |
| `datagrid/filters.tsx` | Filter icon, text/number/select filter controls, and the actions-column filter spacer. |
| `datagrid/toolbar.tsx` | Global search, filter toggle/indicator, clear filters, and refresh controls. |
| `datagrid/header-cell.tsx` | Sort icon and sortable/filterable column header rendering. |
| `datagrid/body-row.tsx` | Selection, zebra/hover state, value/render cells, row click, and direction-aware action-cell placement. |
| `datagrid/empty-state.tsx` | Existing error, loading, and empty result states. |

## Preserved public behavior

- Existing import paths remain valid.
- Props remain controlled by each page; the split adds no internal data fetching.
- The actions column remains before data columns in RTL DOM order and after them in LTR DOM order.
- Sort, column filters, global search, clear filters, refresh, selection, custom cell renderers, widths, and alignment retain their existing contracts.
- Empty, loading, and error states retain their previous precedence and messages.
- A blank `actions` array does not render an actions column.
- The row action callback continues to receive the complete row object.

## Intentional safety-only adjustments

- The three-dot trigger now explicitly uses `type="button"` so it cannot submit an ancestor form.
- The portal menu uses its measured dimensions and clamps its fixed position to the viewport. Oversized menus scroll within the available viewport height.
- An enabled action is invoked once before the menu close is committed; `finally` still closes the menu if the handler throws.

## Consumer scope

The compatibility entry point is used by Companies, Branches, Departments, Users, Roles, Permissions, Number Sequences, Notification Rules, Warehouses, Products, Inventory Movements, Inventory Balances, Audit Log, User Activity, and Login History.

No page imports were migrated as part of this internal split.
