# ATsofterp Target Architecture Design & Gap Analysis Report

> **Design only. No implementation was performed. No code was modified.**

---

## 1. Executive Summary

ATsofterp has a strong existing architecture covering multi-company tenant isolation, organizational hierarchy, CMMS maintenance, production, inventory, costing, and assets. The system already supports recursive hierarchies, dual machine ownership, cost domain/type separation, downtime split ownership, and measurement-point-based output.

**The approved design extends the existing architecture minimally.** Only 4 new models are proposed. No existing working system is replaced.

### Key Decisions at a Glance

| Decision | Verdict | Rationale |
|----------|---------|-----------|
| OrganizationalUnit | FREEZE | No new consumers. Department covers all operational needs. |
| Department | KEEP_AND_EXTEND | Add `classification` field for node type. |
| ProductionArea / ProcessSection | REJECTED | Department recursion covers this. |
| Employee | REJECTED | OperationalPerson is sufficient. |
| OperationalPerson | KEEP_AND_EXTEND | Add jobTitleId FK, supervisorId self-FK. |
| JobTitle | NEW_MODEL | Free text is insufficient for structured roles. |
| OrganizationalPersonAssignment | NEW_MODEL | Historical placement per person is required. |
| SupervisorAssignment | NEW_MODEL | Hierarchical reporting is required. |
| MaintenanceCoverageAssignment | KEEP_AND_EXTEND | Generalize MachineResponsibilityAssignment scope. |
| ShiftHandover | NEW_MODEL | Missing business capability. |
| CompanyProduct | REJECTED | Product global catalog works through scoped intermediaries. |
| CompanySparePart | REJECTED | SparePart global catalog works through scoped intermediaries. |
| MaintenanceWindow | REJECTED | Existing MaintenanceSchedule + WorkOrder covers this. |

---

## 2. Current Baseline

| Metric | Value |
|--------|------|
| Branch | `checkpoint/backend-lan-responsive-shell` |
| Commit | `0e9c925c887777f830a5a0611660770b9a2abdd7` |
| Prisma models | 145 |
| Registered backend modules | 95 |
| Frontend routes | 298 |
| Schema lines | 5,292 |
| Enums | 0 (all plain strings) |
| Migrations | 60 applied |

---

## 3. Architectural Principles

1. **Preserve what works.** Every existing working entity keeps its role unless a concrete conflict proves modification necessary.
2. **Extend, don't rebuild.** New models must prove existing models cannot carry the responsibility.
3. **One source of truth.** No two parallel hierarchies for the same business concept.
4. **Tenant isolation is sacred.** Every new model must define companyId/branchId and how cross-tenant references are prevented.
5. **String conventions.** Status/type/category values remain plain strings (matching existing 0-enum convention).
6. **CUID primary keys.** All new models use `String @id @default(cuid())`.
7. **Soft delete.** All operational models include `deletedAt DateTime?`.
8. **Timestamps.** All models include `createdAt` and `updatedAt`.

---

## 4. Organization Target Design

### 4.1 Current State (CONFIRMED)

```
Company
  +-- Branch (companyId required)
  |     +-- Administration (branchId required)
  |           (linked to Department via administrationId)
  |
  +-- Department (companyId required, branchId optional, administrationId optional)
        +-- parentId -> self-relation "DepartmentHierarchy" (recursive)
        +-- Referenced by: Machine, ProductionLine, CostCenter, MaintenanceSchedule
        +-- Has: type field (default 'OPERATIONAL')
        +-- Has: operationalUnits -> OrganizationalUnit[] (unused in operations)

  +-- OrganizationalUnit (companyId + branchId required)
        +-- parentId -> self-relation "OrganizationalUnitHierarchy" (recursive)
        +-- Referenced by: UserOperationalScope (optional)
        +-- NOT referenced by: Machine, ProductionLine, CostCenter, MaintenanceSchedule
        +-- Has: type field (default 'DEPARTMENT')
```

### 4.2 Target State

```
Company
  +-- Branch
  |     +-- Administration
  |     +-- Department (recursive via parentId)
  |           +-- classification: MANAGEMENT | AREA | PROCESS | SECTION | UNIT | WORKSHOP
  |           +-- Referenced by: Machine (operational + technical), ProductionLine, CostCenter
  |
  +-- CostCenter (recursive via parentId)
        (assigned to Department, Machine, ProductionLine)

OrganizationalUnit -> FROZEN (no new consumers, existing data preserved)
```

### 4.3 OrganizationalUnit -- Decision: FREEZE

| Criterion | Finding |
|-----------|---------|
| Referenced by Machine | NO |
| Referenced by ProductionLine | NO |
| Referenced by CostCenter | NO |
| Referenced by MaintenanceSchedule | NO |
| Referenced by UserOperationalScope | YES (optional) |
| Referenced by ActiveContextValidator | YES (checks scope) |
| Has own CRUD module | YES |
| Has sidebar navigation | YES |
| Schema relation to Department | YES (Department.operationalUnits -> OrgUnit[]) |

**Rationale:** No operational entity consumes OrganizationalUnit. It exists as a parallel hierarchy with CRUD pages but no downstream consumers. Department recursion already handles the same structure. OrganizationalUnit is FROZEN -- no new references, existing data preserved.

**Migration path:** UserOperationalScope.organizationalUnitId should be migrated to use departmentId instead (see Section 31).

### 4.4 Department -- Decision: KEEP_AND_EXTEND

Department already serves as the canonical operational hierarchy. The `type` field (default 'OPERATIONAL') should be extended with a `classification` field to describe the node's role in the hierarchy.

**Proposed `classification` values:**

| Value | Meaning | Example |
|-------|---------|---------|
| MANAGEMENT | Top management area | ??? ??????? ??? ????? |
| AREA | Major operational area | ????? / ????? |
| PROCESS | Product/process grouping | ????? ?????? / ????? ???? |
| SECTION | Manufacturing/packaging section | ?????? ?????? / ?????? ?????? |
| UNIT | Small functional unit | ????? ?????? |
| WORKSHOP | Physical workshop | ??????? ??? ????? |

**Rationale:** Classification is a semantic label on the recursive Department tree. It does NOT create new hierarchy levels -- the same recursive tree handles all depths. Classification helps reporting, filtering, and UI display but does not change the data model structure.

---

## 5. Factory Operational Hierarchy

### 5.1 Current State (CONFIRMED)

```
Department -> ProductionLine -> Machine -> MachineComponent (recursive)
```

Machine links: departmentId (operational), technicalDepartmentId, technicalAdministrationId, productionLineId, operationTypeId, costCenterId.

### 5.2 Target State (PRESERVED -- No New Models)

```
Department (classification: AREA)
  +-- Department (classification: PROCESS)
        +-- ProductionLine
              +-- Machine
                    +-- MachineComponent (recursive)
```

**No new ProductionArea or ProcessSection models.** Department recursion handles unlimited depth:

```
????? ?????? (Department, AREA)
+-- ????? ?????? (Department, PROCESS)
|   +-- ?????? ?????? (Department, SECTION) -> ProductionLine -> Machine
|   +-- ?????? ?????? (Department, SECTION) -> ProductionLine -> Machine
+-- ????? ????? (Department, PROCESS)
    +-- ?????? ????? (Department, SECTION) -> ProductionLine -> Machine
    +-- ?????? ????? (Department, SECTION) -> ProductionLine -> Machine
```

### 5.3 Why This Works Without New Models

1. Department already has `parentId` (recursive) -- unlimited depth
2. ProductionLine already links to Department (`departmentId`)
3. Machine already links to Department (`departmentId` for operational, `technicalDepartmentId` for maintenance)
4. Machine already links to ProductionLine (`productionLineId`)
5. The new `classification` field on Department identifies node purpose without creating structural overhead

---

## 6. Machine Operational vs Technical Ownership

### 6.1 Current State (CONFIRMED)

Machine already has dual organizational dimensions:

| Field | Purpose | Example |
|-------|---------|---------|
| `departmentId` | OPERATIONAL ownership | ?????? ?????? -> ?????? ?????? |
| `technicalDepartmentId` | TECHNICAL/MAINTENANCE ownership | ?????? ?????? -> ?????? ?????? |
| `technicalAdministrationId` | TECHNICAL admin | ?????? ?????? |
| `productionLineId` | Production line | ????? ?????? ?????? 1 |
| `operationTypeId` | Operation type | ?????? / ?????? |
| `costCenterId` | Cost allocation | ?????? ?????? ?????? |

**No new fields needed.** A machine can already belong operationally to "Production -> Chips -> Manufacturing -> Line 1" while technically maintained by "Maintenance -> Chips Maintenance".

---

## 7. Person / Employee Architecture

### 7.1 Current State (CONFIRMED)

| Model | Purpose | Key Fields |
|-------|---------|------------|
| User | System login | email, passwordHash, companyId?, branchId?, departmentId? |
| OperationalPerson | Canonical person | firstName, lastName, jobTitle (FREE TEXT), phone?, email?, userId? (unique), category, companyId, branchId |
| MaintenancePersonnel | Maintenance extension | operationalPersonId (unique), specialty, maintenanceRole, dailyCapacityMinutes, certifications |

### 7.2 Key Gaps Identified

| Gap | Evidence |
|-----|----------|
| `jobTitle` is free text on OperationalPerson | OperationalPerson.jobTitle is `String?` -- not a FK |
| No supervisor hierarchy | No model says "Person A reports to Person B" |
| No organizational assignment history | No record of where person was placed over time |
| No departmentId on OperationalPerson | Person is NOT linked to organizational structure directly |
| MaintenancePersonnel has no branchId | Company-level only |

### 7.3 Decision: KEEP OperationalPerson as Canonical

OperationalPerson is referenced by:
- MaintenancePersonnel (1:1 extension)
- MachineResponsibilityAssignment
- MaintenanceRequestAssignment
- MaintenancePartAccountability
- ProductionShiftAssignment

It already has companyId/branchId, name fields, userId link, category. It CAN serve as the canonical employee/person record with extensions.

**Do NOT create Employee model.** OperationalPerson is sufficient.

---

## 8. Job Titles

### 8.1 Current State

OperationalPerson.jobTitle = `String?` (free text, optional). No JobTitle model exists.

### 8.2 Gap

The business requires structured job titles that are:
- Searchable and filterable
- Reusable across persons
- Category-classifiable
- Company-scoped (same title name may differ across companies)

### 8.3 Proposed Model: JobTitle

**Why not reuse Role?** Role = system access (what can this user DO in the app). JobTitle = organizational position (what is this person's JOB in the factory). These must remain separate.

**Why not use free text?** Free text prevents: consistent filtering, reports by job category, dropdown population, assignment validation, and cross-person comparison.

**Proposed fields (pseudo-Prisma):**

```prisma
model JobTitle {
  id          String    @id @default(cuid())
  companyId   String
  code        String    // unique per company
  name        String
  nameAr      String?
  nameEn      String?
  category    String    @default("OPERATIONAL")
  // OPERATIONAL | MANAGEMENT | TECHNICAL | ADMINISTRATIVE
  description String?
  isActive    Boolean   @default(true)
  status      String    @default("ACTIVE")
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
  deletedAt   DateTime?

  company           Company              @relation(fields: [companyId])
  operationalPersons OperationalPerson[]
  assignments       OperationalPersonAssignment[]

  @@unique([companyId, code])
  @@index([companyId])
  @@index([status])
}

// Add to Company model:
// jobTitles JobTitle[]
```

---

## 9. Organizational Assignment History

### 9.1 Current State

No model records where a person was placed over time. OperationalPerson has no departmentId. The only assignment-like records are:
- UserOperationalScope (authorization, NOT organizational)
- MachineResponsibilityAssignment (maintenance responsibility, NOT organizational)
- ProductionShiftAssignment (shift assignment, NOT organizational)

### 9.2 Gap

The business requires historical tracking:
```
Person A:
2026-01-01 -> 2026-06-30: ????? / ????? / ?????? ??????
2026-07-01 -> current: ?????? / ????? / ?????? ??????
```

### 9.3 Proposed Model: OperationalPersonAssignment

**Why not add departmentId to OperationalPerson?** That gives current placement only -- no history. The business explicitly requires historical tracking.

**Why not reuse UserOperationalScope?** UserOperationalScope is AUTHORIZATION (what can this user access), not ORGANIZATIONAL PLACEMENT (where does this person work). Mixing them conflates security with HR.

**Proposed fields (pseudo-Prisma):**

```prisma
model OperationalPersonAssignment {
  id                String    @id @default(cuid())
  companyId         String
  branchId          String?
  administrationId  String?
  departmentId      String    // where the person is assigned
  jobTitleId        String?   // FK -> JobTitle at time of assignment
  personnelId       String    // FK -> OperationalPerson
  assignmentType    String    @default("PRIMARY")
  // PRIMARY | SECONDARY | TEMPORARY | ACTING
  effectiveFrom     DateTime  // assignment start
  effectiveTo       DateTime? // null = current
  isPrimary         Boolean   @default(true)
  status            String    @default("ACTIVE")
  // ACTIVE | TRANSFERRED | COMPLETED
  notes             String?
  createdBy         String?   // FK -> User who created record
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt
  deletedAt         DateTime?

  company              Company              @relation(fields: [companyId])
  branch               Branch?              @relation(fields: [branchId])
  administration       Administration?      @relation(fields: [administrationId])
  department           Department           @relation(fields: [departmentId])
  jobTitle             JobTitle?            @relation(fields: [jobTitleId])
  person               OperationalPerson    @relation(fields: [personnelId])
  supervisorAssignment SupervisorAssignment[]

  @@unique([personnelId, departmentId, effectiveFrom])
  @@index([companyId])
  @@index([branchId])
  @@index([departmentId])
  @@index([personnelId])
  @@index([status])
}

// Add to OperationalPerson model:
// assignments OperationalPersonAssignment[]
// Add to Department model:
// personAssignments OperationalPersonAssignment[]
```

---

## 10. Supervisor Hierarchy

### 10.1 Current State

No model represents "Person A reports to Person B."

### 10.2 Gap

The business requires a full reporting hierarchy:
```
????? ??????? ??? ?????
  +-- ?????? ??????
  |     +-- ????? ?????? ?????? ??????
  |     |     +-- ?????? ??????
  |     |     +-- ????? ??????
  +-- ?????? ?????
        +-- ????? ?????? ??????
              +-- ?????? ????
              +-- ?????? ??????
```

### 10.3 Proposed Model: SupervisorAssignment

**Why on assignment rather than on OperationalPerson?** Because a person's supervisor may change when they transfer departments. The supervisor relationship is organizational, not personal.

**Why not a self-relation on OperationalPerson?** That gives a person ONE supervisor total. But a person could have different supervisors in different assignments/contexts. The assignment-based approach is more flexible.

**Proposed fields (pseudo-Prisma):**

```prisma
model SupervisorAssignment {
  id                      String    @id @default(cuid())
  companyId               String
  assignmentId            String    // FK -> subordinate's OperationalPersonAssignment
  supervisorAssignmentId  String?   // FK -> supervisor's current OperationalPersonAssignment
  supervisorPersonId      String?   // FK -> supervisor's OperationalPerson
  relationshipType        String    @default("DIRECT")
  // DIRECT | FUNCTIONAL | ESCALATION | BACKUP
  effectiveFrom           DateTime
  effectiveTo             DateTime?
  isActive                Boolean   @default(true)
  status                  String    @default("ACTIVE")
  createdAt               DateTime  @default(now())
  updatedAt               DateTime  @updatedAt
  deletedAt               DateTime?

  company              Company                          @relation(fields: [companyId])
  assignment           OperationalPersonAssignment       @relation(fields: [assignmentId])
  supervisorAssignment OperationalPersonAssignment?      @relation("SupervisorOf", fields: [supervisorAssignmentId])
  supervisorPerson     OperationalPerson?                @relation("SupervisesPerson", fields: [supervisorPersonId])

  @@index([companyId])
  @@index([assignmentId])
  @@index([supervisorPersonId])
  @@index([supervisorAssignmentId])
  @@index([status])
}

// Add to OperationalPersonAssignment:
// supervisorAssignments SupervisorAssignment[]
// supervisedBy SupervisorAssignment[] @relation("SupervisorOf")
// Add to OperationalPerson:
// supervises SupervisorAssignment[] @relation("SupervisesPerson")
```

---

## 11. Maintenance Personnel

### 11.1 Current State (PRESERVED)

MaintenancePersonnel already provides:
- specialty (electrical, mechanical, etc.)
- maintenanceRole ('ENGINEER', 'TECHNICIAN', etc.)
- dailyCapacityMinutes
- certifications
- 1:1 link to OperationalPerson

### 11.2 Decision: KEEP_AS_IS (with minor extension)

MaintenancePersonnel should remain the maintenance-specific extension of OperationalPerson. It should NOT duplicate name, department/branch, job title, or shift assignment.

**Required extension:** Add `branchId` to MaintenancePersonnel (currently company-level only, should be branch-scoped).

**Proposed schema delta:**

```prisma
// Modification to existing MaintenancePersonnel model:
// Add field:
branchId String?  // FK -> Branch
// Add relation:
branch Branch? @relation(fields: [branchId])
// Add index:
// @@index([branchId])
```

---

## 12. Maintenance Coverage / Line Responsibility

### 12.1 Current State (CONFIRMED)

MachineResponsibilityAssignment already has:
- operationalPersonId -> OperationalPerson
- machineId -> Machine
- responsibilityType: PRIMARY, SECONDARY, BACKUP, TEMPORARY, EMERGENCY_SUPPORT
- effectiveFrom, effectiveTo (date range)
- isActive, status

### 12.2 Gap

Current model is machine-scoped only. The business requires coverage at:
1. Department/area level
2. Production line level
3. Machine level

### 12.3 Decision: KEEP_AND_EXTEND

**Rationale:** The current model's structure is correct. It just needs to support line-level and department-level coverage, not only machine-level. Adding optional `departmentId` and `productionLineId` fields extends scope without breaking existing data.

**Proposed schema delta:**

```prisma
// Modification to existing MachineResponsibilityAssignment model:
// Add fields:
departmentId    String?  // FK -> Department (area-level coverage)
productionLineId String?  // FK -> ProductionLine (line-level coverage)
// Add relations:
department     Department?    @relation(fields: [departmentId])
productionLine ProductionLine? @relation(fields: [productionLineId])
// Add indexes:
// @@index([departmentId])
// @@index([productionLineId])
// Make machineId nullable:
// machineId String? (was required, now optional for line/dept coverage)
```

**Backward compatibility:** All existing records have machineId set. Making it nullable is safe. New records can specify departmentId OR productionLineId OR machineId.

---

## 13. Daily Inspection Integration

### 13.1 Current State

MaintenanceSchedule -> MaintenanceChecklistItem (templates)
MaintenanceSchedule -> MaintenanceChecklistExecution -> MaintenanceChecklistExecutionItem

### 13.2 Design: No New Models Needed

The daily inspection workflow uses existing entities:

```
1. MaintenanceSchedule defines: what to inspect, how often, which machine
2. MaintenanceSchedule links to: Machine (via machineId)
3. Machine links to: ProductionLine, Department (operational ownership)
4. MaintenanceChecklistItem defines: what to check
5. Engineer responsible is determined by:
   MachineResponsibilityAssignment (coverage assignment)
   -> OperationalPerson -> User
6. Execution recorded via:
   MaintenanceChecklistExecution -> MaintenanceChecklistExecutionItem
7. If fault discovered:
   -> Create MaintenanceRequest from checklist execution
   -> DowntimeLog created if machine stops
```

The connection between schedule, responsible engineer, and production line exists through:
- MaintenanceSchedule.machineId -> Machine
- Machine.departmentId -> Department (operational area)
- Machine.technicalDepartmentId -> Department (maintenance area)
- MachineResponsibilityAssignment.machineId -> Machine + personnelId -> OperationalPerson

**No new inspection subsystem is required.**

---

## 14. Weekly Maintenance Window

### 14.1 Current State

Existing entities: MaintenanceSchedule, MaintenanceRequest, MaintenanceWorkOrder, MaintenanceTask, DowntimeSegment

### 14.2 Design: No New Model Needed

The weekly maintenance window is an operational workflow, not a data model:

```
1. During the week: deferred non-emergency faults logged as MaintenanceRequest
   with priority = DEFERRED
2. When weekly stop is scheduled:
   - DowntimeSegment created with category PLANNED_STOP
   - MaintenanceWorkOrders created from deferred requests
   - WorkOrders assigned to engineers based on MachineResponsibilityAssignment
3. During weekly stop:
   - WorkOrders executed, MaintenanceTask status tracked
   - Parts consumed via MaintenanceWorkOrderPart
4. After weekly stop:
   - WorkOrders closed, Preventive schedules updated (nextDueDate)
```

---

## 15. Emergency Maintenance Responsibility

### 15.1 Current State

MaintenanceRequestAssignment already has:
- operationalPersonId -> OperationalPerson
- role: 'ASSIGNED_TO', 'INFORMED', 'APPROVER'

MachineResponsibilityAssignment has:
- responsibilityType: PRIMARY, SECONDARY, BACKUP, TEMPORARY, EMERGENCY_SUPPORT

### 15.2 Design: No New Model Needed

Emergency override is handled by assignment records:

```
1. Normal responsibility: MachineResponsibilityAssignment
   responsibilityType = PRIMARY -> Engineer A
   responsibilityType = SECONDARY -> Engineer B
   responsibilityType = EMERGENCY_SUPPORT -> Engineer C

2. Emergency occurs:
   - Any qualified engineer in same operational area responds
   - MaintenanceRequest created with priority = EMERGENCY
   - MaintenanceRequestAssignment created for the responding engineer
   - Actual repair person tracked via MaintenanceRequestAssignment

3. The distinction between:
   - Who is normally responsible (MachineResponsibilityAssignment)
   - Who actually performed the repair (MaintenanceRequestAssignment)
   is already captured by the two models.
```

---

## 16. Shift Architecture

### 16.1 Current State (CONFIRMED)

ProductionShift is already:
- Tenant-scoped (companyId + branchId)
- Used in both production AND maintenance (DowntimeLog.shiftId, DowntimeSegment.shiftId)
- Has templates, calendars, assignments
- Has ProductionShiftAssignment (links OperationalPerson to shift)
- Has ProductionOperationalAssignment (links machine/line to shift)

### 16.2 Decision: KEEP_AS_IS (Generalized Shift)

ProductionShift already serves as the shared shift concept. No MaintenanceShift or EmployeeShift needed.

**Rename consideration:** The model name "ProductionShift" is misleading since it serves maintenance too. However, renaming a Prisma model in a production database is high-risk. **Keep the name, document the broader scope.**

**Required extension:** Add optional `departmentId` to link shifts to operational areas.

**Proposed schema delta:**

```prisma
// Modification to existing ProductionShift model:
// Add field:
departmentId String? // FK -> Department (optional area assignment)
// Add relation:
department Department? @relation(fields: [departmentId])
// Add index:
// @@index([departmentId])
```

---

## 17. Shift Handover

### 17.1 Current State

No shift handover model exists.

### 17.2 Proposed Model: ShiftHandover

**Why a new model?** Shift handover has unique dimensions not covered by any existing model: outgoing/incoming shift pairs, status snapshots from multiple domains (production, maintenance, quality, safety), and a structured handover record.

**Proposed fields (pseudo-Prisma):**

```prisma
model ShiftHandover {
  id                    String    @id @default(cuid())
  companyId             String
  branchId              String?
  departmentId          String?   // FK -> Department (area scope)
  handoverDate          DateTime  // the date of the handover
  outgoingShiftId       String    // FK -> ProductionShift
  incomingShiftId       String    // FK -> ProductionShift
  outgoingPersonId      String?   // FK -> OperationalPerson (outgoing supervisor)
  incomingPersonId      String?   // FK -> OperationalPerson (incoming supervisor)

  // Production status summary
  productionStatus      String?
  activeProductionOrders Int?

  // Maintenance status
  openMaintenanceRequests Int?
  stoppedMachines        Int?
  pendingMaintenance     Int?

  // Quality observations
  qualityObservations    String?

  // Safety observations
  safetyObservations     String?

  // Material status
  materialShortages     String?

  // General
  notes                  String?
  status                 String    @default("DRAFT")
  // DRAFT | SUBMITTED | ACKNOWLEDGED
  submittedAt            DateTime?
  acknowledgedAt         DateTime?
  createdBy              String?
  createdAt              DateTime  @default(now())
  updatedAt              DateTime  @updatedAt
  deletedAt              DateTime?

  company        Company           @relation(fields: [companyId])
  department     Department?       @relation(fields: [departmentId])
  outgoingShift  ProductionShift   @relation("OutgoingShift", fields: [outgoingShiftId])
  incomingShift  ProductionShift   @relation("IncomingShift", fields: [incomingShiftId])
  outgoingPerson OperationalPerson? @relation("OutgoingPerson", fields: [outgoingPersonId])
  incomingPerson OperationalPerson? @relation("IncomingPerson", fields: [incomingPersonId])
  attachments    Attachment[]

  @@index([companyId])
  @@index([branchId])
  @@index([departmentId])
  @@index([handoverDate])
  @@index([outgoingShiftId])
  @@index([incomingShiftId])
  @@index([status])
}

// Add to ProductionShift:
// outgoingHandovers ShiftHandover[] @relation("OutgoingShift")
// incomingHandovers ShiftHandover[] @relation("IncomingShift")
// Add to OperationalPerson:
// outgoingHandovers ShiftHandover[] @relation("OutgoingPerson")
// incomingHandovers ShiftHandover[] @relation("IncomingPerson")
// Add to Department:
// shiftHandovers ShiftHandover[]
```

---

## 18. Maintenance Request / Work Order Integration

### 18.1 Current State (PRESERVED)

All existing models remain unchanged:
- MaintenanceRequest
- MaintenanceWorkOrder
- MaintenanceTask
- MaintenanceSchedule
- MaintenanceChecklistItem/Execution
- MaintenanceSlaRule/State
- MaintenanceRequestRequiredPart/PartUsage/CostEntry
- MaintenanceWorkOrderPart/CostEntry
- MaintenanceRequestAssignment
- MaintenancePartAccountability

### 18.2 Integration with New Organization/Person Models

The new organizational assignment and supervisor models integrate through existing FK points:

```
MaintenanceRequest
  -> machineId -> Machine -> departmentId (operational area)
  -> MachineResponsibilityAssignment -> OperationalPerson (responsible engineer)
  -> MaintenanceRequestAssignment -> OperationalPerson (assigned person)

MaintenanceWorkOrder
  -> machineId -> Machine -> technicalDepartmentId (maintenance area)
  -> MaintenanceWorkOrderPart -> SparePart -> Inventory (parts used)
  -> MaintenanceWorkOrderCostEntry -> OperationalCostTransaction (costs)
```

**No changes to existing maintenance models.**

---

## 19. Spare Part Lifecycle

### 19.1 Current State (PRESERVED)

Complete chain already exists:

```
SparePart (catalog)
+-- MachineSparePart -> Machine
+-- ComponentSparePart -> MachineComponent
+-- SparePartConditionBalance -> Warehouse
+-- SparePartConditionMovement -> Warehouse
+-- SparePartRepairOrder -> Repair workflow
|   +-- SparePartRepairAction
+-- MachineInstalledPart -> Machine
|   +-- MachineInstalledPartReading
+-- SparePartReplacementHistory (old->new)
+-- MaintenanceBom -> Machine/Component
|   +-- MaintenanceBomVersion -> MaintenanceBomItem
+-- PreventiveSparePartPlan -> MaintenanceSchedule
|   +-- PreventiveSparePartPlanItem
+-- MaintenanceRequestRequiredPart -> MaintenanceRequest
+-- MaintenancePartAccountability -> Personnel
+-- Product (optional link to inventory)
```

### 19.2 Coverage Assessment

| Step | Model | Status |
|------|-------|--------|
| Request | MaintenanceRequestRequiredPart | EXISTS |
| Approval | MaintenanceWorkOrder (status workflow) | EXISTS |
| Warehouse issue | MaintenanceStockIssue | EXISTS |
| Receipt by technician | MaintenancePartAccountability | EXISTS |
| Installation | MachineInstalledPart | EXISTS |
| Old part removal | SparePartReplacementHistory | EXISTS |
| Runtime monitoring | MachineInstalledPartReading | EXISTS |
| Life alert | See Section 21 | DESIGN |
| Replacement | SparePartReplacementHistory + MachineInstalledPart | EXISTS |

---

## 20. Installed Part Life / Alerts

### 20.1 Current State

MachineInstalledPart tracks: expectedLifeHours, runtimeHours, lifeStatus, installedAt, removedAt.

### 20.2 Gap

No alert threshold infrastructure exists for installed part life percentage monitoring.

### 20.3 Design: Minimal Extension via Existing Infrastructure

The system already has an `AlertsModule` and `NotificationRule` model. The smallest extension:

**Option A: Configuration via SystemSetting (preferred)**

Add configurable thresholds as SystemSetting entries:
```
PART_LIFE_WARNING_THRESHOLD = 70
PART_LIFE_CRITICAL_THRESHOLD = 85
PART_LIFE_REPLACEMENT_THRESHOLD = 95
PART_LIFE_EXPIRED_THRESHOLD = 100
```

The alert check runs as part of a periodic job or on reading update:
```
When MachineInstalledPartReading is created:
  1. Calculate lifePercent = runtimeHours / expectedLifeHours * 100
  2. Compare against SystemSetting thresholds
  3. If threshold exceeded -> create Notification (existing model)
```

**No new model needed.** The existing Notification + SystemSetting infrastructure handles this.

---

## 21. Production Architecture

### 21.1 Current State (FULLY PRESERVED)

All existing production models remain unchanged:
- ProductionProductDefinition, ProductionVersion, ProductionPackaging, ProductionEligibility
- ProductionCapacityStandard (with revision chain)
- ProductionOrder (status workflow)
- ProductionRun, ProductionRunSession, ProductionRunTransition
- ProductionMeasurementPoint (with purpose: INPUT, INTERMEDIATE, FINAL_OUTPUT, WASTE, REWORK)
- ProductionOutputEvent, ProductionLossQuantityEvent
- DowntimeSegment
- ProductionMaterialDocument/Line, ProductionMaterialRequirement/Line, ProductionMaterialConsumption/Correction
- ProductionFinishedGoodsReceipt/Line
- ProductionQualityPlan, QualityCharacteristic, QualitySamplingPoint
- ProductionInspection/Result, ProductionQualityDisposition
- ProductionNonconformance/Transition/Attachment
- OperationalCostRate, OperationalStandardCostSnapshot, OperationalCostTransaction, OperationalCostCalculation
- ProductionPerformanceTarget/Transition

### 21.2 Integration with New Organization/Person Models

Production models integrate through existing FKs:

```
ProductionLine.departmentId -> Department (operational area)
ProductionOrder -> ProductionLine -> Department
ProductionRun -> ProductionLine -> Department
ProductionRun -> Machine -> Department (operational)
ProductionShiftAssignment -> OperationalPerson -> (via OperationalPersonAssignment -> Department)
```

**No changes to existing production models.**

---

## 22. Measurement Points

### 22.1 Current State (CONFIRMED)

ProductionMeasurementPoint already has:

| Purpose Value | Meaning |
|---------------|---------|
| INPUT | Material input to machine/line |
| INTERMEDIATE | Intermediate product between machines |
| FINAL_OUTPUT | Final count at end of line |
| WASTE | Waste measurement |
| REWORK | Rework measurement |

### 22.2 Rule Enforcement

The business rule "sequential machine counts must NOT be summed as line output" is satisfied by:
1. Each ProductionLine has designated measurement points
2. ProductionOutputEvent links to a specific measurementPointId
3. FINAL_OUTPUT purpose determines actual line output
4. Report queries filter by measurement point purpose

**No changes needed.**

---

## 23. Capacity / Expected vs Actual

### 23.1 Current State

ProductionCapacityStandard supports: standardRate, outputUnit, timeBasis, standardCycleTimeMinutes, setupMinutes, changeoverMinutes, cleaningMinutes, targetEfficiencyPercent, expectedYieldPercent, effectiveFrom/effectiveTo, revision, supersedesId.

### 23.2 Current Support for Expected vs Actual

| Dimension | Expected Source | Actual Source |
|-----------|----------------|---------------|
| By product | CapacityStandard.productDefinition | ProductionOutputEvent -> Product |
| By line | CapacityStandard.productionLineId | ProductionRun.productionLineId |
| By machine | CapacityStandard.machineId | ProductionOutputEvent.machineId |
| By shift | CapacityStandard (timeBasis) | ProductionRun -> shiftId |
| By period | effectiveFrom/To range | ProductionOutputEvent.reportedAt |

**All reporting dimensions already exist.** No changes needed.

---

## 24. Loss / Waste Architecture

### 24.1 Current State (PRESERVED)

| Model | Purpose |
|-------|---------|
| OperationalLossReason | Hierarchical reason catalog (lossCategory: DOWNTIME, QUANTITY, QUALITY) |
| DowntimeSegment | Time-based loss with downtimeCategory (ownership) + lossReasonId (reason) |
| ProductionLossQuantityEvent | Quantity-based loss (scrap, rework, defect) |
| ProductionOutputEvent | Good output |

### 24.2 Reason != Responsibility (Already Separated)

| Concept | Field | Example |
|---------|-------|---------|
| Loss Reason | OperationalLossReason.name | "motor failure" |
| Loss Category | OperationalLossReason.lossCategory | DOWNTIME, QUANTITY, QUALITY |
| Responsibility Owner | DowntimeSegment.downtimeCategory | MAINTENANCE, PRODUCTION, QUALITY, etc. |
| Responsible Department | DowntimeSegment.responsibleDepartmentId | ?????? ?????? |

**Already correctly separated. No changes needed.**

---

## 25. Downtime Responsibility

### 25.1 Current State (CONFIRMED)

**DowntimeLog (Maintenance Domain):** Records technical incident (machine stopped, failure category, RCA status). Links to Machine, MaintenanceRequest, ProductionRun, ProductionOrder, ProductionLine, Shift.

**DowntimeSegment (Production Domain):** Records production-impact segment with downtimeCategory (MAINTENANCE, PRODUCTION, QUALITY, PLANNED_STOP, MATERIAL_SHORTAGE, UTILITIES, EXTERNAL, UNKNOWN), lossReasonId, responsibleDepartmentId, and `splitDowntime()` service method.

### 25.2 Design: No Changes Needed

DowntimeLog = technical incident record (WHAT happened)
DowntimeSegment = production-impact attribution (WHO is responsible)

The splitDowntime() method already supports multi-owner attribution.

---

## 26. Cost Architecture

### 26.1 Current State (CONFIRMED)

**OperationalCostTransaction already has:**

| Field | Values | Purpose |
|-------|--------|---------|
| costType | LABOR, MATERIAL, OVERHEAD, OUTSIDE_SERVICE | Nature of cost |
| costDomain | MAINTENANCE, PRODUCTION_OPERATING, CAPITAL_IMPROVEMENT, QUALITY, SHARED | Operational ownership |

**Cost Nature vs Cost Domain: ALREADY SEPARATE.**
**Cost Transaction: Single Source.** One transaction stored once with all dimensions.

**No changes needed.**

---

## 27. Product Multi-Company Scope

### 27.1 Current State

Product is a GLOBAL catalog entity (no companyId/branchId). Accessed through scoped intermediaries: InventoryBalance -> Warehouse -> Company, ProductionProductDefinition (has companyId/branchId), InventoryMovementLine -> InventoryMovement -> Company.

### 27.2 Decision: KEEP_AS_GLOBAL

**Rationale:** The existing intermediary pattern works correctly. A future per-company activation can be added via a lightweight `CompanyProduct` association record IF needed.

**No changes needed now.**

---

## 28. SparePart Multi-Company Scope

### 28.1 Current State

SparePart is a GLOBAL catalog entity (same pattern as Product). Accessed through scoped intermediaries.

### 28.2 Decision: KEEP_AS_GLOBAL

Same reasoning as Product. **No changes needed now.**

---

## 29. Tenant Isolation

### 29.1 Current State (PRESERVED)

All new models must follow the existing pattern:
1. HTTP headers: `x-active-company-id`, `x-active-branch-id`
2. `ActiveContextInterceptor` validates headers against `UserOperationalScope`
3. `tenant-guards.ts` verifies individual rows in service layer
4. Same Prisma transaction client prevents TOCTOU

### 29.2 New Model Tenant Fields

| Model | companyId | branchId | Tenant derivation |
|-------|-----------|----------|-------------------|
| JobTitle | Required | N/A | From active context |
| OperationalPersonAssignment | Required | Optional | From active context |
| SupervisorAssignment | Required | N/A | Via assignment -> company |
| ShiftHandover | Required | Optional | From active context |

### 29.3 Cross-Tenant Reference Prevention

| Model | Cross-tenant risk | Mitigation |
|-------|-------------------|------------|
| JobTitle | Person in Company A assigned Company B's job title | companyId required, FK validates |
| OperationalPersonAssignment | Assignment references wrong company's department | All FKs validated by tenant guards |
| SupervisorAssignment | Supervisor from different company | supervisorPersonId validated: person.companyId must match |
| ShiftHandover | Handover references wrong company's shift | shift FKs validated by tenant guards |

---

## 30. Audit / Attachments / Notifications

### 30.1 New Model Audit Requirements

| Model | createdBy | updatedBy | timestamps | softDelete | status | attachments |
|-------|-----------|-----------|------------|------------|--------|-------------|
| JobTitle | via default | via default | YES | YES | YES | Optional |
| OperationalPersonAssignment | explicit field | via updatedAt | YES | YES | YES | Optional |
| SupervisorAssignment | via default | via default | YES | YES | YES | Optional |
| ShiftHandover | explicit field | via updatedAt | YES | YES | YES | YES (directly on model) |

---

## 31. Permission Design

### 31.1 Current Convention

Permissions follow the pattern: `module:action` (e.g., `maintenance-request:read`)

### 31.2 New Permission Keys

| Domain | Permission Keys |
|--------|----------------|
| Job Titles | `job-title:read`, `job-title:create`, `job-title:update`, `job-title:delete` |
| Person Assignment | `person-assignment:read`, `person-assignment:create`, `person-assignment:update`, `person-assignment:transfer` |
| Supervisor | `supervisor:read`, `supervisor:assign`, `supervisor:remove` |
| Shift Handover | `shift-handover:read`, `shift-handover:create`, `shift-handover:submit`, `shift-handover:acknowledge` |
| Maintenance Coverage | `maintenance-coverage:read`, `maintenance-coverage:assign`, `maintenance-coverage:remove` |
| Department Classification | `department:read`, `department:create`, `department:update`, `department:classify` |

**Total new permission keys: 19**

---

## 32. Exact Existing Model Delta Matrix

| Model | Decision | Exact Change | DB Risk | API Impact | Frontend Impact |
|-------|----------|--------------|---------|------------|----------------|
| Company | KEEP | Add jobTitles[], personAssignments[] relations | LOW | LOW | LOW |
| Branch | KEEP | Add personAssignments[] relation | LOW | LOW | LOW |
| Administration | KEEP | Add personAssignments[] relation | LOW | LOW | LOW |
| Department | KEEP_AND_EXTEND | Add `classification` String field; Add personAssignments[], shiftHandovers[] relations | LOW | LOW | LOW |
| OrganizationalUnit | FREEZE | No new references. Migrate UserOperationalScope to use departmentId. | MEDIUM | LOW | LOW |
| CostCenter | KEEP | No changes | NONE | NONE | NONE |
| ProductionLine | KEEP | No changes | NONE | NONE | NONE |
| Machine | KEEP | No changes (already has dual ownership) | NONE | NONE | NONE |
| MachineComponent | KEEP | No changes | NONE | NONE | NONE |
| OperationalPerson | KEEP_AND_EXTEND | Add `jobTitleId` FK -> JobTitle; Add `supervisorId` self-FK; Add relations: assignments[], supervises[] | MEDIUM | LOW | LOW |
| User | KEEP | No changes | NONE | NONE | NONE |
| UserOperationalScope | KEEP_AND_MODIFY | Deprecate `organizationalUnitId`; use `departmentId` instead | MEDIUM | LOW | LOW |
| MaintenancePersonnel | KEEP_AND_EXTEND | Add `branchId` FK -> Branch | LOW | LOW | LOW |
| MachineResponsibilityAssignment | KEEP_AND_EXTEND | Add `departmentId`, `productionLineId` FKs; Make `machineId` nullable | LOW | LOW | LOW |
| MaintenanceRequest | KEEP | No changes | NONE | NONE | NONE |
| MaintenanceWorkOrder | KEEP | No changes | NONE | NONE | NONE |
| MaintenanceTask | KEEP | No changes | NONE | NONE | NONE |
| MaintenanceSchedule | KEEP | No changes | NONE | NONE | NONE |
| DowntimeLog | KEEP | No changes | NONE | NONE | NONE |
| DowntimeSegment | KEEP | No changes | NONE | NONE | NONE |
| OperationalLossReason | KEEP | No changes | NONE | NONE | NONE |
| SparePart | KEEP | No changes | NONE | NONE | NONE |
| MachineInstalledPart | KEEP | No changes | NONE | NONE | NONE |
| ProductionShift | KEEP_AND_EXTEND | Add `departmentId` FK -> Department | LOW | LOW | LOW |
| ProductionShiftAssignment | KEEP | No changes | NONE | NONE | NONE |
| ProductionOrder | KEEP | No changes | NONE | NONE | NONE |
| ProductionRun | KEEP | No changes | NONE | NONE | NONE |
| ProductionMeasurementPoint | KEEP | No changes | NONE | NONE | NONE |
| ProductionOutputEvent | KEEP | No changes | NONE | NONE | NONE |
| ProductionCapacityStandard | KEEP | No changes | NONE | NONE | NONE |
| OperationalCostTransaction | KEEP | No changes | NONE | NONE | NONE |
| Product | KEEP | No changes | NONE | NONE | NONE |

---

## 33. Proposed New Models Summary

### NEW-1: JobTitle

| Attribute | Detail |
|-----------|--------|
| Purpose | Structured job title (replaces free text on OperationalPerson) |
| Fields | id, companyId, code, name, nameAr?, nameEn?, category, description?, isActive, status, timestamps, deletedAt |
| Relations | company -> Company; operationalPersons -> OperationalPerson[]; assignments -> OperationalPersonAssignment[] |
| Unique | [companyId, code] |
| Tenant | companyId required |
| API needed | GET/POST/PATCH/DELETE /v1/admin/job-titles |
| Frontend needed | /admin/core/job-titles (list + CRUD) |

### NEW-2: OperationalPersonAssignment

| Attribute | Detail |
|-----------|--------|
| Purpose | Historical organizational placement per person |
| Fields | id, companyId, branchId?, administrationId?, departmentId, jobTitleId?, personnelId, assignmentType, effectiveFrom, effectiveTo?, isPrimary, status, notes?, createdBy?, timestamps, deletedAt |
| Relations | company, branch?, administration?, department, jobTitle?, person (OperationalPerson), supervisorAssignments[] |
| Unique | [personnelId, departmentId, effectiveFrom] |
| Tenant | companyId required, branchId optional |
| API needed | GET/POST/PATCH /v1/admin/person-assignments; POST /v1/admin/person-assignments/transfer |
| Frontend needed | /admin/core/persons/[id]/assignments (assignment history page) |

### NEW-3: SupervisorAssignment

| Attribute | Detail |
|-----------|--------|
| Purpose | Hierarchical reporting relationships |
| Fields | id, companyId, assignmentId, supervisorAssignmentId?, supervisorPersonId?, relationshipType, effectiveFrom, effectiveTo?, isActive, status, timestamps, deletedAt |
| Relations | company, assignment (subordinate), supervisorAssignment?, supervisorPerson? |
| Tenant | companyId required (via assignment) |
| API needed | GET/POST/DELETE /v1/admin/supervisor-assignments; GET /v1/admin/persons/[id]/reporting-line |
| Frontend needed | /admin/core/persons/[id]/reporting (org tree view) |

### NEW-4: ShiftHandover

| Attribute | Detail |
|-----------|--------|
| Purpose | Structured shift-to-shift handover record |
| Fields | id, companyId, branchId?, departmentId?, handoverDate, outgoingShiftId, incomingShiftId, outgoingPersonId?, incomingPersonId?, productionStatus?, openMaintenanceRequests?, stoppedMachines?, pendingMaintenance?, qualityObservations?, safetyObservations?, materialShortages?, notes?, status, submittedAt?, acknowledgedAt?, createdBy?, timestamps, deletedAt |
| Relations | company, department?, outgoingShift (ProductionShift), incomingShift (ProductionShift), outgoingPerson (OperationalPerson), incomingPerson (OperationalPerson), attachments (Attachment[]) |
| Tenant | companyId required |
| Lifecycle | DRAFT -> SUBMITTED -> ACKNOWLEDGED |
| API needed | GET/POST/PATCH /v1/shift-handovers; POST submit; POST acknowledge |
| Frontend needed | /admin/production/shift-handovers (list + detail + submit flow) |

---

## 34. Rejected New Models

| Proposed Model | Reason for Rejection | Current Entity That Handles It |
|---------------|---------------------|-------------------------------|
| Employee | OperationalPerson is sufficient as canonical person record | OperationalPerson |
| ProductionArea | Department recursion + classification field covers this | Department (classification: AREA) |
| ProcessSection | Department recursion + classification field covers this | Department (classification: PROCESS / SECTION) |
| MaintenanceShift | ProductionShift is already tenant-scoped and used in maintenance downtime | ProductionShift |
| CompanyProduct | Product global catalog works through scoped intermediaries | InventoryBalance, ProductionProductDefinition |
| CompanySparePart | SparePart global catalog works through scoped intermediaries | MachineSparePart, SparePartConditionBalance |
| MaintenanceWindow | MaintenanceSchedule + WorkOrder + DowntimeSegment (PLANNED_STOP) covers this | Existing models |

---

## 35. Complete Pseudo-Prisma Target Design

```prisma
// ============================================================
// NEW MODEL: JobTitle
// ============================================================
model JobTitle {
  id          String    @id @default(cuid())
  companyId   String
  code        String
  name        String
  nameAr      String?
  nameEn      String?
  category    String    @default("OPERATIONAL")
  description String?
  isActive    Boolean   @default(true)
  status      String    @default("ACTIVE")
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
  deletedAt   DateTime?

  company           Company                  @relation(fields: [companyId])
  operationalPersons OperationalPerson[]
  assignments       OperationalPersonAssignment[]

  @@unique([companyId, code])
  @@index([companyId])
  @@index([status])
}

// ============================================================
// NEW MODEL: OperationalPersonAssignment
// ============================================================
model OperationalPersonAssignment {
  id                String    @id @default(cuid())
  companyId         String
  branchId          String?
  administrationId  String?
  departmentId      String
  jobTitleId        String?
  personnelId       String
  assignmentType    String    @default("PRIMARY")
  effectiveFrom     DateTime
  effectiveTo       DateTime?
  isPrimary         Boolean   @default(true)
  status            String    @default("ACTIVE")
  notes             String?
  createdBy         String?
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt
  deletedAt         DateTime?

  company              Company                      @relation(fields: [companyId])
  branch               Branch?                      @relation(fields: [branchId])
  administration       Administration?              @relation(fields: [administrationId])
  department           Department                   @relation(fields: [departmentId])
  jobTitle             JobTitle?                    @relation(fields: [jobTitleId])
  person               OperationalPerson            @relation(fields: [personnelId])
  supervisorAssignments SupervisorAssignment[]

  @@unique([personnelId, departmentId, effectiveFrom])
  @@index([companyId])
  @@index([branchId])
  @@index([departmentId])
  @@index([personnelId])
  @@index([status])
}

// ============================================================
// NEW MODEL: SupervisorAssignment
// ============================================================
model SupervisorAssignment {
  id                      String    @id @default(cuid())
  companyId               String
  assignmentId            String
  supervisorAssignmentId  String?
  supervisorPersonId      String?
  relationshipType        String    @default("DIRECT")
  effectiveFrom           DateTime
  effectiveTo             DateTime?
  isActive                Boolean   @default(true)
  status                  String    @default("ACTIVE")
  createdAt               DateTime  @default(now())
  updatedAt               DateTime  @updatedAt
  deletedAt               DateTime?

  company              Company                          @relation(fields: [companyId])
  assignment           OperationalPersonAssignment       @relation(fields: [assignmentId])
  supervisorAssignment OperationalPersonAssignment?      @relation("SupervisorOf", fields: [supervisorAssignmentId])
  supervisorPerson     OperationalPerson?                @relation("SupervisesPerson", fields: [supervisorPersonId])

  @@index([companyId])
  @@index([assignmentId])
  @@index([supervisorPersonId])
  @@index([supervisorAssignmentId])
  @@index([status])
}

// ============================================================
// NEW MODEL: ShiftHandover
// ============================================================
model ShiftHandover {
  id                      String    @id @default(cuid())
  companyId               String
  branchId                String?
  departmentId            String?
  handoverDate            DateTime
  outgoingShiftId         String
  incomingShiftId         String
  outgoingPersonId        String?
  incomingPersonId        String?
  productionStatus        String?
  activeProductionOrders  Int?
  openMaintenanceRequests Int?
  stoppedMachines         Int?
  pendingMaintenance      Int?
  qualityObservations     String?
  safetyObservations      String?
  materialShortages       String?
  notes                   String?
  status                  String    @default("DRAFT")
  submittedAt             DateTime?
  acknowledgedAt          DateTime?
  createdBy               String?
  createdAt               DateTime  @default(now())
  updatedAt               DateTime  @updatedAt
  deletedAt               DateTime?

  company        Company           @relation(fields: [companyId])
  department     Department?       @relation(fields: [departmentId])
  outgoingShift  ProductionShift   @relation("OutgoingShift", fields: [outgoingShiftId])
  incomingShift  ProductionShift   @relation("IncomingShift", fields: [incomingShiftId])
  outgoingPerson OperationalPerson? @relation("OutgoingPerson", fields: [outgoingPersonId])
  incomingPerson OperationalPerson? @relation("IncomingPerson", fields: [incomingPersonId])
  attachments    Attachment[]

  @@index([companyId])
  @@index([branchId])
  @@index([departmentId])
  @@index([handoverDate])
  @@index([outgoingShiftId])
  @@index([incomingShiftId])
  @@index([status])
}

// ============================================================
// SCHEMA MODIFICATIONS TO EXISTING MODELS
// ============================================================

// --- Department: add classification field + new relations ---
// model Department {
//   ... existing fields ...
//   classification String? @default("OPERATIONAL")
//   ... existing relations ...
//   personAssignments OperationalPersonAssignment[]
//   shiftHandovers    ShiftHandover[]
// }

// --- OperationalPerson: add jobTitleId, supervisorId + new relations ---
// model OperationalPerson {
//   ... existing fields ...
//   jobTitleId String?  // FK -> JobTitle
//   supervisorId String? // FK -> self (direct supervisor person)
//   ... existing relations ...
//   jobTitle        JobTitle?                  @relation(fields: [jobTitleId])
//   supervisor      OperationalPerson?         @relation("SupervisedBy", fields: [supervisorId])
//   supervisees     OperationalPerson[]        @relation("SupervisedBy")
//   assignments     OperationalPersonAssignment[]
//   supervises      SupervisorAssignment[]     @relation("SupervisesPerson")
//   outgoingHandovers ShiftHandover[]          @relation("OutgoingPerson")
//   incomingHandovers ShiftHandover[]          @relation("IncomingPerson")
// }

// --- MaintenancePersonnel: add branchId ---
// model MaintenancePersonnel {
//   ... existing fields ...
//   branchId String?  // FK -> Branch
//   branch   Branch?  @relation(fields: [branchId])
//   @@index([branchId])
// }

// --- MachineResponsibilityAssignment: extend scope ---
// model MachineResponsibilityAssignment {
//   ... existing fields ...
//   departmentId     String?  // FK -> Department (area-level coverage)
//   productionLineId String?  // FK -> ProductionLine (line-level coverage)
//   // machineId becomes nullable (was required)
//   department     Department?     @relation(fields: [departmentId])
//   productionLine ProductionLine? @relation(fields: [productionLineId])
//   @@index([departmentId])
//   @@index([productionLineId])
// }

// --- ProductionShift: add departmentId ---
// model ProductionShift {
//   ... existing fields ...
//   departmentId String?  // FK -> Department (area assignment)
//   department   Department? @relation(fields: [departmentId])
//   outgoingHandovers ShiftHandover[] @relation("OutgoingShift")
//   incomingHandovers ShiftHandover[] @relation("IncomingShift")
//   @@index([departmentId])
// }

// --- Company: add new relations ---
// model Company {
//   ... existing relations ...
//   jobTitles             JobTitle[]
//   personAssignments     OperationalPersonAssignment[]
//   supervisorAssignments SupervisorAssignment[]
//   shiftHandovers        ShiftHandover[]
// }

// --- Branch: add new relations ---
// model Branch {
//   ... existing relations ...
//   personAssignments    OperationalPersonAssignment[]
//   maintenancePersonnel MaintenancePersonnel[]
//   shiftHandovers       ShiftHandover[]
// }

// --- Administration: add new relations ---
// model Administration {
//   ... existing relations ...
//   personAssignments OperationalPersonAssignment[]
// }
```

---

## 36. Relationship Diagrams

### 36.1 Organization + Person

```
Company --> Branch
Company --> Department
Company --> CostCenter
Company --> JobTitle
Branch --> Administration
Branch --> Department
Administration --> Department
Department -->|parentId| Department
CostCenter -->|parentId| CostCenter

OperationalPerson -->|userId| User
OperationalPerson -->|jobTitleId| JobTitle
OperationalPerson -.->|supervisorId| OperationalPerson

OperationalPersonAssignment -->|personnelId| OperationalPerson
OperationalPersonAssignment -->|departmentId| Department
OperationalPersonAssignment -->|branchId| Branch
OperationalPersonAssignment -->|administrationId| Administration
OperationalPersonAssignment -->|jobTitleId| JobTitle

SupervisorAssignment -->|assignmentId| OperationalPersonAssignment
SupervisorAssignment -.->|supervisorAssignmentId| OperationalPersonAssignment
SupervisorAssignment -.->|supervisorPersonId| OperationalPerson
```

### 36.2 Factory Operations

```
Department (classification: AREA) --> Department (classification: PROCESS) --> Department (classification: SECTION) --> ProductionLine --> Machine --> MachineComponent
MachineComponent -.->|parentComponentId| MachineComponent
Machine -->|departmentId| Dept: Operational
Machine -->|technicalDepartmentId| Dept: Technical
Machine -->|technicalAdministrationId| TechAdmin: Administration
ProductionLine -->|departmentId| Department
ProductionLine -->|costCenterId| CostCenter
```

### 36.3 Maintenance Responsibility

```
OperationalPerson -->|personnelId| MaintenancePersonnel
MachineResponsibilityAssignment -->|operationalPersonId| OperationalPerson
MachineResponsibilityAssignment -->|machineId| Machine
MachineResponsibilityAssignment -.->|departmentId| Department
MachineResponsibilityAssignment -.->|productionLineId| ProductionLine

MaintenanceRequest --> Machine
MaintenanceRequestAssignment -->|operationalPersonId| OperationalPerson

Machine --> MachineSparePart --> SparePart
MachineInstalledPart --> Machine
MachineInstalledPart --> SparePart
```

### 36.4 Production Flow

```
Product --> ProductionProductDefinition --> ProductionOrder --> ProductionRun --> ProductionRunSession
ProductionRun --> ProductionOutputEvent --> ProductionMeasurementPoint
ProductionRun --> ProductionLossQuantityEvent
ProductionRun --> DowntimeSegment --> OperationalLossReason
ProductionRun --> ProductionMaterialDocument --> InventoryMovement
ProductionRun --> ProductionFinishedGoodsReceipt --> InventoryMovement
ProductionRun --> ProductionInspection --> ProductionNonconformance
```

### 36.5 Cost Flow

```
OperationalCostRate -->|rateId| OperationalCostTransaction
OperationalCostTransaction --> CostCenter, Machine, ProductionLine, ProductionOrder, ProductionRun, MaintenanceWorkOrder, MaintenanceRequest, OperationalPerson, ProductionShift
OperationalCostTransaction --> OperationalCostCalculation
OperationalStandardCostSnapshot --> ProductionOrder
```

### 36.6 Shift Handover

```
ShiftHandover -->|outgoingShiftId| ProductionShift
ShiftHandover -->|incomingShiftId| ProductionShift
ShiftHandover -.->|outgoingPersonId| OperationalPerson
ShiftHandover -.->|incomingPersonId| OperationalPerson
ShiftHandover -.->|departmentId| Department
ShiftHandover --> Attachment
```

---

## 37. Safe Migration Sequence

### Phase 1: Additive Schema Changes (NO data impact)

All new fields are nullable or have defaults. No existing data is affected.

```
1.1  Create JobTitle table
1.2  Create OperationalPersonAssignment table
1.3  Create SupervisorAssignment table
1.4  Create ShiftHandover table
1.5  Add classification field to Department (nullable, default 'OPERATIONAL')
1.6  Add jobTitleId field to OperationalPerson (nullable)
1.7  Add supervisorId field to OperationalPerson (nullable)
1.8  Add branchId field to MaintenancePersonnel (nullable)
1.9  Add departmentId, productionLineId fields to MachineResponsibilityAssignment (nullable)
1.10 Make MachineResponsibilityAssignment.machineId nullable
1.11 Add departmentId field to ProductionShift (nullable)
1.12 Add new relations to Company, Branch, Administration, Department
```

**Risk: LOW.** All additions are nullable. No existing queries break.

### Phase 2: Backend API Development

```
2.1  JobTitle CRUD module
2.2  OperationalPersonAssignment CRUD + transfer logic
2.3  SupervisorAssignment CRUD + reporting line query
2.4  ShiftHandover CRUD + submit/acknowledge workflow
2.5  MachineResponsibilityAssignment scope extension (department/line queries)
2.6  Permission keys creation + seeding
2.7  Audit logging for all new modules
2.8  Tenant guards for all new modules
```

**Risk: MEDIUM.** New modules, no impact on existing modules.

### Phase 3: Data Backfill (with validation)

```
3.1  Migrate OperationalPerson.jobTitle (free text) -> JobTitle records
     - Group by unique job title strings
     - Create JobTitle records per company
     - Update OperationalPerson.jobTitleId
     - MANUALLY VERIFY job title mappings

3.2  Create initial OperationalPersonAssignment records
     - For each OperationalPerson with a User that has departmentId:
       Create assignment: person -> department -> current (effectiveTo = null)
     - AUTO_BACKFILL_SAFE (derivable from existing data)

3.3  Verify MachineResponsibilityAssignment department/line scope
     - For existing records with machineId:
       Derive departmentId from Machine.departmentId
       Derive productionLineId from Machine.productionLineId
     - AUTO_BACKFILL_SAFE
```

**Risk: MEDIUM.** Requires careful validation of migrated data.

### Phase 4: Compatibility Period

```
4.1  Both old (free text jobTitle) and new (jobTitleId) coexist
4.2  Both old (no assignment history) and new (assignment records) coexist
4.3  Frontend shows new fields where available
4.4  Old fields remain readable but new records use new fields
```

### Phase 5: Constraint Addition

```
5.1  After backfill validation:
     - Make OperationalPerson.jobTitleId non-nullable (if all persons have titles)
     - Add NOT NULL on departmentId where required
     - Validate all assignments have valid department references
```

### Phase 6: Deprecation

```
6.1  Deprecate OrganizationalUnit CRUD pages
6.2  Migrate UserOperationalScope.organizationalUnitId -> departmentId
6.3  Eventually freeze OrganizationalUnit (keep data, stop new writes)
```

---

## 38. Backfill Strategy

| Data | Strategy | Risk |
|------|----------|------|
| JobTitle records from free text | AUTO_BACKFILL_SAFE -- group unique jobTitle strings, create records | LOW |
| OperationalPerson.jobTitleId | BACKFILL_WITH_VALIDATION -- set FK after JobTitle records created | LOW |
| OperationalPersonAssignment (initial) | AUTO_BACKFILL_SAFE -- derive from User.departmentId + OperationalPerson | LOW |
| MachineResponsibilityAssignment department/line | AUTO_BACKFILL_SAFE -- derive from Machine.departmentId/productionLineId | LOW |
| MaintenancePersonnel.branchId | AUTO_BACKFILL_SAFE -- derive from OperationalPerson.branchId | LOW |
| ProductionShift.departmentId | NO_BACKFILL -- leave null for existing shifts | NONE |
| Supervisor hierarchy | MANUAL_MAPPING_REQUIRED -- requires real organizational knowledge | HIGH |
| OrganizationalUnit -> Department migration | MANUAL_MAPPING_REQUIRED -- requires business decision on mapping | HIGH |

---

## 39. Frontend Routes

### New Routes Needed

| Route | Module | Priority |
|-------|--------|----------|
| /admin/core/job-titles | Job Title CRUD | HIGH |
| /admin/core/job-titles/new | Job Title create | HIGH |
| /admin/core/job-titles/[id] | Job Title detail/edit | HIGH |
| /admin/core/persons/[id]/assignments | Person assignment history | HIGH |
| /admin/core/persons/[id]/reporting | Person reporting line (org tree) | MEDIUM |
| /admin/core/supervisor-assignments | Supervisor assignment management | MEDIUM |
| /admin/production/shift-handovers | Shift handover list | HIGH |
| /admin/production/shift-handovers/new | Shift handover create | HIGH |
| /admin/production/shift-handovers/[id] | Shift handover detail | HIGH |
| /admin/production/shift-handovers/[id]/submit | Shift handover submit | HIGH |
| /admin/production/shift-handovers/[id]/acknowledge | Shift handover acknowledge | MEDIUM |
| /admin/maintenance/coverage-assignments | Maintenance coverage (extended) | HIGH |

### Modified Routes

| Route | Change |
|-------|--------|
| /admin/core/persons/[id] | Add assignments tab, reporting tab |
| /admin/core/departments | Show classification badge |
| /admin/maintenance/machines/[id] | Show area/line coverage |
| /admin/production/shifts/[id] | Show area assignment |

---

## 40. API Endpoints

### New Endpoints

| Method | Path | Module | Description |
|--------|------|--------|-------------|
| GET | /v1/admin/job-titles | JobTitle | List job titles (paginated) |
| POST | /v1/admin/job-titles | JobTitle | Create job title |
| GET | /v1/admin/job-titles/:id | JobTitle | Get job title by ID |
| PATCH | /v1/admin/job-titles/:id | JobTitle | Update job title |
| DELETE | /v1/admin/job-titles/:id | JobTitle | Soft delete job title |
| GET | /v1/admin/person-assignments | Assignment | List assignments (filtered) |
| POST | /v1/admin/person-assignments | Assignment | Create assignment |
| PATCH | /v1/admin/person-assignments/:id | Assignment | Update assignment |
| POST | /v1/admin/person-assignments/transfer | Assignment | Transfer person (close current + create new) |
| GET | /v1/admin/persons/:id/assignments | Assignment | Get assignment history for person |
| GET | /v1/admin/supervisor-assignments | Supervisor | List supervisor assignments |
| POST | /v1/admin/supervisor-assignments | Supervisor | Create supervisor assignment |
| DELETE | /v1/admin/supervisor-assignments/:id | Supervisor | Remove supervisor assignment |
| GET | /v1/admin/persons/:id/reporting-line | Supervisor | Get full reporting line for person |
| GET | /v1/shift-handovers | ShiftHandover | List handovers (filtered) |
| POST | /v1/shift-handovers | ShiftHandover | Create handover draft |
| GET | /v1/shift-handovers/:id | ShiftHandover | Get handover detail |
| PATCH | /v1/shift-handovers/:id | ShiftHandover | Update handover draft |
| POST | /v1/shift-handovers/:id/submit | ShiftHandover | Submit handover |
| POST | /v1/shift-handovers/:id/acknowledge | ShiftHandover | Acknowledge handover |
| GET | /v1/maintenance/coverage-assignments | Coverage | List coverage assignments (extended) |
| POST | /v1/maintenance/coverage-assignments | Coverage | Create coverage assignment (dept/line/machine) |

---

## 41. Validation Summary

| Aspect | Status | Notes |
|--------|--------|-------|
| Baseline verified | PASS | Branch, commit, working tree confirmed |
| Current architecture investigated | PASS | All 145 models reviewed |
| All 5 design questions answered | PASS | See Sections 4-28 |
| Tenant isolation defined for new models | PASS | See Section 29 |
| Migration strategy safe | PASS | Additive-only Phase 1, then validate |
| No existing working system replaced | PASS | All existing models preserved |
| Only report file modified | PASS | No source code changed |
| Design is minimal and justified | PASS | 4 new models, 5 extensions, 7 rejections |

---

## 42. Final Scope Summary

| Category | Count | Detail |
|----------|-------|--------|
| New models | 4 | JobTitle, OperationalPersonAssignment, SupervisorAssignment, ShiftHandover |
| Extended models | 6 | Department, OperationalPerson, MaintenancePersonnel, MachineResponsibilityAssignment, ProductionShift, UserOperationalScope |
| Frozen models | 1 | OrganizationalUnit |
| Rejected models | 7 | Employee, ProductionArea, ProcessSection, MaintenanceShift, CompanyProduct, CompanySparePart, MaintenanceWindow |
| New API endpoints | 22 | See Section 40 |
| New frontend routes | 12 | See Section 39 |
| New permission keys | 19 | See Section 31 |
| Migration phases | 6 | See Section 37 |

---

*Report generated: 2026-08-18*
*Branch: checkpoint/backend-lan-responsive-shell*
*Commit: 0e9c925c887777f830a5a0611660770b9a2abdd7*
*Status: DESIGN ONLY -- no implementation performed*
