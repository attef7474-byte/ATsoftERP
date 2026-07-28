# Inventory Module — User Manual, SOP, Training & Handover Package

## Purpose
This package contains all operational documentation for the ATsoft ERP Inventory Module (Batches O through W).

## File List
| File | Language | Content |
|------|----------|---------|
| `inventory-user-manual-ar.md` | Arabic | Full user manual |
| `inventory-user-manual-en.md` | English | Full user manual |
| `inventory-sop-ar.md` | Arabic | 12 standard operating procedures |
| `inventory-sop-en.md` | English | 12 standard operating procedures |
| `inventory-training-plan-ar.md` | Arabic | 14-module training plan |
| `inventory-training-plan-en.md` | English | 14-module training plan |
| `inventory-quick-reference-ar.md` | Arabic | Operation quick reference table |
| `inventory-quick-reference-en.md` | English | Operation quick reference table |
| `inventory-permissions-matrix-ar.md` | Arabic | Role-based permissions matrix |
| `inventory-permissions-matrix-en.md` | English | Role-based permissions matrix |
| `inventory-troubleshooting-ar.md` | Arabic | Troubleshooting guide |
| `inventory-troubleshooting-en.md` | English | Troubleshooting guide |
| `inventory-handover-checklist-ar.md` | Arabic | Handover sign-off checklist |
| `inventory-handover-checklist-en.md` | English | Handover sign-off checklist |
| `inventory-release-notes-ar.md` | Arabic | Release notes |
| `inventory-release-notes-en.md` | English | Release notes |
| `inventory-limitations-and-controls-ar.md` | Arabic | Documented limitations |
| `inventory-limitations-and-controls-en.md` | English | Documented limitations |
| `inventory-route-api-reference.md` | English | Route and API reference |

## Recommended Reading Order
1. Release notes (understand scope)
2. Limitations and controls (understand boundaries)
3. Route/API reference (understand routes)
4. User manual (understand operations)
5. Quick reference (daily operations)
6. SOPs (detailed procedures)
7. Permissions matrix (role assignment)
8. Training plan (learning path)
9. Troubleshooting (problem resolution)
10. Handover checklist (sign-off)

## Who Should Read What
| Role | Priority Files |
|------|---------------|
| Administrator | Release notes, limitations, route reference, permissions matrix, troubleshooting |
| Inventory Supervisor | User manual, SOPs, quick reference, permissions matrix, troubleshooting |
| Warehouse Officer | Quick reference, SOPs relevant to their work, troubleshooting |
| Maintenance User | SOP-05, SOP-06, quick reference maintenance rows |
| Auditor/Viewer | User manual (ledger/reconciliation/locks/audit sections) |
| Trainer | Training plan, user manual, SOPs, quick reference |

## Release Status
**READY_FOR_RELEASE_WITH_DOCUMENTED_LIMITATIONS**

## Limitations Summary
- LOCATION_LOCK and ITEM_LOCK not implemented by design
- Finance, HR, Sales, Purchasing domains not activated
- Lock response is 403 Forbidden (blocks mutation safely)
- Opening Balance not guarded by InventoryLockGuard (pre-operational data)
- Migration workflow uses `prisma migrate deploy` not `migrate dev`

## Support
For technical issues, refer to the troubleshooting guide first. For unresolved issues, escalate to the system administrator with the error message and the operation being performed.
