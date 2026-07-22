# Admin Shell Navigation Contract

## Public shell boundary

- Admin pages continue to enter through `apps/web/src/components/admin/admin-shell.tsx`.
- `app/admin/layout.tsx` continues to perform the authentication check and auto-logout registration before rendering `AdminShell`.
- `AdminShell` continues to provide the action-bar context to all nested admin routes.

## Navigation data

- Keep the existing IDs, labels, hrefs, icons, hierarchy, and ordering.
- Keep the Core, Access Control, Inventory, Barcodes, Reports, Maintenance, Search, Alerts, Documents, System, Notifications, and Messaging entries.
- Keep `/admin/notifications` and `/admin/messaging` as direct navigation routes.
- Do not add Sales, Purchasing, Finance, HR, AI, IoT, BI, Forecasting, Workflows, Import/Export Designer, or Print Template Designer.
- Do not add a shell-level permission filter without a separately defined route-to-permission contract. The split preserves the current static navigation and existing backend/page authorization.

## Route and sidebar behavior

- Active links use exact pathname equality.
- Expanded sections default to closed and are toggled by their section button.
- Clicking a mobile leaf closes the mobile panel.
- Clicking a collapsed desktop icon expands the sidebar and marks that section expanded; it does not directly navigate.
- RTL/LTR direction remains rooted at the shell and mobile placement remains direction-aware.
- Existing CSS class names and custom properties remain stable.

## F9 search

- Exactly one global `keydown` listener is registered and cleaned up.
- F9 prevents the browser default and toggles unified search even when an input is focused.
- Ctrl/Cmd+K toggles search only outside `INPUT`, `TEXTAREA`, and `SELECT` targets.
- The top-bar search icon opens the same `UnifiedSearchModal`.
- The unified search registry, routes, sanitizers, and permission behavior are not modified by the shell split.

## Notifications and messaging

- The top bar renders one existing `NotificationBell`, preserving its unread polling, open refresh, dropdown, and view-all route.
- Messaging remains the existing sidebar navigation entry and retains its messaging icon and active-route styling.
- No unread-message polling or new message shortcut is introduced.

## User and locale behavior

- Profile remains loaded through `getProfile()` without blocking shell rendering.
- The existing avatar fallback, loading labels, profile link, and logout callback remain unchanged.
- Language toggle continues to call the existing i18n `setLocale`, which owns persistence and document direction.
- The status clock continues to refresh every 30 seconds using the current locale.
