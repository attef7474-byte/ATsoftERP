# Requirements & Scope

## Requirements

1. **Hierarchical sidebar** — 10 main groups with subgroup sections and child links
2. **Accordion auto-collapse** — only one group open at a time
3. **Route-based auto-open** — navigating to a route automatically opens its group
4. **Collapsed mode** — icon-only sidebar with tooltip on hover
5. **Design tokens** — CSS custom properties for theming
6. **Theme customization** — background, accent color, density, font-size via Appearance settings
7. **RTL support** — proper indentation for Arabic layout
8. **Mobile menu** — mobile-friendly navigation panel
9. **Backward compatibility** — preserve existing NavItem type for any code still using it
10. **no route changes** — all existing route values preserved
11. **no permission changes** — existing permission system unchanged
12. **no forbidden module activation** — Sales, Purchasing, Finance, HR, AI, IoT remain hidden

## Scope (What Changed)

| File | Change |
|------|--------|
| `navigation-data.ts` | New `SidebarGroup`/`Section`/`Item` types + 10-group structure + `routeGroupMap` |
| `sidebar.tsx` | Full rewrite with accordion, CSS classes, route-based active detection |
| `admin-shell.tsx` | Single `openGroup` state, auto-collapse, localStorage theme loading |
| `mobile-menu.tsx` | Rewrite using `sidebarGroups` + local accordion |
| `globals.css` | ~340 lines of sidebar design tokens, variant data-attrs, CSS classes |
| EN/AR `navigation.ts` | 26 new i18n keys (4 group labels + 22 navSection keys) |
| EN/AR `settings.ts` | 12 new appearanceSettings keys for sidebar customization |
| `appearance/page.tsx` | Sidebar background/accent/density/font-size selectors |

## Scope (NOT Changed)

- No schema / DB changes
- No API endpoints
- No permissions
- No routes added or removed
- No forbidden modules
- No npm packages installed
- No existing i18n keys renamed or removed
