# Scope & Rules

## Scope (what changed)

| Area | Changes |
|------|---------|
| `navigation-data.ts` | New types (SidebarGroup/Section/Item), 10-group structure, routeGroupMap, empty navItems backward compat |
| `sidebar.tsx` | Full rewrite for new group/section/item rendering, accordion, CSS token classes, active route detection |
| `admin-shell.tsx` | Single openGroup state, auto-collapse on route change, localStorage sidebar theme loading, data-attrs |
| `mobile-menu.tsx` | Rewritten with sidebarGroups, local accordion, no NavigationItems dep |
| `globals.css` | ~200 lines of sidebar design tokens, variant data-attrs, CSS classes |
| EN/AR `navigation.ts` | 4 new group labels + 22 navSection keys |
| EN/AR `settings.ts` | 12 new appearanceSettings keys |
| `appearance/page.tsx` | Sidebar background, accent, density, font-size selectors + localStorage persistence |

## Scope (NOT changed)

- No schema / migration / DB changes
- No API endpoints added or modified
- No permissions added or modified
- No forbidden modules activated
- No routes added or removed (existing `route` values unchanged)
- No existing i18n keys removed or renamed
- No existing CSS classes removed without replacement
- No new npm packages installed
