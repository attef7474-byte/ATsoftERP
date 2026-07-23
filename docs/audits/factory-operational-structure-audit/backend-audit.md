# Backend Audit — API Controllers / Services / DTOs

> Date: 2026-07-23  
> Scope: `apps/api/src/modules/factory/maintenance/`

---

## Module Structure

```
factory/maintenance/
├── maintenance.module.ts            # Root module
├── maintenance.controller.ts        # Machine + Part + Document endpoints
├── maintenance.service.ts           # Machine + Part + Document logic
├── dto/
│   └── maintenance.dto.ts           # Machine/Part/Document DTOs
├── maintenance-requests/            # Request CRUD + workflow
│   ├── maintenance-requests.controller.ts
│   ├── maintenance-requests.service.ts
│   └── dto/
├── maintenance-tasks/               # Task CRUD
├── maintenance-schedules/           # Preventive schedule CRUD
├── downtime-logs/                   # Downtime CRUD
├── machine-parts/                   # Alternative part endpoints (non-machine specific)
├── machine-categories/              # Category CRUD
├── machine-documents/               # Document CRUD
├── maintenance-request-parts/       # Part usage per request
├── maintenance-request-costs/       # Cost entries per request
├── maintenance-checklist-items/     # Checklist items
├── maintenance-checklist-executions/# Checklist executions
└── maintenance-dashboard/           # Dashboard data
```

---

## Existing Endpoints (Machine)

### `POST /maintenance/machines` — `createMachine(dto: CreateMachineDto)`
- **DTO fields**: code?, name, categoryId?, companyId?, branchId?, departmentId?, model?, serialNumber?, manufacturer?, purchaseDate?, warrantyEnd?, location?, notes?
- **Missing fields**: `productionLineId`, `operationTypeId`, `technicalAdministrationId`, `technicalDepartmentId`, `defaultCostCenterId`

### `PATCH /maintenance/machines/:id` — `updateMachine(id, dto: UpdateMachineDto)`
- **DTO fields**: code?, name?, categoryId?, companyId?, branchId?, departmentId?, model?, serialNumber?, manufacturer?, purchaseDate?, warrantyEnd?, status?, location?, notes?
- **Missing fields**: Same as create — no factory fields

### `GET /maintenance/machines` — `findAllMachines(query)`
- **Filters**: search, categoryId, companyId, status
- **Missing filters**: productionLineId, operationTypeId, costCenterId
- **Missing includes**: productionLine, operationType, costCenter, technicalAdministration, technicalDepartment

### `GET /maintenance/machines/:id` — `findOneMachine(id)`
- **Includes**: category, company, branch, department, parts, documents, _count
- **Missing includes**: productionLine, operationType, costCenter, technicalAdministration, technicalDepartment, components

---

## Existing Endpoints (Maintenance Request)

### `POST /maintenance/requests` — `create(dto, userId)`
- **DTO fields**: machineId, type, priority?, title, description?, assignedToId?, startDate?, endDate?, downtimeHours?, cost?, notes?
- **Missing fields**: `costCenterId`, `operationTypeId`, `productionLineId`

### `PATCH /maintenance/requests/:id` — `update(id, dto, userId)`
- **Missing fields**: Same as create

### `GET /maintenance/requests` — `findAll(query)`
- **Filters**: search, machineId, status, type, priority, requestedById, assignedToId
- **Missing filters**: costCenterId, operationTypeId, productionLineId

---

## Endpoints NOT Present

| Required Endpoint | Reason |
|---|---|
| `POST/GET/PATCH/DELETE /production-lines` | New model — no CRUD exists |
| `POST/GET/PATCH/DELETE /operation-types` | New model — no CRUD exists |
| `POST/GET/PATCH/DELETE /cost-centers` | New model — no CRUD exists |
| `GET /machines/:id/components` | MachineComponent not implemented |
| `POST/GET/PATCH/DELETE /machine-components` | New model — no CRUD exists |
| `POST/GET/PATCH/DELETE /spare-parts` | New model — no CRUD exists |
| `POST/GET/PATCH/DELETE /component-spare-parts` | New model — no CRUD exists |
| `GET /spare-parts/stock-levels` | Inventory tracking not implemented |

---

## Validation

- NestJS class-validator decorators exist on all DTOs
- No validation decorators for non-existent fields
- All machine/service tests would need updates when fields added
