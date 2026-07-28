-- AB-AC: Installed Parts Register + Replacement History
-- Safe additive migration — only CREATE IF NOT EXISTS

IF NOT EXISTS (SELECT * FROM information_schema.tables WHERE table_name = 'machine_installed_parts')
BEGIN
    CREATE TABLE machine_installed_parts (
        id                      NVARCHAR(1000)  NOT NULL PRIMARY KEY,
        machine_id              NVARCHAR(1000)  NOT NULL,
        machine_component_id    NVARCHAR(1000)  NULL,
        spare_part_id           NVARCHAR(1000)  NOT NULL,
        product_id              NVARCHAR(1000)  NULL,
        maintenance_request_id  NVARCHAR(1000)  NULL,
        required_part_id        NVARCHAR(1000)  NULL,
        inventory_movement_id   NVARCHAR(1000)  NULL,
        condition_movement_id   NVARCHAR(1000)  NULL,
        installed_quantity      FLOAT           NOT NULL,
        installed_condition     NVARCHAR(50)    NOT NULL DEFAULT 'NEW',
        installed_at            DATETIME2       NOT NULL DEFAULT GETDATE(),
        installed_by_user_id    NVARCHAR(1000)  NULL,
        source_type             NVARCHAR(50)    NULL,
        source_id               NVARCHAR(1000)  NULL,
        serial_number           NVARCHAR(255)   NULL,
        batch_number            NVARCHAR(255)   NULL,
        status                  NVARCHAR(50)    NOT NULL DEFAULT 'ACTIVE',
        removed_at              DATETIME2       NULL,
        removed_by_user_id      NVARCHAR(1000)  NULL,
        removed_condition       NVARCHAR(50)    NULL,
        removed_quantity        FLOAT           NULL,
        removed_reason          NVARCHAR(MAX)   NULL,
        notes                   NVARCHAR(MAX)   NULL,
        created_at              DATETIME2       NOT NULL DEFAULT GETDATE(),
        updated_at              DATETIME2       NOT NULL DEFAULT GETDATE()
    );

    CREATE INDEX idx_mip_machine ON machine_installed_parts(machine_id);
    CREATE INDEX idx_mip_component ON machine_installed_parts(machine_component_id);
    CREATE INDEX idx_mip_spare_part ON machine_installed_parts(spare_part_id);
    CREATE INDEX idx_mip_request ON machine_installed_parts(maintenance_request_id);
    CREATE INDEX idx_mip_required_part ON machine_installed_parts(required_part_id);
    CREATE INDEX idx_mip_status ON machine_installed_parts(status);
    CREATE INDEX idx_mip_installed_at ON machine_installed_parts(installed_at);
END;

IF NOT EXISTS (SELECT * FROM information_schema.tables WHERE table_name = 'spare_part_replacement_histories')
BEGIN
    CREATE TABLE spare_part_replacement_histories (
        id                          NVARCHAR(1000)  NOT NULL PRIMARY KEY,
        replacement_number          NVARCHAR(255)   NOT NULL UNIQUE,
        machine_id                  NVARCHAR(1000)  NOT NULL,
        machine_component_id        NVARCHAR(1000)  NULL,
        maintenance_request_id      NVARCHAR(1000)  NULL,
        required_part_id            NVARCHAR(1000)  NULL,
        old_installed_part_id       NVARCHAR(1000)  NULL,
        new_installed_part_id       NVARCHAR(1000)  NULL,
        old_spare_part_id           NVARCHAR(1000)  NULL,
        new_spare_part_id           NVARCHAR(1000)  NOT NULL,
        issued_condition            NVARCHAR(50)    NOT NULL,
        issued_quantity             FLOAT           NOT NULL,
        removed_condition           NVARCHAR(50)    NULL,
        removed_quantity            FLOAT           NULL,
        replacement_action          NVARCHAR(50)    NOT NULL,
        no_return_reason            NVARCHAR(MAX)   NULL,
        removed_returned_to_stock   BIT             NOT NULL DEFAULT 0,
        condition_out_movement_id   NVARCHAR(1000)  NULL,
        condition_in_movement_id    NVARCHAR(1000)  NULL,
        inventory_out_movement_id   NVARCHAR(1000)  NULL,
        replaced_at                 DATETIME2       NOT NULL DEFAULT GETDATE(),
        replaced_by_user_id         NVARCHAR(1000)  NULL,
        notes                       NVARCHAR(MAX)   NULL,
        created_at                  DATETIME2       NOT NULL DEFAULT GETDATE()
    );

    CREATE INDEX idx_sprh_machine ON spare_part_replacement_histories(machine_id);
    CREATE INDEX idx_sprh_component ON spare_part_replacement_histories(machine_component_id);
    CREATE INDEX idx_sprh_request ON spare_part_replacement_histories(maintenance_request_id);
    CREATE INDEX idx_sprh_required_part ON spare_part_replacement_histories(required_part_id);
    CREATE INDEX idx_sprh_old_installed ON spare_part_replacement_histories(old_installed_part_id);
    CREATE INDEX idx_sprh_new_installed ON spare_part_replacement_histories(new_installed_part_id);
    CREATE INDEX idx_sprh_replaced_at ON spare_part_replacement_histories(replaced_at);
END;
