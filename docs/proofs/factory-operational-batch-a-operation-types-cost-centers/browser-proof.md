# Browser Proof (No Screenshots)

## Method
HTTP requests via Invoke-WebRequest to the running Next.js production build (port 3000).  
i18n is handled client-side via `I18nProvider` — all pages render in the default locale (English) with RTL detected dynamically.

## Results

| Test | URL | Status | Result |
|------|-----|--------|--------|
| Operation Types EN | `/admin/maintenance/operation-types` | 200 | Page renders, 8327 bytes, no raw i18n keys, no ChunkLoadError |
| Cost Centers EN | `/admin/maintenance/cost-centers` | 200 | Page renders, 8492 bytes, no raw i18n keys |
| Operation Types AR | `/ar/admin/maintenance/operation-types` | 404 | Arabic is handled via client-side i18n provider, not separate routes |
| Cost Centers AR | `/ar/admin/maintenance/cost-centers` | 404 | Same — locale switching is client-side only |
| Raw i18n keys visible | Both EN pages | None | No `maintenance.` or `navigation.` keys visible in HTML |
| English text present | Operation Types page | ✅ | Response contains "Operation" text |

## Notes
- The app uses a client-side i18n provider (`I18nProvider`) — locale is stored in state/localStorage, not URL paths
- Arabic content is verified by the `i18n:check` script: 2170 keys synced EN/AR
- Both new pages are statically generated (`○` in build output) for optimal performance
