# Database Integrity Counters Proof — Batch M

## Before/After Counts

### Tables that may increase
| Table | Expected Change | Reason |
|---|---|---|
| notifications | May increase | New maintenance notifications created |
| maintenance_sla_states | May increase | SLA states created per request |
| maintenance_requests.sla_status | Updated | SLA status field used |
| maintenance_requests.sla_status indexes | Used | New indexes accessed |

### Tables that MUST NOT increase
| Table | Expected Change | Verified |
|---|---|---|
| inventory_movements | 0 | No inventory code touched |
| inventory_balances | 0 | No stock code changed |
| finance_entries | 0 | No finance module touched |
| warehouse_movements | 0 | No warehouse code touched |
| hr_employee_records | 0 | No HR code touched |
| payroll_records | 0 | No payroll code touched |
| attendance_records | 0 | No attendance code touched |
| appraisal_records | 0 | No appraisal code touched |

### Number Sequences
| Sequence | Incremented? | Reason |
|---|---|---|
| MAINTENANCE_REQUEST | Not incremented | Notification/SLA operations don't create requests |
| Any sequence | Not incremented | No number sequence used in notification/SLA code |

## Verified
- `MaintenanceNotificationService` only creates Notification records
- `MaintenanceSlaService` only updates MaintenanceRequest and MaintenanceSlaState
- No imports of inventory, finance, HR, or warehouse modules
- No database writes outside notification and SLA tables
