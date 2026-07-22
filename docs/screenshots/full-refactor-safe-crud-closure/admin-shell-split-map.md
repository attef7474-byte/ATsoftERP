# AdminShell Split Map

## Compatibility entry point

`apps/web/src/components/admin/admin-shell.tsx` remains the public client entry point and re-exports `AdminShell` from `./shell`. The existing `app/admin/layout.tsx` import is unchanged.

## File map

| File | Responsibility moved from the former monolith |
| --- | --- |
| `shell/index.ts` | Internal barrel for `AdminShell`. |
| `shell/admin-shell.tsx` | Shell state and composition, action-bar context consumption, profile/clock lifecycle, language/logout callbacks, CSS variables, workspace/status bar, and unified-search modal. |
| `shell/navigation-data.ts` | Unchanged accepted-domain navigation tree and navigation types. |
| `shell/sidebar.tsx` | Shared navigation rendering plus expanded and collapsed desktop sidebar behavior. |
| `shell/mobile-menu.tsx` | Existing mobile backdrop, panel, close behavior, navigation, and profile summary. |
| `shell/top-bar.tsx` | Existing application title, sidebar toggle, F9 search trigger, notification bell, and user controls. |
| `shell/user-menu.tsx` | Language toggle, profile link, avatar/user labels, logout, and mobile profile summary. |
| `shell/shell-icons.tsx` | Unchanged navigation SVG components and icon map. |
| `shell/breadcrumb.tsx` | Existing pathname-to-title mapping and the status-bar title span; no new visible breadcrumb was introduced. |
| `shell/notification-button.tsx` | Thin wrapper around the existing single `NotificationBell` instance. |
| `shell/message-button.tsx` | Existing `/admin/messaging` navigation leaf with the same icon, classes, active state, and close callback; no new top-bar button was added. |
| `shell/f9-shortcut.tsx` | Existing F9/Ctrl-or-Cmd-K listener and top-bar search button. |

## Preserved contracts

- `AdminActionBarProvider` still wraps all admin page children exactly once.
- Action toolbar visibility still drives `--app-actionbar-active-height`.
- Desktop collapse still drives `--app-sidebar-collapsed`.
- Sidebar sections, exact-match active route highlighting, collapsed-icon expansion, and mobile close-on-navigation remain unchanged.
- Arabic/English selection still comes from the existing i18n provider and controls the shell `dir` attribute.
- Profile loading, logout, clock refresh, F9 search, notifications, messaging route, main workspace, and status bar retain their existing behavior.
- No permission-based navigation filter was invented; authentication remains owned by `app/admin/layout.tsx`, and authorization remains with existing page/API enforcement.
- No rejected-domain navigation or search entry was introduced.

## Safety notes

- Leaf components import their direct dependencies instead of importing the shell barrel, preventing circular shell imports.
- Notification polling remains inside the existing `NotificationBell`; the wrapper does not create a second polling instance.
- The message component represents the existing sidebar navigation entry only, avoiding an unrequested visible top-bar change.
- Existing baseline positioning and physical RTL utility classes were moved without redesign.
