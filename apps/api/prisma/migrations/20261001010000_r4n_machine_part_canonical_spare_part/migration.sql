-- R4N: unify MachinePart and SparePart onto one authoritative technical catalog.
--
-- Adds a single ADDITIVE, NULLABLE column to machine_parts:
--     sparePartId NVARCHAR(1000) NULL  ->  spare_parts(id)
-- plus one nonclustered index and one foreign key.
--
-- Purpose. SparePart is the canonical reusable technical catalog item.
-- MachineSparePart already expresses Machine applicability (unique on
-- machineId+sparePartId), ComponentSparePart already expresses Component
-- applicability, and MachineInstalledPart already records physical installation.
-- machine_parts had NO link to the canonical catalog at all, so a Machine
-- part-list entry could not be associated with the item it represents. This
-- migration supplies exactly that missing link and nothing else.
--
-- DATA SAFETY. This migration is strictly additive and non-destructive:
--   * The column is NULLABLE, so every existing row receives NULL.
--   * No row is inserted, updated or deleted by this script.
--   * No existing value is truncated, renamed or reinterpreted.
--   * onDelete/onUpdate are NO_ACTION, matching every existing FK in this
--     database, so the constraint can never cascade-delete catalog or history.
--   * Column type NVARCHAR(1000) NULL matches spare_parts.id and the existing
--     machine_parts FK columns exactly (measured from INFORMATION_SCHEMA).
--
-- RECONCILIATION IS DELIBERATELY NOT PERFORMED HERE. A measured read-only
-- survey of all 889 machine_parts rows found:
--   * productId populated on 0 rows, partNumber populated on 0 rows.
--     The table therefore carries NO technical identity capable of proving
--     equivalence to a canonical item.
--   * 421 rows fall into 70 cross-machine name clusters with a consistent
--     unit and quantity. Name, unit and quantity are display and usage
--     attributes, NOT technical identity, so these are recorded as
--     AMBIGUOUS_TECHNICAL_IDENTITY and deliberately left NULL.
--   * 167 rows are unbound and carry no companyId/branchId column, so tenant
--     ownership is unprovable; recorded as UNKNOWN_RECORD_OWNERSHIP, left NULL.
--   * 301 rows have unique names and no technical identity;
--     INSUFFICIENT_SOURCE_EVIDENCE, left NULL.
-- Populating this column is a separate, evidence-gated application step.
--
-- RECOVERY. Each statement is guarded by an existence check, so rerunning the
-- script after it has already applied is a no-op. The whole body is one
-- transaction; any failure rolls back completely.

SET ANSI_NULLS ON;
SET ANSI_PADDING ON;
SET ANSI_WARNINGS ON;
SET ARITHABORT ON;
SET CONCAT_NULL_YIELDS_NULL ON;
SET QUOTED_IDENTIFIER ON;
SET NUMERIC_ROUNDABORT OFF;

BEGIN TRY
BEGIN TRAN;

-- 1. Additive nullable canonical link column.
IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[dbo].[machine_parts]')
      AND name = N'sparePartId'
)
BEGIN
    ALTER TABLE [dbo].[machine_parts] ADD [sparePartId] NVARCHAR(1000) NULL;
END;

-- 2. Query-path index for canonical lookups.
IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE object_id = OBJECT_ID(N'[dbo].[machine_parts]')
      AND name = N'machine_parts_sparePartId_idx'
)
BEGIN
    CREATE NONCLUSTERED INDEX [machine_parts_sparePartId_idx]
        ON [dbo].[machine_parts] ([sparePartId]);
END;

-- 3. Referential integrity to the canonical catalog, NO_ACTION both directions.
IF NOT EXISTS (
    SELECT 1 FROM sys.foreign_keys
    WHERE name = N'machine_parts_sparePartId_fkey'
      AND parent_object_id = OBJECT_ID(N'[dbo].[machine_parts]')
)
BEGIN
    ALTER TABLE [dbo].[machine_parts]
        ADD CONSTRAINT [machine_parts_sparePartId_fkey]
        FOREIGN KEY ([sparePartId]) REFERENCES [dbo].[spare_parts] ([id])
        ON DELETE NO ACTION ON UPDATE NO ACTION;
END;

COMMIT TRAN;
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK TRAN;
    THROW;
END CATCH;