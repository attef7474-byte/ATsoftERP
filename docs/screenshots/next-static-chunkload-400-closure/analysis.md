# Next Static ChunkLoad 400 Closure — Analysis

## Problem

Browser console shows:
- `Failed to load resource: the server responded with a status of 400 (Bad Request)`
  - `http://localhost:3000/_next/static/chunks/8109-433fc1f8da01a33b.js`
  - `http://localhost:3000/_next/static/css/f92ce3156817ee15.css`
- `Uncaught ChunkLoadError: Loading chunk 8109 failed.`

## Symptoms

- `/_next/static/chunks/*.js` returning HTTP 400
- `/_next/static/css/*.css` returning HTTP 400
- `ChunkLoadError` in browser console
- Pages fail to render or show broken layout

## Scope

All pages using Next.js app router — any page referencing hashed chunk filenames.
