# UX-0 Phase 1 — Organization Context Audit

> **Date**: 2026-07-28  
> **Batch**: UX-0 (Organization Context Lite + Maintenance Auto-Fill)  
> **Baseline commit**: `335769e` (NX accepted)

---

## 1. Backend Auth / JWT

### 1.1 JWT Strategy (`apps/api/src/modules/auth/strategies/jwt.strategy.ts`)

Already loads org context on every authenticated request:

```typescript
async validate(payload: any): Promise<CurrentUserType> {
  const user = await this.prisma.user.findUnique({
    where: { id: payload.sub },
    select: { id: true, email: true, name: true, companyId: true, branchId: true, departmentId: true, status: true },
  });
  // returns { id, email, name, companyId, branchId, departmentId }
}
```

### 1.2 CurrentUserType (`apps/api/src/modules/auth/types/current-user.type.ts`)

```typescript
export interface CurrentUserType {
  id: string;
  email: string;
  name: string;
  companyId?: string | null;
  branchId?: string | null;
  departmentId?: string | null;
}
```

### 1.3 CurrentUser Decorator (`apps/api/src/modules/auth/decorators/current-user.decorator.ts`)

Supports extracting individual fields: `@CurrentUser('id')` returns `string`, `@CurrentUser()` returns full `CurrentUserType`.

### 1.4 Auth Controller (`apps/api/src/modules/auth/auth.controller.ts`)

| Endpoint | Method | Returns org context? |
|----------|--------|---------------------|
| `/auth/login` | POST | No — only `{ id, email, name }` |
| `/auth/me` | GET | Yes — full `UserProfile` with `companyId`, `branchId`, `departmentId` |
| `/auth/permissions` | GET | No — roles/permissions only |

### 1.5 Auth Service — `getProfile()` (`apps/api/src/modules/auth/auth.service.ts:42`)

Returns `companyId`, `branchId`, `departmentId` from DB. No additional fetch needed.

---

## 2. Frontend Auth State

### 2.1 Auth Module (`apps/web/src/lib/auth.ts`)

- `LoginResponse`: `{ accessToken, user: { id, email, name } }` — **no org context**
- `UserProfile`: `{ id, email, name, phone?, status, companyId?, branchId?, departmentId?, ... }` — **has org context**
- `getProfile()`: calls `/auth/me` — available but not called automatically after login
- No `AuthProvider`, `useAuth`, or `AuthContext` exists anywhere in the codebase
- Only existing React contexts: `I18nContext`, `AdminActionBarContext`, `ErrorModalContext`, `ToastContext`

### 2.2 API Client (`apps/web/src/lib/api.ts`)

- Simple fetch-based client
- Reads `accessToken` from `localStorage`
- No auth context wrapper, no automatic profile refresh

### 2.3 Gap

The frontend has **no persisted auth context**. After login:
1. Token is stored in `localStorage`
2. Profile is NOT automatically fetched
3. Each page/component must manually call `getProfile()` or rely on passed props
4. No component can access `companyId`/`branchId`/`departmentId` without a fetch

---

## 3. Maintenance Request — Form Analysis

### 3.1 New Form (`apps/web/src/app/admin/maintenance/requests/new/page.tsx`)

**Form state** (line 29):
```typescript
const [form, setForm] = useState({
  machineId: '', type: 'CORRECTIVE', priority: 'MEDIUM',
  title: '', description: '', assignedToId: '', notes: '',
  productionLineId: '', machineComponentId: '', operationTypeId: '', costCenterId: ''
});
```

- No `companyId`, `branchId`, `departmentId` fields
- No auth context used
- `handleSave` payload only sends `machineId`, `type`, `title`, `description`, `priority`, `assignedToId`, `notes`, `productionLineId`, `machineComponentId`, `operationTypeId`, `costCenterId`, `requiredParts`
- **No auto-fill**: user must manually select `productionLine`, `machineComponent`, `operationType`, `costCenter` via F9Lookup
- **Expected improvement**: When machine is selected, auto-fill `productionLineId` and `costCenterId` from machine data

### 3.2 Edit Form (`apps/web/src/app/admin/maintenance/requests/[id]/edit/page.tsx`)

Same form state structure as new form. No org context or auto-fill.

### 3.3 Stock Issue Forms

No stock-issue page files found under `apps/web/src/app/admin/maintenance/stock-issue/`.

---

## 4. Backend Service — Maintenance Requests

### 4.1 Controller (`maintenance-requests.controller.ts`)

Uses `@CurrentUser('id')` — only passes `userId: string` to service methods. Does NOT pass the full `CurrentUserType`.

### 4.2 Service (`maintenance-requests.service.ts:71`)

**`createRequest` method**:
```typescript
private async createRequest(dto: CreateMaintenanceRequestDto, userId: string, isEmergency: boolean) {
```

- Accepts `userId` but NOT `companyId`, `branchId`, `departmentId`
- Derives `requestedById` from the user
- Does NOT set `companyId`/`branchId`/`departmentId` on the created record
- **Note**: `MaintenanceRequest` model does NOT have `companyId`/`branchId`/`departmentId` fields anyway

### 4.3 `validateOperationalContext` (line 20-47)

When `productionLineId` is provided, validates it matches the machine. But does NOT auto-fill from machine defaults. This is an opportunity for auto-fill.

### 4.4 Create DTO (`create-maintenance-request.dto.ts`)

No `companyId`, `branchId`, `departmentId` fields — correct for current model.

---

## 5. Prisma Schema — Key Models

### 5.1 Machine (`schema.prisma:1327`)

```
companyId?    String?    → Company
branchId?     String?    → Branch
departmentId? String?    → Department
productionLineId? String? → ProductionLine
defaultCostCenterId? String? → CostCenter
```

**Key insight**: Machine already has `productionLineId` and `defaultCostCenterId`. When a user selects a machine, we can derive `productionLineId` and `costCenterId` from the machine record.

### 5.2 MaintenanceRequest (`schema.prisma:1553`)

```
productionLineId?   String? → ProductionLine  (user-selected)
machineComponentId? String? → MachineComponent (user-selected)
operationTypeId?    String? → OperationType    (user-selected)
costCenterId?       String? → CostCenter       (user-selected)
```

**No `companyId`, `branchId`, `departmentId` fields**. The request's org context is implicit through:
- `requestedById` → User → companyId/branchId/departmentId
- `machineId` → Machine → companyId/branchId/departmentId

### 5.3 User (`schema.prisma`)

```
companyId?    String?
branchId?     String?
departmentId? String?
```

User has optional org context. JWT strategy loads these fields.

---

## 6. Current Auto-Fill / Derivation Gaps

| Field | Source | Current Auto-Fill? | Target |
|-------|--------|-------------------|--------|
| `companyId` on request | JWT profile | N/A — field does not exist on model | Implicit via requestedById/machineId |
| `branchId` on request | JWT profile | N/A — field does not exist on model | Implicit via requestedById/machineId |
| `departmentId` on request | JWT profile + Machine | N/A — field does not exist on model | Implicit via requestedById/machineId |
| `productionLineId` on request | Selected Machine | **No** — user must manually select | Auto-fill from machine.productionLineId |
| `costCenterId` on request | Selected Machine | **No** — user must manually select | Auto-fill from machine.defaultCostCenterId |
| `operationTypeId` on request | Selected Machine | **No** — user must manually select | Auto-fill from machine.operationTypeId if single |
| `machineComponentId` on request | Selection | **No** — user must manually select | Leave as user selection (no single default) |

---

## 7. Gaps Summary

1. **No frontend auth context provider** — profile/org data must be re-fetched on every page
2. **Login response doesn't include org context** — only `/auth/me` returns it
3. **Maintenance request forms don't auto-fill** `productionLineId` or `costCenterId` from machine
4. **Backend controller passes only `userId`** — full `CurrentUserType` not available for derivation
5. **Backend service has no org derivation logic** — could auto-derive `productionLineId`/`costCenterId` from machine if not provided
6. **MaintenanceRequest model lacks org fields** — OK by design (derived via machine/user), but queries cannot filter by org context directly

---

## 8. Recommendations for UX-0

1. **Create `AuthProvider` + `useAuth` hook** on frontend — fetches profile on mount, stores in React context
2. **Extend login flow** to fetch profile after successful login
3. **Add machine auto-fill** in maintenance request forms — when machine is selected, auto-populate `productionLineId`, `costCenterId`
4. **Backend**: Pass full `CurrentUserType` to service `create()`; if `productionLineId` not provided, auto-derive from machine
5. **Backend**: In `validateOperationalContext`, auto-derive missing fields from machine defaults
6. **No schema changes needed** — all work is frontend context + backend derivation logic
