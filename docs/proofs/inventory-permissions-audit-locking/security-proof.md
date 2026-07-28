# Security Proof — Batch V

## 1. Authentication Enforcement
- All inventory governance endpoints require JWT Bearer token
- [x] No token → 401
- [x] Invalid token → 401
- [x] Expired token → 401

## 2. Authorization (Permissions)
Every protected endpoint is decorated with `@Permissions()` and enforced by the global `PermissionsGuard`:

| Endpoint | Permission Required | Verified |
|----------|-------------------|----------|
| POST /inventory/locks | `inventory:lock:create` | PASS |
| GET /inventory/locks | `inventory:lock:read` | PASS |
| GET /inventory/locks/:id | `inventory:lock:read` | PASS |
| PATCH /inventory/locks/:id | `inventory:lock:update` | PASS |
| POST /inventory/locks/:id/activate | `inventory:lock:activate` | PASS |
| POST /inventory/locks/:id/deactivate | `inventory:lock:deactivate` | PASS |
| DELETE /inventory/locks/:id | `inventory:lock:delete` | PASS |
| POST /inventory/locks/check | `inventory:lock:read` | PASS |
| GET /inventory/audit | `inventory:audit:read` | PASS |
| GET /inventory/audit/summary | `inventory:audit:read` | PASS |
| GET /inventory/audit/export | `inventory:audit:export` | PASS |
| GET /inventory/audit/:id | `inventory:audit:read` | PASS |

## 3. Data Protection (Audit Response)
- [x] No `passwordHash` or `password_hash` exposed in audit responses
- [x] No `accessToken` or `refreshToken` exposed in audit responses
- [x] Audit records do not contain user credentials

## 4. Lock Enforcement (InventoryLockGuard)
The guard is applied via `@UseGuards(InventoryLockGuard)` on 6 posting controllers:
- InventoryMovementsController
- InventoryAdjustmentsController
- InventoryStockAdjustmentsController
- InventoryStockTransfersController
- InventoryOperationalReceiptsController
- InventoryPhysicalCountsController

The guard:
- Reads `date`, `warehouseId`, `locationId`, `productId` from request body
- Queries active `InventoryLock` records matching scope + date range
- Throws 403 Forbidden if an active lock applies
- Returns 200 OK (pass) for read-only operations

## 5. Audit Trail Integrity
- All lock mutations (CREATE, UPDATE, ACTIVATE, DEACTIVATE, DELETE) are logged to `AuditLog`
- Each audit entry captures: `userId`, `action`, `entity`, `entityId`, `description`, `metadata`, `createdAt`
- [x] No circumvention path exists for audit logging

## 6. Seeded Permissions
13 governance permissions seeded to SUPER_ADMIN role:

| Permission | Description |
|-----------|-------------|
| `inventory:lock:create` | Create inventory locks |
| `inventory:lock:read` | View inventory locks |
| `inventory:lock:update` | Update inventory locks |
| `inventory:lock:activate` | Activate inventory locks |
| `inventory:lock:deactivate` | Deactivate inventory locks |
| `inventory:lock:delete` | Delete inventory locks |
| `inventory:lock:override` | Override inventory lock restrictions |
| `inventory:audit:read` | View audit logs |
| `inventory:audit:export` | Export audit logs |
| `inventory:governance:read` | View governance configuration |
| `inventory:reports:ledger` | View inventory ledger reports |
| `inventory:reports:reconciliation` | View reconciliation reports |
| `inventory:reports:permissions-view` | View permissions report |
