BEGIN TRY

BEGIN TRAN;

-- CreateTable
CREATE TABLE [dbo].[business_partner_groups] (
    [id] NVARCHAR(1000) NOT NULL,
    [code] NVARCHAR(1000) NOT NULL,
    [name] NVARCHAR(1000) NOT NULL,
    [description] NVARCHAR(max),
    [status] NVARCHAR(1000) NOT NULL CONSTRAINT [business_partner_groups_status_df] DEFAULT 'ACTIVE',
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [business_partner_groups_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    [deletedAt] DATETIME2,
    CONSTRAINT [business_partner_groups_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [business_partner_groups_code_key] UNIQUE NONCLUSTERED ([code])
);

-- CreateTable
CREATE TABLE [dbo].[payment_terms] (
    [id] NVARCHAR(1000) NOT NULL,
    [code] NVARCHAR(1000) NOT NULL,
    [name] NVARCHAR(1000) NOT NULL,
    [description] NVARCHAR(max),
    [days] INT NOT NULL CONSTRAINT [payment_terms_days_df] DEFAULT 0,
    [discountDays] INT,
    [discountPercent] DECIMAL(9,4),
    [status] NVARCHAR(1000) NOT NULL CONSTRAINT [payment_terms_status_df] DEFAULT 'ACTIVE',
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [payment_terms_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    [deletedAt] DATETIME2,
    CONSTRAINT [payment_terms_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [payment_terms_code_key] UNIQUE NONCLUSTERED ([code])
);

-- CreateTable
CREATE TABLE [dbo].[business_partners] (
    [id] NVARCHAR(1000) NOT NULL,
    [code] NVARCHAR(1000) NOT NULL,
    [type] NVARCHAR(1000) NOT NULL CONSTRAINT [business_partners_type_df] DEFAULT 'CUSTOMER',
    [status] NVARCHAR(1000) NOT NULL CONSTRAINT [business_partners_status_df] DEFAULT 'ACTIVE',
    [name] NVARCHAR(1000) NOT NULL,
    [legalName] NVARCHAR(1000),
    [commercialName] NVARCHAR(1000),
    [description] NVARCHAR(max),
    [groupId] NVARCHAR(1000),
    [paymentTermId] NVARCHAR(1000),
    [companyId] NVARCHAR(1000),
    [branchId] NVARCHAR(1000),
    [taxNumber] NVARCHAR(1000),
    [commercialRegistrationNo] NVARCHAR(1000),
    [vatRegistrationNo] NVARCHAR(1000),
    [nationalIdOrRegistryNo] NVARCHAR(1000),
    [phone] NVARCHAR(1000),
    [mobile] NVARCHAR(1000),
    [email] NVARCHAR(1000),
    [website] NVARCHAR(1000),
    [creditLimit] DECIMAL(18,4),
    [creditUsed] DECIMAL(18,4) CONSTRAINT [business_partners_creditUsed_df] DEFAULT 0,
    [allowCredit] BIT NOT NULL CONSTRAINT [business_partners_allowCredit_df] DEFAULT 0,
    [isBlocked] BIT NOT NULL CONSTRAINT [business_partners_isBlocked_df] DEFAULT 0,
    [blockReason] NVARCHAR(1000),
    [blockNotes] NVARCHAR(max),
    [blockedAt] DATETIME2,
    [blockedById] NVARCHAR(1000),
    [isCustomer] BIT NOT NULL CONSTRAINT [business_partners_isCustomer_df] DEFAULT 0,
    [isSupplier] BIT NOT NULL CONSTRAINT [business_partners_isSupplier_df] DEFAULT 0,
    [notes] NVARCHAR(max),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [business_partners_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    [deletedAt] DATETIME2,
    CONSTRAINT [business_partners_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [business_partners_code_key] UNIQUE NONCLUSTERED ([code])
);

-- CreateTable
CREATE TABLE [dbo].[business_partner_contacts] (
    [id] NVARCHAR(1000) NOT NULL,
    [partnerId] NVARCHAR(1000) NOT NULL,
    [type] NVARCHAR(1000) NOT NULL CONSTRAINT [business_partner_contacts_type_df] DEFAULT 'GENERAL',
    [name] NVARCHAR(1000) NOT NULL,
    [jobTitle] NVARCHAR(1000),
    [phone] NVARCHAR(1000),
    [mobile] NVARCHAR(1000),
    [email] NVARCHAR(1000),
    [isPrimary] BIT NOT NULL CONSTRAINT [business_partner_contacts_isPrimary_df] DEFAULT 0,
    [notes] NVARCHAR(max),
    [status] NVARCHAR(1000) NOT NULL CONSTRAINT [business_partner_contacts_status_df] DEFAULT 'ACTIVE',
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [business_partner_contacts_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    [deletedAt] DATETIME2,
    CONSTRAINT [business_partner_contacts_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[business_partner_addresses] (
    [id] NVARCHAR(1000) NOT NULL,
    [partnerId] NVARCHAR(1000) NOT NULL,
    [type] NVARCHAR(1000) NOT NULL CONSTRAINT [business_partner_addresses_type_df] DEFAULT 'BILLING',
    [label] NVARCHAR(1000),
    [country] NVARCHAR(1000),
    [city] NVARCHAR(1000),
    [district] NVARCHAR(1000),
    [street] NVARCHAR(1000),
    [buildingNo] NVARCHAR(1000),
    [postalCode] NVARCHAR(1000),
    [addressLine1] NVARCHAR(500),
    [addressLine2] NVARCHAR(500),
    [latitude] DECIMAL(10,7),
    [longitude] DECIMAL(10,7),
    [isPrimary] BIT NOT NULL CONSTRAINT [business_partner_addresses_isPrimary_df] DEFAULT 0,
    [notes] NVARCHAR(max),
    [status] NVARCHAR(1000) NOT NULL CONSTRAINT [business_partner_addresses_status_df] DEFAULT 'ACTIVE',
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [business_partner_addresses_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    [deletedAt] DATETIME2,
    CONSTRAINT [business_partner_addresses_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[business_partner_bank_accounts] (
    [id] NVARCHAR(1000) NOT NULL,
    [partnerId] NVARCHAR(1000) NOT NULL,
    [bankName] NVARCHAR(1000) NOT NULL,
    [accountName] NVARCHAR(1000),
    [accountNumber] NVARCHAR(1000),
    [iban] NVARCHAR(1000),
    [swiftCode] NVARCHAR(1000),
    [currency] NVARCHAR(1000),
    [isPrimary] BIT NOT NULL CONSTRAINT [business_partner_bank_accounts_isPrimary_df] DEFAULT 0,
    [notes] NVARCHAR(max),
    [status] NVARCHAR(1000) NOT NULL CONSTRAINT [business_partner_bank_accounts_status_df] DEFAULT 'ACTIVE',
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [business_partner_bank_accounts_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    [deletedAt] DATETIME2,
    CONSTRAINT [business_partner_bank_accounts_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateIndex
CREATE NONCLUSTERED INDEX [business_partner_groups_code_idx] ON [dbo].[business_partner_groups]([code]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [business_partner_groups_status_idx] ON [dbo].[business_partner_groups]([status]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [payment_terms_code_idx] ON [dbo].[payment_terms]([code]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [payment_terms_status_idx] ON [dbo].[payment_terms]([status]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [business_partners_code_idx] ON [dbo].[business_partners]([code]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [business_partners_type_idx] ON [dbo].[business_partners]([type]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [business_partners_status_idx] ON [dbo].[business_partners]([status]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [business_partners_groupId_idx] ON [dbo].[business_partners]([groupId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [business_partners_paymentTermId_idx] ON [dbo].[business_partners]([paymentTermId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [business_partners_companyId_idx] ON [dbo].[business_partners]([companyId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [business_partners_branchId_idx] ON [dbo].[business_partners]([branchId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [business_partners_taxNumber_idx] ON [dbo].[business_partners]([taxNumber]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [business_partners_commercialRegistrationNo_idx] ON [dbo].[business_partners]([commercialRegistrationNo]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [business_partners_email_idx] ON [dbo].[business_partners]([email]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [business_partners_phone_idx] ON [dbo].[business_partners]([phone]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [business_partners_isCustomer_idx] ON [dbo].[business_partners]([isCustomer]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [business_partners_isSupplier_idx] ON [dbo].[business_partners]([isSupplier]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [business_partners_isBlocked_idx] ON [dbo].[business_partners]([isBlocked]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [business_partner_contacts_partnerId_idx] ON [dbo].[business_partner_contacts]([partnerId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [business_partner_contacts_type_idx] ON [dbo].[business_partner_contacts]([type]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [business_partner_contacts_email_idx] ON [dbo].[business_partner_contacts]([email]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [business_partner_contacts_phone_idx] ON [dbo].[business_partner_contacts]([phone]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [business_partner_contacts_isPrimary_idx] ON [dbo].[business_partner_contacts]([isPrimary]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [business_partner_addresses_partnerId_idx] ON [dbo].[business_partner_addresses]([partnerId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [business_partner_addresses_type_idx] ON [dbo].[business_partner_addresses]([type]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [business_partner_addresses_city_idx] ON [dbo].[business_partner_addresses]([city]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [business_partner_addresses_isPrimary_idx] ON [dbo].[business_partner_addresses]([isPrimary]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [business_partner_bank_accounts_partnerId_idx] ON [dbo].[business_partner_bank_accounts]([partnerId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [business_partner_bank_accounts_iban_idx] ON [dbo].[business_partner_bank_accounts]([iban]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [business_partner_bank_accounts_isPrimary_idx] ON [dbo].[business_partner_bank_accounts]([isPrimary]);

-- AddForeignKey
ALTER TABLE [dbo].[business_partners] ADD CONSTRAINT [business_partners_groupId_fkey] FOREIGN KEY ([groupId]) REFERENCES [dbo].[business_partner_groups]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[business_partners] ADD CONSTRAINT [business_partners_paymentTermId_fkey] FOREIGN KEY ([paymentTermId]) REFERENCES [dbo].[payment_terms]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[business_partner_contacts] ADD CONSTRAINT [business_partner_contacts_partnerId_fkey] FOREIGN KEY ([partnerId]) REFERENCES [dbo].[business_partners]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[business_partner_addresses] ADD CONSTRAINT [business_partner_addresses_partnerId_fkey] FOREIGN KEY ([partnerId]) REFERENCES [dbo].[business_partners]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[business_partner_bank_accounts] ADD CONSTRAINT [business_partner_bank_accounts_partnerId_fkey] FOREIGN KEY ([partnerId]) REFERENCES [dbo].[business_partners]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
