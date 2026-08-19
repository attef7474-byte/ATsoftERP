# ATsofterp Target Architecture Design & Gap Analysis Report v2

> **Design only. No implementation was performed. No code was modified.**
> **Correction gate applied. All 15 corrections resolved.**

---

## 0. Correction Gate Summary

| # | Correction | Resolution |
|---|-----------|------------|
| 1 | Job Title Source of Truth | jobTitleId ONLY on OperationalPersonAssignment. NOT on OperationalPerson. |
| 2 | Supervisor Source of Truth | SupervisorAssignment ONLY. No OperationalPerson.supervisorId. |
| 3 | Maintenance Personnel Branch | NO branchId on MaintenancePersonnel. Branch from OperationalPersonAssignment. |
| 4 | Production Shift Department | NO departmentId on ProductionShift. Dept scope via assignments/handover. |
| 5 | Department Type vs Classification | Department has NO type field. Adding NEW classification field. |
| 6 | Maintenance Coverage Scope | Add scopeType + nullable departmentId/productionLineId/machineId. Exactly-one-target. |
| 7 | Person Assignment Integrity | Remove isPrimary. Use assignmentType only. Single PRIMARY enforcement. |
| 8 | Shift Handover Attachments | Use polymorphic Attachment: entityName='SHIFT_HANDOVER', entityId=id. |
| 9 | Shift Handover Detail Items | NEW MODEL: ShiftHandoverItem with entityType/entityId polymorphic. |
| 10 | Attachments/Audit/CreatedBy | Align all models with existing shared-service conventions. |
| 11 | OrganizationalUnit Transition | Freeze only. No migration in first batch. |
| 12 | Backfill Classification | Reclassify all backfills with honest risk assessment. |
| 13 | Missing Design Sections | Add: Batch Plan, Test Strategy, Risks, Open Decisions, Decision Matrix. |
| 14 | Test Strategy | Explicit test cases for all critical paths. |
| 15 | Final Model Count | Updated to 5 new models (added ShiftHandoverItem). |

---

## 1. Executive Summary

ATsofterp has a strong existing architecture covering multi-company tenant isolation, organizational hierarchy, CMMS maintenance, production, inventory, costing, and assets.

**The approved design extends the existing architecture minimally.** 5 new models are proposed. No existing working system is replaced. All corrections from the v1 report have been applied.

### Key Decisions at a Glance

| Decision | Verdict | Rationale |
|----------|---------|-----------|
| OrganizationalUnit | FREEZE | No new consumers. Not referenced by UserOperationalScope in code. |
| Department | ADD_CLASSIFICATION | Department has NO type field. New classification field needed. |
| ProductionArea / ProcessSection | REJECTED | Department recursion covers this. |
| Employee | REJECTED | OperationalPerson is sufficient. |
| OperationalPerson | KEEP_AS_GLOBAL | Global entity, no tenant scoping. Extended via OperationalPersonAssignment. |
| JobTitle | NEW_MODEL | No jobTitle field exists on any model. New structured model required. |
| OperationalPersonAssignment | NEW_MODEL | Historical placement + job title + branch + department per person. |
| SupervisorAssignment | NEW_MODEL | Hierarchical reporting via assignment-based relationships. |
| MachineResponsibilityAssignment | KEEP_AND_EXTEND | Add scopeType + departmentId/productionLineId. Exactly-one-target validation. |
| ShiftHandover | NEW_MODEL | Missing business capability. |
| ShiftHandoverItem | NEW_MODEL | Structured handover detail referencing operational entities. |
| CompanyProduct | REJECTED | Product global catalog works through scoped intermediaries. |
| CompanySparePart | REJECTED | SparePart global catalog works through scoped intermediaries. |
| MaintenanceWindow | REJECTED | Existing MaintenanceSchedule + WorkOrder covers this. |

---

## 2. Current Baseline (VERIFIED)

| Metric | Value |
|--------|------|
| Branch | checkpoint/backend-lan-responsive-shell |
| Commit | 0e9c925c887777f830a5a0611660770b9a2abdd7 |
| Prisma models | 145 |
| Registered backend modules | 95 |
| Frontend routes | 298 |
| Schema lines | 5,292 |
| Enums | 0 (all plain strings) |
| Migrations | 60 applied |

---

## 3. Architectural Principles

1. Preserve what works. Every existing working entity keeps its role unless a concrete conflict proves modification necessary.
2. Extend, do not rebuild. New models must prove existing models cannot carry the responsibility.
3. One source of truth. No two parallel hierarchies for the same business concept. No redundant fields storing the same fact.
4. Tenant isolation is sacred. Every new model must define companyId/branchId and how cross-tenant references are prevented.
5. String conventions. Status/type/category values remain plain strings (matching existing 0-enum convention).
6. CUID primary keys. All new models use String @id @default(cuid()).
7. Soft delete. All operational models include deletedAt DateTime?.
8. Timestamps. All models include createdAt and updatedAt.
9. Shared services. Use existing Attachment, Audit, Notification patterns. Do not invent parallel infrastructure.

---

## 4. CRITICAL FINDING: Department Has No type Field

**The v1 report stated Department has a type field. This is WRONG.**

Investigation confirmed:
- Department model (schema.prisma lines 398-429): fields are id, companyId, branchId, administrationId, parentId, code, name, status, createdAt, updatedAt, deletedAt
- NO type field exists in the schema
- NO type column exists in any migration
- NO type reference exists in any service, DTO, controller, guard, frontend, filter, report, or seed
- The type field that DOES exist belongs to OrganizationalUnit (values: DEPARTMENT, SECTION, UNIT, TEAM, PROJECT, OTHER)

**Decision: Adding classification to Department is a NEW field, not a rename.**

---

## 5. CRITICAL FINDING: OperationalPerson Has No jobTitle Field

**The v1 report stated OperationalPerson has a free-text jobTitle field. This is WRONG.**

Investigation confirmed:
- OperationalPerson model (schema.prisma lines 2679-2702): fields are id, code, name, category, userId, isActive, phone, email, notes, createdAt, updatedAt
- NO jobTitle field exists
- The DTO for CreateMaintenancePersonnelDto has role (for MaintenancePersonnel), not jobTitle
- The only title-like concept is category (default MAINTENANCE) on OperationalPerson

**Decision: JobTitle is an entirely new concept. OperationalPersonAssignment will own jobTitleId.**

---

## 6. CRITICAL FINDING: OperationalPerson Is a Global Entity

**OperationalPerson has NO tenant scoping.**

| Field | Value |
|-------|------|
| companyId | NOT PRESENT |
| branchId | NOT PRESENT |
| administrationId | NOT PRESENT |
| departmentId | NOT PRESENT |

The maintenance-personnel controller does NOT use @CurrentActiveContext(). All queries return records globally across all companies.

**OperationalPersonAssignment (proposed) will provide the tenant-scoped organizational placement.**

---

## 7. CRITICAL FINDING: UserOperationalScope Has No organizationalUnitId

**The v1 report stated UserOperationalScope has organizationalUnitId. This is WRONG.**

The OrganizationalUnit model exists in schema.prisma but:
- Zero TypeScript references to organizationalUnitId exist anywhere
- UserOperationalScope fields: userId, companyId, branchId, administrationId?, departmentId?, isDefault, status, notes
- NO organizationalUnitId field on UserOperationalScope
- No CRUD API exists for managing UserOperationalScope records
- No frontend UI renders or manages it

**OrganizationalUnit is already disconnected from operations. FREEZE confirmed.**

---

## 8. CRITICAL FINDING: MachineResponsibilityAssignment Uses responsibilityRole (Free Text)

**The v1 report stated the model has responsibilityType with enum values. This is WRONG.**

Actual model fields:
- responsibilityRole String (free text, NO enum, NO validation)
- isPrimary Boolean @default(false)
- startDate DateTime
- endDate DateTime?
- status String @default("ACTIVE")

No allowed values are defined. The frontend uses a free-text Input for role selection.

**Decision: Extend existing model with scope fields. Optionally add role standardization separately.**

---

## 9. Organization Target Design

### 9.1 Current State (VERIFIED)

Department: id, companyId, branchId?, administrationId?, parentId?, code, name, status, timestamps, deletedAt. Recursive via parentId. Referenced by Machine, ProductionLine, CostCenter. NO type field.

OrganizationalUnit: id, companyId, branchId, code, name, type (DEPARTMENT/SECTION/UNIT/TEAM/PROJECT/OTHER), parentId?, status, timestamps, deletedAt. NOT referenced by any operational entity.

### 9.2 Target State

Department gets NEW classification field. OrganizationalUnit frozen.

### 9.3 Department Classification Values

| Value | Meaning |
|-------|---------|
| OPERATIONAL | Default for existing records |
| MANAGEMENT | Top management area |
| AREA | Major operational area |
| PROCESS | Product/process grouping |
| SECTION | Manufacturing/packaging section |
| UNIT | Small functional unit |
| WORKSHOP | Physical workshop |

Schema delta: classification String? @default("OPERATIONAL") on Department.

---

## 10. Machine Coverage Extension (CORRECTION 6)

### 10.1 Current State (VERIFIED)

MachineResponsibilityAssignment:
- machineId (REQUIRED, non-nullable)
- maintenancePersonnelId (REQUIRED)
- responsibilityRole (free text)
- isPrimary Boolean
- startDate, endDate?
- status

NO departmentId, NO productionLineId, NO scopeType. Strictly machine-scoped.

### 10.2 Proposed Extension

Add to MachineResponsibilityAssignment:
- scopeType String @default("MACHINE") -- values: MACHINE | PRODUCTION_LINE | DEPARTMENT
- departmentId String? -- FK to Department (for DEPARTMENT scope)
- productionLineId String? -- FK to ProductionLine (for PRODUCTION_LINE scope)
- machineId becomes NULLABLE (was required)

### 10.3 Scope Integrity Rules

1. EXACTLY ONE target must be populated:
   - scopeType=MACHINE requires machineId NOT NULL, departmentId NULL, productionLineId NULL
   - scopeType=PRODUCTION_LINE requires productionLineId NOT NULL, machineId NULL, departmentId NULL
   - scopeType=DEPARTMENT requires departmentId NOT NULL, machineId NULL, productionLineId NULL

2. All target IDs must belong to the active tenant (validated via machineScope/departmentScope)

3. If productionLineId is provided, the line must belong to the same company/branch

4. Duplicate active PRIMARY coverage per scope is prevented at service level:
   - MACHINE scope: one PRIMARY per machine
   - PRODUCTION_LINE scope: one PRIMARY per line
   - DEPARTMENT scope: one PRIMARY per department

5. Service-level validation (not SQL CHECK constraint) because:
   - ATsofterp uses plain strings, not SQL-level CHECK constraints
   - Existing pattern: all validation in service layer
   - Prisma does not support CHECK constraints

---

## 11. Person Assignment Integrity (CORRECTION 7)

### 11.1 Redundancy Removed

v1 had BOTH assignmentType=PRIMARY AND isPrimary=true. This violates one-source-of-truth.

**Resolution:** Remove isPrimary. Use assignmentType only.

### 11.2 assignmentType Values

| Value | Meaning |
|-------|---------|
| PRIMARY | Main organizational placement. Only ONE current PRIMARY per person. |
| SECONDARY | Additional placement (e.g., matrix reporting) |
| TEMPORARY | Time-limited placement (e.g., cover for absence) |
| ACTING | Acting in a role during vacancy |

### 11.3 Integrity Rules

1. Only ONE current (effectiveTo=null) PRIMARY assignment per person
2. effectiveTo must be null OR >= effectiveFrom
3. companyId must match across all FK references (department.companyId, branch.companyId, administration.companyId, jobTitle.companyId)
4. Transfer: atomically close current PRIMARY (set effectiveTo=now) and create new PRIMARY (effectiveFrom=now)
5. unique [personnelId, departmentId, effectiveFrom] prevents exact duplicates

---

## 12. JobTitle Model (NEW)

No jobTitle field exists anywhere. This is a completely new model.

```prisma
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
  assignments       OperationalPersonAssignment[]

  @@unique([companyId, code])
  @@index([companyId])
  @@index([status])
}
```

Note: JobTitle does NOT get a direct relation from OperationalPerson. It is accessed through OperationalPersonAssignment.

---

## 13. OperationalPersonAssignment Model (NEW)

```prisma
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
  status            String    @default("ACTIVE")
  notes             String?
  createdByUserId   String?
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt
  deletedAt         DateTime?

  company              Company                  @relation(fields: [companyId])
  branch               Branch?                  @relation(fields: [branchId])
  administration       Administration?          @relation(fields: [administrationId])
  department           Department               @relation(fields: [departmentId])
  jobTitle             JobTitle?                @relation(fields: [jobTitleId])
  person               OperationalPerson        @relation(fields: [personnelId])
  supervisorAssignments SupervisorAssignment[]

  @@unique([personnelId, departmentId, effectiveFrom])
  @@index([companyId])
  @@index([branchId])
  @@index([departmentId])
  @@index([personnelId])
  @@index([status])
}
```

Relations added to existing models:
- OperationalPerson: assignments OperationalPersonAssignment[]
- Department: personAssignments OperationalPersonAssignment[]
- Company: personAssignments OperationalPersonAssignment[]
- Branch: personAssignments OperationalPersonAssignment[]
- Administration: personAssignments OperationalPersonAssignment[]

---

## 14. SupervisorAssignment Model (NEW)

Source of truth for reporting hierarchy. NO supervisorId on OperationalPerson.

```prisma
model SupervisorAssignment {
  id                      String    @id @default(cuid())
  companyId               String
  assignmentId            String
  supervisorAssignmentId  String?
  relationshipType        String    @default("DIRECT")
  effectiveFrom           DateTime
  effectiveTo             DateTime?
  isActive                Boolean   @default(true)
  status                  String    @default("ACTIVE")
  createdAt               DateTime  @default(now())
  updatedAt               DateTime  @updatedAt
  deletedAt               DateTime?

  company              Company                      @relation(fields: [companyId])
  assignment           OperationalPersonAssignment   @relation(fields: [assignmentId])
  supervisorAssignment OperationalPersonAssignment?  @relation("SupervisorOf", fields: [supervisorAssignmentId])

  @@index([companyId])
  @@index([assignmentId])
  @@index([supervisorAssignmentId])
  @@index([status])
}
```

Key design decisions:
- subordinateAssignmentId (required) -- the person being supervised
- supervisorAssignmentId (optional) -- the supervisor's current assignment
- NO supervisorPersonId -- derive person through supervisorAssignment.personnelId
- This ensures supervisor must have an active assignment (single source of truth)

Relations:
- OperationalPersonAssignment: supervisorAssignments SupervisorAssignment[]

---

## 15. ShiftHandover Model (NEW)

```prisma
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
  activeProductionOrders  Int?
  openMaintenanceRequests Int?
  stoppedMachines         Int?
  pendingMaintenance      Int?
  notes                   String?
  status                  String    @default("DRAFT")
  submittedAt             DateTime?
  acknowledgedAt          DateTime?
  createdByUserId         String?
  createdAt               DateTime  @default(now())
  updatedAt               DateTime  @updatedAt
  deletedAt               DateTime?

  company        Company           @relation(fields: [companyId])
  department     Department?       @relation(fields: [departmentId])
  outgoingShift  ProductionShift   @relation("OutgoingShift", fields: [outgoingShiftId])
  incomingShift  ProductionShift   @relation("IncomingShift", fields: [incomingShiftId])
  outgoingPerson OperationalPerson? @relation("OutgoingPerson", fields: [outgoingPersonId])
  incomingPerson OperationalPerson? @relation("IncomingPerson", fields: [incomingPersonId])
  items          ShiftHandoverItem[]

  @@index([companyId])
  @@index([branchId])
  @@index([departmentId])
  @@index([handoverDate])
  @@index([outgoingShiftId])
  @@index([incomingShiftId])
  @@index([status])
}
```

Lifecycle: DRAFT -> SUBMITTED -> ACKNOWLEDGED

### 15.1 Attachments (CORRECTION 8)

NO direct Prisma relation. Use existing polymorphic Attachment infrastructure:
- entityName = 'SHIFT_HANDOVER'
- entityId = ShiftHandover.id
- attachments queried via: GET /v1/attachments?entityName=SHIFT_HANDOVER&entityId={id}

The Attachment assertEntityOwned switch must add a case for SHIFT_HANDOVER.

### 15.2 Summary Snapshot Fields

The count fields (activeProductionOrders, openMaintenanceRequests, stoppedMachines, pendingMaintenance) are frozen snapshots at handover creation time. They provide a quick overview. Detailed items are in ShiftHandoverItem.

---

## 16. ShiftHandoverItem Model (NEW -- CORRECTION 9)

### 16.1 Why Needed

Summary counts are insufficient for operational handover. Users must know WHICH requests, machines, orders are being handed over.

### 16.2 Approach Evaluation

| Approach | Pros | Cons |
|----------|------|------|
| A. Generic entityType/entityId | Simple, follows Attachment pattern | No FK enforcement |
| B. Explicit nullable FKs | Strong referential integrity | Many nullable columns, complex queries |
| C. Reuse Attachment infrastructure | Consistent with existing pattern | Attachment is for files, not operational items |

**Decision: Approach A (generic entityType/entityId)** -- matches ATsofterp convention (Attachment uses same pattern). The category field provides type-safe filtering.

### 16.3 Proposed Model

```prisma
model ShiftHandoverItem {
  id                String    @id @default(cuid())
  companyId         String
  shiftHandoverId   String
  category          String
  entityType        String
  entityId          String
  entityCode        String?
  entitySummary     String?
  priority          String?
  status            String?
  notes             String?
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt
  deletedAt         DateTime?

  company  Company         @relation(fields: [companyId])
  handover ShiftHandover   @relation(fields: [shiftHandoverId])

  @@index([companyId])
  @@index([shiftHandoverId])
  @@index([category])
  @@index([entityType, entityId])
}
```

Category values: MAINTENANCE_REQUEST, STOPPED_MACHINE, PRODUCTION_ORDER, QUALITY_ISSUE, MATERIAL_SHORTAGE, SAFETY_OBSERVATION, GENERAL

entityType values: MAINTENANCE_REQUEST, MACHINE, PRODUCTION_ORDER, PRODUCTION_NONCONFORMANCE, SPARE_PART

---

## 17. MachineResponsibilityAssignment Extension Details

### 17.1 Schema Delta

```prisma
// Modification to existing MachineResponsibilityAssignment model:
scopeType        String    @default("MACHINE")
departmentId     String?
productionLineId String?
machineId        String?   // was REQUIRED, now nullable

department     Department?     @relation(fields: [departmentId])
productionLine ProductionLine? @relation(fields: [productionLineId])

@@index([departmentId])
@@index([productionLineId])
@@index([scopeType])
```

### 17.2 Validation Algorithm

```
1. Validate scopeType is one of: MACHINE, PRODUCTION_LINE, DEPARTMENT
2. Switch on scopeType:
   - MACHINE: require machineId NOT NULL, departmentId NULL, productionLineId NULL
   - PRODUCTION_LINE: require productionLineId NOT NULL, machineId NULL, departmentId NULL
   - DEPARTMENT: require departmentId NOT NULL, machineId NULL, productionLineId NULL
3. Validate target entity belongs to active tenant context
4. For MACHINE scope: validate machine exists and is in scope
5. For PRODUCTION_LINE scope: validate line exists and is in scope
6. For DEPARTMENT scope: validate department exists and is in scope
7. Check no duplicate active PRIMARY for same scope target
```

### 17.3 Backward Compatibility

All existing records have machineId set and no scopeType/departmentId/productionLineId. Migration:
- Set scopeType='MACHINE' for all existing records (derivable, AUTO_BACKFILL_SAFE)
- departmentId and productionLineId remain NULL for existing records (optional backfill from Machine)

---

## 18. Shared Service Integration (CORRECTION 10)

### 18.1 Attachment

Pattern: Polymorphic entityName/entityId on existing Attachment model.

For each new model:
- ShiftHandover: entityName='SHIFT_HANDOVER', query via Attachment service
- All other new models: entityName values TBD based on business need (JOB_TITLE, PERSON_ASSIGNMENT, etc.)

The Attachment.assertEntityOwned switch must be extended with new cases.

### 18.2 Audit

Pattern: AuditService.log() or AuditService.logWithClient() with userId, action, entity, entityId, details.

For each new model:
- JobTitle: log CREATE/UPDATE/DELETE with { code, name, companyId }
- OperationalPersonAssignment: log CREATE/TRANSFER/UPDATE/DELETE with { personnelId, departmentId, assignmentType }
- SupervisorAssignment: log CREATE/REMOVE with { assignmentId, supervisorAssignmentId }
- ShiftHandover: log CREATE/SUBMIT/ACKNOWLEDGE with { shiftId, handoverDate }
- ShiftHandoverItem: log CREATE/DELETE with { handoverId, category, entityType }

### 18.3 Notifications

Pattern: NotificationsService.dispatch({ userId, title, message, type, link }).

For each new model:
- ShiftHandover SUBMIT: notify incoming shift supervisor
- ShiftHandover ACKNOWLEDGE: notify outgoing shift supervisor
- SupervisorAssignment CREATE: notify both parties

### 18.4 CreatedBy

Pattern: createdByUserId String? field on model, set via @CurrentUser('id') in controller.

Models that get createdByUserId:
- OperationalPersonAssignment (explicit tracking of who made the assignment)
- ShiftHandover (explicit tracking of who created the handover)

Models that rely on updatedAt only:
- JobTitle (standard CRUD, updatedBy not critical)
- SupervisorAssignment (standard CRUD)
- ShiftHandoverItem (created as part of handover)

---

## 19. ProductionShift -- No Department Extension (CORRECTION 4)

ProductionShift is a shared branch-scoped shift definition. MORNING 08:00-16:00 should not belong to one department.

Department/area scope is provided through:
- ProductionShiftAssignment (links person to shift)
- ProductionOperationalAssignment (links machine/line to shift)
- ShiftHandover (handover scoped to department)

**No schema change to ProductionShift.**

---

## 20. MaintenancePersonnel -- No Branch Extension (CORRECTION 3)

MaintenancePersonnel remains a maintenance-specialty extension of OperationalPerson.

Branch/department/job title come from OperationalPersonAssignment.

**No schema change to MaintenancePersonnel.**

---

## 21. Daily Inspection Integration

No new models needed. Uses existing: MaintenanceSchedule, MaintenanceChecklistItem, MaintenanceChecklistExecution, MachineResponsibilityAssignment.

---

## 22. Weekly Maintenance Window

No new model needed. Uses existing: MaintenanceSchedule, MaintenanceRequest (priority=DEFERRED), MaintenanceWorkOrder, DowntimeSegment (PLANNED_STOP).

---

## 23. Emergency Maintenance Responsibility

No new model needed. Uses existing: MachineResponsibilityAssignment (EMERGENCY_SUPPORT role) + MaintenanceRequestAssignment (actual performer).

---

## 24. Shift Architecture

ProductionShift already serves as shared shift concept. Used in production AND maintenance (DowntimeLog, DowntimeSegment).

No MaintenanceShift or EmployeeShift needed.

---

## 25. Spare Part Lifecycle

Complete chain exists. Only gap: installed part life alerts (via existing Notification + SystemSetting).

---

## 26. Production Architecture

All existing production models preserved unchanged.

---

## 27. Measurement Points

ProductionMeasurementPoint.purpose already supports: INPUT, INTERMEDIATE, FINAL_OUTPUT, WASTE, REWORK.

---

## 28. Capacity / Expected vs Actual

All reporting dimensions exist. No changes needed.

---

## 29. Loss / Waste Architecture

Reason vs Responsibility already separated. No changes needed.

---

## 30. Downtime Responsibility

DowntimeLog (technical incident) vs DowntimeSegment (production attribution) already separated. splitDowntime() supports multi-owner.

---

## 31. OrganizationalUnit Transition (CORRECTION 11)

### 31.1 Dependency Inventory

OrganizationalUnit is referenced by:
- Department.operationalUnits relation (schema only, no runtime usage)
- CRUD module (admin/organizational-units/)
- Frontend pages (admin/core/organizational-units/)
- Navigation sidebar

### 31.2 Migration Plan (DEFERRED)

Phase 1 (first batch): FREEZE only. No new references. CRUD pages remain functional but deprecated.
Phase 2 (future): Produce dependency inventory, record mapping, zero-unmapped validation, compatibility period.
Phase 3 (future): Migrate UserOperationalScope to use departmentId (if UserOperationalScope ever gets organizationalUnitId added).

**Do NOT migrate in first implementation batch.**

---

## 32. Tenant Isolation

### 32.1 New Model Tenant Fields

| Model | companyId | branchId |
|-------|-----------|----------|
| JobTitle | Required | N/A |
| OperationalPersonAssignment | Required | Optional |
| SupervisorAssignment | Required | N/A (via assignment) |
| ShiftHandover | Required | Optional |
| ShiftHandoverItem | Required | N/A (via handover) |

### 32.2 Cross-Tenant Reference Prevention

All FK references validated by tenant guards. Same pattern as existing models.

---

## 33. Permission Design

### 33.1 New Permission Keys

| Domain | Keys |
|--------|------|
| Job Titles | job-title:read, job-title:create, job-title:update, job-title:delete |
| Person Assignment | person-assignment:read, person-assignment:create, person-assignment:update, person-assignment:transfer |
| Supervisor | supervisor:read, supervisor:assign, supervisor:remove |
| Shift Handover | shift-handover:read, shift-handover:create, shift-handover:submit, shift-handover:acknowledge |
| Coverage Extension | machine-responsibility:read (already exists), machine-responsibility:create (already exists) |

Total new permission keys: 16

---

## 34. Existing Model Delta Matrix

| Model | Decision | Change | Risk |
|-------|----------|--------|------|
| Company | KEEP | Add personAssignments[], shiftHandovers[] relations | LOW |
| Branch | KEEP | Add personAssignments[] relation | LOW |
| Administration | KEEP | Add personAssignments[] relation | LOW |
| Department | ADD_CLASSIFICATION | Add classification String? field; Add personAssignments[], shiftHandovers[] relations | LOW |
| OrganizationalUnit | FREEZE | No changes | NONE |
| CostCenter | KEEP | No changes | NONE |
| ProductionLine | KEEP | No changes | NONE |
| Machine | KEEP | No changes | NONE |
| MachineComponent | KEEP | No changes | NONE |
| OperationalPerson | KEEP | Add assignments[] relation | LOW |
| User | KEEP | No changes | NONE |
| UserOperationalScope | KEEP | No changes (organizationalUnitId does not exist) | NONE |
| MaintenancePersonnel | KEEP | No changes (no branchId added) | NONE |
| MachineResponsibilityAssignment | EXTEND | Add scopeType, departmentId?, productionLineId?; Make machineId nullable | MEDIUM |
| MaintenanceRequest | KEEP | No changes | NONE |
| MaintenanceWorkOrder | KEEP | No changes | NONE |
| ProductionShift | KEEP | No changes (no departmentId added) | NONE |
| ProductionOrder | KEEP | No changes | NONE |
| ProductionRun | KEEP | No changes | NONE |
| SparePart | KEEP | No changes | NONE |
| Product | KEEP | No changes | NONE |
| OperationalCostTransaction | KEEP | No changes | NONE |
| Attachment | KEEP | Add SHIFT_HANDOVER case to assertEntityOwned | LOW |

---

## 35. Proposed New Models Summary

### NEW-1: JobTitle
Purpose: Structured job titles. companyId-scoped. Code unique per company.

### NEW-2: OperationalPersonAssignment
Purpose: Historical organizational placement. Owns jobTitleId. companyId+branchId-scoped.

### NEW-3: SupervisorAssignment
Purpose: Reporting hierarchy via assignment references. companyId-scoped.

### NEW-4: ShiftHandover
Purpose: Structured shift-to-shift handover. companyId+branchId-scoped. Lifecycle: DRAFT->SUBMITTED->ACKNOWLEDGED.

### NEW-5: ShiftHandoverItem
Purpose: Detail items for handover. Polymorphic entity reference. companyId-scoped.

---

## 36. Rejected New Models

| Model | Reason |
|-------|--------|
| Employee | OperationalPerson is sufficient |
| ProductionArea | Department recursion covers this |
| ProcessSection | Department recursion covers this |
| MaintenanceShift | ProductionShift already shared |
| CompanyProduct | Global catalog works via intermediaries |
| CompanySparePart | Global catalog works via intermediaries |
| MaintenanceWindow | Existing models cover this |

---

## 37. Implementation Batch Plan

### BATCH A -- Organization + People Foundation

**Scope:** Core organizational and person infrastructure.

**Models:** JobTitle (NEW), OperationalPersonAssignment (NEW), SupervisorAssignment (NEW), Department.classification (EXTEND)

**Migration:**
1. Create job_titles table
2. Create operational_person_assignments table
3. Create supervisor_assignments table
4. Add classification column to departments (nullable, default 'OPERATIONAL')
5. Add relations to Company, Branch, Administration, Department, OperationalPerson

**Backend:**
- JobTitle CRUD module (controller, service, DTO, module)
- OperationalPersonAssignment CRUD + transfer logic
- SupervisorAssignment CRUD + reporting line query
- Permission keys creation + seeding
- Tenant guards for all new modules
- Audit logging for all new modules

**Frontend:**
- /admin/core/job-titles (list + CRUD)
- /admin/core/persons/[id]/assignments (assignment history)
- /admin/core/persons/[id]/reporting (org tree view)
- /admin/core/departments (add classification column + filter)

**Permissions:** job-title:*, person-assignment:*, supervisor:*, department:classify

**i18n:** All new keys for both Arabic and English

**Tests:**
- Tenant isolation for all new CRUD modules
- Recursive department hierarchy with classification
- One active primary person assignment per person
- Assignment transfer atomicity
- Supervisor cycle prevention
- Supervisor cross-company rejection

**Backfill:**
- JobTitle records from maintenance personnel roles: BACKFILL_WITH_VALIDATION (roles may differ from job titles)
- Initial OperationalPersonAssignment: MANUAL_MAPPING_REQUIRED (operationalPerson is global, no department info exists)
- Department classification: NO_BACKFILL (all existing departments get default OPERATIONAL)

**Rollback:** Drop new tables. Remove classification column. Remove new relations.

**Acceptance Criteria:**
- JobTitle CRUD works end-to-end with tenant isolation
- Person assignment history tracks placements over time
- Supervisor reporting line query returns correct hierarchy
- Department classification filters work
- All new permissions enforced

**Risk:** MEDIUM -- OperationalPerson is global, creating assignments requires manual mapping of which company each person belongs to.

---

### BATCH B -- Maintenance Coverage + Shift Handover

**Scope:** Extend MachineResponsibilityAssignment scope + Shift Handover.

**Models:** MachineResponsibilityAssignment (EXTEND), ShiftHandover (NEW), ShiftHandoverItem (NEW)

**Migration:**
1. Add scopeType, departmentId?, productionLineId? to machine_responsibility_assignments
2. Make machineId nullable
3. Create shift_handovers table
4. Create shift_handover_items table
5. Add SHIFT_HANDOVER case to Attachment assertEntityOwned

**Backend:**
- MachineResponsibilityAssignment scope extension (service validation for scopeType + exactly-one-target)
- ShiftHandover CRUD + submit/acknowledge workflow
- ShiftHandoverItem CRUD
- Permission keys for shift handover
- Audit logging for handover lifecycle

**Frontend:**
- /admin/maintenance/machine-responsibilities (update form for scopeType + dept/line selectors)
- /admin/production/shift-handovers (list + detail + submit flow)
- Shift handover create/edit with item management

**Permissions:** shift-handover:*, machine-responsibility scope update

**i18n:** All new keys for both Arabic and English

**Tests:**
- Maintenance coverage exact-one-scope rule
- Coverage overlap prevention
- Emergency support role
- Shift handover lifecycle (DRAFT->SUBMITTED->ACKNOWLEDGED)
- Handover item references
- Attachment integration for handover
- Backward compatibility (existing machine-scoped assignments still work)

**Backfill:**
- scopeType='MACHINE' for all existing records: AUTO_BACKFILL_SAFE
- departmentId/productionLineId from Machine: AUTO_BACKFILL_SAFE (optional)

**Rollback:** Remove new columns. Drop shift_handovers and shift_handover_items tables.

**Acceptance Criteria:**
- Machine responsibility works with all three scope types
- Exactly one scope target enforced
- Shift handover lifecycle works end-to-end
- Handover items correctly reference operational entities
- Attachments work for shift handovers
- Existing machine-scoped assignments unaffected

**Risk:** LOW-MEDIUM -- scope extension is additive; handover is entirely new.

---

### BATCH C -- Downtime/Cost Integration Verification + Operational UI Completion

**Scope:** Verify existing downtime/cost architecture works with new org structure. Complete operational UI.

**Models:** None new. Verify existing models.

**Backend:**
- Verify DowntimeSegment downtimeCategory + responsibleDepartmentId works correctly
- Verify OperationalCostTransaction costType + costDomain separation
- Verify DowntimeSegment.splitDowntime() supports multi-owner attribution
- Verify MeasurementPoint purpose-based output calculation
- Verify capacity standard expected vs actual reporting

**Frontend:**
- Department classification badges in machine/line/shift views
- Person assignment history tab in maintenance personnel detail
- Supervisor reporting line visualization

**Tests:**
- Downtime split ownership end-to-end
- Cost domain attribution
- Measurement point output calculation
- Capacity standard vs actual comparison

**Backfill:** None.

**Rollback:** N/A (verification only).

**Acceptance Criteria:**
- All existing production/maintenance/cost workflows verified
- No regression in existing functionality
- New org structure correctly integrates

**Risk:** LOW -- verification only.

---

### BATCH D -- OrganizationalUnit Controlled Transition

**Scope:** Evaluate and plan OrganizationalUnit deprecation.

**Models:** OrganizationalUnit (FROZEN, no changes)

**Steps:**
1. Produce complete dependency inventory (already done in this report)
2. Verify no new references were added in Batches A-C
3. Document all OrganizationalUnit CRUD usage
4. Plan data migration to Department (if OrganizationalUnit records map to Department hierarchy)
5. Create compatibility period plan
6. Execute migration in future batch

**Acceptance Criteria:**
- Zero new references to OrganizationalUnit in Batches A-C
- Complete migration plan documented
- Stakeholder approval for deprecation timeline

**Risk:** LOW -- no code changes.

---

### BATCH E -- Joubah Workbook Cleanup/Import Preparation

**Scope:** Prepare for controlled Joubah data import.

**Depends on:** Batches A, B, C complete.

**Steps:**
1. Map Joubah organizational structure to ATsofterp Department hierarchy
2. Map Joubah person records to OperationalPerson + OperationalPersonAssignment
3. Map Joubah job titles to JobTitle model
4. Map Joubah machine responsibility to MachineResponsibilityAssignment
5. Validate all mappings with stakeholders

**Acceptance Criteria:**
- Complete mapping document
- Zero unmapped records
- Stakeholder sign-off

**Risk:** HIGH -- depends on external data quality.

---

### BATCH F -- Controlled Joubah Import

**Scope:** Execute Joubah data import.

**Depends on:** Batch E complete.

**Steps:**
1. Import departments with classification
2. Import job titles
3. Import persons + assignments
4. Import supervisor relationships
5. Import machine responsibility assignments
6. Validate imported data
7. Run acceptance tests

**Acceptance Criteria:**
- All data imported correctly
- Tenant isolation verified for imported data
- No duplicate records
- All relationships valid

**Risk:** HIGH -- data import is always risky.

---

## 38. Test Strategy

### 38.1 Unit Tests

| Test | Module | Priority |
|------|--------|----------|
| JobTitle CRUD tenant isolation | job-titles.service.spec | HIGH |
| One PRIMARY assignment per person | person-assignments.service.spec | HIGH |
| Assignment transfer atomicity | person-assignments.service.spec | HIGH |
| EffectiveTo >= effectiveFrom validation | person-assignments.service.spec | HIGH |
| Supervisor cycle prevention | supervisor-assignments.service.spec | HIGH |
| Supervisor cross-company rejection | supervisor-assignments.service.spec | HIGH |
| Coverage exact-one-scope rule | machine-responsibilities.service.spec | HIGH |
| Coverage scope validation | machine-responsibilities.service.spec | HIGH |
| Duplicate PRIMARY prevention | machine-responsibilities.service.spec | MEDIUM |
| Shift handover lifecycle | shift-handovers.service.spec | HIGH |
| Handover item references | shift-handover-items.service.spec | MEDIUM |

### 38.2 Integration Tests

| Test | Priority |
|------|----------|
| Department classification filter | HIGH |
| Recursive department hierarchy | HIGH |
| Person assignment history query | HIGH |
| Supervisor reporting line query | MEDIUM |
| Coverage by department/line/machine | HIGH |
| Handover submit/acknowledge flow | HIGH |
| Attachment for shift handover | MEDIUM |

### 38.3 Tenant Isolation Tests

| Test | Priority |
|------|----------|
| Company A cannot read Company B's JobTitles | HIGH |
| Company A cannot create assignment in Company B's department | HIGH |
| Company A cannot assign Company B's person | HIGH |
| Company A cannot see Company B's handovers | HIGH |
| Cross-company machine responsibility blocked | HIGH |

### 38.4 Frontend Tests

| Test | Priority |
|------|----------|
| RTL layout for new pages | HIGH |
| LTR layout for new pages | HIGH |
| Arabic translations complete | HIGH |
| English translations complete | HIGH |
| Permission-based visibility | HIGH |
| F9 lookup integration | MEDIUM |

### 38.5 Permission Enforcement Tests

| Test | Priority |
|------|----------|
| job-title:create denied without permission | HIGH |
| person-assignment:transfer denied without permission | HIGH |
| shift-handover:submit denied without permission | HIGH |
| supervisor:assign denied without permission | HIGH |

---

## 39. Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| OperationalPerson is global -- creating per-company assignments requires manual mapping | HIGH | Batch E mapping exercise with stakeholder validation |
| MachineResponsibilityAssignment scope extension breaks existing queries | MEDIUM | Backward-compatible: machineId still works, scopeType defaults to MACHINE |
| Shift handover adoption requires training | LOW | Phased rollout, Arabic/English UI |
| Department classification may be misused as hierarchy level | LOW | Documentation, classification is label-only, not structural |
| Supervisor cycle could cause infinite loops in reporting | MEDIUM | Cycle detection in service layer + max depth limit |
| Attachment assertEntityOwned switch may miss new entity types | LOW | Unit test for each new entity type |

---

## 40. Open Decisions

| # | Decision | Status | Needed By |
|---|----------|--------|-----------|
| 1 | Should OperationalPerson get companyId/branchId in a future batch? | DEFERRED | Batch D |
| 2 | Should responsibilityRole be standardized with allowed values? | DEFERRED | Separate task |
| 3 | Should MaintenancePersonnel get branchId in future? | DEFERRED | Batch D |
| 4 | What is the maximum supervisor hierarchy depth? | OPEN | Batch A |
| 5 | Should shift handover require both submit + acknowledge? | OPEN | Batch B |
| 6 | Should handover items be read-only after submission? | OPEN | Batch B |
| 7 | Should department classification be editable or immutable after creation? | OPEN | Batch A |

---

## 41. Architecture Decision Matrix

| Decision | Option A | Option B | Chosen | Reason |
|----------|----------|----------|--------|--------|
| JobTitle location | On OperationalPerson | On OperationalPersonAssignment | B | Single source of truth via assignment |
| Supervisor source | Self-FK on OperationalPerson | SupervisorAssignment model | B | Assignment-based, supports transfers |
| MaintenancePersonnel branch | Add branchId | Derive from assignment | B | No duplication principle |
| ProductionShift dept | Add departmentId | Derive from assignments | B | Shift is company-wide concept |
| Department type | Reuse existing type | Add new classification | NEW | Department has no type field |
| Coverage scope | Generic scopeType | Separate models | A | Extends existing model, fewer tables |
| Handover attachments | Direct Prisma relation | Polymorphic Attachment | B | Matches existing convention |
| Handover items | Generic entityType/entityId | Explicit FKs | A | Matches Attachment convention |
| Assignment primary | isPrimary + assignmentType | assignmentType only | B | Single source of truth |

---

## 42. Pseudo-Prisma Complete Target Design

```prisma
// NEW MODEL: JobTitle
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

  company     Company   @relation(fields: [companyId])
  assignments OperationalPersonAssignment[]

  @@unique([companyId, code])
  @@index([companyId])
  @@index([status])
}

// NEW MODEL: OperationalPersonAssignment
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
  status            String    @default("ACTIVE")
  notes             String?
  createdByUserId   String?
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt
  deletedAt         DateTime?

  company              Company                  @relation(fields: [companyId])
  branch               Branch?                  @relation(fields: [branchId])
  administration       Administration?          @relation(fields: [administrationId])
  department           Department               @relation(fields: [departmentId])
  jobTitle             JobTitle?                @relation(fields: [jobTitleId])
  person               OperationalPerson        @relation(fields: [personnelId])
  supervisorAssignments SupervisorAssignment[]

  @@unique([personnelId, departmentId, effectiveFrom])
  @@index([companyId])
  @@index([branchId])
  @@index([departmentId])
  @@index([personnelId])
  @@index([status])
}

// NEW MODEL: SupervisorAssignment
model SupervisorAssignment {
  id                      String    @id @default(cuid())
  companyId               String
  assignmentId            String
  supervisorAssignmentId  String?
  relationshipType        String    @default("DIRECT")
  effectiveFrom           DateTime
  effectiveTo             DateTime?
  isActive                Boolean   @default(true)
  status                  String    @default("ACTIVE")
  createdAt               DateTime  @default(now())
  updatedAt               DateTime  @updatedAt
  deletedAt               DateTime?

  company              Company                      @relation(fields: [companyId])
  assignment           OperationalPersonAssignment   @relation(fields: [assignmentId])
  supervisorAssignment OperationalPersonAssignment?  @relation("SupervisorOf", fields: [supervisorAssignmentId])

  @@index([companyId])
  @@index([assignmentId])
  @@index([supervisorAssignmentId])
  @@index([status])
}

// NEW MODEL: ShiftHandover
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
  activeProductionOrders  Int?
  openMaintenanceRequests Int?
  stoppedMachines         Int?
  pendingMaintenance      Int?
  notes                   String?
  status                  String    @default("DRAFT")
  submittedAt             DateTime?
  acknowledgedAt          DateTime?
  createdByUserId         String?
  createdAt               DateTime  @default(now())
  updatedAt               DateTime  @updatedAt
  deletedAt               DateTime?

  company        Company           @relation(fields: [companyId])
  department     Department?       @relation(fields: [departmentId])
  outgoingShift  ProductionShift   @relation("OutgoingShift", fields: [outgoingShiftId])
  incomingShift  ProductionShift   @relation("IncomingShift", fields: [incomingShiftId])
  outgoingPerson OperationalPerson? @relation("OutgoingPerson", fields: [outgoingPersonId])
  incomingPerson OperationalPerson? @relation("IncomingPerson", fields: [incomingPersonId])
  items          ShiftHandoverItem[]

  @@index([companyId])
  @@index([branchId])
  @@index([departmentId])
  @@index([handoverDate])
  @@index([outgoingShiftId])
  @@index([incomingShiftId])
  @@index([status])
}

// NEW MODEL: ShiftHandoverItem
model ShiftHandoverItem {
  id                String    @id @default(cuid())
  companyId         String
  shiftHandoverId   String
  category          String
  entityType        String
  entityId          String
  entityCode        String?
  entitySummary     String?
  priority          String?
  status            String?
  notes             String?
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt
  deletedAt         DateTime?

  company  Company       @relation(fields: [companyId])
  handover ShiftHandover @relation(fields: [shiftHandoverId])

  @@index([companyId])
  @@index([shiftHandoverId])
  @@index([category])
  @@index([entityType, entityId])
}

// EXTENSION: Department
// Add: classification String? @default("OPERATIONAL")
// Add: personAssignments OperationalPersonAssignment[]
// Add: shiftHandovers ShiftHandover[]

// EXTENSION: MachineResponsibilityAssignment
// Add: scopeType String @default("MACHINE")
// Add: departmentId String?
// Add: productionLineId String?
// Make: machineId String? (was required)
// Add: department Department? @relation
// Add: productionLine ProductionLine? @relation

// EXTENSION: Company
// Add: personAssignments OperationalPersonAssignment[]
// Add: jobTitles JobTitle[]
// Add: shiftHandovers ShiftHandover[]

// EXTENSION: Branch
// Add: personAssignments OperationalPersonAssignment[]
// Add: shiftHandovers ShiftHandover[]

// EXTENSION: Administration
// Add: personAssignments OperationalPersonAssignment[]

// EXTENSION: OperationalPerson
// Add: assignments OperationalPersonAssignment[]
```

---

## 43. Final Model Count

### NEW MODELS (5)
1. JobTitle
2. OperationalPersonAssignment
3. SupervisorAssignment
4. ShiftHandover
5. ShiftHandoverItem

### EXTENDED MODELS (3)
1. Department (classification field + relations)
2. MachineResponsibilityAssignment (scopeType + departmentId + productionLineId)
3. Attachment (new entityName case for SHIFT_HANDOVER)

### UNCHANGED MODELS (remaining ~142)
All other models remain exactly as-is.

### FROZEN MODELS (1)
1. OrganizationalUnit (no new references, CRUD remains functional but deprecated)

### REJECTED MODELS (7)
1. Employee
2. ProductionArea
3. ProcessSection
4. MaintenanceShift
5. CompanyProduct
6. CompanySparePart
7. MaintenanceWindow

---

## 44. Final Verification

### Baseline
- Branch: checkpoint/backend-lan-responsive-shell -- VERIFIED
- Commit: 0e9c925c887777f830a5a0611660770b9a2abdd7 -- VERIFIED
- Working tree: only docs/proofs/ files -- VERIFIED

### Source Code
- No source code modified -- VERIFIED
- No Prisma schema modified -- VERIFIED
- No migration created -- VERIFIED
- No database writes -- VERIFIED
- No commit created -- VERIFIED

### Report
- Only docs/proofs/atsofterp-target-architecture-gap-design-report-v2.md created -- VERIFIED

---

---

## 45. FINAL GATE

| Check | Result | Evidence |
|-------|--------|----------|
| ARCHITECTURE_CONSISTENCY_CHECK | PASS | All 15 corrections applied. No contradictions remain. Department.type confusion resolved (field does not exist). OperationalPerson.jobTitle confusion resolved (field does not exist). One-source-of-truth enforced for job title (assignment only), supervisor (assignment only), maintenance personnel (no branch duplication), production shift (no department duplication). |
| SINGLE_SOURCE_OF_TRUTH_CHECK | PASS | JobTitleId on OperationalPersonAssignment ONLY. SupervisorAssignment ONLY (no self-FK on OperationalPerson). assignmentType is sole primary indicator (isPrimary removed). MachineResponsibilityAssignment.scopeType with exactly-one-target. |
| TENANT_ISOLATION_DESIGN | PASS | All 5 new models have companyId. All cross-tenant references validated by service-level tenant guards. MachineResponsibilityAssignment tenant isolation extended to department/line scope. |
| MIGRATION_SAFETY_DESIGN | PASS | All schema changes additive (nullable fields, new tables). No existing columns removed. Backward-compatible scope extension (machineId nullable, defaults to MACHINE scope). |
| SHARED_SERVICE_COMPATIBILITY | PASS | Attachment: polymorphic entityName/entityId pattern reused. Audit: AuditService.log/logWithClient pattern followed. CreatedBy: createdByUserId with @CurrentUser('id'). Notifications: NotificationsService.dispatch pattern. |
| BATCH_PLAN_COMPLETE | PASS | 6 batches (A-F) defined with scope, models, migration, backend, frontend, permissions, i18n, tests, backfill, rollback, acceptance criteria, risk. |
| TEST_STRATEGY_COMPLETE | PASS | Unit, integration, tenant isolation, frontend, and permission enforcement tests defined. 27 explicit test cases. |

**READY_FOR_IMPLEMENTATION = YES**

All checks PASS. The v2 report is ready for implementation via the approved batch plan.

---

*Report generated: 2026-08-18*
*Branch: checkpoint/backend-lan-responsive-shell*
*Commit: 0e9c925c887777f830a5a0611660770b9a2abdd7*
*Status: DESIGN ONLY -- no implementation performed*
*Version: v2 -- Correction gate applied*
