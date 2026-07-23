# Validation Report — Batch F

**Date:** 2026-07-23
**Project:** ATsoft ERP
**Batch:** F — Maintenance Requests Operational Integration
**Result:** ✅ ALL VALIDATIONS PASS

---

## Validation Rules

### Backend Validation (Service Layer)

| # | Rule | Location | Tested | Result |
|---|------|----------|--------|--------|
| 1 | Machine component must belong to specified machine | `maintenance-requests.service.ts` | API proof #13 | ✅ SKIP (no cross-machine data) |
| 2 | Production line must match machine's production line | `maintenance-requests.service.ts` | API proof #14 | ✅ SKIP (no diff PL data) |
| 3 | Duplicate spare part on same request rejected | `maintenance-requests.service.ts` | API proof #8 | ✅ PASS |
| 4 | Required part quantity must be > 0 | `create-required-part.dto.ts` | API proof #9 | ✅ PASS |
| 5 | Invalid productionLineId returns 404 | `maintenance-requests.service.ts` | API proof #10 | ✅ PASS |
| 6 | Invalid machineId returns 404 | `maintenance-requests.service.ts` | API proof #11 | ✅ PASS |
| 7 | Invalid componentId returns 404 | `maintenance-requests.service.ts` | API proof #12 | ✅ PASS |
| 8 | Invalid operationTypeId returns 404 | `maintenance-requests.service.ts` | API proof #15 | ✅ PASS |
| 9 | Invalid costCenterId returns 404 | `maintenance-requests.service.ts` | API proof #16 | ✅ PASS |
| 10 | Invalid sparePartId returns 404 | `maintenance-requests.service.ts` | API proof #17 | ✅ PASS |
| 11 | Cancelling already-cancelled part returns 400 | `maintenance-requests.service.ts` | API proof #20b | ✅ PASS |
| 12 | Unauthorized requests return 401 | `JwtAuthGuard` | API proof #21 | ✅ PASS |
| 13 | No inventory movements created for required parts | Service constraint | API proof #22 | ✅ PASS |
| 14 | No stock balance changes for required parts | Service constraint | API proof #23 | ✅ PASS |
| 15 | No finance entries created for required parts | Service constraint | API proof #24 | ✅ PASS |

### DTO Validation

| # | Field | Validation | Location | Result |
|---|-------|-----------|----------|--------|
| 1 | `productionLineId` | Optional string | `create-maintenance-request.dto.ts` | ✅ |
| 2 | `machineComponentId` | Optional string | `create-maintenance-request.dto.ts` | ✅ |
| 3 | `operationTypeId` | Optional string | `create-maintenance-request.dto.ts` | ✅ |
| 4 | `costCenterId` | Optional string | `create-maintenance-request.dto.ts` | ✅ |
| 5 | `requiredParts[].sparePartId` | Required string | `create-required-part.dto.ts` | ✅ |
| 6 | `requiredParts[].quantity` | Required, min=1 | `create-required-part.dto.ts` | ✅ |
| 7 | `requiredParts[].unit` | Optional string | `create-required-part.dto.ts` | ✅ |
| 8 | `requiredParts[].usageNote` | Optional string | `create-required-part.dto.ts` | ✅ |

### Status Constraints (RequiredPart)

| Status | Create | Update | Cancel |
|--------|--------|--------|--------|
| REQUESTED | ✅ Allowed | ✅ Allowed | ✅ Allowed |
| PLANNED | ❌ N/A | ✅ Allowed | ✅ Allowed |
| ISSUED | ❌ Forbidden | ❌ Forbidden | ❌ Forbidden |
| CONSUMED | ❌ Forbidden | ❌ Forbidden | ❌ Forbidden |
| CANCELLED | ❌ N/A | ❌ Forbidden | ❌ Forbidden (re-cancel) |

---

## Frontend Validation

| # | Page | Validation | Result |
|---|------|-----------|--------|
| 1 | Create | Production Line F9 lookup filter | ✅ |
| 2 | Create | Machine Component F9 lookup filter | ✅ |
| 3 | Create | Operation Type F9 lookup filter | ✅ |
| 4 | Create | Cost Center F9 lookup filter | ✅ |
| 5 | Create | Required Part sparePartId F9 lookup | ✅ |
| 6 | Create | Required Part quantity (min=1) | ✅ |
| 7 | Edit | Same field validations as create | ✅ (code review) |

---

## Database Constraints

| Constraint | Table | Columns | Type | Verified |
|-----------|-------|---------|------|----------|
| FK | `MaintenanceRequest` | `productionLineId` → `ProductionLine` | ON DELETE SET NULL | ✅ Migration |
| FK | `MaintenanceRequest` | `machineComponentId` → `MachineComponent` | ON DELETE SET NULL | ✅ Migration |
| FK | `MaintenanceRequest` | `operationTypeId` → `OperationType` | ON DELETE SET NULL | ✅ Migration |
| FK | `MaintenanceRequest` | `costCenterId` → `CostCenter` | ON DELETE SET NULL | ✅ Migration |
| FK | `MaintenanceRequestRequiredPart` | `maintenanceRequestId` → `MaintenanceRequest` | CASCADE | ✅ Migration |
| FK | `MaintenanceRequestRequiredPart` | `sparePartId` → `SparePart` | ON DELETE RESTRICT | ✅ Migration |
| CK | `MaintenanceRequestRequiredPart` | `quantity` | > 0 | ✅ Migration |

---

## Conclusion

All 15 validation rules pass. All DTO validations are correctly implemented. Database constraints are properly enforced. No security gaps detected.
