BEGIN TRY

BEGIN TRAN;

-- CreateTable
CREATE TABLE [dbo].[barcode_labels] (
    [id] NVARCHAR(1000) NOT NULL,
    [code] NVARCHAR(1000) NOT NULL,
    [value] NVARCHAR(1000) NOT NULL,
    [symbology] NVARCHAR(1000) NOT NULL CONSTRAINT [barcode_labels_symbology_df] DEFAULT 'QR_CODE',
    [entityType] NVARCHAR(1000) NOT NULL,
    [entityId] NVARCHAR(1000) NOT NULL,
    [status] NVARCHAR(1000) NOT NULL CONSTRAINT [barcode_labels_status_df] DEFAULT 'ACTIVE',
    [title] NVARCHAR(1000),
    [description] NVARCHAR(max),
    [qrPayload] NVARCHAR(max),
    [humanReadableValue] NVARCHAR(1000),
    [labelTemplateCode] NVARCHAR(1000),
    [printCount] INT NOT NULL CONSTRAINT [barcode_labels_printCount_df] DEFAULT 0,
    [lastPrintedAt] DATETIME2,
    [lastScannedAt] DATETIME2,
    [scanCount] INT NOT NULL CONSTRAINT [barcode_labels_scanCount_df] DEFAULT 0,
    [createdById] NVARCHAR(1000),
    [updatedById] NVARCHAR(1000),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [barcode_labels_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    [deletedAt] DATETIME2,
    CONSTRAINT [barcode_labels_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [barcode_labels_code_key] UNIQUE NONCLUSTERED ([code]),
    CONSTRAINT [barcode_labels_value_key] UNIQUE NONCLUSTERED ([value])
);

-- CreateTable
CREATE TABLE [dbo].[barcode_scan_events] (
    [id] NVARCHAR(1000) NOT NULL,
    [labelId] NVARCHAR(1000),
    [scannedValue] NVARCHAR(1000) NOT NULL,
    [symbology] NVARCHAR(1000),
    [purpose] NVARCHAR(1000) NOT NULL CONSTRAINT [barcode_scan_events_purpose_df] DEFAULT 'GENERAL_LOOKUP',
    [result] NVARCHAR(1000) NOT NULL CONSTRAINT [barcode_scan_events_result_df] DEFAULT 'SUCCESS',
    [source] NVARCHAR(1000) NOT NULL CONSTRAINT [barcode_scan_events_source_df] DEFAULT 'WEB',
    [entityType] NVARCHAR(1000),
    [entityId] NVARCHAR(1000),
    [contextType] NVARCHAR(1000),
    [contextId] NVARCHAR(1000),
    [message] NVARCHAR(500),
    [metadata] NVARCHAR(max),
    [scannedById] NVARCHAR(1000),
    [scannedAt] DATETIME2 NOT NULL CONSTRAINT [barcode_scan_events_scannedAt_df] DEFAULT CURRENT_TIMESTAMP,
    [ipAddress] NVARCHAR(1000),
    [userAgent] NVARCHAR(1000),
    CONSTRAINT [barcode_scan_events_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[barcode_label_templates] (
    [id] NVARCHAR(1000) NOT NULL,
    [code] NVARCHAR(1000) NOT NULL,
    [name] NVARCHAR(1000) NOT NULL,
    [description] NVARCHAR(max),
    [symbology] NVARCHAR(1000) NOT NULL CONSTRAINT [barcode_label_templates_symbology_df] DEFAULT 'QR_CODE',
    [entityType] NVARCHAR(1000),
    [widthMm] DECIMAL(9,2),
    [heightMm] DECIMAL(9,2),
    [templateData] NVARCHAR(max),
    [status] NVARCHAR(1000) NOT NULL CONSTRAINT [barcode_label_templates_status_df] DEFAULT 'ACTIVE',
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [barcode_label_templates_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    [deletedAt] DATETIME2,
    CONSTRAINT [barcode_label_templates_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [barcode_label_templates_code_key] UNIQUE NONCLUSTERED ([code])
);

-- CreateIndex
CREATE NONCLUSTERED INDEX [barcode_labels_code_idx] ON [dbo].[barcode_labels]([code]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [barcode_labels_value_idx] ON [dbo].[barcode_labels]([value]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [barcode_labels_entityType_idx] ON [dbo].[barcode_labels]([entityType]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [barcode_labels_entityId_idx] ON [dbo].[barcode_labels]([entityId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [barcode_labels_status_idx] ON [dbo].[barcode_labels]([status]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [barcode_labels_symbology_idx] ON [dbo].[barcode_labels]([symbology]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [barcode_labels_entityType_entityId_idx] ON [dbo].[barcode_labels]([entityType], [entityId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [barcode_labels_status_entityType_idx] ON [dbo].[barcode_labels]([status], [entityType]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [barcode_scan_events_scannedValue_idx] ON [dbo].[barcode_scan_events]([scannedValue]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [barcode_scan_events_labelId_idx] ON [dbo].[barcode_scan_events]([labelId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [barcode_scan_events_result_idx] ON [dbo].[barcode_scan_events]([result]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [barcode_scan_events_purpose_idx] ON [dbo].[barcode_scan_events]([purpose]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [barcode_scan_events_entityType_idx] ON [dbo].[barcode_scan_events]([entityType]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [barcode_scan_events_entityId_idx] ON [dbo].[barcode_scan_events]([entityId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [barcode_scan_events_contextType_contextId_idx] ON [dbo].[barcode_scan_events]([contextType], [contextId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [barcode_scan_events_scannedById_idx] ON [dbo].[barcode_scan_events]([scannedById]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [barcode_scan_events_scannedAt_idx] ON [dbo].[barcode_scan_events]([scannedAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [barcode_label_templates_code_idx] ON [dbo].[barcode_label_templates]([code]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [barcode_label_templates_symbology_idx] ON [dbo].[barcode_label_templates]([symbology]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [barcode_label_templates_entityType_idx] ON [dbo].[barcode_label_templates]([entityType]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [barcode_label_templates_status_idx] ON [dbo].[barcode_label_templates]([status]);

-- AddForeignKey
ALTER TABLE [dbo].[barcode_scan_events] ADD CONSTRAINT [barcode_scan_events_labelId_fkey] FOREIGN KEY ([labelId]) REFERENCES [dbo].[barcode_labels]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
