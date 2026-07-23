# Root Cause

## Failed Assets
- `/_next/static/chunks/8109-433fc1f8da01a33b.js` → 400 Bad Request
- `/_next/static/css/f92ce3156817ee15.css` → 400 Bad Request
- `/_next/static/chunks/app/page-3e8855106a60ea12.js` → 400 Bad Request

## File Existence
- `.next/static/chunks/` directory contained ONLY `polyfills.js`
- `.next/static/css/` directory did NOT exist at all
- `.next/build-manifest.json` had `rootMainFiles: []` (empty) — this is a **dev-mode build manifest**
- `.next/static/development/` directory present (dev-mode artifact)

## Middleware
- No middleware files exist anywhere in the project (`middleware.ts`, `src/middleware.ts`)
- `next.config.ts` has only `images: { unoptimized: true }` — no rewrites, redirects, assetPrefix

## Service Worker
- No service worker registered (confirmed via grep for `serviceWorker`, `sw.js`, `workbox`, `manifest`)

## next.config
- No `assetPrefix`, `basePath`, `distDir`, `trailingSlash` — completely clean config

## Server Mode Mismatch — The Root Cause
The project has two operational modes:

1. **Development mode** — `npm run dev:web` → `next dev`
   - Serves content via webpack dev middleware (in-memory)
   - Writes minimal dev-mode files to `.next/` (no CSS, no chunks, empty build manifest)
   - Hot Module Replacement (HMR), fast refresh enabled

2. **Production mode** — `npm run build:web` → `next build` + `next start`
   - Requires `next build` first to produce full static output in `.next/`
   - `next start` serves from `.next/static/chunks/` and `.next/static/css/`
   - No HMR, no webpack middleware

The error occurs when:
- `next dev` runs first (even briefly), writing dev-mode files to `.next/static/`
- Then `next start` is started against the same `.next/` directory
- `next start` expects production chunks and CSS in `.next/static/` — but only dev-mode stubs exist
- Every `/_next/static/*` request fails with HTTP 400 because the server cannot find the expected chunks

## Why It Recurred After First Fix
The first fix (clean `.next`, rebuild, restart `next start`) worked temporarily, but as soon as `next dev` ran again for development work, it corrupted `.next/` again with dev-mode output. The next `next start` then failed with the same 400 errors.

## Final Root Cause
> **`next dev` (development server) corrupts `.next/static/` with dev-mode output. Running `next start` (production server) against this dev-mode `.next/` causes all `/_next/static/*` requests to return HTTP 400. The project had no safe `start:web` script that ensures a production build exists before starting the production server.**
