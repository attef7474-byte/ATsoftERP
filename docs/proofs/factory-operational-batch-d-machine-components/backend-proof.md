# Backend Validation Proof — Batch D Machine Components

## Validation Rules (machine-components.service.ts)

| Test | Expected | Actual | Result |
|------|----------|--------|--------|
| Machine not found | 400 | 400 "Machine not found" | PASS |
| Duplicate code per machine | 409 | 409 "Component code already exists for this machine" | PASS |
| Parent component not found | 400 | 400 "Parent component not found" | PASS |
| Parent not same machine | 400 | 400 "Parent component must belong to the same machine" | PASS |
| Self-parenting | 400 | 400 "A component cannot be its own parent" | PASS |
| Unauthorized (no token) | 401 | 401 | PASS |
| Invalid componentType enum | 400 | 400 validation error | PASS |
| Invalid criticality enum | 400 | 400 validation error | PASS |

## Endpoint Authorization

| Endpoint | Required Permission |
|----------|-------------------|
| POST /machine-components | `machine-component:create` |
| GET /machine-components | `machine-component:read` |
| GET /machine-components/:id | `machine-component:read` |
| PATCH /machine-components/:id | `machine-component:update` |
| DELETE /machine-components/:id | `machine-component:delete` |
| PATCH /machine-components/:id/activate | `machine-component:activate` |
| PATCH /machine-components/:id/deactivate | `machine-component:deactivate` |

## Response Includes

All CRUD responses include:
- `machine { id, name, code }`
- `parentComponent { id, name, code }` (if parent exists)
- `children { id, name, code, componentType, criticality, status }` (findOne only)
- `_count { children }` (findAll only)
