-- Fix pre-existing ProductionEligibility uniqueness defect.
--
-- Defect: SQL Server treats NULLs as equal in unique constraints, so the two
-- unfiltered unique constraints created by 20260803120000_add_production_master_data
--   UNIQUE (productionProductId, resourceType, machineId)
--   UNIQUE (productionProductId, resourceType, productionLineId)
-- allowed at most ONE MACHINE eligibility and at most ONE LINE eligibility per
-- product. A second, distinct machine (or line) eligibility for the same product
-- collided with the NULL counterpart of every other row of the same resourceType
-- and failed with P2002.
--
-- Required final invariants (no resourceType column; the application guard in
-- production-product-definitions.service enforces resourceType/MACHINE-line
-- semantics and both-populated = 0 / neither-populated = 0 are verified data
-- invariants), enforced at the database as the concurrency safety net:
--   UNIQUE (productionProductId, machineId)        WHERE machineId IS NOT NULL
--   UNIQUE (productionProductId, productionLineId) WHERE productionLineId IS NOT NULL
-- Prisma schema cannot express filtered indexes, so the schema.prisma
-- @@unique entries are removed and the invariant is documented there and
-- covered by regression tests.
SET ANSI_NULLS ON;
SET ANSI_PADDING ON;
SET ANSI_WARNINGS ON;
SET ARITHABORT ON;
SET CONCAT_NULL_YIELDS_NULL ON;
SET QUOTED_IDENTIFIER ON;
SET NUMERIC_ROUNDABORT OFF;

BEGIN TRY
BEGIN TRAN;

IF EXISTS (
    SELECT 1 FROM sys.key_constraints
    WHERE name = N'production_eligibilities_productionProductId_resourceType_machineId_key'
      AND parent_object_id = OBJECT_ID(N'[dbo].[production_eligibilities]')
      AND type = 'UQ'
)
BEGIN
    ALTER TABLE [dbo].[production_eligibilities]
        DROP CONSTRAINT [production_eligibilities_productionProductId_resourceType_machineId_key];
END;

IF EXISTS (
    SELECT 1 FROM sys.key_constraints
    WHERE name = N'production_eligibilities_productionProductId_resourceType_productionLineId_key'
      AND parent_object_id = OBJECT_ID(N'[dbo].[production_eligibilities]')
      AND type = 'UQ'
)
BEGIN
    ALTER TABLE [dbo].[production_eligibilities]
        DROP CONSTRAINT [production_eligibilities_productionProductId_resourceType_productionLineId_key];
END;

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = N'production_eligibilities_productionProductId_machineId_unique'
      AND object_id = OBJECT_ID(N'[dbo].[production_eligibilities]')
)
BEGIN
    CREATE UNIQUE NONCLUSTERED INDEX [production_eligibilities_productionProductId_machineId_unique]
        ON [dbo].[production_eligibilities] ([productionProductId], [machineId])
        WHERE [machineId] IS NOT NULL;
END;

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = N'production_eligibilities_productionProductId_productionLineId_unique'
      AND object_id = OBJECT_ID(N'[dbo].[production_eligibilities]')
)
BEGIN
    CREATE UNIQUE NONCLUSTERED INDEX [production_eligibilities_productionProductId_productionLineId_unique]
        ON [dbo].[production_eligibilities] ([productionProductId], [productionLineId])
        WHERE [productionLineId] IS NOT NULL;
END;

COMMIT TRAN;
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK TRAN;
    THROW;
END CATCH;
