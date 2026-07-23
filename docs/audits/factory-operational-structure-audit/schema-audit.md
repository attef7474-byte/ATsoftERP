# Schema Audit — Factory Operational Structure

> Date: 2026-07-23  
> Target: `apps/api/prisma/schema.prisma`  
> Method: Read-only comparison against target factory model

---

## Target Models vs. Current State

### ✅ Already Present (Existing)

| Target Model | Current Mapping | Status |
|---|---|---|
| Company | `model Company` | ✅ EXISTS |
| Branch | `model Branch` | ✅ EXISTS |
| Administration | `model Administration` | ✅ EXISTS |
| Department | `model Department` | ✅ EXISTS |
| Machine | `model Machine` | ✅ EXISTS |
| MachineCategory | `model MachineCategory` | ✅ EXISTS |
| MaintenanceRequest | `model MaintenanceRequest` | ✅ EXISTS |
| MaintenanceTask | `model MaintenanceTask` | ✅ EXISTS |
| MaintenanceSchedule | `model MaintenanceSchedule` | ✅ EXISTS |
| DowntimeLog | `model DowntimeLog` | ✅ EXISTS |
| MachineDocument | `model MachineDocument` | ✅ EXISTS |
| MachinePart | `model MachinePart` | ✅ EXISTS (per-machine, not reusable catalog) |
| MaintenanceChecklistItem | `model MaintenanceChecklistItem` | ✅ EXISTS |
| MaintenanceChecklistExecution | `model MaintenanceChecklistExecution` | ✅ EXISTS |
| MaintenanceRequestPartUsage | `model MaintenanceRequestPartUsage` | ✅ EXISTS |
| MaintenanceRequestCostEntry | `model MaintenanceRequestCostEntry` | ✅ EXISTS |

### ❌ Missing (New Models Required)

| Target Model | Reason | Priority |
|---|---|---|
| `ProductionLine` | ProductionLine entity; represents physical or logical production line. Links: `branchId` required, `administrationId` optional, `supervisorId`, `status` | **HIGH** |
| `OperationType` | Enum-like catalog of operation types (e.g. Preventive, Corrective, Predictive, Emergency). Referenced by Machine and MaintenanceRequest. | **HIGH** |
| `CostCenter` | Cost center entity with `code`, `name`, `type` (e.g. PRODUCTION, MAINTENANCE, QUALITY, etc.) | **HIGH** |
| `MachineComponent` | Hierarchical component/assembly tree under a Machine (e.g. "Main Drive → Gearbox → Bearing"). Enables drill-down spare part planning. | **HIGH** |
| `SparePart` | Reusable spare part catalog (not per-machine). Includes `code`, `name`, `partNumber`, `manufacturer`, `supplierId`, `unit`, `minStock`, `currentStock`, `location`, `leadTimeDays`, etc. | **HIGH** |
| `ComponentSparePart` | Junction: links SparePart to MachineComponent with quantity and optional specification | **HIGH** |

---

## Field Gap Analysis — Machine (`model Machine`)

**Current Fields (20):**
- id, code, name, categoryId*, companyId*, branchId*, departmentId*, model, serialNumber, manufacturer, purchaseDate, warrantyEnd, location, status, qrCode, image, notes, createdAt, updatedAt, deletedAt

**Missing Fields for Factory Hierarchy:**
| Field | Type | Purpose | Priority |
|---|---|---|---|
| `productionLineId` | String? → ProductionLine | Links machine to a production line | **HIGH** |
| `operationTypeId` | String? → OperationType | Default operation type for the machine | **HIGH** |
| `technicalAdministrationId` | String? → Administration | Technical ownership — overrides org admin | **HIGH** |
| `technicalDepartmentId` | String? → Department | Technical ownership — overrides org dept | **HIGH** |
| `defaultCostCenterId` | String? → CostCenter | Default cost center for maintenance on this machine | **MEDIUM** |

---

## Field Gap Analysis — MaintenanceRequest (`model MaintenanceRequest`)

**Current Fields (18):**
- id, requestNumber, machineId*, type, priority, title, description, status, requestedById*, assignedToId*, startDate, endDate, downtimeHours, cost, notes, createdAt, updatedAt, deletedAt

**Missing Fields:**
| Field | Type | Purpose | Priority |
|---|---|---|---|
| `costCenterId` | String? → CostCenter | Cost center assignment for the request | **MEDIUM** |
| `operationTypeId` | String? → OperationType | Specific operation type for this request | **MEDIUM** |
| `productionLineId` | String? → ProductionLine | Optional override for production line context | **LOW** |

---

## Field Gap Analysis — MachinePart (`model MachinePart`)

**Current Fields (11):**
- id, code*, name, machineId*, productId*, partNumber, quantity, minStock, unit, createdAt, updatedAt

**Issues:**
- **Per-machine**, not a reusable catalog. Same spare part duplicated across machines.
- No link to `MachineComponent` (component/assembly hierarchy).
- No `manufacturer`, `supplierId`, `leadTimeDays`, `currentStock`, `location` — not suitable for inventory management.

---

## Current Prisma Schema Summary

| Table (SQL Name) | Model Name | Rows | Purpose |
|---|---|---|---|
| `companies` | Company | 6 | Org hierarchy root |
| `branches` | Branch | 4 | Org hierarchy level 2 |
| `administrations` | Administration | 2 | Org hierarchy level 3 |
| `departments` | Department | 4 | Org hierarchy level 4 |
| `machine_categories` | MachineCategory | 2 | Machine classification |
| `machines` | Machine | 1 | Machine asset registry |
| `machine_parts` | MachinePart | 0 | Per-machine parts |
| `machine_documents` | MachineDocument | 0 | Machine documentation |
| `maintenance_requests` | MaintenanceRequest | 1 | Maintenance work orders |
| `maintenance_tasks` | MaintenanceTask | 0 | Task breakdown |
| `downtime_logs` | DowntimeLog | 0 | Downtime tracking |
| `maintenance_schedules` | MaintenanceSchedule | 0 | Preventive schedules |
| `maintenance_request_part_usages` | MaintenanceRequestPartUsage | 0 | Parts used in requests |
| `maintenance_request_cost_entries` | MaintenanceRequestCostEntry | 0 | Cost tracking |
| `maintenance_checklist_items` | MaintenanceChecklistItem | 0 | Checklist templates |
| `maintenance_checklist_executions` | MaintenanceChecklistExecution | 0 | Completed checklists |

---

## Required New Tables

| Table | Model | Columns (estimated) |
|---|---|---|
| `production_lines` | ProductionLine | id, code, name, branchId, administrationId*, supervisorId*, status, description, notes, timestamps, deletedAt |
| `operation_types` | OperationType | id, code, name, description, color*, icon*, isActive, timestamps |
| `cost_centers` | CostCenter | id, code, name, type, description, departmentId*, isActive, timestamps |
| `machine_components` | MachineComponent | id, code, name, machineId, parentId*, componentType, position*, level, description, timestamps |
| `spare_parts` | SparePart | id, code, name, partNumber, manufacturer, supplierId*, unit, minStock, currentStock, location, leadTimeDays, notes, timestamps |
| `component_spare_parts` | ComponentSparePart | id, componentId, sparePartId, quantity, specification*, timestamps |

---

## Schema Validation

- `npx prisma validate` — ✅ PASS
- `npm run build:api` (tsc) — ✅ PASS (0 errors)
