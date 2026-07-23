# Backend Validation Proof — Batch C Machines

## Validation Rules (maintenance.service.ts:13-50)

| Test | Expected | Actual | Result |
|------|----------|--------|--------|
| Invalid productionLineId | 400 | 400 "Production line not found" | PASS |
| ProductionLine company mismatch | 400 | 400 "Production line does not belong to the selected company" | PASS |
| Invalid operationTypeId | 400 | 400 "Operation type not found" | PASS |
| Invalid defaultCostCenterId | 400 | 400 "Cost center not found" | PASS |
| Invalid technicalAdministrationId | 400 | 400 "Technical administration not found" | PASS |
| TechnicalDepartment not in technicalAdministration | 400 | 400 "Technical department does not belong to the selected technical administration" | PASS |
| Duplicate machine code | 409 | 409 "Machine code already exists" | PASS |
| Update does not wipe unrelated fields | Preserved | ProductionLine/OperationType preserved after name-only PATCH | PASS |
| Unauthorized access (no token) | 401 | 401 | PASS |

## Endpoint Authorization

| Endpoint | Guard | Required Permission |
|----------|-------|-------------------|
| POST /machines | JwtAuthGuard + PermissionsGuard | `machines:create` |
| GET /machines | JwtAuthGuard + PermissionsGuard | `machines:read` |
| GET /machines/:id | JwtAuthGuard + PermissionsGuard | `machines:read` |
| PATCH /machines/:id | JwtAuthGuard + PermissionsGuard | `machines:update` |
| DELETE /machines/:id | JwtAuthGuard + PermissionsGuard | `machines:delete` |

## Response Includes

All CRUD responses include:
- `productionLine { id, name, code }`
- `operationType { id, name, code }`
- `defaultCostCenter { id, name, code }`
- `technicalAdministration { id, name }`
- `technicalDepartment { id, name }`
