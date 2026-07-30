# Settings / Theme Customization Proof

## Appearance Page Sidebar Controls

Verified via browser at `/admin/settings/appearance`:

| Control | Present | Value Options |
|---------|---------|---------------|
| Sidebar Background | ✓ | Navy (افتراضي), Slate (رمادي), Teal (زرقوني), Custom (مخصص) |
| Accent Color | ✓ | Teal (زرقوني), Blue (أزرق), Emerald (زمردي), Violet (بنفسجي) |
| Sidebar Density | ✓ | Default (افتراضي), Compact (مضغوط), Comfortable (مريح) |
| Sidebar Font Size | ✓ | Medium (متوسط), Large (كبير) |

## Persistence

- Values saved to `localStorage` on "حفظ" (Save) click:
  - `sidebar-background-mode`
  - `sidebar-accent-color`
  - `sidebar-density`
  - `sidebar-font-size`
- Applied as `data-*` attributes on root element via `admin-shell.tsx`:
  - `data-sidebar-bg`
  - `data-sidebar-accent`
  - `data-sidebar-density`
  - `data-sidebar-font`
- CSS custom properties in `globals.css` respond to data attributes

## API Integration

- Checkbox `sidebarCollapsed` saved via `api.patch('/settings/appearance', { sidebarCollapsed })`
- Sidebar theme prefs use localStorage (no schema change needed)
