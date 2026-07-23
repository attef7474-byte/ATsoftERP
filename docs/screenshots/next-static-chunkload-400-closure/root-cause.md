# Root Cause

## Failed Assets
- `/admin/_next/static/chunks/8109-433fc1f8da01a33b.js` → 400 Bad Request
- `/admin/_next/static/css/f92ce3156817ee15.css` → 400 Bad Request

## File Existence
- `.next/static/chunks/` directory existed but contained ONLY `polyfills.js`
- `.next/static/css/` directory did NOT exist at all
- `.next/build-manifest.json` had `rootMainFiles: []` (empty) — this is a dev-mode build manifest

## Middleware
- No middleware files exist anywhere in the project (`middleware.ts`, `src/middleware.ts`)
- `next.config.ts` has only `images: { unoptimized: true }` — no rewrites, redirects, assetPrefix

## Service Worker
- No service worker registered (confirmed via grep for `serviceWorker`, `sw.js`, `workbox`, `manifest`)

## next.config
- No `assetPrefix`, `basePath`, `distDir`, `trailingSlash` — completely clean config

## Cache / .next State
- Two Next.js processes were running simultaneously:
  1. `next dev` (PID 36636) — development server
  2. `next start` (PID 14680) — production server
- `next dev` had overwritten `.next/static/` with dev-mode output, deleting all production chunks and CSS
- The production `next start` server was serving from this dev-corrupted `.next` directory
- When browser requested chunk files referenced by the HTML (from a previous production build's HTML), they either didn't exist or were served incorrectly

## Final Root Cause

> **`next dev` development server overwrote `.next/static/` with development-mode output (no CSS, no chunks, empty build manifest), but the production `next start` server continued serving from that corrupted `.next` directory, causing every `/_next/static/*` request to return HTTP 400.**
