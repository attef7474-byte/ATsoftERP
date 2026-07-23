# Executive Summary — Factory Operational Structure Audit

> Date: 2026-07-23  
> Version: `8fcdbef` (main) — 3 tags pushed  
> Auditor: read-only audit, no source/database changes made

---

## Audit Scope

Evaluate current system (Company→Branch→Administration→Department→Machine→Maintenance) for readiness to extend to full factory operational model including Production Lines, Operation Types, Cost Centers, Machine Components, Spare Parts, and Technician/Engineer Accountability.

---

## State of the System

| Area | Verdict |
|---|---|
| **Git** | ✅ Clean, committed, tagged, pushed |
| **Prisma Schema** | ✅ Valid, no migration pending |
| **API Build** | ✅ 0 errors |
| **Web Build** | ✅ 0 errors |
| **TypeScript** | ✅ 0 errors across all workspaces |
| **API Health** | ✅ All 4 health checks pass |
| **Smoke Tests** | ✅ 7/7 API tests pass |
| **Database** | ✅ SQL Server online, 6 companies/4 branches/2 admins/4 depts/1 machine |
| **Existing Maintenance** | ✅ Full CRUD for machines, parts, documents, requests, tasks, schedules, downtime |

---

## What's Missing (Factory Operational Layer)

### 6 New Models Required
| Model | Priority | Complexity |
|---|---|---|
| `ProductionLine` | HIGH | Simple CRUD + hierarchy |
| `OperationType` | HIGH | Simple catalog |
| `CostCenter` | HIGH | Simple CRUD + typing |
| `MachineComponent` | HIGH | Tree hierarchy (parent/child) |
| `SparePart` | HIGH | Reusable catalog + stock fields |
| `ComponentSparePart` | HIGH | Junction table |

### 5 New Fields on Existing Models
- **Machine**: `productionLineId`, `operationTypeId`, `technicalAdministrationId`, `technicalDepartmentId`, `defaultCostCenterId` (5 new nullable FK fields)
- **MaintenanceRequest**: `costCenterId`, `operationTypeId`, `productionLineId` (3 new nullable FK fields)

### 6 New Permission Modules
`production-line`, `operation-type`, `cost-center`, `machine-component`, `spare-part`, `component-spare-part`

### 6+ New i18n Module Groups
Complete translation keys for all new entities in both English and Arabic.

### 6 New Frontend CRUD Pages + 3 Form Updates
- Full CRUD pages for each new model
- Machine create/edit form: add 5 new F9Lookup selectors + cascading logic
- Request create/edit form: add 3 new selectors

### 3 New Number Sequences
`PRODUCTION_LINE`, `SPARE_PART`, `MACHINE_COMPONENT`

---

## Accountability Gap (Batch H)

### 1 New Model Required
| Model | Priority | Notes |
|---|---|---|
| `MachineResponsibleAssignment` | HIGH | id, machineId, userId, roleType (RESPONSIBLE_ENGINEER/TECHNICIAN/...), isPrimary, startDate, endDate, assignedById |

### 7+ New Fields on Existing Models
- **MaintenanceRequest**: `assignedEngineerId`, `completedById`, `closedById`, `failureCause`, `actionTaken`, `unresolvedReason`, `acceptedAt` (7 new fields)
- **MaintenanceRequestPartUsage** (or new `SparePartIssue`): `requestedById`, `approvedById`, `issuedById`, `receivedById`, `installedById`, `machineId`, `costCenterId`, `issueDate`, `reason` (9 new fields)
- **Machine**: `responsibleTechnicianId` — superseded by `MachineResponsibleAssignment` model

### 3 New Permission Modules
`machine-responsibility`, `spare-part-issue`, `technician-report`

### Key Findings
- **Machine responsibility**: No current support for assigning technician/engineer to a machine
- **Assignment history**: No historical tracking — responsibility changes would be lost
- **Maintenance completion**: `completedById`/`closedById` not stored — only accessible via audit log
- **Spare parts**: No actor tracking (requestedBy, issuedBy, installedBy) — anonymous consumption
- **Cost center**: No cost center linkage on part usage
- **KPI readiness**: Most technician performance KPIs not computable with current data

---

## Effort Estimate (Read-Only, Not Binding)

| Layer | Estimated Files | Estimated Effort |
|---|---|---|
| Factory Models (ProdLine, OpType, CostCenter, MachineComponent, SparePart, CompSparePart) | ~30 files | 1-2 weeks |
| Accountability (MachineResponsibleAssignment, Request fields, SparePartIssue, Reports) | ~25 files | 1-1.5 weeks |
| Permissions + i18n + Menu + Migration | ~10 files | 1-2 days |
| Tests | ~15 files | 2-3 days |
| **Total (all batches)** | ~80 files | **~3-5 weeks** |

---

## Risks

1. **Free tier module limit (5)** — Adding 6-9 new permission modules (+ accountability) may require subscription reallocation.
2. **Database migration** — Adding nullable FK columns to existing tables with data is safe, but `productionLineId` on machine will require populating for existing records if made required.
3. **Web dev server** — Stale cache issue on dev server (homepage 500). Requires server restart. Not a production concern.
4. **No existing tests for maintenance models** — Test infrastructure exists but no test files were found for the current machine/request/task endpoints. Backfill needed.
5. **Anonymous spare part consumption** — Current system has no actor tracking on part usage. All existing part usage records (0 currently, but growing) would lack accountability data unless backfilled.
6. **Technician/Engineer role not defined** — No seed roles exist for technician/engineer. Implementation must decide: extend `User` with role, or create separate `MaintenancePersonnel` model? Both options need careful design to avoid HR module activation.
7. **Audit log reliance for accountability** — Current `completedBy`/`cancelledBy`/`startedBy` exists only in audit log. If audit log is archived/pruned, accountability data is lost.

---

## Conclusion

The current system is well-architected and the existing maintenance module provides a solid foundation. However, the target factory operational structure requires a **major extension** across two dimensions:

**Dimension 1 — Factory Structure** (6 new models, ~40 files, ~2 weeks)
- Production lines, operation types, cost centers, machine components, spare parts catalog
- Hierarchical machine organization with technical ownership

**Dimension 2 — Technician Accountability** (1 new model + 16+ new fields, ~25 files, ~1.5 weeks)
- Machine responsibility assignments with history
- Maintenance request actor tracking (assignedEng, completedBy, failureCause)
- Spare part issue chain-of-custody (requestedBy → issuedBy → receivedBy → installedBy)
- KPI-readiness data structures

**Total estimated effort: ~3-5 weeks (~80 files)**

No source code or database changes were made during this audit.
