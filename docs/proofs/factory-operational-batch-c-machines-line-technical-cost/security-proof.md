# Security Proof — Batch C Machines

## 1. Authentication

### Admin layout guard (`src/app/admin/layout.tsx:12`)
```typescript
if (!isAuthenticated()) {
  router.replace('/login');
}
```
- Unauthenticated users are redirected to `/login`
- The check runs in `useEffect` before any admin shell renders
- If `accessToken` is missing from `localStorage`, the user never sees admin UI

### API guard (`@UseGuards(JwtAuthGuard)`)
- All machine endpoints require a valid JWT Bearer token
- Tested: `GET /machines` without token → **401 Unauthorized** (api-proof test #4)

## 2. Input Validation

### Backend validation (`maintenance.service.ts:validateMachineReferences`)
| Field | Rule | Test Result |
|-------|------|-------------|
| `productionLineId` | Must reference existing `ProductionLine` record | PASS — 400 on invalid ID |
| `operationTypeId` | Must reference existing `OperationType` record | PASS — 400 on invalid ID |
| `defaultCostCenterId` | Must reference existing `CostCenter` record | PASS — 400 on invalid ID |
| `technicalAdministrationId` | Must reference existing `Administration` record | PASS — 400 on invalid ID |
| `technicalDepartmentId` | Must reference existing `Department` record | PASS — 400 on invalid ID |

### Cross-module reference validation
| ID Source | Resolved In | Validated |
|-----------|-------------|-----------|
| `productionLineId` | `maintenance.ProductionLine` | READ + select + query |
| `operationTypeId` | `maintenance.OperationType` | READ + select + query |
| `defaultCostCenterId` | `maintenance.CostCenter` | READ + select + query |
| `technicalAdministrationId` | `core.Administration` | READ + select + query |
| `technicalDepartmentId` | `core.Department` | READ + select + query |

## 3. Authorization

- All endpoints use the standard `JwtAuthGuard` registered globally for the maintenance module
- Role-based access can be added via additional guards if needed (deferred to access-control layer)

## 4. Data integrity

### Nullable constraints
All 5 new fields are nullable (`String?` in Prisma). The migration applies `NULL` defaults, ensuring existing records without these fields remain valid.

### Cascade rules
- No cascading deletes on any of the 5 foreign keys (referential action: `NoAction`)
- Deleting a referenced `ProductionLine` / `OperationType` / etc. will fail if a machine still points to it (protects against orphaned references)

## 5. No secrets exposure

- No API keys, passwords, or tokens in frontend source
- `accessToken` stored in `localStorage` (standard SPA pattern)
- Backend JWT secret stored in `.env`, not in code
