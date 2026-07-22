# Root Cause: Actions Dropdown Click Handler Not Firing

## Bug 1: Missing `data-actions-menu` attribute

The `mousedown` outside-click handler (`admin-data-grid.tsx:182-193`) identifies
portal clicks by querying `[data-actions-menu]` elements:

```ts
const portalMenus = document.querySelectorAll('[data-actions-menu]');
```

The portal `<div>` (line 132-136) did not have this attribute:

```tsx
<div ref={menuRef} style={style} className="..." onClick={(e) => e.stopPropagation()}>
```

Without the attribute, clicking any action button triggered the outside-click
handler, which called `closeMenu()` during `mousedown` — before the `click`
event reached the button's `onClick` handler. React 18's batching meant the
state update from `closeMenu()` was committed before the next event (`click`),
unmounting the portal before the action executed.

## Bug 2: Missing `type="button"` on action buttons

Action buttons lacked `type="button"`:

```tsx
<button key={ai} onClick={() => { ... }}>
```

Buttons default to `type="submit"` which triggers form submission if the
button is inside a `<form>` element — preventing the `onClick` from working.
