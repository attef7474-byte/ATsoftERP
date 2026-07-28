# UX-0 — Organization Context Lite + Maintenance Auto-Fill — Summary

> **Status**: ACCEPTED  
> **Date**: 2026-07-28  
> **Branch**: `main` (or current)  
> **Baseline commit**: `335769e` (NX)  
> **Final commit**: _(to be set at closeout)_

## What Was Done

### 1. Frontend Auth Context (AuthProvider + useAuth)

- Created `apps/web/src/lib/auth-context.tsx` — `AuthProvider` React context + `useAuth()` hook
- Provides globally: `user` (UserProfile), `permissions`, `loading`, `error`, `login()`, `logout()`, `refreshProfile()`, `refreshPermissions()`, `isSuperAdmin`
- Automatically fetches `/auth/me` and `/auth/permissions` on mount if token exists
- Wrapped in root `layout.tsx` (available to all pages including login)
- Admin layout now uses `useAuth()` instead of manual `isAuthenticated()` check
- Login page now uses `useAuth().login()` which fetches profile + permissions

### 2. F9Lookup Enhancement

- Added optional `onItemSelect` prop to `F9Lookup` component
- Passes the full selected item (e.g., full Machine object) for richer form interactions

### 3. Machine Auto-Fill (Frontend)

- `requests/new/page.tsx`: When machine is selected, auto-fills `productionLineId` from `machine.productionLineId` and `costCenterId` from `machine.defaultCostCenterId`
- `requests/[id]/edit/page.tsx`: Same auto-fill when machine is changed

### 4. Backend Derivation

- Controller (`maintenance-requests.controller.ts`): `create` and `createEmergency` now pass full `CurrentUserType` instead of just `userId`
- Service (`maintenance-requests.service.ts`):
  - `createRequest` now accepts `CurrentUserType` and extracts `userId` from `user.id`
  - `validateOperationalContext`: If `productionLineId` not provided, derives from `machine.productionLineId`. If `costCenterId` not provided, derives from `machine.defaultCostCenterId`

### 5. No Schema Changes

- No database migrations
- No Prisma schema changes
- No forbidden module activation
- No placeholder pages

## Files Changed

| File | Change |
|------|--------|
| `apps/web/src/lib/auth-context.tsx` | **NEW** — AuthProvider + useAuth |
| `apps/web/src/app/layout.tsx` | Added AuthProvider wrapper |
| `apps/web/src/app/admin/layout.tsx` | Use useAuth() for auth guard |
| `apps/web/src/app/login/page.tsx` | Use useAuth().login() |
| `apps/web/src/components/f9/F9Lookup.tsx` | Added onItemSelect prop |
| `apps/web/src/app/admin/maintenance/requests/new/page.tsx` | Machine auto-fill, import Machine type |
| `apps/web/src/app/admin/maintenance/requests/[id]/edit/page.tsx` | Machine auto-fill, import Machine type |
| `apps/api/src/modules/factory/maintenance/maintenance-requests/maintenance-requests.controller.ts` | Pass full CurrentUserType to create/createEmergency |
| `apps/api/src/modules/factory/maintenance/maintenance-requests/maintenance-requests.service.ts` | Accept CurrentUserType, auto-derive productionLineId/costCenterId |

## Build Results

- `apps/api` — `npm run build`: PASS (0 errors)
- `apps/web` — `npm run build`: PASS (157 static pages, 0 errors)
