# Schema Proof — Maintenance Spare Parts Request + Reservation + Usage Proof

## Changes

### Model: `MaintenanceRequestRequiredPart` (maintenance_request_required_parts)

Added 18 nullable workflow fields:

| Field | Type | Nullable | Default |
|---|---|---|---|
| reason | String? (NVARCHAR(MAX)) | ✅ | null |
| requestedQuantity | Float? | ✅ | null |
| approvedQuantity | Float? | ✅ | null |
| reservedQuantity | Float? | ✅ | null |
| usedQuantity | Float? | ✅ | null |
| requestedByUserId | String? (NVARCHAR(1000)) | ✅ | null |
| approvedByUserId | String? (NVARCHAR(1000)) | ✅ | null |
| rejectedByUserId | String? (NVARCHAR(1000)) | ✅ | null |
| reservedByUserId | String? (NVARCHAR(1000)) | ✅ | null |
| usedByUserId | String? (NVARCHAR(1000)) | ✅ | null |
| cancelledByUserId | String? (NVARCHAR(1000)) | ✅ | null |
| failureCauseId | String? (NVARCHAR(1000)) | ✅ | null |
| requestedAt | DateTime? | ✅ | null |
| approvedAt | DateTime? | ✅ | null |
| rejectedAt | DateTime? | ✅ | null |
| reservedAt | DateTime? | ✅ | null |
| usedAt | DateTime? | ✅ | null |
| cancelledAt | DateTime? | ✅ | null |

### Foreign Keys Added (all nullable, no existing data impact)

| FK Name | From | To | Type |
|---|---|---|---|
| FK_required_part_requestedBy | requestedByUserId | users(id) | Optional |
| FK_required_part_approvedBy | approvedByUserId | users(id) | Optional |
| FK_required_part_rejectedBy | rejectedByUserId | users(id) | Optional |
| FK_required_part_reservedBy | reservedByUserId | users(id) | Optional |
| FK_required_part_usedBy | usedByUserId | users(id) | Optional |
| FK_required_part_cancelledBy | cancelledByUserId | users(id) | Optional |
| FK_required_part_failureCause | failureCauseId | downtime_logs(id) | Optional |

### Indexes Added

| Index | Column(s) |
|---|---|
| idx_required_part_requestedBy | requestedByUserId |
| idx_required_part_approvedBy | approvedByUserId |
| idx_required_part_reservedBy | reservedByUserId |
| idx_required_part_usedBy | usedByUserId |
| idx_required_part_failureCause | failureCauseId |

### Reverse Relations on User Model
- `requestedRequiredParts` — @relation("RequiredPartRequestedBy")
- `approvedRequiredParts` — @relation("RequiredPartApprovedBy")
- `rejectedRequiredParts` — @relation("RequiredPartRejectedBy")
- `reservedRequiredParts` — @relation("RequiredPartReservedBy")
- `usedRequiredParts` — @relation("RequiredPartUsedBy")
- `cancelledRequiredParts` — @relation("RequiredPartCancelledBy")

### Reverse Relation on DowntimeLog
- `requiredParts` — MaintenanceRequestRequiredPart[]

### Existing Fields Preserved
All existing fields unchanged: id, maintenanceRequestId, sparePartId, machineComponentId, machineId, quantity, unit, usageNote, isPrimary, status, createdAt, updatedAt.

### Existing constraints preserved
- `@@unique([maintenanceRequestId, sparePartId])` — unchanged
- All existing FKs — unchanged
- All existing indexes — unchanged

### Data Integrity
- No existing rows modified
- All new fields are nullable
- No destructive changes
- Existing status workflow preserved
