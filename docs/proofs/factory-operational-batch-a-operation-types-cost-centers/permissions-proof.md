# Permissions Proof

## Permissions Registered in Seed

From `prisma/seed/seed.ts`:

```
operation_types:create
operation_types:read
operation_types:update
operation_types:delete

cost_centers:create
cost_centers:read
cost_centers:update
cost_centers:delete
```

## Guard Verification

### Controller Guards
Both controllers use `@UseGuards(JwtAuthGuard, PermissionsGuard)`:
- `OperationTypesController` — all endpoints protected
- `CostCentersController` — all endpoints protected

### Permission Decorators
Each endpoint uses `@Permissions('operation_types:action')`:
- `POST /operation-types` → `operation_types:create`
- `GET /operation-types` → `operation_types:read`
- `GET /operation-types/:id` → `operation_types:read`
- `PATCH /operation-types/:id` → `operation_types:update`
- `DELETE /operation-types/:id` → `operation_types:delete`
- `PATCH /operation-types/:id/activate` → `operation_types:update`
- `PATCH /operation-types/:id/deactivate` → `operation_types:update`

Same pattern for cost_centers.

## Unauthorized Access
Requests without JWT token return 401 `"Invalid or expired token"`.
Requests without required permission return 403.
