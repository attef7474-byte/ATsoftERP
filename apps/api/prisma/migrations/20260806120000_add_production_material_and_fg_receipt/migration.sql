BEGIN TRY

BEGIN TRAN;

-- Phase 1.7 — Material Consumption and Finished-Goods Receipt
-- Additive, data-preserving migration:
--   1. Add Decimal shadow `quantityBase` + traceability dimensions to inventory_movement_lines.
--   2. Add Decimal shadow `quantityBase` to inventory_balances and backfill from `quantity`.
--   3. Add a location-aware index on inventory_balances (the legacy unique key omits location;
--      the verification/reconciliation step corrects the unique constraint in a separate task).
--   4. Create production material document and finished-goods receipt tables.
-- No existing constraint, column, or row is altered or removed.

-- AlterTable
ALTER TABLE [dbo].[inventory_movement_lines] ADD [quantityBase] DECIMAL(18,4),
[batchNumber] NVARCHAR(1000),
[serialNumber] NVARCHAR(1000),
[expiryDate] DATETIME2;

-- AlterTable
ALTER TABLE [dbo].[inventory_balances] ADD [quantityBase] DECIMAL(18,4);

-- Backfill the Decimal shadow from the legacy Float quantity (dual-compatible precision conversion).
UPDATE [dbo].[inventory_balances] SET [quantityBase] = [quantity] WHERE [quantityBase] IS NULL;

-- CreateIndex (location-aware lookup support until the unique key is corrected)
CREATE NONCLUSTERED INDEX [inventory_balances_warehouseId_productId_locationId_batchNumber_serialNumber_idx] ON [dbo].[inventory_balances]([warehouseId], [productId], [locationId], [batchNumber], [serialNumber]);

-- CreateTable
CREATE TABLE [dbo].[production_material_documents] (
    [id] NVARCHAR(1000) NOT NULL,
    [companyId] NVARCHAR(1000) NOT NULL,
    [branchId] NVARCHAR(1000) NOT NULL,
    [documentNumber] NVARCHAR(1000) NOT NULL,
    [productionOrderId] NVARCHAR(1000) NOT NULL,
    [productionRunId] NVARCHAR(1000) NOT NULL,
    [documentType] NVARCHAR(1000) NOT NULL,
    [issueWarehouseId] NVARCHAR(1000),
    [status] NVARCHAR(1000) NOT NULL CONSTRAINT [production_material_documents_status_df] DEFAULT 'DRAFT',
    [movementId] NVARCHAR(1000),
    [movementNumber] NVARCHAR(1000),
    [sourceType] NVARCHAR(1000) NOT NULL CONSTRAINT [production_material_documents_sourceType_df] DEFAULT 'MANUAL',
    [requestId] NVARCHAR(1000),
    [notes] NVARCHAR(1000),
    [documentDate] DATETIME2 NOT NULL CONSTRAINT [production_material_documents_documentDate_df] DEFAULT CURRENT_TIMESTAMP,
    [postedAt] DATETIME2,
    [cancelledAt] DATETIME2,
    [createdById] NVARCHAR(1000) NOT NULL,
    [postedById] NVARCHAR(1000),
    [cancelledById] NVARCHAR(1000),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [production_material_documents_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [production_material_documents_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [production_material_documents_companyId_branchId_documentNumber_key] UNIQUE NONCLUSTERED ([companyId],[branchId],[documentNumber]),
    CONSTRAINT [production_material_documents_companyId_branchId_movementId_key] UNIQUE NONCLUSTERED ([companyId],[branchId],[movementId]),
    CONSTRAINT [production_material_documents_companyId_branchId_requestId_key] UNIQUE NONCLUSTERED ([companyId],[branchId],[requestId])
);

-- CreateTable
CREATE TABLE [dbo].[production_material_document_lines] (
    [id] NVARCHAR(1000) NOT NULL,
    [companyId] NVARCHAR(1000) NOT NULL,
    [branchId] NVARCHAR(1000) NOT NULL,
    [documentId] NVARCHAR(1000) NOT NULL,
    [productId] NVARCHAR(1000) NOT NULL,
    [productCodeSnapshot] NVARCHAR(1000) NOT NULL,
    [productNameSnapshot] NVARCHAR(1000) NOT NULL,
    [productVersionLabelSnapshot] NVARCHAR(1000),
    [productPackagingLabelSnapshot] NVARCHAR(1000),
    [unit] NVARCHAR(1000) NOT NULL,
    [quantity] DECIMAL(18,4) NOT NULL,
    [substitutedProductId] NVARCHAR(1000),
    [substitutionReason] NVARCHAR(1000),
    [warehouseLocationId] NVARCHAR(1000),
    [batchNumber] NVARCHAR(1000),
    [serialNumber] NVARCHAR(1000),
    [expiryDate] DATETIME2,
    [lineNumber] INT NOT NULL CONSTRAINT [production_material_document_lines_lineNumber_df] DEFAULT 1,
    [notes] NVARCHAR(1000),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [production_material_document_lines_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [production_material_document_lines_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[production_finished_goods_receipts] (
    [id] NVARCHAR(1000) NOT NULL,
    [companyId] NVARCHAR(1000) NOT NULL,
    [branchId] NVARCHAR(1000) NOT NULL,
    [receiptNumber] NVARCHAR(1000) NOT NULL,
    [productionOrderId] NVARCHAR(1000) NOT NULL,
    [productionRunId] NVARCHAR(1000) NOT NULL,
    [receiptWarehouseId] NVARCHAR(1000),
    [status] NVARCHAR(1000) NOT NULL CONSTRAINT [production_finished_goods_receipts_status_df] DEFAULT 'DRAFT',
    [movementId] NVARCHAR(1000),
    [movementNumber] NVARCHAR(1000),
    [sourceType] NVARCHAR(1000) NOT NULL CONSTRAINT [production_finished_goods_receipts_sourceType_df] DEFAULT 'MANUAL',
    [requestId] NVARCHAR(1000),
    [notes] NVARCHAR(1000),
    [receiptDate] DATETIME2 NOT NULL CONSTRAINT [production_finished_goods_receipts_receiptDate_df] DEFAULT CURRENT_TIMESTAMP,
    [postedAt] DATETIME2,
    [cancelledAt] DATETIME2,
    [createdById] NVARCHAR(1000) NOT NULL,
    [postedById] NVARCHAR(1000),
    [cancelledById] NVARCHAR(1000),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [production_finished_goods_receipts_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [production_finished_goods_receipts_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [production_finished_goods_receipts_companyId_branchId_receiptNumber_key] UNIQUE NONCLUSTERED ([companyId],[branchId],[receiptNumber]),
    CONSTRAINT [production_finished_goods_receipts_companyId_branchId_movementId_key] UNIQUE NONCLUSTERED ([companyId],[branchId],[movementId]),
    CONSTRAINT [production_finished_goods_receipts_companyId_branchId_requestId_key] UNIQUE NONCLUSTERED ([companyId],[branchId],[requestId])
);

-- CreateTable
CREATE TABLE [dbo].[production_finished_goods_receipt_lines] (
    [id] NVARCHAR(1000) NOT NULL,
    [companyId] NVARCHAR(1000) NOT NULL,
    [branchId] NVARCHAR(1000) NOT NULL,
    [receiptId] NVARCHAR(1000) NOT NULL,
    [productId] NVARCHAR(1000) NOT NULL,
    [productCodeSnapshot] NVARCHAR(1000) NOT NULL,
    [productNameSnapshot] NVARCHAR(1000) NOT NULL,
    [productVersionLabelSnapshot] NVARCHAR(1000),
    [productPackagingLabelSnapshot] NVARCHAR(1000),
    [unit] NVARCHAR(1000) NOT NULL,
    [quantity] DECIMAL(18,4) NOT NULL,
    [warehouseLocationId] NVARCHAR(1000),
    [batchNumber] NVARCHAR(1000),
    [serialNumber] NVARCHAR(1000),
    [expiryDate] DATETIME2,
    [lineNumber] INT NOT NULL CONSTRAINT [production_finished_goods_receipt_lines_lineNumber_df] DEFAULT 1,
    [notes] NVARCHAR(1000),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [production_finished_goods_receipt_lines_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [production_finished_goods_receipt_lines_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateIndex
CREATE NONCLUSTERED INDEX [production_material_documents_companyId_branchId_documentType_status_idx] ON [dbo].[production_material_documents]([companyId], [branchId], [documentType], [status]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [production_material_documents_companyId_branchId_productionOrderId_idx] ON [dbo].[production_material_documents]([companyId], [branchId], [productionOrderId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [production_material_documents_companyId_branchId_productionRunId_documentDate_idx] ON [dbo].[production_material_documents]([companyId], [branchId], [productionRunId], [documentDate]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [production_material_documents_productionOrderId_idx] ON [dbo].[production_material_documents]([productionOrderId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [production_material_documents_productionRunId_idx] ON [dbo].[production_material_documents]([productionRunId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [production_material_documents_movementId_idx] ON [dbo].[production_material_documents]([movementId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [production_material_document_lines_documentId_idx] ON [dbo].[production_material_document_lines]([documentId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [production_material_document_lines_productId_idx] ON [dbo].[production_material_document_lines]([productId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [production_material_document_lines_warehouseLocationId_idx] ON [dbo].[production_material_document_lines]([warehouseLocationId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [production_material_document_lines_documentId_productId_idx] ON [dbo].[production_material_document_lines]([documentId], [productId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [production_finished_goods_receipts_companyId_branchId_status_idx] ON [dbo].[production_finished_goods_receipts]([companyId], [branchId], [status]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [production_finished_goods_receipts_companyId_branchId_productionOrderId_idx] ON [dbo].[production_finished_goods_receipts]([companyId], [branchId], [productionOrderId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [production_finished_goods_receipts_companyId_branchId_productionRunId_receiptDate_idx] ON [dbo].[production_finished_goods_receipts]([companyId], [branchId], [productionRunId], [receiptDate]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [production_finished_goods_receipts_productionOrderId_idx] ON [dbo].[production_finished_goods_receipts]([productionOrderId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [production_finished_goods_receipts_productionRunId_idx] ON [dbo].[production_finished_goods_receipts]([productionRunId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [production_finished_goods_receipts_movementId_idx] ON [dbo].[production_finished_goods_receipts]([movementId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [production_finished_goods_receipt_lines_receiptId_idx] ON [dbo].[production_finished_goods_receipt_lines]([receiptId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [production_finished_goods_receipt_lines_productId_idx] ON [dbo].[production_finished_goods_receipt_lines]([productId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [production_finished_goods_receipt_lines_warehouseLocationId_idx] ON [dbo].[production_finished_goods_receipt_lines]([warehouseLocationId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [production_finished_goods_receipt_lines_receiptId_productId_idx] ON [dbo].[production_finished_goods_receipt_lines]([receiptId], [productId]);

-- AddForeignKey
ALTER TABLE [dbo].[production_material_documents] ADD CONSTRAINT [production_material_documents_companyId_fkey] FOREIGN KEY ([companyId]) REFERENCES [dbo].[companies]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[production_material_documents] ADD CONSTRAINT [production_material_documents_branchId_fkey] FOREIGN KEY ([branchId]) REFERENCES [dbo].[branches]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[production_material_documents] ADD CONSTRAINT [production_material_documents_productionOrderId_fkey] FOREIGN KEY ([productionOrderId]) REFERENCES [dbo].[production_orders]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[production_material_documents] ADD CONSTRAINT [production_material_documents_productionRunId_fkey] FOREIGN KEY ([productionRunId]) REFERENCES [dbo].[production_runs]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[production_material_documents] ADD CONSTRAINT [production_material_documents_issueWarehouseId_fkey] FOREIGN KEY ([issueWarehouseId]) REFERENCES [dbo].[warehouses]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[production_material_documents] ADD CONSTRAINT [production_material_documents_movementId_fkey] FOREIGN KEY ([movementId]) REFERENCES [dbo].[inventory_movements]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[production_material_document_lines] ADD CONSTRAINT [production_material_document_lines_companyId_fkey] FOREIGN KEY ([companyId]) REFERENCES [dbo].[companies]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[production_material_document_lines] ADD CONSTRAINT [production_material_document_lines_branchId_fkey] FOREIGN KEY ([branchId]) REFERENCES [dbo].[branches]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[production_material_document_lines] ADD CONSTRAINT [production_material_document_lines_documentId_fkey] FOREIGN KEY ([documentId]) REFERENCES [dbo].[production_material_documents]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[production_material_document_lines] ADD CONSTRAINT [production_material_document_lines_productId_fkey] FOREIGN KEY ([productId]) REFERENCES [dbo].[products]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[production_material_document_lines] ADD CONSTRAINT [production_material_document_lines_substitutedProductId_fkey] FOREIGN KEY ([substitutedProductId]) REFERENCES [dbo].[products]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[production_material_document_lines] ADD CONSTRAINT [production_material_document_lines_warehouseLocationId_fkey] FOREIGN KEY ([warehouseLocationId]) REFERENCES [dbo].[warehouse_locations]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[production_finished_goods_receipts] ADD CONSTRAINT [production_finished_goods_receipts_companyId_fkey] FOREIGN KEY ([companyId]) REFERENCES [dbo].[companies]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[production_finished_goods_receipts] ADD CONSTRAINT [production_finished_goods_receipts_branchId_fkey] FOREIGN KEY ([branchId]) REFERENCES [dbo].[branches]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[production_finished_goods_receipts] ADD CONSTRAINT [production_finished_goods_receipts_productionOrderId_fkey] FOREIGN KEY ([productionOrderId]) REFERENCES [dbo].[production_orders]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[production_finished_goods_receipts] ADD CONSTRAINT [production_finished_goods_receipts_productionRunId_fkey] FOREIGN KEY ([productionRunId]) REFERENCES [dbo].[production_runs]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[production_finished_goods_receipts] ADD CONSTRAINT [production_finished_goods_receipts_receiptWarehouseId_fkey] FOREIGN KEY ([receiptWarehouseId]) REFERENCES [dbo].[warehouses]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[production_finished_goods_receipts] ADD CONSTRAINT [production_finished_goods_receipts_movementId_fkey] FOREIGN KEY ([movementId]) REFERENCES [dbo].[inventory_movements]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[production_finished_goods_receipt_lines] ADD CONSTRAINT [production_finished_goods_receipt_lines_companyId_fkey] FOREIGN KEY ([companyId]) REFERENCES [dbo].[companies]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[production_finished_goods_receipt_lines] ADD CONSTRAINT [production_finished_goods_receipt_lines_branchId_fkey] FOREIGN KEY ([branchId]) REFERENCES [dbo].[branches]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[production_finished_goods_receipt_lines] ADD CONSTRAINT [production_finished_goods_receipt_lines_receiptId_fkey] FOREIGN KEY ([receiptId]) REFERENCES [dbo].[production_finished_goods_receipts]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[production_finished_goods_receipt_lines] ADD CONSTRAINT [production_finished_goods_receipt_lines_productId_fkey] FOREIGN KEY ([productId]) REFERENCES [dbo].[products]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[production_finished_goods_receipt_lines] ADD CONSTRAINT [production_finished_goods_receipt_lines_warehouseLocationId_fkey] FOREIGN KEY ([warehouseLocationId]) REFERENCES [dbo].[warehouse_locations]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- =====================================================================
-- Phase 1.7 closure — Material Requirements snapshot, Consumption facts,
-- and traceability linkage columns. Additive, data-preserving.
-- =====================================================================

-- AlterTable (traceability / requirement linkage on material documents)
ALTER TABLE [dbo].[production_material_documents] ADD [requirementId] NVARCHAR(1000);

-- AlterTable (material document lines: requirement, return-reference, loss link)
ALTER TABLE [dbo].[production_material_document_lines] ADD [requirementLineId] NVARCHAR(1000),
[originalIssueLineId] NVARCHAR(1000),
[lossQuantityEventId] NVARCHAR(1000);

-- CreateTable
CREATE TABLE [dbo].[production_material_requirements] (
    [id] NVARCHAR(1000) NOT NULL,
    [companyId] NVARCHAR(1000) NOT NULL,
    [branchId] NVARCHAR(1000) NOT NULL,
    [productionOrderId] NVARCHAR(1000) NOT NULL,
    [revision] INT NOT NULL CONSTRAINT [production_material_requirements_revision_df] DEFAULT 1,
    [status] NVARCHAR(1000) NOT NULL CONSTRAINT [production_material_requirements_status_df] DEFAULT 'DRAFT',
    [sourceType] NVARCHAR(1000) NOT NULL CONSTRAINT [production_material_requirements_sourceType_df] DEFAULT 'MANUAL',
    [productDefinitionCodeSnapshot] NVARCHAR(1000),
    [productDefinitionNameSnapshot] NVARCHAR(1000),
    [productVersionLabelSnapshot] NVARCHAR(1000),
    [productPackagingLabelSnapshot] NVARCHAR(1000),
    [notes] NVARCHAR(1000),
    [preparedById] NVARCHAR(1000) NOT NULL,
    [preparedAt] DATETIME2 NOT NULL CONSTRAINT [production_material_requirements_preparedAt_df] DEFAULT CURRENT_TIMESTAMP,
    [frozenById] NVARCHAR(1000),
    [frozenAt] DATETIME2,
    [requestId] NVARCHAR(1000),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [production_material_requirements_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [production_material_requirements_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [production_material_requirements_companyId_branchId_productionOrderId_revision_key] UNIQUE NONCLUSTERED ([companyId],[branchId],[productionOrderId],[revision]),
    CONSTRAINT [production_material_requirements_companyId_branchId_requestId_key] UNIQUE NONCLUSTERED ([companyId],[branchId],[requestId])
);

-- CreateTable
CREATE TABLE [dbo].[production_material_requirement_lines] (
    [id] NVARCHAR(1000) NOT NULL,
    [companyId] NVARCHAR(1000) NOT NULL,
    [branchId] NVARCHAR(1000) NOT NULL,
    [requirementId] NVARCHAR(1000) NOT NULL,
    [lineNumber] INT NOT NULL,
    [productId] NVARCHAR(1000) NOT NULL,
    [productCodeSnapshot] NVARCHAR(1000) NOT NULL,
    [productNameSnapshot] NVARCHAR(1000) NOT NULL,
    [componentRole] NVARCHAR(1000) NOT NULL CONSTRAINT [production_material_requirement_lines_componentRole_df] DEFAULT 'RAW_MATERIAL',
    [plannedQuantityPerUnit] DECIMAL(18,4) NOT NULL,
    [plannedQuantity] DECIMAL(18,4) NOT NULL,
    [baseUnit] NVARCHAR(1000) NOT NULL,
    [issueUnit] NVARCHAR(1000) NOT NULL,
    [conversionFactor] DECIMAL(18,4) NOT NULL CONSTRAINT [production_material_requirement_lines_conversionFactor_df] DEFAULT 1,
    [warehouseId] NVARCHAR(1000),
    [productionStage] NVARCHAR(1000),
    [lotControlRequired] BIT NOT NULL CONSTRAINT [production_material_requirement_lines_lotControlRequired_df] DEFAULT 0,
    [overIssuePolicy] NVARCHAR(1000) NOT NULL CONSTRAINT [production_material_requirement_lines_overIssuePolicy_df] DEFAULT 'NOT_ALLOWED',
    [tolerancePercent] DECIMAL(7,4),
    [notes] NVARCHAR(1000),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [production_material_requirement_lines_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [production_material_requirement_lines_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[production_material_consumptions] (
    [id] NVARCHAR(1000) NOT NULL,
    [companyId] NVARCHAR(1000) NOT NULL,
    [branchId] NVARCHAR(1000) NOT NULL,
    [productionOrderId] NVARCHAR(1000) NOT NULL,
    [productionRunId] NVARCHAR(1000),
    [requirementId] NVARCHAR(1000),
    [requirementLineId] NVARCHAR(1000),
    [productId] NVARCHAR(1000) NOT NULL,
    [productCodeSnapshot] NVARCHAR(1000) NOT NULL,
    [productNameSnapshot] NVARCHAR(1000) NOT NULL,
    [unit] NVARCHAR(1000) NOT NULL,
    [quantity] DECIMAL(18,4) NOT NULL,
    [method] NVARCHAR(1000) NOT NULL CONSTRAINT [production_material_consumptions_method_df] DEFAULT 'EXPLICIT',
    [sourceType] NVARCHAR(1000) NOT NULL CONSTRAINT [production_material_consumptions_sourceType_df] DEFAULT 'MANUAL',
    [sourceDocumentId] NVARCHAR(1000),
    [sourceDocumentNumber] NVARCHAR(1000),
    [sourceDocumentType] NVARCHAR(1000),
    [recordedById] NVARCHAR(1000) NOT NULL,
    [recordedAt] DATETIME2 NOT NULL CONSTRAINT [production_material_consumptions_recordedAt_df] DEFAULT CURRENT_TIMESTAMP,
    [requestId] NVARCHAR(1000) NOT NULL,
    [notes] NVARCHAR(1000),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [production_material_consumptions_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [production_material_consumptions_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [production_material_consumptions_companyId_branchId_requestId_key] UNIQUE NONCLUSTERED ([companyId],[branchId],[requestId])
);

-- CreateTable
CREATE TABLE [dbo].[production_material_consumption_corrections] (
    [id] NVARCHAR(1000) NOT NULL,
    [companyId] NVARCHAR(1000) NOT NULL,
    [branchId] NVARCHAR(1000) NOT NULL,
    [consumptionId] NVARCHAR(1000) NOT NULL,
    [previousQuantity] DECIMAL(18,4) NOT NULL,
    [newQuantity] DECIMAL(18,4) NOT NULL,
    [reason] NVARCHAR(1000) NOT NULL,
    [correctedById] NVARCHAR(1000) NOT NULL,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [production_material_consumption_corrections_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [production_material_consumption_corrections_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateIndex
CREATE NONCLUSTERED INDEX [production_material_documents_companyId_branchId_requirementId_idx] ON [dbo].[production_material_documents]([companyId], [branchId], [requirementId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [production_material_document_lines_requirementLineId_idx] ON [dbo].[production_material_document_lines]([requirementLineId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [production_material_document_lines_originalIssueLineId_idx] ON [dbo].[production_material_document_lines]([originalIssueLineId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [production_material_document_lines_lossQuantityEventId_idx] ON [dbo].[production_material_document_lines]([lossQuantityEventId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [production_material_requirements_companyId_branchId_productionOrderId_status_idx] ON [dbo].[production_material_requirements]([companyId], [branchId], [productionOrderId], [status]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [production_material_requirements_productionOrderId_idx] ON [dbo].[production_material_requirements]([productionOrderId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [production_material_requirement_lines_requirementId_idx] ON [dbo].[production_material_requirement_lines]([requirementId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [production_material_requirement_lines_productId_idx] ON [dbo].[production_material_requirement_lines]([productId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [production_material_requirement_lines_requirementId_productId_idx] ON [dbo].[production_material_requirement_lines]([requirementId], [productId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [production_material_consumptions_companyId_branchId_productionOrderId_idx] ON [dbo].[production_material_consumptions]([companyId], [branchId], [productionOrderId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [production_material_consumptions_companyId_branchId_productionRunId_idx] ON [dbo].[production_material_consumptions]([companyId], [branchId], [productionRunId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [production_material_consumptions_requirementLineId_idx] ON [dbo].[production_material_consumptions]([requirementLineId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [production_material_consumption_corrections_consumptionId_idx] ON [dbo].[production_material_consumption_corrections]([consumptionId]);

-- AddForeignKey
ALTER TABLE [dbo].[production_material_requirements] ADD CONSTRAINT [production_material_requirements_companyId_fkey] FOREIGN KEY ([companyId]) REFERENCES [dbo].[companies]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[production_material_requirements] ADD CONSTRAINT [production_material_requirements_branchId_fkey] FOREIGN KEY ([branchId]) REFERENCES [dbo].[branches]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[production_material_requirements] ADD CONSTRAINT [production_material_requirements_productionOrderId_fkey] FOREIGN KEY ([productionOrderId]) REFERENCES [dbo].[production_orders]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[production_material_requirement_lines] ADD CONSTRAINT [production_material_requirement_lines_companyId_fkey] FOREIGN KEY ([companyId]) REFERENCES [dbo].[companies]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[production_material_requirement_lines] ADD CONSTRAINT [production_material_requirement_lines_branchId_fkey] FOREIGN KEY ([branchId]) REFERENCES [dbo].[branches]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[production_material_requirement_lines] ADD CONSTRAINT [production_material_requirement_lines_requirementId_fkey] FOREIGN KEY ([requirementId]) REFERENCES [dbo].[production_material_requirements]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[production_material_requirement_lines] ADD CONSTRAINT [production_material_requirement_lines_productId_fkey] FOREIGN KEY ([productId]) REFERENCES [dbo].[products]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[production_material_requirement_lines] ADD CONSTRAINT [production_material_requirement_lines_warehouseId_fkey] FOREIGN KEY ([warehouseId]) REFERENCES [dbo].[warehouses]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[production_material_consumptions] ADD CONSTRAINT [production_material_consumptions_companyId_fkey] FOREIGN KEY ([companyId]) REFERENCES [dbo].[companies]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[production_material_consumptions] ADD CONSTRAINT [production_material_consumptions_branchId_fkey] FOREIGN KEY ([branchId]) REFERENCES [dbo].[branches]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[production_material_consumptions] ADD CONSTRAINT [production_material_consumptions_productionOrderId_fkey] FOREIGN KEY ([productionOrderId]) REFERENCES [dbo].[production_orders]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[production_material_consumptions] ADD CONSTRAINT [production_material_consumptions_productionRunId_fkey] FOREIGN KEY ([productionRunId]) REFERENCES [dbo].[production_runs]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[production_material_consumptions] ADD CONSTRAINT [production_material_consumptions_requirementId_fkey] FOREIGN KEY ([requirementId]) REFERENCES [dbo].[production_material_requirements]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[production_material_consumptions] ADD CONSTRAINT [production_material_consumptions_requirementLineId_fkey] FOREIGN KEY ([requirementLineId]) REFERENCES [dbo].[production_material_requirement_lines]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[production_material_consumptions] ADD CONSTRAINT [production_material_consumptions_productId_fkey] FOREIGN KEY ([productId]) REFERENCES [dbo].[products]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[production_material_consumption_corrections] ADD CONSTRAINT [production_material_consumption_corrections_companyId_fkey] FOREIGN KEY ([companyId]) REFERENCES [dbo].[companies]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[production_material_consumption_corrections] ADD CONSTRAINT [production_material_consumption_corrections_branchId_fkey] FOREIGN KEY ([branchId]) REFERENCES [dbo].[branches]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[production_material_consumption_corrections] ADD CONSTRAINT [production_material_consumption_corrections_consumptionId_fkey] FOREIGN KEY ([consumptionId]) REFERENCES [dbo].[production_material_consumptions]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[production_material_documents] ADD CONSTRAINT [production_material_documents_requirementId_fkey] FOREIGN KEY ([requirementId]) REFERENCES [dbo].[production_material_requirements]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[production_material_document_lines] ADD CONSTRAINT [production_material_document_lines_requirementLineId_fkey] FOREIGN KEY ([requirementLineId]) REFERENCES [dbo].[production_material_requirement_lines]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[production_material_document_lines] ADD CONSTRAINT [production_material_document_lines_originalIssueLineId_fkey] FOREIGN KEY ([originalIssueLineId]) REFERENCES [dbo].[production_material_document_lines]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[production_material_document_lines] ADD CONSTRAINT [production_material_document_lines_lossQuantityEventId_fkey] FOREIGN KEY ([lossQuantityEventId]) REFERENCES [dbo].[production_loss_quantity_events]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
