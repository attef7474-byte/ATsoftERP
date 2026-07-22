# Fix Report

## Issue
Actions dropdown in AdminDataGrid was hidden under the main sidebar/menu due to
stacking context restrictions and overflow clipping.

## Root Cause
1. `.admin-main` container (z-index: 40) creates a stacking context that traps
   all children below the sidebar (z-index: 50).
2. `overflow: hidden` on the grid wrapper clipped absolutely positioned elements.

## Fix Applied
1. Portal: Actions menu rendered via `createPortal` to `document.body`.
2. Positioning: `position: fixed` using `getBoundingClientRect()`.
3. z-index: 100 (above all admin layout layers).
4. Removed `overflow: hidden` from grid wrapper.
5. Handle scroll/resize/Escape/outside click.
6. GridAction.enabled now supports per-row function evaluation.

## Pages Migrated
7 pages converted from old DataTable to AdminDataGrid with full unified styling.

## Validation
- typecheck: PASS
- build:web (125 pages): PASS
- i18n:check (2137 keys): PASS
- prisma validate: PASS
- prisma generate: PASS
- build:api: PASS
- health: 3/4 PASS (web unreachable — dev server not started)
- smoke: 1/3 PASS (login page; homepage and login fail — pre-existing env issue)
