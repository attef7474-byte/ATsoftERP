# Schema Implementation — Batch H

## Models Added (4)

### 1. MaintenancePersonnel
- Table: `maintenance_personnel`
- Fields: `id`, `code` (unique), `name`, `role`, `specialty?`, `phone?`, `email?`, `userId?` (optional FK → User), `isActive`, `notes?`, `createdAt`, `updatedAt`
- Indexes: `code`, `role`, `specialty`, `isActive`, `userId`
- Relations: `maintenancePersonnel → User?`, `machineResponsibilities`, `requestAssignments`, `partAccountabilities`

### 2. MachineResponsibilityAssignment
- Table: `machine_responsibility_assignments`
- Fields: `id`, `machineId` (FK → Machine), `maintenancePersonnelId` (FK → MaintenancePersonnel), `responsibilityRole`, `isPrimary`, `startDate`, `endDate?`, `status`, `notes?`, `createdAt`, `updatedAt`
- Indexes: `machineId`, `maintenancePersonnelId`, `responsibilityRole`, `isPrimary`, `status`, composite `[machineId, maintenancePersonnelId, status]`
- No hard delete — history preserved

### 3. MaintenanceRequestAssignment
- Table: `maintenance_request_assignments`
- Fields: `id`, `maintenanceRequestId` (FK → MaintenanceRequest), `maintenancePersonnelId` (FK → MaintenancePersonnel), `assignmentRole`, `status`, `assignedAt`, `acceptedAt?`, `startedAt?`, `completedAt?`, `cancelledAt?`, `notes?`, `createdAt`, `updatedAt`
- Indexes: `maintenanceRequestId`, `maintenancePersonnelId`, `assignmentRole`, `status`, composite `[maintenanceRequestId, maintenancePersonnelId, status]`
- Status transitions: ASSIGNED → ACCEPTED → IN_PROGRESS → COMPLETED; ASSIGNED → CANCELLED; ACCEPTED → CANCELLED

### 4. MaintenancePartAccountability
- Table: `maintenance_part_accountability`
- Fields: `id`, `maintenanceRequestId` (FK → MaintenanceRequest), `requiredPartId` (FK → MaintenanceRequestRequiredPart), `sparePartId` (FK → SparePart), `machineId?` (FK → Machine), `machineComponentId?` (FK → MachineComponent), `maintenancePersonnelId` (FK → MaintenancePersonnel), `quantity`, `reportedUsedQuantity?`, `returnedQuantity?`, `status`, `accountabilityNote?`, `assignedAt`, `reportedAt?`, `cancelledAt?`, `createdAt`, `updatedAt`
- Indexes: `maintenanceRequestId`, `requiredPartId`, `sparePartId`, `machineId`, `machineComponentId`, `maintenancePersonnelId`, `status`
- No inventory movement, no stock balance change, no finance entry

## Relations Added to Existing Models

- `Machine.responsibilities → MachineResponsibilityAssignment[]`
- `Machine.partAccountabilities → MaintenancePartAccountability[]`
- `MaintenanceRequest.assignments → MaintenanceRequestAssignment[]`
- `MaintenanceRequest.partAccountabilities → MaintenancePartAccountability[]`
- `MaintenanceRequestRequiredPart.partAccountabilities → MaintenancePartAccountability[]`
- `SparePart.partAccountabilities → MaintenancePartAccountability[]`
- `MachineComponent.partAccountabilities → MaintenancePartAccountability[]`
- `User.maintenancePersonnel → MaintenancePersonnel[]`

## No Schema Changes To
- HR tables: none
- Inventory tables: none
- Finance tables: none
- Stock balance tables: none
- Existing machine/maintenance/part tables: only new reverse relations added
