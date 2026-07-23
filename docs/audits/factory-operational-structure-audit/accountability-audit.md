# Accountability Audit — Machine Responsibility / Technician Tracking

> Date: 2026-07-23  
> Scope: User model, MaintenanceRequest, MachinePart, MaintenanceRequestPartUsage, AuditLog

---

## 1. Capability Matrix

| Capability | Exists Now | Model/Table | API | UI | Missing | Risk | Future Fix |
|---|---|---|---|---|---|---|---|
| Machine responsible technician | ❌ | — | — | — | No `Machine.responsibleTechnicianId` | Anonymous machine ownership | `MachineResponsibleAssignment` model |
| Machine responsible engineer | ❌ | — | — | — | No `Machine.responsibleEngineerId` | Anonymous machine ownership | `MachineResponsibleAssignment` model |
| Machine responsibility history | ❌ | — | — | — | No assignment history model | Lost accountability on reassignment | `MachineResponsibleAssignment` with endDate |
| Maintenance request assigned technician | ✅ PARTIAL | `MaintenanceRequest.assignedToId` → User | `PATCH /assign` | Assign page | Only one assignee, no role-type (technician vs engineer) | Cannot distinguish technician vs engineer | Add `assignedEngineerId` or role-type |
| Maintenance request assigned engineer | ❌ | — | — | — | No separate engineer field | One person can't be both tech + eng | `assignedEngineerId` on request |
| Maintenance request completed by | ❌ | Only via AuditLog | — | — | No `completedById` field | Cannot directly query who completed | Add `completedById` + `closedById` + `acceptedAt` |
| Maintenance request unresolved reason | ❌ | — | — | — | No `unresolvedReason` field | Cancelled requests lose context | Add `unresolvedReason` + `failureCause` |
| Spare part requested by | ❌ | — | — | — | No `requestedById` | Anonymous part requests | Add to `MaintenanceRequestPartUsage` |
| Spare part approved by | ❌ | — | — | — | No `approvedById` | No approval chain | Add `approvedById` |
| Spare part issued by | ❌ | — | — | — | No `issuedById` | Anonymous stock removal | Create `SparePartIssue` model |
| Spare part received by | ❌ | — | — | — | No `receivedById` | Anonymous receipt | Add `receivedById` |
| Spare part installed/used by | ❌ | — | — | — | No `installedById` | Anonymous installation | Add `installedById`/`usedById` |
| Cost center on spare part issue | ❌ | — | — | — | No `costCenterId` | No cost allocation | Add `costCenterId` |
| Employee/user performance indicators | ❌ | — | — | — | No KPI tables | No performance visibility | Future dashboard |
| Audit trail by actor | ✅ | `AuditLog` with `userId` + `action` + `entity` + `entityId` | `GET activity` | Activity tab | Not structured for accountability reports | Only generic logging | Structured accountability events |

---

## 2. Machine Detail/Edit Accountability Audit

### Summary Table

| Field/Feature | List | Detail | Edit | API | DB | Status | Notes |
|---|---|---|---|---|---|---|---|
| Responsible technician | ❌ | ❌ | ❌ | ❌ | ❌ | MISSING | No field anywhere |
| Responsible engineer | ❌ | ❌ | ❌ | ❌ | ❌ | MISSING | No field anywhere |
| Technical administration | ❌ | ❌ | ❌ | ❌ | ❌ | MISSING | `technicalAdministrationId` not in schema |
| Technical department | ❌ | ❌ | ❌ | ❌ | ❌ | MISSING | `technicalDepartmentId` not in schema |
| Maintenance team | ❌ | ❌ | ❌ | ❌ | ❌ | MISSING | No team concept |
| Responsibility start date | ❌ | ❌ | ❌ | ❌ | ❌ | MISSING | No assignment history |
| Current active assignment | ❌ | ❌ | ❌ | ❌ | ❌ | MISSING | No current responsibility |
| Assignment history | ❌ | ❌ | ❌ | ❌ | ❌ | MISSING | No history stored |
| Last maintenance request | ❌ | ❌ | ❌ | ❌ | ❌ | MISSING | No dedicated query |
| Open maintenance requests | ❌ | ✅ (machine page) | ❌ | ✅ (query) | ❌ | PARTIAL | Detail has activity tab but no request list |
| Repeated failures | ❌ | ❌ | ❌ | ❌ | ❌ | MISSING | No failure cause tracking |
| Spare parts used (by machine) | ❌ | ❌ | ❌ | ❌ | ❌ | MISSING | No machine-level part consumption query |
| Downtime summary | ❌ | ✅ (separate page) | ❌ | ✅ (`/summary/machines`) | ❌ | PARTIAL | Dashboard shows per-machine downtime |
| Cost center | ❌ | ❌ | ❌ | ❌ | ❌ | MISSING | No cost center on machine |

---

## 3. Maintenance Request Accountability Audit

| Capability | Exists | Evidence | Missing | Risk | Required Future Implementation |
|---|---|---|---|---|---|
| Assign to technician | ✅ | `assignedToId` field, assign page, `PATCH /assign` | No role-type | ✅ PARTIAL | Add role-type or separate engineer field |
| Assign to engineer | ❌ | — | No second assignee field | Cannot track both | Add `assignedEngineerId` |
| Status transition records actor | ✅ | AuditLog userId per action | Not persisted on request itself | Audit log can be pruned | Add `startedBy`, `completedBy`, `cancelledBy` fields |
| Completion records who completed | ❌ | Only AuditLog (COMPLETE action) | No `completedById` field | Must join audit log | Add `completedById` + `closedById` |
| Request shows machine hierarchy | ❌ | — | No productionLine/techAdmin/techDept | No full context | Add hierarchy fields + includes |
| Request shows responsible tech/eng | ❌ | — | No machine responsibility link | Cannot link to owner | Add machine responsibility |
| Unresolved request records reason | ❌ | — | No `unresolvedReason` | Lost context | Add `unresolvedReason` + `failureCause` |
| Request shows spare parts consumed | ✅ | `MaintenanceRequestPartUsage` | No actor tracking (who issued/installed) | Anonymous consumption | Add actor fields to PartUsage |
| Response/repair duration | ❌ | — | No `startedAt` per request, no `acceptedAt` | No SLA tracking | `acceptedAt` - `createdAt` = response time; `completedAt` - `startedAt` = repair time |
| Accountability reports | ❌ | — | No report infrastructure | No accountability visibility | Batch H reports |

---

## 4. Spare Part Issue Accountability Audit

| Field | Exists in DB | Exists in API | Exists in UI | Required | Status | Notes |
|---|---|---|---|---|---|---|
| `requestedById` | ❌ | ❌ | ❌ | YES | MISSING | Who asked for the part |
| `approvedById` | ❌ | ❌ | ❌ | YES | MISSING | Who approved issuance |
| `issuedById` | ❌ | ❌ | ❌ | YES | MISSING | Stock keeper who issued |
| `receivedById` | ❌ | ❌ | ❌ | YES | MISSING | Technician who received |
| `installedById`/`usedById` | ❌ | ❌ | ❌ | YES | MISSING | Who actually installed/used |
| `machineId` | ❌ | ❌ | ❌ | YES | MISSING | Which machine the part was used on |
| `componentId` | ❌ | ❌ | ❌ | NICE | MISSING | Which component |
| `maintenanceRequestId` | ✅ | ✅ | ✅ | YES | EXISTS | PartUsage has requestId |
| `costCenterId` | ❌ | ❌ | ❌ | YES | MISSING | Cost allocation |
| `quantity` | ✅ | ✅ | ✅ | YES | EXISTS | Current PartUsage has quantity |
| `returnedQuantity` | ❌ | ❌ | ❌ | NICE | MISSING | Returns tracking |
| `reason` | ❌ | ❌ | ❌ | YES | MISSING | Why part was used |
| `issueDate` | ❌ | ❌ | ❌ | YES | MISSING | When issued |
| `installDate` | ❌ | ❌ | ❌ | NICE | MISSING | When installed |
| `audit actor` | ✅ | ✅ | ❌ | YES | PARTIAL | API logs via audit but UI doesn't show |

**Current PartUsage DTO** (`create-maintenance-request-part.dto.ts`):
```ts
{ requestId, productId, quantity, unitCost?, totalCost?, notes? }
```
No accountability fields at all.

---

## 5. Audit Log Capability

| Feature | Status | Details |
|---|---|---|
| `AuditLog.userId` | ✅ EXISTS | Tracks who performed action |
| `AuditLog.action` | ✅ EXISTS | CREATE, UPDATE, DELETE, START, COMPLETE, CANCEL, REOPEN |
| `AuditLog.entity` | ✅ EXISTS | MaintenanceRequest, Machine, MachinePart, etc. |
| `AuditLog.entityId` | ✅ EXISTS | ID of affected record |
| `AuditLog.details` | ✅ EXISTS | JSON with status changes, machineId, etc. |
| `AuditLog.ip` | ✅ EXISTS | Request IP |
| `AuditLog.userAgent` | ✅ EXISTS | Browser info |
| `AuditLog.createdAt` | ✅ EXISTS | Timestamp |
| `createdBy`/`updatedBy` on models | ❌ MISSING | No auto-populated creator/updater fields |
| Structured accountability query | ❌ MISSING | No dedicated endpoint for "what did user X do" |

**Current audit log in service methods:**
- `create()` → audit `{ requestNumber, machineId }`
- `start()` → audit `{ oldStatus, newStatus, machineId }`
- `complete()` → audit `{ oldStatus, newStatus, machineId, downtimeHours }`
- `cancel()` → audit `{ oldStatus, newStatus, machineId }`
- `assign()` → audit `{ action: 'assign', assignedToId, oldAssignedToId }`

All actions record `userId` — good for tracing, but not directly queryable as "completed by."

---

## 6. KPI Data Readiness

| KPI | Data Exists | Source | Missing | Risk | Future Implementation |
|---|---|---|---|---|---|
| Number of assigned machines | ❌ | — | No MachineResponsibleAssignment | Cannot measure machine load | Batch H — assignment model |
| Requests assigned to tech | ✅ | `MaintenanceRequest.assignedToId` | No aggregated query | Low — queryable | Aggregate endpoint |
| Completed requests | ✅ PARTIAL | AuditLog COMPLETE action | No `completedById` field | Must join audit log | Add `completedById` |
| Overdue requests | ❌ | — | No SLA/expected duration | Cannot detect overdue | Add expectedDuration + SLA window |
| Average response time | ❌ | — | No `acceptedAt` | Cannot compute | Add `acceptedAt` = tech acknowledges |
| Average repair time | ❌ | — | No `startedAt`/`completedAt` on request | Cannot compute | `startedAt` exists; `completedById` needed |
| Repeated failure count | ❌ | — | No `failureCause` | Cannot detect patterns | Add `failureCause` + machine-level query |
| Spare parts consumption value | ✅ PARTIAL | `MaintenanceRequestPartUsage.totalCost` | No per-technician aggregation | Low — cost exists | Aggregate by technician when actor fields added |
| Unresolved requests | ✅ | `status: CANCELLED` | No reason for cancellation | Medium — no context | Add `unresolvedReason` |
| First-time-fix rate | ❌ | — | No repeat-failure tracking | Cannot compute | `failureCause` + machine + close date |
| Downtime caused/reduced by tech | ✅ PARTIAL | `DowntimeLog.durationMinutes` | Not linked to technician | Medium | Link downtime to assigned tech |
| Tasks completed on time | ❌ | — | No SLA/due dates on tasks | Cannot compute | Add expected completion |
| Preventive maintenance compliance | ✅ PARTIAL | Schedules + checklist executions | No compliance % query | Medium | Compliance query endpoint |

---

## 7. Existing User/Personnel Model

| Feature | Exists | Details |
|---|---|---|
| User model | ✅ | `User` with id, email, name, phone, status, companyId, branchId, departmentId |
| User roles | ✅ | `UserRole` junction table → `Role` with code, name |
| Role-based permissions | ✅ | `RolePermission` → `Permission` |
| Technician/engineer role | ❌ NOT DEFINED | No seed role for technician or engineer. Only admin/system roles exist |
| Maintenance personnel model | ❌ | No separate `MaintenancePersonnel` model — only system Users |
| Machine assigned to user | ❌ | No field for responsible user on Machine |
| Maintenance request assigned to user | ✅ | `assignedToId` on request |
| CompletedBy recording | ❌ | Only audit log, not a direct field |
| Spare part issue actor fields | ❌ | No requestedBy/issuedBy/installedBy |
| Audit log actorId | ✅ | `AuditLog.userId` tracks all action actors |
| `createdBy`/`updatedBy` fields | ❌ | Models have `createdAt`/`updatedAt` but no creator/updater |
| `passwordHash` exposure | ⚠️ | `model User { passwordHash String }` — exposed in Prisma but not in API responses |

---

## 8. Gap Register — Accountability

| ID | Gap | Impact | Priority |
|---|---|---|---|
| RESP-001 | Machine has no responsible technician/engineer | No machine ownership accountability | **HIGH** |
| RESP-002 | No machine responsibility history | Lost accountability on reassignment | **HIGH** |
| RESP-003 | Maintenance request does not distinguish technician vs engineer assignee | Single assignee field insufficient | **HIGH** |
| RESP-004 | Maintenance completion does not store `completedById`/`closedById` | Must join audit log for who resolved | **HIGH** |
| RESP-005 | Spare part issue does not track requestedBy/issuedBy/receivedBy/installedBy | Anonymous part consumption | **HIGH** |
| RESP-006 | Spare part issue not linked to cost center | No cost allocation | **HIGH** |
| RESP-007 | No technician/engineer performance data readiness | Cannot evaluate staff | **MEDIUM** |
| RESP-008 | No report by technician/engineer | Cannot filter work by person | **MEDIUM** |
| RESP-009 | No repeated failure tracking by responsible person | Cannot detect recurring issues | **MEDIUM** |
| RESP-010 | No accountability dashboard | No visibility into technician workload | **LOW** |

---

## 9. Existing Accountability Features (What Works Now)

Despite the gaps, the current system does provide:

1. **Assigned technician** on maintenance request — the `F9Lookup` user selector works, `assignedToId` is stored and displayed
2. **Audit log** for every status transition — who STARTED, COMPLETED, CANCELLED is logged with userId
3. **Activity tab** on request detail — shows audit log entries with user names
4. **RequestedBy** on request — who created the request is stored
5. **Part usage** tracked to a request — `MaintenanceRequestPartUsage` links parts to specific work orders
6. **Cost tracking** — `MaintenanceRequestCostEntry` stores costs per request
7. **Machine operational status** — `GET /machines/:id/operational-status` shows active requests, downtime, open tasks
8. **Downtime logs** — linked to machine and optionally to request

---

## 10. Roadmap Addition — Batch H

```
Batch H — Technician / Engineer Accountability

Scope:
- MachineResponsibleAssignment model + CRUD API + UI
- Machine detail: display current assignments + history
- MaintenanceRequest: add assignedEngineerId, completedById, closedById, failureCause, actionTaken, unresolvedReason
- SparePartIssue model (replacing/extending PartUsage): 
  requestedById, approvedById, issuedById, receivedById, installedById, costCenterId, machineId, componentId
- Reports by technician/engineer
- KPI-readiness data structures

Rules:
- Do NOT activate HR module
- Do NOT implement payroll or HR appraisal
- Only maintenance accountability and operational performance tracking
- Preserve existing machine/request/parts data
- Backfill existing records with documented fallback
```
