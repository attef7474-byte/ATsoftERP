# Implementation Map — AH-AI

## Files Changed

### Schema (Lane A)
- `apps/api/prisma/schema.prisma` — 5 new models added (MaintenanceBom, MaintenanceBomVersion, MaintenanceBomItem, PreventiveSparePartPlan, PreventiveSparePartPlanItem) + back-relations to Machine, MachineComponent, MaintenanceSchedule, SparePart, MaintenanceRequest, User
- `apps/api/prisma/migrations/ahai_bom_versioning_preventive_spareparts_planning.sql` — manual SQL migration (5 tables, 53 columns)

### Backend (Lane B)
- `apps/api/src/modules/factory/maintenance/maintenance-bom/maintenance-bom.module.ts`
- `apps/api/src/modules/factory/maintenance/maintenance-bom/maintenance-bom.controller.ts` — 18 endpoints
- `apps/api/src/modules/factory/maintenance/maintenance-bom/maintenance-bom.service.ts`
- `apps/api/src/modules/factory/maintenance/maintenance-bom/dto/maintenance-bom.dto.ts`
- `apps/api/src/modules/factory/maintenance/preventive-spare-part-plan/preventive-spare-part-plan.module.ts`
- `apps/api/src/modules/factory/maintenance/preventive-spare-part-plan/preventive-spare-part-plan.controller.ts` — 16 endpoints
- `apps/api/src/modules/factory/maintenance/preventive-spare-part-plan/preventive-spare-part-plan.service.ts`
- `apps/api/src/modules/factory/maintenance/preventive-spare-part-plan/dto/preventive-spare-part-plan.dto.ts`
- `apps/api/src/app.module.ts` — module registration

### Numbering (Lane D)
- `apps/api/src/modules/numbering/numbering.constants.ts` — MAINTENANCE_BOM, PREVENTIVE_SPARE_PART_PLAN

### Seed (Lane D)
- `apps/api/prisma/seed/seed.ts` — modules `maintenance-bom`, `preventive-spare-part-plan` with CRUD permissions, extra permissions for BOM/Plan, numbering sequences

### i18n (Lane D)
- `apps/api/src/common/i18n/api-messages.ts` — 13 new API message keys
- `apps/web/src/lib/i18n/locales/en/maintenance.ts` — ~40 new BOM/Planning UI keys
- `apps/web/src/lib/i18n/locales/ar/maintenance.ts` — ~40 new BOM/Planning UI keys
- `apps/web/src/lib/i18n/locales/en/settings.ts` — 2 new numbering entity type entries
- `apps/web/src/lib/i18n/locales/ar/settings.ts` — 2 new numbering entity type entries

### Proof (Lane F)
- `docs/proofs/ahai-bom-versioning-preventive-spareparts-planning/`

## New Models

| Model | Table | Fields | Key Relations |
|-------|-------|--------|--------------|
| MaintenanceBom | maintenance_boms | 10 | Machine, MachineComponent, versions[] |
| MaintenanceBomVersion | maintenance_bom_versions | 10 | MaintenanceBom, items[], User(createdBy) |
| MaintenanceBomItem | maintenance_bom_items | 10 | MaintenanceBomVersion, SparePart |
| PreventiveSparePartPlan | preventive_spare_part_plans | 11 | MaintenanceSchedule, Machine, User(generatedBy), items[] |
| PreventiveSparePartPlanItem | preventive_spare_part_plan_items | 12 | PreventiveSparePartPlan, SparePart, MaintenanceRequest(copyToRequest) |

## Numbering Entity Types

| Code | Prefix | Status |
|------|--------|--------|
| MAINTENANCE_BOM | BOM- | ACTIVE |
| PREVENTIVE_SPARE_PART_PLAN | PSP- | ACTIVE |

## Permissions

| Module | Actions |
|--------|--------|
| maintenance-bom | create, read, update, delete |
| preventive-spare-part-plan | create, read, update, delete |

## API Endpoints

### BOM (`/api/v1/maintenance/bom`)
| Method | Path | Permission |
|--------|------|-----------|
| POST | / | maintenance-bom:create |
| GET | / | maintenance-bom:read |
| GET | /:id | maintenance-bom:read |
| PATCH | /:id | maintenance-bom:update |
| PATCH | /:id/activate | maintenance-bom:update |
| PATCH | /:id/deactivate | maintenance-bom:update |
| DELETE | /:id | maintenance-bom:delete |
| GET | /:id/versions | maintenance-bom:read |
| POST | /:id/versions | maintenance-bom:create |
| POST | /:id/versions/:versionId/activate | maintenance-bom:update |
| GET | /:id/versions/:versionId/items | maintenance-bom:read |
| POST | /:id/versions/:versionId/items | maintenance-bom:create |
| PATCH | /:id/versions/:versionId/items/:itemId | maintenance-bom:update |
| DELETE | /:id/versions/:versionId/items/:itemId | maintenance-bom:delete |
| GET | /by-machine/:machineId | maintenance-bom:read |
| GET | /by-component/:componentId | maintenance-bom:read |
| GET | /:id/active-version | maintenance-bom:read |
| **Total: 18 endpoints** | | |

### Plans (`/api/v1/maintenance/spare-part-plans`)
| Method | Path | Permission |
|--------|------|-----------|
| POST | / | preventive-spare-part-plan:create |
| GET | / | preventive-spare-part-plan:read |
| GET | /:id | preventive-spare-part-plan:read |
| PATCH | /:id | preventive-spare-part-plan:update |
| DELETE | /:id | preventive-spare-part-plan:delete |
| POST | /:id/activate | preventive-spare-part-plan:update |
| POST | /:id/complete | preventive-spare-part-plan:update |
| POST | /:id/cancel | preventive-spare-part-plan:update |
| POST | /generate-from-schedule/:scheduleId | preventive-spare-part-plan:create |
| GET | /:id/items | preventive-spare-part-plan:read |
| POST | /:id/items | preventive-spare-part-plan:create |
| PATCH | /:id/items/:itemId | preventive-spare-part-plan:update |
| DELETE | /:id/items/:itemId | preventive-spare-part-plan:delete |
| POST | /:id/refresh-availability | preventive-spare-part-plan:update |
| POST | /:id/copy-to-request | preventive-spare-part-plan:update |
| **Total: 15 endpoints** | | |

**Grand total: 33 new endpoints**

## i18n Coverage
- 13 API messages (EN + AR) for BOM/Plan errors
- ~40 UI keys (EN + AR) for BOM/Planning labels
- 2 settings keys (EN + AR) for numbering entity types
