-- Global canonical Unit / Unit-of-Measure master (ERP-wide reference data).
-- PHASED, NON-DESTRUCTIVE: creates the master, adds NULLABLE unitId FKs, seeds the
-- canonical unit set, and backfills unitId ONLY for values whose meaning is proven.
-- Legacy text `unit` columns are preserved. No NOT NULL, no column drop. Reversible.

BEGIN TRY

BEGIN TRAN;

-- AlterTable
ALTER TABLE [dbo].[products] ADD [unitId] NVARCHAR(1000);

-- AlterTable
ALTER TABLE [dbo].[machine_parts] ADD [unitId] NVARCHAR(1000);

-- AlterTable
ALTER TABLE [dbo].[spare_parts] ADD [unitId] NVARCHAR(1000);

-- CreateTable
CREATE TABLE [dbo].[units] (
    [id] NVARCHAR(1000) NOT NULL,
    [code] NVARCHAR(1000) NOT NULL,
    [nameAr] NVARCHAR(1000) NOT NULL,
    [nameEn] NVARCHAR(1000) NOT NULL,
    [symbol] NVARCHAR(1000),
    [isActive] BIT NOT NULL CONSTRAINT [units_isActive_df] DEFAULT 1,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [units_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [units_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [units_code_key] UNIQUE NONCLUSTERED ([code])
);

-- CreateIndex
CREATE NONCLUSTERED INDEX [units_isActive_idx] ON [dbo].[units]([isActive]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [products_unitId_idx] ON [dbo].[products]([unitId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [machine_parts_unitId_idx] ON [dbo].[machine_parts]([unitId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [spare_parts_unitId_idx] ON [dbo].[spare_parts]([unitId]);

-- AddForeignKey
ALTER TABLE [dbo].[products] ADD CONSTRAINT [products_unitId_fkey] FOREIGN KEY ([unitId]) REFERENCES [dbo].[units]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[machine_parts] ADD CONSTRAINT [machine_parts_unitId_fkey] FOREIGN KEY ([unitId]) REFERENCES [dbo].[units]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[spare_parts] ADD CONSTRAINT [spare_parts_unitId_fkey] FOREIGN KEY ([unitId]) REFERENCES [dbo].[units]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- Seed canonical unit set (idempotent by code).
INSERT INTO [dbo].[units] ([id], [code], [nameAr], [nameEn], [symbol], [isActive], [createdAt], [updatedAt])
SELECT v.[id], v.[code], v.[nameAr], v.[nameEn], v.[symbol], 1, SYSUTCDATETIME(), SYSUTCDATETIME()
FROM (VALUES
    ('unit-pcs',  'PCS',  N'قطعة',     N'Piece',      'pc'),
    ('unit-kg',   'KG',   N'كيلوجرام', N'Kilogram',   'kg'),
    ('unit-g',    'G',    N'جرام',     N'Gram',       'g'),
    ('unit-l',    'L',    N'لتر',      N'Liter',      'L'),
    ('unit-ml',   'ML',   N'مليلتر',   N'Milliliter', 'mL'),
    ('unit-m',    'M',    N'متر',      N'Meter',      'm'),
    ('unit-cm',   'CM',   N'سنتيمتر',  N'Centimeter', 'cm'),
    ('unit-mm',   'MM',   N'مليمتر',   N'Millimeter', 'mm'),
    ('unit-set',  'SET',  N'طقم',      N'Set',        'set'),
    ('unit-box',  'BOX',  N'علبة',     N'Box',        'box'),
    ('unit-roll', 'ROLL', N'لفة',      N'Roll',       'roll')
) AS v([id], [code], [nameAr], [nameEn], [symbol])
WHERE NOT EXISTS (SELECT 1 FROM [dbo].[units] u WHERE u.[code] = v.[code]);

-- Backfill unitId ONLY where the existing text proves PCS (piece): pcs / EA / قطعة.
-- Empty and ambiguous values (e.g. 'UNIT') are intentionally left NULL.
--
-- These UPDATEs reference [unitId], a column added by ALTER TABLE in this same file.
-- SQL Server compiles a batch as a whole, and Prisma sends migration.sql as one batch
-- (it does not honor GO), so a direct UPDATE would fail compile-time validation with
-- "Invalid column name". Deferring each statement through sys.sp_executesql recompiles
-- it at runtime, after the ALTER has executed.
EXEC sys.sp_executesql N'UPDATE [dbo].[products] SET [unitId] = ''unit-pcs'' WHERE [unitId] IS NULL AND LOWER(LTRIM(RTRIM([unit]))) IN (''pcs'', ''ea'', N''قطعة'')';

EXEC sys.sp_executesql N'UPDATE [dbo].[spare_parts] SET [unitId] = ''unit-pcs'' WHERE [unitId] IS NULL AND LOWER(LTRIM(RTRIM([unit]))) IN (''pcs'', ''ea'', N''قطعة'')';

EXEC sys.sp_executesql N'UPDATE [dbo].[machine_parts] SET [unitId] = ''unit-pcs'' WHERE [unitId] IS NULL AND LOWER(LTRIM(RTRIM([unit]))) IN (''pcs'', ''ea'', N''قطعة'')';

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
