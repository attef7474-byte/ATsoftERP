# Security Proof

## Guards
- ✅ `JwtAuthGuard` active on all Operation Types and Cost Centers endpoints
- ✅ `PermissionsGuard` active on all CRUD operations
- ✅ Unauthorized requests return 401 `"Invalid or expired token"`
- ✅ Authorization enforced at both controller and route level

## Data Exposure
- ✅ `passwordHash` not exposed in any API response
- ✅ JWT/token not exposed in API responses (access token returned only at login)
- ✅ No `.env` file committed (in `.gitignore`)
- ✅ No cookies/session files committed
- ✅ No secrets in source code

## Rejected Domains
- ✅ HR domain: not implemented, not accessible
- ✅ Finance domain: not implemented, not accessible
- ✅ Production (production_lines, work_orders): excluded by scope
- ✅ Machines changes: excluded by scope
- ✅ Spare Parts changes: excluded by scope
- ✅ Maintenance Request changes: excluded by scope

## Endpoint Protection Verification
| Endpoint | Auth Required | Permission Required | Status |
|----------|--------------|-------------------|--------|
| GET /api/v1/maintenance/operation-types | Yes | operation_types:read | ✅ |
| POST /api/v1/maintenance/operation-types | Yes | operation_types:create | ✅ |
| GET /api/v1/maintenance/operation-types/:id | Yes | operation_types:read | ✅ |
| PATCH /api/v1/maintenance/operation-types/:id | Yes | operation_types:update | ✅ |
| PATCH /api/v1/maintenance/operation-types/:id/activate | Yes | operation_types:update | ✅ |
| PATCH /api/v1/maintenance/operation-types/:id/deactivate | Yes | operation_types:update | ✅ |
| DELETE /api/v1/maintenance/operation-types/:id | Yes | operation_types:delete | ✅ |
| GET /api/v1/maintenance/cost-centers | Yes | cost_centers:read | ✅ |
| POST /api/v1/maintenance/cost-centers | Yes | cost_centers:create | ✅ |
| GET /api/v1/maintenance/cost-centers/:id | Yes | cost_centers:read | ✅ |
| PATCH /api/v1/maintenance/cost-centers/:id | Yes | cost_centers:update | ✅ |
| PATCH /api/v1/maintenance/cost-centers/:id/activate | Yes | cost_centers:update | ✅ |
| PATCH /api/v1/maintenance/cost-centers/:id/deactivate | Yes | cost_centers:update | ✅ |
| DELETE /api/v1/maintenance/cost-centers/:id | Yes | cost_centers:delete | ✅ |
