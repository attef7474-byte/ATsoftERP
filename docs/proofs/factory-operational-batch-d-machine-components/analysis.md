# Analysis — Batch D: Machine Components

## Objective
Implement a Machine Components / Machine Assemblies structure with parent/child support, enabling hierarchical decomposition of machines into their constituent assemblies and sub-assemblies.

## Scope
- Backend: Prisma model, migration, NestJS CRUD module (controller, service, DTOs), authorization, audit logging
- Frontend: TypeScript interface, 4 pages (list, new, detail, edit), F9 lookup adapter, i18n (AR/EN)
- Permissions: 6 new permission entries (create/read/update/delete/activate/deactivate)
- Proofs: API tests, Playwright browser tests, validation suite

## Out of Scope
- Spare Parts (separate module)
- ComponentSparePart (separate module)
- Technician/Engineer assignment
- HR or Finance integration
- Screenshots

## Data Model
- MachineComponent: id (cuid), machineId (FK), parentComponentId (self-ref FK, optional), code, name, componentType (enum), description, locationInMachine, manufacturer, model, serialNumber, criticality (enum), status, createdAt, updatedAt, deletedAt
- Unique constraint: [machineId, code]
- 5 indexes: machineId, parentComponentId, status, deletedAt, componentType

## Hierarchy Rules
- Machine → MachineComponent (top-level) → MachineComponent (child, optional depth)
- Parent must belong to same machine
- Self-parenting blocked
- Cycle prevention via update guard
- Soft delete via deletedAt

## API Endpoints
| Method | Path | Permission |
|--------|------|------------|
| POST | /maintenance/machine-components | machine-component:create |
| GET | /maintenance/machine-components | machine-component:read |
| GET | /maintenance/machine-components/:id | machine-component:read |
| PATCH | /maintenance/machine-components/:id | machine-component:update |
| DELETE | /maintenance/machine-components/:id | machine-component:delete |
| PATCH | /maintenance/machine-components/:id/activate | machine-component:activate |
| PATCH | /maintenance/machine-components/:id/deactivate | machine-component:deactivate |
| GET | /maintenance/machines/:id/components | machines:read |
