# UX-0 — Browser/DOM Proof

## Frontend Changes Verified

### 1. AuthProvider — Wrapping

- Root `layout.tsx` wraps `<AuthProvider>` inside `<ToastProvider>` ✓
- Available globally to all pages including login ✓
- `useAuth()` available via React context ✓

### 2. Admin Layout — Auth Guard

- Uses `useAuth().loading` and `useAuth().user` instead of manual `isAuthenticated()` ✓
- Shows loading spinner while auth context initializes ✓
- Redirects to `/login` if not authenticated ✓

### 3. Login Page

- Uses `useAuth().login()` which calls `/auth/login` then fetches profile via `/auth/me` ✓
- After login, redirects to `/admin/dashboard` ✓

### 4. F9Lookup — onItemSelect

- New optional `onItemSelect` prop added ✓
- Called with full item object after selection ✓
- Backward compatible — existing usage unchanged ✓

### 5. Maintenance Request New Form — Auto-Fill

- Machine F9Lookup has `onItemSelect` handler ✓
- When machine selected: `productionLineId` set from `machine.productionLineId` ✓
- When machine selected: `costCenterId` set from `machine.defaultCostCenterId` ✓
- Fields remain editable for override ✓
- No additional i18n keys needed (auto-fill is silent) ✓

### 6. Maintenance Request Edit Form — Auto-Fill

- Same auto-fill on machine change ✓
- Guarded by `isReadOnly` check ✓

### 7. No Broken Navigation

- All existing page routes unchanged ✓
- No new page routes added ✓
- No placeholder pages ✓

### 8. i18n — No Raw Keys

- No new hardcoded strings or i18n keys introduced ✓
- Login form continues using existing i18n keys ✓
