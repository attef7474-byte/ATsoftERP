# AdminDataGrid Actions Menu Contract

## Rendering and layering

- Render only when the current row key equals the grid's single `openMenuRow` value.
- Wait for client mount before accessing `document.body`.
- Render with `createPortal(..., document.body)`.
- Use `position: fixed` and `z-index: 100`, above the grid, main workspace, sidebar, top bar, and current F9 overlay layers.
- Recalculate position on capture-phase scroll and on window resize.
- Clamp horizontally and vertically to an 8px viewport margin.
- Use the measured menu dimensions; constrain oversized menus with a viewport-safe max height and vertical scrolling.

## Direction

- In RTL, anchor the menu from the trigger's left edge before viewport clamping.
- In LTR, anchor the menu from the trigger's right edge before viewport clamping.
- Keep the actions column in the established direction-aware table position.

## Open and close behavior

- The trigger stops row-click propagation and explicitly uses `type="button"`.
- Only one row menu may be open at a time.
- Clicking the active trigger toggles its menu closed.
- A document `mousedown` outside both the active trigger and `[data-actions-menu]` closes the menu.
- A click inside the portal does not trigger the outside-close path.
- Escape stops propagation and closes the menu.
- Scroll and resize listeners and the Escape listener are removed on unmount.

## Action execution

- `enabled` may be a boolean or a function of the complete row.
- Omitted `enabled` means enabled.
- Disabled actions remain visible, are disabled at the button level, and never invoke their callback.
- Enabled menu buttons explicitly use `type="button"`.
- A click invokes exactly one `action.onClick(item)` call with the complete row.
- The menu closes in `finally` after the callback has been invoked.
- No action handler is duplicated in the row component or trigger.

## Compatibility constraints

- Keep the `data-actions-menu` marker in sync with outside-click detection.
- Keep the active trigger ref assigned before opening the portal.
- Keep the close callback stable so menu effects are not repeatedly rebound.
- Keep the public `GridAction<T>` shape unchanged.
