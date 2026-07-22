# Fix Report

## Issue
Actions dropdown appeared but clicking any action item did nothing. Menu
closed on click but no modal opened, no navigation occurred, no action
executed.

## Root Cause
Two bugs in the portal-based actions menu:
1. Missing `data-actions-menu` attribute — outside-click handler couldn't
   detect clicks inside the portal, closed menu prematurely on `mousedown`.
2. Missing `type="button"` on action buttons — default `type="submit"` could
   cause form submission behavior.

## Fix
- Added `data-actions-menu="true"` to portal container div
- Added `type="button"` to all action buttons

## Validation
- typecheck: PASS
- build:web (125 pages): PASS
- i18n:check (2137 keys): PASS
