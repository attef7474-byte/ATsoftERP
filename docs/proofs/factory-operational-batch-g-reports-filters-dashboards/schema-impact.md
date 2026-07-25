# Schema Impact — Batch G

- Schema changes: none
- Migration: N/A
- Reason: All operational context fields already exist in the database schema (productionLineId, machineComponentId, operationTypeId, costCenterId on MaintenanceRequest; sparePartId on MaintenanceRequestRequiredPart). Only DTO and query logic were updated.
