# UX-0 — API Proof

## Backend Changes Verified

### 1. Controller — `CurrentUserType` Passed

**File**: `maintenance-requests.controller.ts`

- `create(@Body() dto, @CurrentUser() user: CurrentUserType)` ✓
- `createEmergency(@Body() dto, @CurrentUser() user: CurrentUserType)` ✓
- Other endpoints remain with `@CurrentUser('id') userId: string` (no change needed)

### 2. Service — Auto-Derivation

**File**: `maintenance-requests.service.ts`

- `create(dto, user: CurrentUserType)` — accepts full user with org context ✓
- `createEmergency(dto, user: CurrentUserType)` — accepts full user ✓
- `createRequest(dto, user: CurrentUserType, isEmergency)` — extracts `userId = user.id` ✓
- `validateOperationalContext`:
  - If `productionLineId` not provided AND machine has `productionLineId` → auto-assign ✓
  - If `costCenterId` not provided AND machine has `defaultCostCenterId` → auto-assign ✓
  - Validation rules remain intact (cross-checks when values are explicitly provided) ✓

### 3. Auth Endpoints — No Change

- `/auth/me` — unchanged, already returns `companyId`, `branchId`, `departmentId`
- `/auth/login` — unchanged (returns `{ accessToken, user: { id, email, name } }`)
- Profile fetching happens on frontend after login via `/auth/me`

### 4. No New Endpoints

No API endpoints were created or removed.

### 5. No Schema Changes

Confirmed: no Prisma schema modifications.
