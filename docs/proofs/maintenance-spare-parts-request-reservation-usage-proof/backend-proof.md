# Backend Proof — Maintenance Spare Parts Request + Reservation + Usage Proof

## Module
`maintenance-spare-part-request-lines`

### Files Created
- `maintenance-spare-part-request-lines.module.ts`
- `maintenance-spare-part-request-lines.controller.ts`
- `maintenance-spare-part-request-lines.service.ts`
- `dto/create-spare-part-request-line.dto.ts`

### DTOs
- `CreateSparePartRequestLineDto` — sparePartId, quantity, reason, unit, usageNote, isPrimary, machineComponentId, machineId, failureCauseId
- `UpdateSparePartRequestLineDto` — all optional fields

### Endpoints

| Method | Path | Permission | Description |
|---|---|---|---|
| POST | /maintenance/requests/:requestId/parts | maintenance-request-parts:create | Create spare part request line (DRAFT) |
| GET | /maintenance/requests/:requestId/parts | maintenance-request-parts:read | List request part lines |
| GET | /maintenance/requests/:requestId/parts/:lineId | maintenance-request-parts:read | Get part line detail |
| PATCH | /maintenance/requests/:requestId/parts/:lineId | maintenance-request-parts:update | Update draft part line |
| PATCH | /maintenance/requests/:requestId/parts/:lineId/request | maintenance-request-parts:request | Submit/request spare part |
| PATCH | /maintenance/requests/:requestId/parts/:lineId/approve | maintenance-request-parts:approve | Approve spare part request |
| PATCH | /maintenance/requests/:requestId/parts/:lineId/reject | maintenance-request-parts:reject | Reject spare part request |
| PATCH | /maintenance/requests/:requestId/parts/:lineId/reserve | maintenance-request-parts:reserve | Reserve spare part operationally |
| PATCH | /maintenance/requests/:requestId/parts/:lineId/use | maintenance-request-parts:use | Mark spare part as used |
| PATCH | /maintenance/requests/:requestId/parts/:lineId/cancel | maintenance-request-parts:cancel | Cancel spare part request |

### Workflow Statuses

| Status | Description | Can transition to |
|---|---|---|
| DRAFT | Newly created, editable | REQUESTED, CANCELLED |
| REQUESTED | Submitted for approval | APPROVED, REJECTED, CANCELLED |
| APPROVED | Approved by authorized person | RESERVED, USED (skip reserve), CANCELLED |
| REJECTED | Rejected | CANCELLED |
| RESERVED | Operationally reserved | USED, CANCELLED |
| USED | Marked as used (terminal) | — |
| CANCELLED | Cancelled (terminal) | — |

### Guards
- JwtAuthGuard active on all endpoints
- PermissionsGuard active on all endpoints

### Validation
- Quantity must be > 0
- Spare part must exist and be ACTIVE
- Duplicate spare part on same request blocked unless previous line is in terminal status
- Machine component validated if provided
- Failure cause validated if provided
- Invalid status transition returns 400
- Not found returns 404
- Unauthorized returns 401
- Bad token returns 401

### App Module Registration
Imported in `app.module.ts` as `MaintenanceSparePartRequestLinesModule`.
