SET ANSI_NULLS ON;
SET ANSI_PADDING ON;
SET ANSI_WARNINGS ON;
SET ARITHABORT ON;
SET CONCAT_NULL_YIELDS_NULL ON;
SET QUOTED_IDENTIFIER ON;
SET NUMERIC_ROUNDABORT OFF;

BEGIN TRY
BEGIN TRAN;

-- ============================================================================
-- Phase 1.1 (Master Plan): Production Master Data slice.
-- New additive tables:
--   1. `production_units`                    - configurable production units.
--   2. `production_product_definitions`      - production product definitions
--                                              (link to global inventory products).
--   3. `production_specifications`           - attribute/specification lines.
--   4. `production_versions`                 - version lines.
--   5. `production_packagings`               - packaging definition lines.
--   6. `production_eligibilities`            - machine/line eligibility lines.
-- 100% additive: new tables plus indexes. No existing column is altered,
-- renamed, or dropped.
--
-- Existing-data impact: none (new tables only).
-- Tenant impact: tenant-owned tables are scoped by companyId + branchId columns
-- (enforced in the service layer). Child tables inherit tenant scope through
-- their parent definition (validated in the service layer).
-- Referential targets: companies, branches, products, machines, production_lines,
-- warehouses, cost_centers - all exist.
-- ============================================================================

IF OBJECT_ID(N'[dbo].[production_units]', N'U') IS NULL
BEGIN
  CREATE TABLE [dbo].[production_units] (
    [id] NVARCHAR(1000) NOT NULL,
    [code] NVARCHAR(1000) NOT NULL,
    [name] NVARCHAR(1000) NOT NULL,
    [abbreviation] NVARCHAR(1000) NULL,
    [description] NVARCHAR(1000) NULL,
    [decimals] INT NOT NULL
      CONSTRAINT [production_units_decimals_df] DEFAULT 2,
    [companyId] NVARCHAR(1000) NOT NULL,
    [branchId] NVARCHAR(1000) NOT NULL,
    [status] NVARCHAR(1000) NOT NULL
      CONSTRAINT [production_units_status_df] DEFAULT N'ACTIVE',
    [createdAt] DATETIME2 NOT NULL
      CONSTRAINT [production_units_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    [deletedAt] DATETIME2 NULL,
    CONSTRAINT [production_units_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [production_units_companyId_branchId_code_key] UNIQUE NONCLUSTERED ([companyId], [branchId], [code]),
    CONSTRAINT [production_units_companyId_fkey]
      FOREIGN KEY ([companyId]) REFERENCES [dbo].[companies]([id])
      ON DELETE NO ACTION ON UPDATE NO ACTION,
    CONSTRAINT [production_units_branchId_fkey]
      FOREIGN KEY ([branchId]) REFERENCES [dbo].[branches]([id])
      ON DELETE NO ACTION ON UPDATE NO ACTION
  );
END;

IF OBJECT_ID(N'[dbo].[production_product_definitions]', N'U') IS NULL
BEGIN
  CREATE TABLE [dbo].[production_product_definitions] (
    [id] NVARCHAR(1000) NOT NULL,
    [code] NVARCHAR(1000) NOT NULL,
    [name] NVARCHAR(1000) NOT NULL,
    [description] NVARCHAR(1000) NULL,
    [productId] NVARCHAR(1000) NOT NULL,
    [defaultUnitId] NVARCHAR(1000) NULL,
    [defaultLineId] NVARCHAR(1000) NULL,
    [defaultWarehouseId] NVARCHAR(1000) NULL,
    [defaultCostCenterId] NVARCHAR(1000) NULL,
    [companyId] NVARCHAR(1000) NOT NULL,
    [branchId] NVARCHAR(1000) NOT NULL,
    [status] NVARCHAR(1000) NOT NULL
      CONSTRAINT [production_product_definitions_status_df] DEFAULT N'ACTIVE',
    [createdById] NVARCHAR(1000) NULL,
    [createdAt] DATETIME2 NOT NULL
      CONSTRAINT [production_product_definitions_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    [deletedAt] DATETIME2 NULL,
    CONSTRAINT [production_product_definitions_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [production_product_definitions_code_key] UNIQUE NONCLUSTERED ([code]),
    CONSTRAINT [production_product_definitions_productId_fkey]
      FOREIGN KEY ([productId]) REFERENCES [dbo].[products]([id])
      ON DELETE NO ACTION ON UPDATE NO ACTION,
    CONSTRAINT [production_product_definitions_defaultUnitId_fkey]
      FOREIGN KEY ([defaultUnitId]) REFERENCES [dbo].[production_units]([id])
      ON DELETE NO ACTION ON UPDATE NO ACTION,
    CONSTRAINT [production_product_definitions_defaultLineId_fkey]
      FOREIGN KEY ([defaultLineId]) REFERENCES [dbo].[production_lines]([id])
      ON DELETE NO ACTION ON UPDATE NO ACTION,
    CONSTRAINT [production_product_definitions_defaultWarehouseId_fkey]
      FOREIGN KEY ([defaultWarehouseId]) REFERENCES [dbo].[warehouses]([id])
      ON DELETE NO ACTION ON UPDATE NO ACTION,
    CONSTRAINT [production_product_definitions_defaultCostCenterId_fkey]
      FOREIGN KEY ([defaultCostCenterId]) REFERENCES [dbo].[cost_centers]([id])
      ON DELETE NO ACTION ON UPDATE NO ACTION,
    CONSTRAINT [production_product_definitions_companyId_fkey]
      FOREIGN KEY ([companyId]) REFERENCES [dbo].[companies]([id])
      ON DELETE NO ACTION ON UPDATE NO ACTION,
    CONSTRAINT [production_product_definitions_branchId_fkey]
      FOREIGN KEY ([branchId]) REFERENCES [dbo].[branches]([id])
      ON DELETE NO ACTION ON UPDATE NO ACTION
  );
END;

IF OBJECT_ID(N'[dbo].[production_specifications]', N'U') IS NULL
BEGIN
  CREATE TABLE [dbo].[production_specifications] (
    [id] NVARCHAR(1000) NOT NULL,
    [productionProductId] NVARCHAR(1000) NOT NULL,
    [attributeName] NVARCHAR(1000) NOT NULL,
    [attributeValue] NVARCHAR(1000) NOT NULL,
    [dataType] NVARCHAR(1000) NOT NULL
      CONSTRAINT [production_specifications_dataType_df] DEFAULT N'TEXT',
    [unitId] NVARCHAR(1000) NULL,
    [isRequired] BIT NOT NULL
      CONSTRAINT [production_specifications_isRequired_df] DEFAULT 0,
    [sortOrder] INT NOT NULL
      CONSTRAINT [production_specifications_sortOrder_df] DEFAULT 0,
    [status] NVARCHAR(1000) NOT NULL
      CONSTRAINT [production_specifications_status_df] DEFAULT N'ACTIVE',
    [createdAt] DATETIME2 NOT NULL
      CONSTRAINT [production_specifications_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [production_specifications_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [production_specifications_productionProductId_fkey]
      FOREIGN KEY ([productionProductId]) REFERENCES [dbo].[production_product_definitions]([id])
      ON DELETE NO ACTION ON UPDATE NO ACTION,
    CONSTRAINT [production_specifications_unitId_fkey]
      FOREIGN KEY ([unitId]) REFERENCES [dbo].[production_units]([id])
      ON DELETE NO ACTION ON UPDATE NO ACTION
  );
END;

IF OBJECT_ID(N'[dbo].[production_versions]', N'U') IS NULL
BEGIN
  CREATE TABLE [dbo].[production_versions] (
    [id] NVARCHAR(1000) NOT NULL,
    [productionProductId] NVARCHAR(1000) NOT NULL,
    [versionNumber] INT NOT NULL,
    [versionLabel] NVARCHAR(1000) NOT NULL,
    [description] NVARCHAR(1000) NULL,
    [isCurrent] BIT NOT NULL
      CONSTRAINT [production_versions_isCurrent_df] DEFAULT 0,
    [status] NVARCHAR(1000) NOT NULL
      CONSTRAINT [production_versions_status_df] DEFAULT N'ACTIVE',
    [createdById] NVARCHAR(1000) NULL,
    [createdAt] DATETIME2 NOT NULL
      CONSTRAINT [production_versions_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [production_versions_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [production_versions_productionProductId_versionNumber_key] UNIQUE NONCLUSTERED ([productionProductId], [versionNumber]),
    CONSTRAINT [production_versions_productionProductId_fkey]
      FOREIGN KEY ([productionProductId]) REFERENCES [dbo].[production_product_definitions]([id])
      ON DELETE NO ACTION ON UPDATE NO ACTION
  );
END;

IF OBJECT_ID(N'[dbo].[production_packagings]', N'U') IS NULL
BEGIN
  CREATE TABLE [dbo].[production_packagings] (
    [id] NVARCHAR(1000) NOT NULL,
    [productionProductId] NVARCHAR(1000) NOT NULL,
    [packagingType] NVARCHAR(1000) NOT NULL,
    [packQuantity] FLOAT NOT NULL,
    [unitId] NVARCHAR(1000) NULL,
    [grossWeight] FLOAT NULL,
    [netWeight] FLOAT NULL,
    [isDefault] BIT NOT NULL
      CONSTRAINT [production_packagings_isDefault_df] DEFAULT 0,
    [status] NVARCHAR(1000) NOT NULL
      CONSTRAINT [production_packagings_status_df] DEFAULT N'ACTIVE',
    [createdAt] DATETIME2 NOT NULL
      CONSTRAINT [production_packagings_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [production_packagings_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [production_packagings_productionProductId_fkey]
      FOREIGN KEY ([productionProductId]) REFERENCES [dbo].[production_product_definitions]([id])
      ON DELETE NO ACTION ON UPDATE NO ACTION,
    CONSTRAINT [production_packagings_unitId_fkey]
      FOREIGN KEY ([unitId]) REFERENCES [dbo].[production_units]([id])
      ON DELETE NO ACTION ON UPDATE NO ACTION
  );
END;

IF OBJECT_ID(N'[dbo].[production_eligibilities]', N'U') IS NULL
BEGIN
  CREATE TABLE [dbo].[production_eligibilities] (
    [id] NVARCHAR(1000) NOT NULL,
    [productionProductId] NVARCHAR(1000) NOT NULL,
    [resourceType] NVARCHAR(1000) NOT NULL,
    [machineId] NVARCHAR(1000) NULL,
    [productionLineId] NVARCHAR(1000) NULL,
    [priority] INT NOT NULL
      CONSTRAINT [production_eligibilities_priority_df] DEFAULT 0,
    [isDefault] BIT NOT NULL
      CONSTRAINT [production_eligibilities_isDefault_df] DEFAULT 0,
    [notes] NVARCHAR(1000) NULL,
    [status] NVARCHAR(1000) NOT NULL
      CONSTRAINT [production_eligibilities_status_df] DEFAULT N'ACTIVE',
    [createdAt] DATETIME2 NOT NULL
      CONSTRAINT [production_eligibilities_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [production_eligibilities_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [production_eligibilities_productionProductId_resourceType_machineId_key]
      UNIQUE NONCLUSTERED ([productionProductId], [resourceType], [machineId]),
    CONSTRAINT [production_eligibilities_productionProductId_resourceType_productionLineId_key]
      UNIQUE NONCLUSTERED ([productionProductId], [resourceType], [productionLineId]),
    CONSTRAINT [production_eligibilities_productionProductId_fkey]
      FOREIGN KEY ([productionProductId]) REFERENCES [dbo].[production_product_definitions]([id])
      ON DELETE NO ACTION ON UPDATE NO ACTION,
    CONSTRAINT [production_eligibilities_machineId_fkey]
      FOREIGN KEY ([machineId]) REFERENCES [dbo].[machines]([id])
      ON DELETE NO ACTION ON UPDATE NO ACTION,
    CONSTRAINT [production_eligibilities_productionLineId_fkey]
      FOREIGN KEY ([productionLineId]) REFERENCES [dbo].[production_lines]([id])
      ON DELETE NO ACTION ON UPDATE NO ACTION
  );
END;

-- production_units indexes
IF NOT EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE name = N'production_units_companyId_idx'
    AND object_id = OBJECT_ID(N'[dbo].[production_units]')
)
  CREATE NONCLUSTERED INDEX [production_units_companyId_idx]
    ON [dbo].[production_units]([companyId]);

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE name = N'production_units_branchId_idx'
    AND object_id = OBJECT_ID(N'[dbo].[production_units]')
)
  CREATE NONCLUSTERED INDEX [production_units_branchId_idx]
    ON [dbo].[production_units]([branchId]);

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE name = N'production_units_status_idx'
    AND object_id = OBJECT_ID(N'[dbo].[production_units]')
)
  CREATE NONCLUSTERED INDEX [production_units_status_idx]
    ON [dbo].[production_units]([status]);

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE name = N'production_units_companyId_branchId_status_idx'
    AND object_id = OBJECT_ID(N'[dbo].[production_units]')
)
  CREATE NONCLUSTERED INDEX [production_units_companyId_branchId_status_idx]
    ON [dbo].[production_units]([companyId], [branchId], [status]);

-- production_product_definitions indexes
IF NOT EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE name = N'production_product_definitions_code_idx'
    AND object_id = OBJECT_ID(N'[dbo].[production_product_definitions]')
)
  CREATE NONCLUSTERED INDEX [production_product_definitions_code_idx]
    ON [dbo].[production_product_definitions]([code]);

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE name = N'production_product_definitions_productId_idx'
    AND object_id = OBJECT_ID(N'[dbo].[production_product_definitions]')
)
  CREATE NONCLUSTERED INDEX [production_product_definitions_productId_idx]
    ON [dbo].[production_product_definitions]([productId]);

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE name = N'production_product_definitions_defaultUnitId_idx'
    AND object_id = OBJECT_ID(N'[dbo].[production_product_definitions]')
)
  CREATE NONCLUSTERED INDEX [production_product_definitions_defaultUnitId_idx]
    ON [dbo].[production_product_definitions]([defaultUnitId]);

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE name = N'production_product_definitions_defaultLineId_idx'
    AND object_id = OBJECT_ID(N'[dbo].[production_product_definitions]')
)
  CREATE NONCLUSTERED INDEX [production_product_definitions_defaultLineId_idx]
    ON [dbo].[production_product_definitions]([defaultLineId]);

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE name = N'production_product_definitions_defaultWarehouseId_idx'
    AND object_id = OBJECT_ID(N'[dbo].[production_product_definitions]')
)
  CREATE NONCLUSTERED INDEX [production_product_definitions_defaultWarehouseId_idx]
    ON [dbo].[production_product_definitions]([defaultWarehouseId]);

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE name = N'production_product_definitions_defaultCostCenterId_idx'
    AND object_id = OBJECT_ID(N'[dbo].[production_product_definitions]')
)
  CREATE NONCLUSTERED INDEX [production_product_definitions_defaultCostCenterId_idx]
    ON [dbo].[production_product_definitions]([defaultCostCenterId]);

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE name = N'production_product_definitions_companyId_idx'
    AND object_id = OBJECT_ID(N'[dbo].[production_product_definitions]')
)
  CREATE NONCLUSTERED INDEX [production_product_definitions_companyId_idx]
    ON [dbo].[production_product_definitions]([companyId]);

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE name = N'production_product_definitions_branchId_idx'
    AND object_id = OBJECT_ID(N'[dbo].[production_product_definitions]')
)
  CREATE NONCLUSTERED INDEX [production_product_definitions_branchId_idx]
    ON [dbo].[production_product_definitions]([branchId]);

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE name = N'production_product_definitions_status_idx'
    AND object_id = OBJECT_ID(N'[dbo].[production_product_definitions]')
)
  CREATE NONCLUSTERED INDEX [production_product_definitions_status_idx]
    ON [dbo].[production_product_definitions]([status]);

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE name = N'production_product_definitions_companyId_branchId_status_idx'
    AND object_id = OBJECT_ID(N'[dbo].[production_product_definitions]')
)
  CREATE NONCLUSTERED INDEX [production_product_definitions_companyId_branchId_status_idx]
    ON [dbo].[production_product_definitions]([companyId], [branchId], [status]);

-- production_specifications indexes
IF NOT EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE name = N'production_specifications_productionProductId_idx'
    AND object_id = OBJECT_ID(N'[dbo].[production_specifications]')
)
  CREATE NONCLUSTERED INDEX [production_specifications_productionProductId_idx]
    ON [dbo].[production_specifications]([productionProductId]);

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE name = N'production_specifications_unitId_idx'
    AND object_id = OBJECT_ID(N'[dbo].[production_specifications]')
)
  CREATE NONCLUSTERED INDEX [production_specifications_unitId_idx]
    ON [dbo].[production_specifications]([unitId]);

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE name = N'production_specifications_status_idx'
    AND object_id = OBJECT_ID(N'[dbo].[production_specifications]')
)
  CREATE NONCLUSTERED INDEX [production_specifications_status_idx]
    ON [dbo].[production_specifications]([status]);

-- production_versions indexes
IF NOT EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE name = N'production_versions_productionProductId_idx'
    AND object_id = OBJECT_ID(N'[dbo].[production_versions]')
)
  CREATE NONCLUSTERED INDEX [production_versions_productionProductId_idx]
    ON [dbo].[production_versions]([productionProductId]);

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE name = N'production_versions_status_idx'
    AND object_id = OBJECT_ID(N'[dbo].[production_versions]')
)
  CREATE NONCLUSTERED INDEX [production_versions_status_idx]
    ON [dbo].[production_versions]([status]);

-- production_packagings indexes
IF NOT EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE name = N'production_packagings_productionProductId_idx'
    AND object_id = OBJECT_ID(N'[dbo].[production_packagings]')
)
  CREATE NONCLUSTERED INDEX [production_packagings_productionProductId_idx]
    ON [dbo].[production_packagings]([productionProductId]);

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE name = N'production_packagings_unitId_idx'
    AND object_id = OBJECT_ID(N'[dbo].[production_packagings]')
)
  CREATE NONCLUSTERED INDEX [production_packagings_unitId_idx]
    ON [dbo].[production_packagings]([unitId]);

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE name = N'production_packagings_status_idx'
    AND object_id = OBJECT_ID(N'[dbo].[production_packagings]')
)
  CREATE NONCLUSTERED INDEX [production_packagings_status_idx]
    ON [dbo].[production_packagings]([status]);

-- production_eligibilities indexes
IF NOT EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE name = N'production_eligibilities_productionProductId_idx'
    AND object_id = OBJECT_ID(N'[dbo].[production_eligibilities]')
)
  CREATE NONCLUSTERED INDEX [production_eligibilities_productionProductId_idx]
    ON [dbo].[production_eligibilities]([productionProductId]);

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE name = N'production_eligibilities_machineId_idx'
    AND object_id = OBJECT_ID(N'[dbo].[production_eligibilities]')
)
  CREATE NONCLUSTERED INDEX [production_eligibilities_machineId_idx]
    ON [dbo].[production_eligibilities]([machineId]);

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE name = N'production_eligibilities_productionLineId_idx'
    AND object_id = OBJECT_ID(N'[dbo].[production_eligibilities]')
)
  CREATE NONCLUSTERED INDEX [production_eligibilities_productionLineId_idx]
    ON [dbo].[production_eligibilities]([productionLineId]);

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE name = N'production_eligibilities_resourceType_idx'
    AND object_id = OBJECT_ID(N'[dbo].[production_eligibilities]')
)
  CREATE NONCLUSTERED INDEX [production_eligibilities_resourceType_idx]
    ON [dbo].[production_eligibilities]([resourceType]);

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE name = N'production_eligibilities_status_idx'
    AND object_id = OBJECT_ID(N'[dbo].[production_eligibilities]')
)
  CREATE NONCLUSTERED INDEX [production_eligibilities_status_idx]
    ON [dbo].[production_eligibilities]([status]);

COMMIT;
END TRY
BEGIN CATCH
  IF @@TRANCOUNT > 0 ROLLBACK;
  THROW;
END CATCH;
