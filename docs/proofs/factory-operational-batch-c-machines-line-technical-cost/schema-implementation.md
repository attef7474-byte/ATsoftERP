# Schema Implementation — Batch C: Machines Production Line / Technical / Cost

## Machine Model — New Fields

| Field | Type | Required (DB) | Default | Index |
|-------|------|---------------|---------|-------|
| `productionLineId` | String? | No (nullable) | null | Yes |
| `operationTypeId` | String? | No (nullable) | null | Yes |
| `defaultCostCenterId` | String? | No (nullable) | null | Yes |
| `technicalAdministrationId` | String? | No (nullable) | null | Yes |
| `technicalDepartmentId` | String? | No (nullable) | null | Yes |

## Relations

- `productionLine` → `ProductionLine` via `productionLineId`
- `operationType` → `OperationType` via `operationTypeId`
- `defaultCostCenter` → `CostCenter` via `defaultCostCenterId`
- `technicalAdministration` → `Administration` via `technicalAdministrationId` (named `"TechnicalAdministration"`)
- `technicalDepartment` → `Department` via `technicalDepartmentId` (named `"TechnicalDepartment"`)

## Reverse Relations Added on Related Models

- `ProductionLine.machines` (relation `Machine[]`)
- `OperationType.machines` (relation `Machine[]`)
- `CostCenter.machines` (relation `Machine[]`)
- `Administration.technicalMachines` (relation `"TechnicalAdministration"`, `Machine[]`)
- `Department.technicalMachines` (relation `"TechnicalDepartment"`, `Machine[]`)

## Verification

```prisma
model Machine {
  // ... existing fields ...
  productionLineId         String?
  productionLine           ProductionLine?  @relation(fields: [productionLineId], references: [id])
  operationTypeId          String?
  operationType            OperationType?   @relation(fields: [operationTypeId], references: [id])
  defaultCostCenterId      String?
  defaultCostCenter        CostCenter?      @relation(fields: [defaultCostCenterId], references: [id])
  technicalAdministrationId String?
  technicalAdministration  Administration?  @relation("TechnicalAdministration", fields: [technicalAdministrationId], references: [id])
  technicalDepartmentId    String?
  technicalDepartment      Department?      @relation("TechnicalDepartment", fields: [technicalDepartmentId], references: [id])

  @@index([productionLineId])
  @@index([operationTypeId])
  @@index([defaultCostCenterId])
  @@index([technicalAdministrationId])
  @@index([technicalDepartmentId])
}
```

## Backend Components

### DTOs (maintenance.dto.ts)

**CreateMachineDto** (lines 38-58):
- `productionLineId?: string`
- `operationTypeId?: string`
- `defaultCostCenterId?: string`
- `technicalAdministrationId?: string`
- `technicalDepartmentId?: string`

**UpdateMachineDto** (lines 130-150):
- Same fields, all optional

### Service Validation (maintenance.service.ts)

`validateMachineReferences()` (lines 13-50):
1. `productionLineId` — existence + company/branch/administration/department matching
2. `operationTypeId` — existence
3. `defaultCostCenterId` — existence
4. `technicalAdministrationId` — existence
5. `technicalDepartmentId` — existence + belongs to technicalAdministration

### Controller Filters

`findAllMachines` accepts:
- `productionLineId` — filter by production line
- `operationTypeId` — filter by operation type
- `administrationId` — filter by machine department administration

### Includes in Responses

All CRUD operations (`createMachine`, `findOneMachine`, `findAllMachines`, `updateMachine`) include:
- `productionLine { id, name, code }`
- `operationType { id, name, code }`
- `defaultCostCenter { id, name, code }`
- `technicalAdministration { id, name }`
- `technicalDepartment { id, name }`

## Migration

Migration file: `20260723063756_add_machine_operational_technical_cost_fields/`
Status: Applied
All fields nullable for safe migration (no data loss).
