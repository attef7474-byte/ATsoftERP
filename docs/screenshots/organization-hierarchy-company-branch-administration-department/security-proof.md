# Security Proof

## Guard Configuration

| Endpoint | JwtAuthGuard | PermissionsGuard | Required Permission |
|----------|-------------|-----------------|-------------------|
| POST /api/v1/administrations | Yes | Yes | `administrations:create` |
| GET /api/v1/administrations | Yes | Yes | `administrations:read` |
| GET /api/v1/administrations/:id | Yes | Yes | `administrations:read` |
| PATCH /api/v1/administrations/:id | Yes | Yes | `administrations:update` |
| DELETE /api/v1/administrations/:id | Yes | Yes | `administrations:delete` |
| POST /api/v1/departments | Yes | Yes | `departments:create` |
| PATCH /api/v1/departments/:id | Yes | Yes | `departments:update` |

## Validation

- `ValidationPipe` configured globally with `whitelist: true` and `forbidNonWhitelisted: true`
- All DTOs use `class-validator` decorators (`@IsString()`, `@IsOptional()`, etc.)
- Hierarchy validation in `DepartmentsService`:
  - Administration existence check
  - Branch-Administration cross-relation check

## Verified

| Check | Status |
|-------|--------|
| Unauthorized access returns 401 | PASS (API proof) |
| Invalid cross-relation returns 400 | PASS (API proof) |
| passwordHash not exposed | PASS (not in any DTO/response) |
| JWT token not exposed in responses | PASS |
| No secrets in docs/screenshots | PASS |
| Rejected domains inactive | PASS (Sales, Purchasing, Finance, HR, AI, IoT, BI not loaded) |

## Conclusions

All administration CRUD endpoints are protected by JWT authentication and permission-based authorization. Hierarchy validation prevents cross-branch/cross-company administration-to-department assignments. Global ValidationPipe rejects unknown properties in request bodies.
