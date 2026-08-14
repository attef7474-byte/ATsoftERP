-- Inventory locks were created without tenant ownership. Additive nullable
-- ownership preserves every legacy row while allowing new runtime writes and
-- all reads/checks/mutations to use exact company + branch scope.
--
-- Deterministic backfill policy:
--   * A location-owned row is backfilled only when its optional warehouseId is
--     absent or agrees with the location's parent warehouse.
--   * A warehouse-only row is backfilled from that warehouse.
--   * Company-wide warehouses legitimately leave branchId NULL; product-only,
--     spare-part-only, global/period, missing-reference and conflicting-parent
--     rows remain partially or wholly NULL and are intentionally hidden by the
--     remediated runtime. No tenant or branch is guessed.
--
-- Recovery: the DDL and deterministic updates are transactional. On failure,
-- SQL Server rolls the entire migration back. The nullable columns can coexist
-- with the previous application during a rolling deployment; deploy the new
-- application immediately after this migration so new rows receive exact scope.
-- The six tenant-first indexes add bounded write/storage overhead to the small
-- lock-control table and match code lookup plus active lock checks by reference.
--
-- SQL Server batch note: statements that reference the columns added above are
-- executed through EXEC sys.sp_executesql. SQL Server compiles an entire batch
-- before executing it, so a statement referencing a column added by ALTER TABLE
-- in the same batch fails with "Invalid column name" at compile time. Dynamic
-- SQL compiles at runtime, after the ALTER has executed. This mirrors the
-- approved pattern in
-- 20260807100000_add_2a_cost_center_hierarchy_and_assignments.

SET XACT_ABORT ON;

BEGIN TRY
  BEGIN TRANSACTION;

  ALTER TABLE [dbo].[inventory_locks] ADD [companyId] NVARCHAR(1000) NULL;
  ALTER TABLE [dbo].[inventory_locks] ADD [branchId] NVARCHAR(1000) NULL;

  EXEC sys.sp_executesql N'
  -- A location is authoritative only when the row has no warehouse reference
  -- or both references identify the same warehouse.
  UPDATE [lock]
  SET
    [lock].[companyId] = [warehouse].[companyId],
    [lock].[branchId] = [warehouse].[branchId]
  FROM [dbo].[inventory_locks] AS [lock]
  INNER JOIN [dbo].[warehouse_locations] AS [location]
    ON [location].[id] = [lock].[locationId]
  INNER JOIN [dbo].[warehouses] AS [warehouse]
    ON [warehouse].[id] = [location].[warehouseId]
  WHERE [lock].[companyId] IS NULL
    AND [lock].[branchId] IS NULL
    AND ([lock].[warehouseId] IS NULL OR [lock].[warehouseId] = [location].[warehouseId]);

  -- Do not use warehouseId as a fallback for a row carrying an unresolved or
  -- contradictory locationId; such a row is not deterministically owned.
  UPDATE [lock]
  SET
    [lock].[companyId] = [warehouse].[companyId],
    [lock].[branchId] = [warehouse].[branchId]
  FROM [dbo].[inventory_locks] AS [lock]
  INNER JOIN [dbo].[warehouses] AS [warehouse]
    ON [warehouse].[id] = [lock].[warehouseId]
  WHERE [lock].[companyId] IS NULL
    AND [lock].[branchId] IS NULL
    AND [lock].[locationId] IS NULL;

  ALTER TABLE [dbo].[inventory_locks]
    ADD CONSTRAINT [inventory_locks_companyId_fkey]
    FOREIGN KEY ([companyId]) REFERENCES [dbo].[companies]([id])
    ON DELETE NO ACTION ON UPDATE NO ACTION;

  ALTER TABLE [dbo].[inventory_locks]
    ADD CONSTRAINT [inventory_locks_branchId_fkey]
    FOREIGN KEY ([branchId]) REFERENCES [dbo].[branches]([id])
    ON DELETE NO ACTION ON UPDATE NO ACTION;

  CREATE INDEX [inventory_locks_companyId_branchId_code_idx]
    ON [dbo].[inventory_locks]([companyId], [branchId], [code]);

  CREATE INDEX [inventory_locks_companyId_branchId_status_lockType_dateFrom_dateTo_idx]
    ON [dbo].[inventory_locks]([companyId], [branchId], [status], [lockType], [dateFrom], [dateTo]);

  CREATE INDEX [inventory_locks_companyId_branchId_warehouseId_idx]
    ON [dbo].[inventory_locks]([companyId], [branchId], [warehouseId]);

  CREATE INDEX [inventory_locks_companyId_branchId_locationId_idx]
    ON [dbo].[inventory_locks]([companyId], [branchId], [locationId]);

  CREATE INDEX [inventory_locks_companyId_branchId_productId_idx]
    ON [dbo].[inventory_locks]([companyId], [branchId], [productId]);

  CREATE INDEX [inventory_locks_companyId_branchId_sparePartId_idx]
    ON [dbo].[inventory_locks]([companyId], [branchId], [sparePartId]);
  ';

  COMMIT TRANSACTION;
END TRY
BEGIN CATCH
  IF XACT_STATE() <> 0 ROLLBACK TRANSACTION;
  THROW;
END CATCH;
