# Filters & Actions Proof

All migrated pages support:
- Global search bar at the top
- Toggleable filter row below headers (text inputs for text columns,
  select dropdowns for status/select columns)
- Sort indicators in headers (click to toggle asc/desc/none)
- Clear filters button (appears when any filter is active)
- Refresh button with loading spinner
- Row-level actions dropdown via portal (never clipped by sidebar or container)

## GridAction Features

- `enabled` now accepts `(item: T) => boolean` for per-row enable/disable
- Example: Activate shown only when status !== 'ACTIVE'; Deactivate only when
  status === 'ACTIVE'
- Danger variant (red) for destructive actions (delete, deactivate)
- Icons on each action button
- Close menu on action click
- Close menu on outside click
- Close menu on Escape
- Menu stays inside viewport
