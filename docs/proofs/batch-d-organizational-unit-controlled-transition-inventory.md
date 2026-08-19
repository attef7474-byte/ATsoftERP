# Batch D — OrganizationalUnit Controlled Transition: Full Inventory

**Date:** 2026-08-18
**Branch:** `checkpoint/backend-lan-responsive-shell`
**Status:** RECONCILED

---

## 1. OrganizationalUnit Model

### 1.1 Prisma Model (`schema.prisma:443-469`)

```prisma
model OrganizationalUnit {
  id        String               @id @default(cuid())
  companyId String
  company   Company              @relation(fields: [companyId], references: [id], onDelete: NoAction, onUpdate: NoAction)
  branchId  String
  branch    Branch               @relation(fields: [branchId], references: [id], onDelete: NoAction, onUpdate: NoAction)
  parentId  String?
  parent    OrganizationalUnit?  @relation("OrganizationalUnitHierarchy", fields: [parentId], references: [id], onDelete: NoAction, onUpdate: NoAction)
  children  OrganizationalUnit[] @relation("OrganizationalUnitHierarchy")
  code      String
  name      String
  type      String               @default("DEPARTMENT")
  status    String               @default("ACTIVE")
  createdAt DateTime             @default(now())
  updatedAt DateTime             @updatedAt
  deletedAt DateTime?

  @@unique([branchId, code])
  @@index([companyId])
  @@index([branchId])
  @@index([parentId])
  @@index([type])
  @@index([status])
  @@index([createdAt])
  @@index([companyId, status])
  @@map("organizational_units")
}
```

**Fields:** 14 scalar + 4 relations
**Unique constraint:** `[branchId, code]` (per-branch)
**Table:** `organizational_units`

### 1.2 Downstream FK Consumers: **ZERO**

No Prisma model holds an `organizationalUnitId` FK. OU is an orphan leaf.

### 1.3 Parent Models with `organizationalUnits` Relation

| Model | Relation |
|-------|----------|
| Company (line 221) | `organizationalUnits OrganizationalUnit[]` |
| Branch (line 309) | `organizationalUnits OrganizationalUnit[]` |

---

## 2. Department Model

### 2.1 Prisma Model (`schema.prisma:406-441`)

```prisma
model Department {
  id               String          @id @default(cuid())
  companyId        String
  company          Company         @relation(fields: [companyId], references: [id], onDelete: NoAction, onUpdate: NoAction)
  branchId         String?
  branch           Branch?         @relation(fields: [branchId], references: [id], onDelete: NoAction, onUpdate: NoAction)
  administrationId String?
  administration   Administration? @relation(fields: [administrationId], references: [id], onDelete: NoAction, onUpdate: NoAction)
  parentId         String?
  parent           Department?     @relation("DepartmentHierarchy", fields: [parentId], references: [id], onDelete: NoAction, onUpdate: NoAction)
  children         Department[]    @relation("DepartmentHierarchy")
  code             String
  name             String
  classification   String          @default("OPERATIONAL")
  status           String          @default("ACTIVE")
  createdAt        DateTime        @default(now())
  updatedAt        DateTime        @updatedAt
  deletedAt        DateTime?

  users                   User[]
  machines                Machine[]
  technicalMachines       Machine[]                         @relation("TechnicalDepartment")
  costCenters             CostCenter[]
  productionLines         ProductionLine[]
  operationalScopes       UserOperationalScope[]
  personAssignments       OperationalPersonAssignment[]
  machineResponsibilities MachineResponsibilityAssignment[]
  shiftHandovers          ShiftHandover[]

  @@unique([companyId, code])
  @@index([branchId])
  @@index([administrationId])
  @@index([status])
  @@index([createdAt])
  @@map("departments")
}
```

**Fields:** 14 scalar + 11 relations
**Unique constraint:** `[companyId, code]` (per-company)
**Table:** `departments`

### 2.2 Downstream FK Consumers: **9+ models**

| Model | FK Field | Required? | Usage |
|-------|----------|-----------|-------|
| User | `departmentId` | Optional | User assignment, JWT, operational context |
| Machine | `departmentId` | Optional | Machine ownership, stock issue cost derivation |
| Machine | `technicalDepartmentId` | Optional | Technical department validation |
| CostCenter | `departmentId` | Optional | CRUD with department validation |
| ProductionLine | `departmentId` | **Required** | CRUD with department validation |
| UserOperationalScope | `departmentId` | Optional | Context resolver |
| OperationalPersonAssignment | `departmentId` | **Required** | CRUD with transfer support |
| MachineResponsibilityAssignment | `departmentId` | Optional | Scope-based with department ownership |
| ShiftHandover | `departmentId` | Optional | CRUD with department validation |
| MaintenanceRequestRequiredPart | `costDepartmentId` | Optional | Stock issue cost attribution |

---

## 3. Semantic Comparison: Department vs OrganizationalUnit

| Aspect | Department | OrganizationalUnit |
|--------|-----------|-------------------|
| **Purpose** | Operational organizational entity with transactional FKs | Generic organizational tree structure |
| **FK consumers** | 9+ models | 0 models |
| **branchId** | Optional (`String?`) — can exist without branch | Required (`String`) — always branch-scoped |
| **code uniqueness** | Per **company** (`[companyId, code]`) | Per **branch** (`[branchId, code]`) |
| **administrationId** | Yes — links to Administration | No |
| **classification** | Yes — `OPERATIONAL/MANAGEMENT/AREA/PROCESS/SECTION/UNIT/WORKSHOP` (7 values, default: OPERATIONAL) | No |
| **type** | No | Yes — `DEPARTMENT/SECTION/UNIT/TEAM/PROJECT/OTHER` |
| **Self-referential** | Yes (`DepartmentHierarchy`) | Yes (`OrganizationalUnitHierarchy`) |
| **Seed data** | 1 record (`ADMIN`) | 0 records |
| **Numbering** | `DEP-` prefix | `OU-` prefix |

### 3.1 Field Mapping Feasibility

| OU Field | Dept Equivalent | Mapping |
|----------|-----------------|---------|
| `id` | `id` | Direct (different tables) |
| `companyId` | `companyId` | Direct |
| `branchId` (required) | `branchId` (optional) | OU.branchId → Dept.branchId (safe: required→optional) |
| `parentId` | `parentId` | Direct |
| `code` | `code` | Direct (but different uniqueness scope) |
| `name` | `name` | Direct |
| `type` | **MISSING** | New field needed on Department |
| `status` | `status` | Direct |
| `createdAt` | `createdAt` | Direct |
| `updatedAt` | `updatedAt` | Direct |
| `deletedAt` | `deletedAt` | Direct |

**Missing on Department:** `type` field (enum: DEPARTMENT/SECTION/UNIT/TEAM/PROJECT/OTHER)

---

## 4. Backend File Inventory

### 4.1 OrganizationalUnit Backend Files

| File | Purpose |
|------|---------|
| `apps/api/src/modules/admin/organizational-units/organizational-units.module.ts` | Module registration |
| `apps/api/src/modules/admin/organizational-units/organizational-units.controller.ts` | CRUD controller (6 endpoints) |
| `apps/api/src/modules/admin/organizational-units/organizational-units.service.ts` | CRUD service with tenant isolation |
| `apps/api/src/modules/admin/organizational-units/organizational-units.service.spec.ts` | 14 unit tests |
| `apps/api/src/modules/admin/organizational-units/dto/create-organizational-unit.dto.ts` | Create DTO |
| `apps/api/src/modules/admin/organizational-units/dto/update-organizational-unit.dto.ts` | Update DTO |
| `apps/api/src/app.module.ts:14,105` | App module registration |
| `apps/api/prisma/seed/seed.ts:31` | Permission generation (`organizational-unit` module) |
| `apps/api/prisma/seed/seed.ts:260` | Numbering sequence (`ORGANIZATIONAL_UNIT`) |
| `apps/api/prisma/migrations/20260802000000_add_organizational_unit/migration.sql` | Table creation migration |

### 4.2 Department Backend Files

| File | Purpose |
|------|---------|
| `apps/api/src/modules/admin/departments/departments.module.ts` | Module registration |
| `apps/api/src/modules/admin/departments/departments.controller.ts` | CRUD controller (7 endpoints) |
| `apps/api/src/modules/admin/departments/departments.service.ts` | CRUD service with reference validation |
| `apps/api/src/modules/admin/departments/departments.service.spec.ts` | 10 unit tests |
| `apps/api/src/modules/admin/departments/dto/create-department.dto.ts` | Create DTO |
| `apps/api/src/modules/admin/departments/dto/update-department.dto.ts` | Update DTO |
| `apps/api/src/app.module.ts:10,105` | App module registration |
| `apps/api/prisma/seed/seed.ts:31,77,110,128,259` | Seed data + permissions + numbering |
| `apps/api/prisma/seed/seed-batch-a-permission-keys.ts:17` | Extra permission (`department:classify`) |
| `apps/api/prisma/migrations/20260714042111_init_core_foundation/migration.sql` | Table creation |
| `apps/api/prisma/migrations/20260723023622_add_administration/migration.sql` | administrationId added |
| `apps/api/prisma/migrations/20260818100000_batch_a_org_people_foundation/migration.sql` | classification added |

### 4.3 Backend Files Consuming Department FK

| File | Lines | Usage |
|------|-------|-------|
| `users.service.ts` | 29-30, 77, 96, 121-122, 211-222 | departmentId validation, JWT select |
| `users.service.spec.ts` | 45, 73-83 | Mock department for user tests |
| `administrations.service.ts` | 54, 70, 106, 109 | Department count before delete |
| `administrations.service.spec.ts` | 120-135 | Mock department count |
| `person-assignments.service.ts` | 42-307 | Full CRUD with department validation |
| `person-assignments.service.spec.ts` | 25-332 | Department mock data |
| `person-assignments/tenant-isolation.spec.ts` | 39-244 | Cross-company department rejection |
| `supervisor-assignments.service.ts` | 61-297 | Read-only via nested relation |
| `supervisor-assignments.service.spec.ts` | 24 | Mock department |
| `machine-responsibility-assignments.service.ts` | 29-355 | Scope-based department ownership |
| `machine-responsibility-assignments.service.spec.ts` | 17-355 | Department mock data |
| `shift-handovers.service.ts` | 103-282 | CRUD with department validation |
| `shift-handovers.service.spec.ts` | 33 | Mock department |
| `maintenance.service.ts` | 83-345 | technicalDepartmentId validation |
| `maintenance.dto.ts` | 33, 58, 125, 150 | departmentId fields |
| `cost-centers.service.ts` | 62-406 | CRUD with department validation |
| `cost-centers.service.spec.ts` | 17-105 | Mock department |
| `production-lines.service.ts` | 37-192 | CRUD with department validation |
| `maintenance-stock-issue.service.ts` | 34-232 | costDepartmentId derivation |
| `maintenance-stock-issue.service.spec.ts` | 22-36 | Mock department |
| `dashboard.service.ts` | 47-92 | department count |
| `dashboard.service.spec.ts` | 17-42 | Mock department count |
| `search.service.ts` | 139-1377 | Department search entity |
| `companies.service.ts` | 41, 56 | department count |
| `report-filter.dto.ts` | 9 | departmentId filter |
| `report-query-utils.ts` | 6 | departmentId filter type |
| `maintenance-reports.service.ts` | 498-566 | department aggregation |
| `auth/types/current-user.type.ts` | 8 | departmentId on CurrentUser |
| `auth/strategies/jwt.strategy.ts` | 26-38 | departmentId in JWT |
| `common/operational-context/` | 5 files | departmentId in context system |
| `common/guards/inventory-lock.guard.ts` | 96 | departmentId header |

---

## 5. Frontend File Inventory

### 5.1 OrganizationalUnit Frontend Files (12 files)

| File | Category |
|------|----------|
| `lib/admin-types/core.ts:120-137` | Type definition |
| `components/f9/lookup-adapters.ts:43-54` | F9 adapter |
| `components/f9/index.ts:11` | Barrel export |
| `components/f9/adapter-registry.ts:110-115` | Registry entry |
| `app/admin/core/organizational-units/page.tsx` | List page |
| `app/admin/core/organizational-units/[id]/page.tsx` | Detail page |
| `components/admin/shell/navigation-data.ts:83` | Nav entry |
| `lib/i18n/locales/en/core.ts:32-44,166-176` | English translations |
| `lib/i18n/locales/ar/core.ts:32-44,166-176` | Arabic translations |
| `lib/i18n/locales/en/navigation.ts:15` | Nav English |
| `lib/i18n/locales/ar/navigation.ts:15` | Nav Arabic |
| `lib/i18n/locales/en/organization.ts:9` | Error message |
| `lib/i18n/locales/ar/organization.ts:9` | Error message |

### 5.2 Department Frontend Files (~50 files)

**Type definitions:** `admin-types/core.ts`, `admin-types/access.ts`, `admin-types/maintenance.ts`, `auth.ts`

**Infrastructure:** `operational-context.ts`, `f9/types.ts`, `f9/F9Lookup.tsx`

**F9 system:** `lookup-adapters.ts`, `adapter-registry.ts`, `index.ts`

**CRUD pages:** `departments/page.tsx`, `departments/[id]/page.tsx`

**Pages using departmentId FK (14 files):** users, person-assignments, persons, machines (new/edit/detail/list), machine-responsibilities, production-lines, cost-centers, shift-handovers (list + detail), companies/[id]

**Related entity pages (4 files):** companies (drawer), branches (drawer + detail), administrations/[id]

**Search/Dashboard (4 files):** search page, results, entities, dashboard

**Navigation:** `navigation-data.ts`, `breadcrumb.tsx`

**i18n (15+ files):** en/ar × core, maintenance, access, navigation, workspace, common, organization, validation, production, settings, literals

---

## 6. Permission Keys

### 6.1 Seed-Generated Keys

| Key | Source | Enforced |
|-----|--------|----------|
| `organizational-unit:create` | MODULES loop | Backend controller |
| `organizational-unit:read` | MODULES loop | Backend controller |
| `organizational-unit:update` | MODULES loop | Backend controller |
| `organizational-unit:delete` | MODULES loop | Backend controller |
| `department:create` | MODULES loop | **REMEDIATED**: controller now uses `department:create` (singular) |
| `department:read` | MODULES loop | **REMEDIATED**: controller now uses `department:read` (singular) |
| `department:update` | MODULES loop | **REMEDIATED**: controller now uses `department:update` (singular) |
| `department:delete` | MODULES loop | **REMEDIATED**: controller now uses `department:delete` (singular) |
| `department:classify` | BATCH_A | Backend controller |

### 6.2 Frontend Permission Gating

- **OrganizationalUnit:** **NO frontend permission gating** — nav item has no `permission` field, pages have no permission checks. Backend controller enforces `organizational-unit:*` keys. This is a known compatibility-period gap.
- **Department:** **REMEDIATED** — nav item now has `permission: 'department:read'`. Backend controller uses singular `department:*` keys matching seed.

---

## 7. Seed Data and Actual Database Counts

### 7.1 Seed Records

| Entity | Seed Count | Details |
|--------|------------|---------|
| Department | 1 | `ADMIN` / "Administration" under DEFAULT company/HQ branch |
| OrganizationalUnit | 0 | Table created empty |

### 7.2 Actual Database Counts (verified via SQL Server query)

| Entity | Total | Active | Deleted/Inactive |
|--------|-------|--------|------------------|
| **OrganizationalUnit** | **1** | **1** | **0** |
| **Department** | **4** | **4** | **0** |

**OU record details:**
- id: `cmsc6qcy90000fw95txh2t42j`
- companyId: `cmrl31uuy0000ok959hdjnca6`
- branchId: `cmrx06a560000ng95g7d65vzh`
- code: `MAINT-DEPT`
- name: `Maintenance Department`
- type: `DEPARTMENT`
- status: `ACTIVE`

**Department records:** 4 active records across 4 companies, all with `classification = NULL`

### 7.3 Department Classification Values (verified from source)

**Actual supported values** (from DTO `@IsIn` + service `allowed[]` + i18n):
```
OPERATIONAL (default), MANAGEMENT, AREA, PROCESS, SECTION, UNIT, WORKSHOP
```

**NOT valid:** `TECHNICAL`, `SUPPORT` — these do not exist in current source code.

**Current data state:** All 4 department records have `classification = NULL` (not yet populated).

---

## 62. Migration History (OU/Dept Relevant)

| Migration | Action |
|-----------|--------|
| `20260714042111_init_core_foundation` | Dept table created + users/machines FKs |
| `20260716070228_batch25_performance_indexes` | Dept indexes added |
| `20260723023622_add_administration` | Dept.administrationId added |
| `20260723041650_add_operation_types_cost_centers` | CostCenter.departmentId FK |
| `20260723053312_add_production_lines` | ProductionLine.departmentId FK |
| `20260723063756_add_machine_operational_technical_cost_fields` | Machine.technicalDepartmentId FK |
| `20260729120000_add_user_operational_scopes` | UserOperationalScope.departmentId FK |
| `20260802000000_add_organizational_unit` | **OU table created** |
| `20260818100000_batch_a_org_people_foundation` | Dept.classification + PersonAssignment.departmentId FK |
| `20260818110000_batch_b_maintenance_coverage_shift_handover` | MachineResp.departmentId + ShiftHandover.departmentId FKs |

---

## 7. Test Files

| File | Entity | Test Count |
|------|--------|------------|
| `organizational-units.service.spec.ts` | OU | 14 |
| `departments.service.spec.ts` | Dept | 10 |
| `job-titles/permission-keys.spec.ts` | Dept (permissions) | 7 |
| `person-assignments/tenant-isolation.spec.ts` | Dept (indirect) | 11 |
| `administrations.service.spec.ts` | Dept (indirect) | 2 |

---

## 8. Risk Assessment

| Risk | Severity | Impact |
|------|----------|--------|
| OU has 0 FK consumers | Low | No FK migration needed if merging OU→Dept |
| Department has 9+ FK consumers | High | Migrating Dept→OU would require touching 9+ models |
| OU code scoped per branch vs Dept code scoped per company | Medium | Code uniqueness conflict if merging — requires deterministic conflict policy |
| OU has no administrationId | Low | Safe to add nullable FK |
| OU has `type` field not on Department | Medium | ARCHITECTURE_DECISION_REQUIRED — may use existing `classification` + `parentId` hierarchy |
| Permission key singular/plural mismatch | **REMEDIATED** | Controller now uses singular `department:*` matching seed |
| OU has 1 actual DB record (not 0) | Medium | Data migration needed — 1 OU row must be mapped to Department |
| Department classification values all NULL | Low | Existing 7-value set is correct, just not populated in data |
| OU frontend lacks permission gating | Medium | Known compatibility-period gap — backend enforces keys |
