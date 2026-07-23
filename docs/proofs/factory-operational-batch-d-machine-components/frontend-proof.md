# Frontend Proof — Batch D: Machine Components

## Pages Implemented

### List Page (`machine-components/page.tsx`)
- AdminDataGrid with columns: code, name, componentType, criticality, machine, status (CmmsStatusBadge)
- Inline modal for create/edit with all form fields
- F9Lookup for parent component
- Select dropdowns for componentType (13 options) and criticality (4 options)
- Pagination, search, action bar
- ConfirmDialog for status changes

### Create Page (`machine-components/new/page.tsx`)
- Dedicated route with Card layout
- All form fields: code, name, description, componentType, criticality, locationInMachine, manufacturer, model, serialNumber, parentComponentId
- Validation for required fields (code, name)
- F9Lookup for parent component
- Action bar with save/cancel/back
- On success redirects to detail page

### Detail Page (`machine-components/[id]/page.tsx`)
- Fetches single record with children included
- Data display cards: basic info, details, parent component (with link), children DataTable
- Action bar: edit, refresh, activate, deactivate, back
- LoadingState / ErrorState handling
- ConfirmDialog for activate/deactivate

### Edit Page (`machine-components/[id]/edit/page.tsx`)
- Pre-fetches existing record
- Same form fields as create
- Dirty tracking (only sends changed fields on PATCH)
- Read-only guard when status !== ACTIVE
- Action bar: save, cancel, back
- On success redirects to detail page

## Component Patterns Used
- `'use client'` directive
- `useRegisterAdminActions` + `useStableHandlers` for action bar
- `CmmsStatusBadge` for status
- `F9Lookup` + `machineComponentAdapter` for parent component selection
- `AdminDataGrid` + `GridColumn` + `GridAction` for list
- `DataTable` for children list
- `Card` / `CardContent` / `CardHeader` for layout
- `Select` component with enum options
- `ConfirmDialog` for destructive operations
- `LoadingState` / `ErrorState` for async states

## TypeScript Interface
Added `MachineComponent` to `admin-types/maintenance.ts` with all fields and relations (machine, parentComponent, children, _count.children).
