BEGIN TRY

BEGIN TRAN;

-- CreateTable
CREATE TABLE [dbo].[notification_rules] (
    [id] NVARCHAR(1000) NOT NULL,
    [code] NVARCHAR(1000) NOT NULL,
    [nameAr] NVARCHAR(1000) NOT NULL,
    [nameEn] NVARCHAR(1000) NOT NULL,
    [description] NVARCHAR(1000),
    [eventType] NVARCHAR(1000) NOT NULL,
    [channel] NVARCHAR(1000) NOT NULL CONSTRAINT [notification_rules_channel_df] DEFAULT 'IN_APP',
    [severity] NVARCHAR(1000) NOT NULL CONSTRAINT [notification_rules_severity_df] DEFAULT 'INFO',
    [enabled] BIT NOT NULL CONSTRAINT [notification_rules_enabled_df] DEFAULT 1,
    [targetRoleId] NVARCHAR(1000),
    [targetPermission] NVARCHAR(1000),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [notification_rules_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [notification_rules_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [notification_rules_code_key] UNIQUE NONCLUSTERED ([code])
);

-- CreateIndex
CREATE NONCLUSTERED INDEX [notification_rules_enabled_idx] ON [dbo].[notification_rules]([enabled]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [notification_rules_eventType_idx] ON [dbo].[notification_rules]([eventType]);

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
