BEGIN TRY

BEGIN TRAN;

-- CreateTable
CREATE TABLE [dbo].[internal_conversations] (
    [id] NVARCHAR(1000) NOT NULL,
    [title] NVARCHAR(200),
    [createdByUserId] NVARCHAR(1000) NOT NULL,
    [lastMessageAt] DATETIME2,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [internal_conversations_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    [deletedAt] DATETIME2,
    CONSTRAINT [internal_conversations_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[internal_conversation_participants] (
    [id] NVARCHAR(1000) NOT NULL,
    [conversationId] NVARCHAR(1000) NOT NULL,
    [userId] NVARCHAR(1000) NOT NULL,
    [joinedAt] DATETIME2 NOT NULL CONSTRAINT [internal_conversation_participants_joinedAt_df] DEFAULT CURRENT_TIMESTAMP,
    [lastReadAt] DATETIME2,
    CONSTRAINT [internal_conversation_participants_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [internal_conversation_participants_conversationId_userId_key] UNIQUE NONCLUSTERED ([conversationId],[userId])
);

-- CreateTable
CREATE TABLE [dbo].[internal_messages] (
    [id] NVARCHAR(1000) NOT NULL,
    [conversationId] NVARCHAR(1000) NOT NULL,
    [senderUserId] NVARCHAR(1000) NOT NULL,
    [body] NVARCHAR(max) NOT NULL,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [internal_messages_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [editedAt] DATETIME2,
    [deletedAt] DATETIME2,
    [isSystem] BIT NOT NULL CONSTRAINT [internal_messages_isSystem_df] DEFAULT 0,
    CONSTRAINT [internal_messages_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateIndex
CREATE NONCLUSTERED INDEX [internal_conversations_createdByUserId_idx] ON [dbo].[internal_conversations]([createdByUserId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [internal_conversations_lastMessageAt_idx] ON [dbo].[internal_conversations]([lastMessageAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [internal_conversation_participants_userId_idx] ON [dbo].[internal_conversation_participants]([userId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [internal_messages_conversationId_createdAt_idx] ON [dbo].[internal_messages]([conversationId], [createdAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [internal_messages_senderUserId_idx] ON [dbo].[internal_messages]([senderUserId]);

-- AddForeignKey
ALTER TABLE [dbo].[internal_conversations] ADD CONSTRAINT [internal_conversations_createdByUserId_fkey] FOREIGN KEY ([createdByUserId]) REFERENCES [dbo].[users]([id]) ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[internal_conversation_participants] ADD CONSTRAINT [internal_conversation_participants_conversationId_fkey] FOREIGN KEY ([conversationId]) REFERENCES [dbo].[internal_conversations]([id]) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[internal_conversation_participants] ADD CONSTRAINT [internal_conversation_participants_userId_fkey] FOREIGN KEY ([userId]) REFERENCES [dbo].[users]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[internal_messages] ADD CONSTRAINT [internal_messages_conversationId_fkey] FOREIGN KEY ([conversationId]) REFERENCES [dbo].[internal_conversations]([id]) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[internal_messages] ADD CONSTRAINT [internal_messages_senderUserId_fkey] FOREIGN KEY ([senderUserId]) REFERENCES [dbo].[users]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
