# 06 — Context UI and Smart Defaults Proof

## Components

### `OperationalContextGate`
- Wraps admin layout; shows context selector when `contextSelectionRequired` is true
- Shows loading spinner while contexts load
- Shows empty state with retry/logout if no contexts available
- Renders null (passes through to children) when context is ready

### `ContextSelector`
- Portal-based dialog for selecting operational context
- Radio-style grid of allowed contexts with ContextChip display
- Confirm button validates via API on selection
- Required mode (no close) for initial selection after login
- Optional mode with escape/close for switching

### `ContextChip`
- Displays company + branch (compact) or full path (company/branch/admin/department)
- Uses localized names from context (Arabic/English)

### `ContextSwitcher`
- Button in top bar showing current context
- Opens ContextSelector on click
- Only active when multiple contexts are available

## Layout Integration

### `admin/layout.tsx`
- `OperationalContextGate` shown when `!contextReady`
- Prevents access to admin pages until context is selected

### `admin-shell.tsx` / `top-bar.tsx`
- `ContextSwitcher` rendered in top bar between app name and action buttons

## Smart Form Defaults

### Inventory Movement Create (`movements/new/page.tsx`)
- `companyId`/`branchId` auto-filled from `activeContext`
- Displayed as read-only disabled inputs showing company/branch names
- `useEffect` syncs context changes to form

### Stock Transfers (`transfers/page.tsx`)
- Modal form pre-fills company/branch from `activeContext` as read-only
- Filter section includes F9 for company/branch with context-aware defaults

### Stock Adjustments (`stock-adjustments/page.tsx`)
- Modal form pre-fills company/branch from `activeContext` as read-only
- Filter section uses context-aware F9 lookups

### Operational Receipts (`operational-receipts/page.tsx`)
- Modal form pre-fills company/branch from `activeContext` as read-only
- Filter section uses context-aware F9 lookups

### Maintenance Request Create (`maintenance/requests/new/page.tsx`)
- Machine selection auto-fills productionLineId, operationTypeId, costCenterId
- Machine-aware filtering for spare parts and components
- Context fields shown as read-only

### Maintenance Request Edit (`maintenance/requests/[id]/edit/page.tsx`)
- Same auto-fill logic as create
- Machine-based derived fields blocked from manual edit

## F9 Context Binding

### `F9Lookup.tsx`
- `bindToActiveContext`: when true and adapter has `contextField`, auto-binds to active context
- `clearOnContextChange`: resets selection when context changes
- `clearOnFilterChange`: resets when filters change
- Operational route detection (`/admin/(inventory|maintenance|barcodes|reports)`) enables context binding

### `lookup-adapters.ts`
- `companyAdapter.contextField = 'companyId'`
- `branchAdapter.contextField = 'branchId'`
- `departmentAdapter.contextField = 'departmentId'`
- `administrationAdapter.contextField = 'administrationId'`

### `F9LookupModal.tsx`
- `contextVersion` prop triggers data refresh on context change
- All API calls include context headers automatically via `api.ts`

## Notifications Integration

### `use-notifications-polling.ts`
- Watches `contextReady` and `contextVersion` from operational context
- Only fetches unread count when context is ready
- Refetches when context changes
