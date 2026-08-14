-- Additive tenant ownership for operational barcode facts. Barcode templates
-- intentionally remain global shared reference data and are not changed here.
ALTER TABLE [barcode_labels] ADD [companyId] NVARCHAR(1000) NULL;
ALTER TABLE [barcode_labels] ADD [branchId] NVARCHAR(1000) NULL;
ALTER TABLE [barcode_scan_events] ADD [companyId] NVARCHAR(1000) NULL;
ALTER TABLE [barcode_scan_events] ADD [branchId] NVARCHAR(1000) NULL;
ALTER TABLE [barcode_print_jobs] ADD [companyId] NVARCHAR(1000) NULL;
ALTER TABLE [barcode_print_jobs] ADD [branchId] NVARCHAR(1000) NULL;

-- Backfill only polymorphic references whose current owning aggregate proves one
-- exact company and non-null branch. Global Products and company-wide Machines /
-- Warehouses cannot prove the historical active branch and intentionally remain
-- NULL so the runtime fail-closed filters hide them until an approved data repair.
CREATE TABLE [#BarcodeEntityOwners] (
    [entityType] NVARCHAR(100) NOT NULL,
    [entityId] NVARCHAR(1000) NOT NULL,
    [companyId] NVARCHAR(1000) NOT NULL,
    [branchId] NVARCHAR(1000) NOT NULL
);

INSERT INTO [#BarcodeEntityOwners] ([entityType], [entityId], [companyId], [branchId])
SELECT N'MACHINE', [id], [companyId], [branchId]
FROM [machines] WHERE [companyId] IS NOT NULL AND [branchId] IS NOT NULL
UNION ALL
SELECT N'MACHINE_PART', [p].[id], [m].[companyId], [m].[branchId]
FROM [machine_parts] AS [p]
INNER JOIN [machines] AS [m] ON [m].[id] = [p].[machineId]
WHERE [m].[companyId] IS NOT NULL AND [m].[branchId] IS NOT NULL
UNION ALL
SELECT N'WAREHOUSE', [id], [companyId], [branchId]
FROM [warehouses] WHERE [companyId] IS NOT NULL AND [branchId] IS NOT NULL
UNION ALL
SELECT N'WAREHOUSE_LOCATION', [l].[id], [w].[companyId], [w].[branchId]
FROM [warehouse_locations] AS [l]
INNER JOIN [warehouses] AS [w] ON [w].[id] = [l].[warehouseId]
WHERE [w].[companyId] IS NOT NULL AND [w].[branchId] IS NOT NULL
UNION ALL
SELECT N'INVENTORY_COUNT', [id], [companyId], [branchId]
FROM [inventory_counts] WHERE [companyId] IS NOT NULL AND [branchId] IS NOT NULL
UNION ALL
SELECT N'INVENTORY_COUNT_LINE', [l].[id], [c].[companyId], [c].[branchId]
FROM [inventory_count_lines] AS [l]
INNER JOIN [inventory_counts] AS [c] ON [c].[id] = [l].[countId]
WHERE [c].[companyId] IS NOT NULL AND [c].[branchId] IS NOT NULL
UNION ALL
SELECT N'INVENTORY_MOVEMENT', [id], [companyId], [branchId]
FROM [inventory_movements] WHERE [companyId] IS NOT NULL AND [branchId] IS NOT NULL
UNION ALL
SELECT N'INVENTORY_ADJUSTMENT', [id], [companyId], [branchId]
FROM [inventory_adjustments] WHERE [companyId] IS NOT NULL AND [branchId] IS NOT NULL
UNION ALL
SELECT N'MAINTENANCE_REQUEST', [r].[id], [m].[companyId], [m].[branchId]
FROM [maintenance_requests] AS [r]
INNER JOIN [machines] AS [m] ON [m].[id] = [r].[machineId]
WHERE [m].[companyId] IS NOT NULL AND [m].[branchId] IS NOT NULL
UNION ALL
SELECT N'MAINTENANCE_TASK', [t].[id], [m].[companyId], [m].[branchId]
FROM [maintenance_tasks] AS [t]
INNER JOIN [maintenance_requests] AS [r] ON [r].[id] = [t].[requestId]
INNER JOIN [machines] AS [m] ON [m].[id] = [r].[machineId]
WHERE [m].[companyId] IS NOT NULL AND [m].[branchId] IS NOT NULL
UNION ALL
SELECT N'MAINTENANCE_SCHEDULE', [s].[id], [m].[companyId], [m].[branchId]
FROM [maintenance_schedules] AS [s]
INNER JOIN [machines] AS [m] ON [m].[id] = [s].[machineId]
WHERE [m].[companyId] IS NOT NULL AND [m].[branchId] IS NOT NULL
UNION ALL
SELECT N'MAINTENANCE_CHECKLIST_ITEM', [i].[id], [m].[companyId], [m].[branchId]
FROM [maintenance_checklist_items] AS [i]
INNER JOIN [maintenance_schedules] AS [s] ON [s].[id] = [i].[scheduleId]
INNER JOIN [machines] AS [m] ON [m].[id] = [s].[machineId]
WHERE [m].[companyId] IS NOT NULL AND [m].[branchId] IS NOT NULL
UNION ALL
SELECT N'DOWNTIME_LOG', [d].[id], [m].[companyId], [m].[branchId]
FROM [downtime_logs] AS [d]
INNER JOIN [machines] AS [m] ON [m].[id] = [d].[machineId]
WHERE [m].[companyId] IS NOT NULL AND [m].[branchId] IS NOT NULL;

UPDATE [l]
SET [l].[companyId] = [o].[companyId], [l].[branchId] = [o].[branchId]
FROM [barcode_labels] AS [l]
INNER JOIN [#BarcodeEntityOwners] AS [o]
    ON [o].[entityType] = [l].[entityType] AND [o].[entityId] = [l].[entityId]
WHERE [l].[companyId] IS NULL AND [l].[branchId] IS NULL;

UPDATE [e]
SET [e].[companyId] = [o].[companyId], [e].[branchId] = [o].[branchId]
FROM [barcode_scan_events] AS [e]
INNER JOIN [#BarcodeEntityOwners] AS [o]
    ON [o].[entityType] = [e].[entityType] AND [o].[entityId] = [e].[entityId]
WHERE [e].[companyId] IS NULL AND [e].[branchId] IS NULL;

UPDATE [e]
SET [e].[companyId] = [l].[companyId], [e].[branchId] = [l].[branchId]
FROM [barcode_scan_events] AS [e]
INNER JOIN [barcode_labels] AS [l] ON [l].[id] = [e].[labelId]
WHERE [e].[companyId] IS NULL AND [e].[branchId] IS NULL
  AND [l].[companyId] IS NOT NULL AND [l].[branchId] IS NOT NULL;

UPDATE [j]
SET [j].[companyId] = [o].[companyId], [j].[branchId] = [o].[branchId]
FROM [barcode_print_jobs] AS [j]
INNER JOIN [#BarcodeEntityOwners] AS [o]
    ON [o].[entityType] = [j].[entityType] AND [o].[entityId] = [j].[entityId]
WHERE [j].[companyId] IS NULL AND [j].[branchId] IS NULL;

UPDATE [j]
SET [j].[companyId] = [l].[companyId], [j].[branchId] = [l].[branchId]
FROM [barcode_print_jobs] AS [j]
INNER JOIN [barcode_labels] AS [l] ON [l].[id] = [j].[labelId]
WHERE [j].[companyId] IS NULL AND [j].[branchId] IS NULL
  AND [l].[companyId] IS NOT NULL AND [l].[branchId] IS NOT NULL;

DROP TABLE [#BarcodeEntityOwners];

CREATE INDEX [barcode_labels_companyId_branchId_createdAt_idx]
    ON [barcode_labels]([companyId], [branchId], [createdAt]);
CREATE INDEX [barcode_labels_companyId_branchId_entityType_entityId_idx]
    ON [barcode_labels]([companyId], [branchId], [entityType], [entityId]);
CREATE INDEX [barcode_labels_companyId_branchId_status_idx]
    ON [barcode_labels]([companyId], [branchId], [status]);

CREATE INDEX [barcode_scan_events_companyId_branchId_scannedAt_idx]
    ON [barcode_scan_events]([companyId], [branchId], [scannedAt]);
CREATE INDEX [barcode_scan_events_companyId_branchId_entityType_entityId_idx]
    ON [barcode_scan_events]([companyId], [branchId], [entityType], [entityId]);
CREATE INDEX [barcode_scan_events_companyId_branchId_result_scannedAt_idx]
    ON [barcode_scan_events]([companyId], [branchId], [result], [scannedAt]);

CREATE INDEX [barcode_print_jobs_companyId_branchId_requestedAt_idx]
    ON [barcode_print_jobs]([companyId], [branchId], [requestedAt]);
CREATE INDEX [barcode_print_jobs_companyId_branchId_entityType_entityId_idx]
    ON [barcode_print_jobs]([companyId], [branchId], [entityType], [entityId]);
CREATE INDEX [barcode_print_jobs_companyId_branchId_status_idx]
    ON [barcode_print_jobs]([companyId], [branchId], [status]);
