# Database Audit — SQL Server (WINCC:50079 / ATsoftERP_DB)

> Date: 2026-07-23  
> Connection: SQL Server direct via `sqlcmd`

---

## Current Record Counts

| Table | Row Count |
|---|---|
| `companies` | 6 |
| `branches` | 4 |
| `administrations` | 2 |
| `departments` | 4 |
| `users` | 3 |
| `roles` | 4 |
| `products` | 4 |
| `machine_categories` | 2 |
| `machines` | 1 |
| `machine_parts` | 0 |
| `machine_documents` | 0 |
| `maintenance_requests` | 1 |
| `maintenance_tasks` | 0 |
| `downtime_logs` | 0 |
| `maintenance_schedules` | 0 |

---

## Existing Tables (Non-Maintenance)

| Table | Purpose |
|---|---|
| `companies` | ✅ |
| `branches` | ✅ |
| `administrations` | ✅ (NEW — Phase 0) |
| `departments` | ✅ |
| `users` | ✅ |
| `roles` | ✅ |
| `products` | ✅ |
| `number_sequences` | ✅ (MACHINE, MACHINE_PART, MAINTENANCE_REQUEST sequences exist) |
| `permissions` | ✅ |
| `role_permissions` | ✅ |
| `audit_logs` | ✅ |

---

## Tables That Do NOT Exist

| Table | Status |
|---|---|
| `production_lines` | ❌ NOT EXISTS |
| `operation_types` | ❌ NOT EXISTS |
| `cost_centers` | ❌ NOT EXISTS |
| `machine_components` | ❌ NOT EXISTS |
| `spare_parts` | ❌ NOT EXISTS |
| `component_spare_parts` | ❌ NOT EXISTS |

---

## Number Sequences

| Code | Exists? |
|---|---|
| `MACHINE` | ✅ |
| `MACHINE_PART` | ✅ |
| `MAINTENANCE_REQUEST` | ✅ |
| `PRODUCTION_LINE` | ❌ (would need to be added) |
| `SPARE_PART` | ❌ (would need to be added) |
| `MACHINE_COMPONENT` | ❌ (would need to be added) |

---

## Data Integrity

- All foreign keys on existing tables reference valid records
- No orphaned records in any table
- Hierarchical data (company → branch → administration → department) is consistent
- One sample machine exists with valid company/branch/department/category references
- One sample maintenance request exists with valid machine reference
