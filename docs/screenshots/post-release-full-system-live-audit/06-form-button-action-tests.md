# Form & Button Action Tests

**Date:** 2026-07-20

## Methodology

All major CRUD routes were verified to exist as built pages.
Form actions and button interactions are handled client-side via React Server Components
and cannot be fully tested without authenticated user session and database seed data.

## Verified Page Structure

| Module | New/Create | Edit | View/Detail | List | Delete |
|--------|-----------|------|-------------|------|--------|
| Users | page exists | page exists | page exists | page exists | soft delete via API |
| Roles | page exists | page exists | page exists | page exists | soft delete via API |
| Permissions | N/A (seed) | N/A (seed) | N/A | page exists | N/A |
| Branches | page exists | page exists | page exists | page exists | soft delete via API |
| Departments | page exists | page exists | page exists | page exists | soft delete via API |
| Companies | page exists | page exists | page exists | page exists | soft delete via API |
| Warehouses | page exists | page exists | page exists | page exists | soft delete via API |
| Locations | page exists | page exists | page exists | page exists | deactivate via API |
| Products | page exists | page exists | page exists | page exists | soft delete via API |
| Categories | page exists | page exists | page exists | page exists | soft delete via API |
| Machines | page exists | page exists | page exists | page exists | soft delete via API |
| Maintenance Requests | page exists | page exists | page exists | page exists | soft delete via API |
| Tasks | page exists | page exists | page exists | page exists | soft delete via API |
| Schedules | page exists | page exists | page exists | page exists | soft delete via API |
| Inventory Counts | page exists | page exists | page exists | page exists | soft delete via API |
| Inventory Adjustments | page exists | page exists | page exists | page exists | soft delete via API |
| Inventory Movements | page exists | page exists | page exists | page exists | soft delete via API |
| Barcode Templates | page exists | page exists | page exists | page exists | soft delete via API |
| Barcode Labels | page exists | N/A | page exists | page exists | soft delete via API |

## Workflow Actions (API-Level)

| Action | Endpoint | Status |
|--------|----------|--------|
| Start count | PATCH `/inventory/counts/:id/start` | Implemented |
| Complete count | PATCH `/inventory/counts/:id/complete` | Implemented |
| Post adjustment | PATCH `/inventory/adjustments/:id/post` | Implemented |
| Cancel adjustment | PATCH `/inventory/adjustments/:id/cancel` | Implemented |
| Assign technician | PATCH `/maintenance/requests/:id/assign` | Implemented |
| Start maintenance | PATCH `/maintenance/requests/:id/start` | Implemented |
| Complete maintenance | PATCH `/maintenance/requests/:id/complete` | Implemented |
| Cancel maintenance | PATCH `/maintenance/requests/:id/cancel` | Implemented |
| Reopen request | PATCH `/maintenance/requests/:id/reopen` | Implemented |
| Start task | PATCH `/maintenance/tasks/:id/start` | Implemented |
| Complete task | PATCH `/maintenance/tasks/:id/complete` | Implemented |
| Scan barcode | POST `/barcodes/scan` | Implemented |
| Mark label printed | POST `/barcodes/labels/:id/mark-printed` | Implemented |

## Conclusion

All CRUD pages are structurally complete with create, edit, view, and list views.
Workflow state transitions are implemented at the API level for all business processes.
Action buttons and forms cannot be fully interactively tested without seed data.
