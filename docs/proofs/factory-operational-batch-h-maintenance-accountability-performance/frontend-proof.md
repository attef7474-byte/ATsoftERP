# Frontend Implementation — Batch H

## Pages Created (3)

### 1. Personnel Page
- **Route:** `/admin/maintenance/personnel`
- **Features:** List with grid, create/edit inline modal, activate/deactivate, search, pagination
- **F9 adapter:** `maintenancePersonnelAdapter` registered for unified search

### 2. Machine Responsibilities Page
- **Route:** `/admin/maintenance/machine-responsibilities`
- **Features:** List with grid, create/edit inline modal with F9 lookups for machine and personnel, end/cancel
- **Pattern:** Uses `machineAdapter` and `maintenancePersonnelAdapter` for form lookups

### 3. Accountability Dashboard Page
- **Route:** `/admin/maintenance/accountability`
- **Features:** KPI cards (personnel count, active responsibilities, active assignments, part accountabilities), breakdown tables (personnel by role, top assignees, machines with most responsibilities, part accountability by status, top personnel)

## Sections Added (3)

### 1. Machine Detail — Responsibilities Tab
- **Route:** `/admin/maintenance/machines/[id]` (new tab)
- **Features:** Data table of active responsibilities for the machine

### 2. Request Detail — Assignments Tab
- **Route:** `/admin/maintenance/requests/[id]` (new tab)
- **Features:** Data table of personnel assignments for the request

### 3. Request Detail — Part Accountability Tab
- **Route:** `/admin/maintenance/requests/[id]` (new tab)
- **Features:** Data table of spare part accountability records with assigned, used, returned quantities

## Navigation
- 3 new sidebar entries under Maintenance section
- i18n nav keys added for EN and AR

## Build Verification
| Check | Status |
|---|---|
| `build:web` | ✅ 135 static pages, 0 errors |
