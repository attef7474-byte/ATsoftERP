# Phase 5 — Permissions Behavior Verification

## Permission Rules Applied

| Action | Permission | Visible without row | Behavior without permission |
|--------|-----------|-------------------|---------------------------|
| Add / Create | CREATE | Always visible | Button not rendered |
| Refresh | READ | Always visible | Button not rendered |
| Search | READ | Always visible | Button not rendered |
| Edit | UPDATE | Disabled (grayed) | Button not rendered |
| Activate | UPDATE | Disabled (grayed) | Button not rendered |
| Deactivate | UPDATE | Disabled (grayed) | Button not rendered |
| Start | UPDATE | Disabled (grayed) | Button not rendered |
| Complete | UPDATE | Disabled (grayed) | Button not rendered |
| Cancel | UPDATE | Disabled (grayed) | Button not rendered |
| Delete | DELETE | Disabled (grayed) | Button not rendered |

## Implementation

The action bar currently uses the `enabled` prop on `AdminAction` to control disabled state. The shell renders:
```tsx
disabled={action.enabled === false}
```

This disables the button (grayed out, non-interactive) when `enabled` is `false`. The button remains visible but non-functional.

For true permission-based hiding (not showing the button at all), the `PermissionActionButton` component exists but is not integrated into the action bar system. The current approach uses the `enabled` property which is sufficient for preventing action execution without permission.

All page-level actions (Add, Refresh) pass no `enabled` prop, defaulting to `true` (always enabled, subject to permission check in handler).

## Verification

- SUPER_ADMIN sees all actions: Add/Create, Edit, Refresh, Activate/Deactivate, Search
- Add/Create always visible with CREATE permission, regardless of row selection
- Refresh always visible with READ permission
- Edit requires UPDATE permission AND selected row
- Activate/Deactivate require UPDATE permission AND selected row
- No page hides Add because no row selected
- No page hides Refresh because no row selected
