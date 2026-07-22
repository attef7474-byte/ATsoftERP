# Actions Handler Fix

## Changes in `admin-data-grid.tsx`

### Line 134: Add `data-actions-menu` attribute

```diff
- <div ref={menuRef} style={style} className="w-44 ..." onClick={(e) => e.stopPropagation()}>
+ <div ref={menuRef} data-actions-menu="true" style={style} className="w-44 ..." onClick={(e) => e.stopPropagation()}>
```

This allows the outside-click handler to correctly identify clicks inside the
portal menu. When the user clicks an action button, the `mousedown` handler
finds `[data-actions-menu]` containing the target, sets `clickedInsidePortal`
to `true`, and does NOT call `closeMenu()`. The `click` event then reaches
the action button's `onClick` handler normally.

### Line 146: Add `type="button"` to action buttons

```diff
- <button key={ai} onClick={() => { ... }} disabled={!enabled} className="...">
+ <button key={ai} type="button" onClick={() => { ... }} disabled={!enabled} className="...">
```

Prevents form submission behavior if the button renders inside a `<form>`.

## How it works now

1. User clicks action button inside portal dropdown
2. `mousedown` fires → outside-click handler checks `[data-actions-menu]` → finds it → skips `closeMenu()`
3. `click` fires → button's `onClick` → `onClose()` + `action.onClick(item)`
4. Action handler executes (navigation, modal open, confirmation, API call, etc.)
5. `onClose()` sets `openMenuRow` to `null`, menu closes
