-- Unified Item Master — Phase 1: canonical business item classification.
--
-- ADDITIVE ONLY. Adds one nullable column to dbo.products, backfills ONLY rows
-- whose role is proven by authoritative relationships, enforces the six-value
-- vocabulary with a trusted SQL CHECK constraint, and adds one index for the new
-- server-side list / F9 filter. No row, identity, stock, movement, SparePart or
-- historical migration is changed. Conflicting / unproven products stay NULL and
-- are shown as "غير مصنف" until an authorized user classifies them.
--
-- SQL Server compiles a whole batch before executing it, so every statement that
-- references the new column runs in a later EXEC sp_executesql batch.

BEGIN TRY
BEGIN TRAN;

-- 1. Nullable structural column (Prisma String? -> NVARCHAR(1000) on SQL Server).
IF COL_LENGTH('dbo.products', 'itemType') IS NULL
  ALTER TABLE [dbo].[products] ADD [itemType] NVARCHAR(1000) NULL;

-- 2. Evidence-based backfill. A product with more than one incompatible evidence
--    family is deliberately left NULL (CONFLICT_REQUIRES_REVIEW in the report).
EXEC sp_executesql N'
WITH evidence AS (
  SELECT p.id,
    CASE WHEN EXISTS (SELECT 1 FROM dbo.spare_parts sp WHERE sp.productId = p.id AND sp.deletedAt IS NULL) THEN 1 ELSE 0 END AS f_sp,
    CASE WHEN EXISTS (SELECT 1 FROM dbo.production_product_definitions d WHERE d.productId = p.id AND d.deletedAt IS NULL) THEN 1 ELSE 0 END AS f_fgdef,
    CASE WHEN EXISTS (
      SELECT 1 FROM dbo.production_finished_goods_receipt_lines l
      JOIN dbo.production_finished_goods_receipts r ON r.id = l.receiptId
      WHERE l.productId = p.id AND r.status = N''POSTED'') THEN 1 ELSE 0 END AS f_fgrcpt,
    CASE WHEN EXISTS (SELECT 1 FROM dbo.production_material_requirement_lines l WHERE l.productId = p.id AND l.componentRole = N''RAW_MATERIAL'') THEN 1 ELSE 0 END AS f_rawreq,
    CASE WHEN EXISTS (SELECT 1 FROM dbo.production_material_requirement_lines l WHERE l.productId = p.id AND l.componentRole = N''PACKAGING'') THEN 1 ELSE 0 END AS f_packreq,
    CASE WHEN EXISTS (SELECT 1 FROM dbo.production_material_document_lines l WHERE l.productId = p.id) THEN 1 ELSE 0 END AS f_matdoc,
    CASE WHEN EXISTS (SELECT 1 FROM dbo.production_material_consumptions c WHERE c.productId = p.id) THEN 1 ELSE 0 END AS f_matcons
  FROM dbo.products p
), classified AS (
  SELECT id,
    CASE
      WHEN (CASE WHEN f_sp > 0 THEN 1 ELSE 0 END)
         + (CASE WHEN f_fgdef + f_fgrcpt > 0 THEN 1 ELSE 0 END)
         + (CASE WHEN f_rawreq + f_matdoc + f_matcons > 0 THEN 1 ELSE 0 END)
         + (CASE WHEN f_packreq > 0 THEN 1 ELSE 0 END) > 1 THEN NULL
      WHEN f_sp = 1 THEN N''SPARE_PART''
      WHEN f_fgdef + f_fgrcpt > 0 THEN N''FINISHED_GOOD''
      WHEN f_rawreq + f_matdoc + f_matcons > 0 THEN N''RAW_MATERIAL''
      WHEN f_packreq > 0 THEN N''PACKAGING_MATERIAL''
      ELSE NULL
    END AS target
  FROM evidence
)
UPDATE p
  SET itemType = c.target
FROM dbo.products p
JOIN classified c ON c.id = p.id
WHERE c.target IS NOT NULL
  AND (p.itemType IS NULL OR p.itemType <> c.target);
';

-- 3. Trusted CHECK constraint for the canonical vocabulary.
EXEC sp_executesql N'
IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = N''products_item_type_ck'' AND parent_object_id = OBJECT_ID(N''dbo.products''))
  ALTER TABLE [dbo].[products] WITH CHECK ADD CONSTRAINT [products_item_type_ck]
    CHECK ([itemType] IS NULL OR [itemType] IN (
      N''RAW_MATERIAL'', N''FINISHED_GOOD'', N''SPARE_PART'',
      N''PACKAGING_MATERIAL'', N''CONSUMABLE'', N''GENERAL''));
IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = N''products_item_type_ck'' AND parent_object_id = OBJECT_ID(N''dbo.products''))
  ALTER TABLE [dbo].[products] CHECK CONSTRAINT [products_item_type_ck];
';

-- 4. Index for the real server-side filter path (items grid + F9 product lookup).
EXEC sp_executesql N'
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N''products_itemType_idx'' AND object_id = OBJECT_ID(N''dbo.products''))
  CREATE NONCLUSTERED INDEX [products_itemType_idx] ON [dbo].[products]([itemType]);
';

COMMIT TRAN;
END TRY
BEGIN CATCH
  IF @@TRANCOUNT > 0 ROLLBACK TRAN;
  THROW;
END CATCH;
