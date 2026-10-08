-- Add missing foreign key constraints to machine_installed_parts
SET ANSI_NULLS ON;
SET ANSI_PADDING ON;
SET ANSI_WARNINGS ON;
SET ARITHABORT ON;
SET CONCAT_NULL_YIELDS_NULL ON;
SET QUOTED_IDENTIFIER ON;
SET NUMERIC_ROUNDABORT OFF;

BEGIN TRY
BEGIN TRAN;

IF NOT EXISTS (
    SELECT 1 FROM sys.foreign_keys
    WHERE name = N'machine_installed_parts_machineId_fkey'
      AND parent_object_id = OBJECT_ID(N'[dbo].[machine_installed_parts]')
)
BEGIN
    ALTER TABLE [dbo].[machine_installed_parts]
        ADD CONSTRAINT [machine_installed_parts_machineId_fkey]
        FOREIGN KEY ([machine_id]) REFERENCES [dbo].[machines] ([id])
        ON DELETE NO ACTION ON UPDATE NO ACTION;
END;

IF NOT EXISTS (
    SELECT 1 FROM sys.foreign_keys
    WHERE name = N'machine_installed_parts_machineComponentId_fkey'
      AND parent_object_id = OBJECT_ID(N'[dbo].[machine_installed_parts]')
)
BEGIN
    ALTER TABLE [dbo].[machine_installed_parts]
        ADD CONSTRAINT [machine_installed_parts_machineComponentId_fkey]
        FOREIGN KEY ([machine_component_id]) REFERENCES [dbo].[machine_components] ([id])
        ON DELETE NO ACTION ON UPDATE NO ACTION;
END;

IF NOT EXISTS (
    SELECT 1 FROM sys.foreign_keys
    WHERE name = N'machine_installed_parts_sparePartId_fkey'
      AND parent_object_id = OBJECT_ID(N'[dbo].[machine_installed_parts]')
)
BEGIN
    ALTER TABLE [dbo].[machine_installed_parts]
        ADD CONSTRAINT [machine_installed_parts_sparePartId_fkey]
        FOREIGN KEY ([spare_part_id]) REFERENCES [dbo].[spare_parts] ([id])
        ON DELETE NO ACTION ON UPDATE NO ACTION;
END;

IF NOT EXISTS (
    SELECT 1 FROM sys.foreign_keys
    WHERE name = N'machine_installed_parts_maintenanceRequestId_fkey'
      AND parent_object_id = OBJECT_ID(N'[dbo].[machine_installed_parts]')
)
BEGIN
    ALTER TABLE [dbo].[machine_installed_parts]
        ADD CONSTRAINT [machine_installed_parts_maintenanceRequestId_fkey]
        FOREIGN KEY ([maintenance_request_id]) REFERENCES [dbo].[maintenance_requests] ([id])
        ON DELETE NO ACTION ON UPDATE NO ACTION;
END;

IF NOT EXISTS (
    SELECT 1 FROM sys.foreign_keys
    WHERE name = N'machine_installed_parts_requiredPartId_fkey'
      AND parent_object_id = OBJECT_ID(N'[dbo].[machine_installed_parts]')
)
BEGIN
    ALTER TABLE [dbo].[machine_installed_parts]
        ADD CONSTRAINT [machine_installed_parts_requiredPartId_fkey]
        FOREIGN KEY ([required_part_id]) REFERENCES [dbo].[maintenance_request_required_parts] ([id])
        ON DELETE NO ACTION ON UPDATE NO ACTION;
END;

IF NOT EXISTS (
    SELECT 1 FROM sys.foreign_keys
    WHERE name = N'machine_installed_parts_inventoryMovementId_fkey'
      AND parent_object_id = OBJECT_ID(N'[dbo].[machine_installed_parts]')
)
BEGIN
    ALTER TABLE [dbo].[machine_installed_parts]
        ADD CONSTRAINT [machine_installed_parts_inventoryMovementId_fkey]
        FOREIGN KEY ([inventory_movement_id]) REFERENCES [dbo].[inventory_movements] ([id])
        ON DELETE NO ACTION ON UPDATE NO ACTION;
END;

COMMIT TRAN;
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK TRAN;
    THROW;
END CATCH;
