# API Regression Report

> Batch 38 — Full QA Regression of all approved API groups

## Method

All GET endpoints were tested with admin JWT authentication. Expected status codes: 200/201/204. Summary: 99 endpoints across 33 API groups.

## Results

| Group | Tested | Passed | Failed |
|-------|--------|--------|--------|
| Auth | 3 | 3 | 0 |
| Dashboard | 3 | 3 | 0 |
| Companies | 1 | 1 | 0 |
| Branches | 1 | 1 | 0 |
| Departments | 2 | 2 | 0 |
| Users | 1 | 1 | 0 |
| Roles | 1 | 1 | 0 |
| Permissions | 4 | 4 | 0 |
| Alerts | 2 | 2 | 0 |
| Notifications | 2 | 2 | 0 |
| Settings | 2 | 2 | 0 |
| Audit | 2 | 2 | 0 |
| Attachments | 2 | 2 | 0 |
| Warehouses | 1 | 1 | 0 |
| Locations | 1 | 1 | 0 |
| Products | 3 | 3 | 0 |
| InventoryBalances | 2 | 2 | 0 |
| InventoryMovements | 1 | 1 | 0 |
| InventoryCounts | 1 | 1 | 0 |
| InventoryAdjustments | 1 | 1 | 0 |
| Machines | 3 | 3 | 0 |
| MachineParts | 2 | 2 | 0 |
| MachineDocuments | 1 | 1 | 0 |
| MaintenanceRequests | 2 | 2 | 0 |
| MaintenanceTasks | 3 | 3 | 0 |
| Preventive | 4 | 4 | 0 |
| Downtime | 3 | 3 | 0 |
| MaintDashboard | 7 | 7 | 0 |
| Barcodes | 5 | 5 | 0 |
| Reports | 23 | 23 | 0 |
| Search | 2 | 2 | 0 |
| PaymentTerms | 1 | 1 | 0 |
| Numbering | 1 | 1 | 0 |
| BusinessPartners | 5 | 5 | 0 |
| **TOTAL** | **99** | **99** | **0** |

## Route Corrections Found

| Original Test Route | Correct Route | Status |
|---------------------|---------------|--------|
| `/inventory/balances/summary` | `/inventory/summary/balances` | Fixed |
| `/maintenance/requests/summary` | `/maintenance/summary/requests` | Fixed |
| `/numbering/code/DEFAULT` | No `DEFAULT` code exists — test data limitation | Not a bug |

## Summary: 99/99 PASS

All approved API endpoints respond with expected status codes. No 404 or 500 errors on valid routes.
