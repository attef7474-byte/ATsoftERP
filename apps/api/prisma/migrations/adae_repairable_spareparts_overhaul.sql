-- Batch AD-AE: Repairable Spare Parts Workflow + Overhaul
-- Additive migration — creates new tables only
-- Pre: 83 tables / 1182 columns
-- Post: 85 tables / ~1244 columns

-- Table 1: spare_part_repair_orders
IF NOT EXISTS (SELECT * FROM information_schema.tables WHERE table_name = 'spare_part_repair_orders')
BEGIN
    CREATE TABLE spare_part_repair_orders (
        id                          NVARCHAR(50)   NOT NULL PRIMARY KEY,
        repair_order_number         NVARCHAR(50)   NULL,
        spare_part_id               NVARCHAR(50)   NOT NULL,
        product_id                  NVARCHAR(50)   NULL,
        warehouse_id                NVARCHAR(50)   NOT NULL,
        source_condition            NVARCHAR(50)   NOT NULL,
        source_quantity             FLOAT          NOT NULL DEFAULT 0,
        reserved_quantity           FLOAT          NOT NULL DEFAULT 0,
        repaired_quantity           FLOAT          NOT NULL DEFAULT 0,
        scrapped_quantity           FLOAT          NOT NULL DEFAULT 0,
        remaining_quantity          FLOAT          NOT NULL DEFAULT 0,
        target_condition            NVARCHAR(50)   NULL,
        status                      NVARCHAR(50)   NOT NULL DEFAULT 'DRAFT',
        source_type                 NVARCHAR(50)   NULL,
        source_id                   NVARCHAR(50)   NULL,
        maintenance_request_id      NVARCHAR(50)   NULL,
        required_part_id            NVARCHAR(50)   NULL,
        replacement_history_id      NVARCHAR(50)   NULL,
        installed_part_id           NVARCHAR(50)   NULL,
        condition_in_movement_id    NVARCHAR(50)   NULL,
        condition_out_movement_id   NVARCHAR(50)   NULL,
        inventory_scrap_movement_id NVARCHAR(50)   NULL,
        machine_id                  NVARCHAR(50)   NULL,
        machine_component_id        NVARCHAR(50)   NULL,
        inspection_result           NVARCHAR(500)  NULL,
        failure_description         NVARCHAR(1000) NULL,
        repair_description          NVARCHAR(1000) NULL,
        test_result                 NVARCHAR(500)  NULL,
        test_notes                  NVARCHAR(500)  NULL,
        external_repair             BIT            NOT NULL DEFAULT 0,
        external_repair_provider_name NVARCHAR(200) NULL,
        estimated_repair_cost       DECIMAL(18,2)  NULL,
        actual_repair_cost          DECIMAL(18,2)  NULL,
        opened_by_user_id           NVARCHAR(50)   NULL,
        inspected_by_user_id        NVARCHAR(50)   NULL,
        repaired_by_user_id         NVARCHAR(50)   NULL,
        tested_by_user_id           NVARCHAR(50)   NULL,
        closed_by_user_id           NVARCHAR(50)   NULL,
        opened_at                   DATETIME2      NOT NULL DEFAULT GETDATE(),
        inspection_started_at       DATETIME2      NULL,
        repair_started_at           DATETIME2      NULL,
        test_started_at             DATETIME2      NULL,
        completed_at                DATETIME2      NULL,
        cancelled_at                DATETIME2      NULL,
        cancel_reason               NVARCHAR(500)  NULL,
        notes                       NVARCHAR(1000) NULL,
        created_at                  DATETIME2      NOT NULL DEFAULT GETDATE(),
        updated_at                  DATETIME2      NOT NULL DEFAULT GETDATE(),

        CONSTRAINT uq_repair_order_number UNIQUE (repair_order_number)
    );

    CREATE INDEX idx_ro_spare_part_id ON spare_part_repair_orders(spare_part_id);
    CREATE INDEX idx_ro_product_id ON spare_part_repair_orders(product_id);
    CREATE INDEX idx_ro_warehouse_id ON spare_part_repair_orders(warehouse_id);
    CREATE INDEX idx_ro_status ON spare_part_repair_orders(status);
    CREATE INDEX idx_ro_source_condition ON spare_part_repair_orders(source_condition);
    CREATE INDEX idx_ro_target_condition ON spare_part_repair_orders(target_condition);
    CREATE INDEX idx_ro_maintenance_request_id ON spare_part_repair_orders(maintenance_request_id);
    CREATE INDEX idx_ro_required_part_id ON spare_part_repair_orders(required_part_id);
    CREATE INDEX idx_ro_replacement_history_id ON spare_part_repair_orders(replacement_history_id);
    CREATE INDEX idx_ro_condition_in_movement_id ON spare_part_repair_orders(condition_in_movement_id);
    CREATE INDEX idx_ro_machine_id ON spare_part_repair_orders(machine_id);
    CREATE INDEX idx_ro_machine_component_id ON spare_part_repair_orders(machine_component_id);
    CREATE INDEX idx_ro_opened_at ON spare_part_repair_orders(opened_at);
    CREATE INDEX idx_ro_completed_at ON spare_part_repair_orders(completed_at);
    CREATE INDEX idx_ro_source_type_source_id ON spare_part_repair_orders(source_type, source_id);
END
GO

-- Table 2: spare_part_repair_actions
IF NOT EXISTS (SELECT * FROM information_schema.tables WHERE table_name = 'spare_part_repair_actions')
BEGIN
    CREATE TABLE spare_part_repair_actions (
        id                  NVARCHAR(50)   NOT NULL PRIMARY KEY,
        repair_order_id     NVARCHAR(50)   NOT NULL,
        action_type         NVARCHAR(50)   NOT NULL,
        action_status       NVARCHAR(50)   NOT NULL DEFAULT 'PLANNED',
        description         NVARCHAR(1000) NULL,
        result              NVARCHAR(500)  NULL,
        performed_by_user_id NVARCHAR(50)  NULL,
        performed_at        DATETIME2      NULL,
        duration_minutes    INT            NULL,
        notes               NVARCHAR(500)  NULL,
        created_at          DATETIME2      NOT NULL DEFAULT GETDATE(),
        updated_at          DATETIME2      NOT NULL DEFAULT GETDATE(),

        CONSTRAINT fk_repair_action_order FOREIGN KEY (repair_order_id) REFERENCES spare_part_repair_orders(id)
    );

    CREATE INDEX idx_ra_repair_order_id ON spare_part_repair_actions(repair_order_id);
    CREATE INDEX idx_ra_action_type ON spare_part_repair_actions(action_type);
    CREATE INDEX idx_ra_action_status ON spare_part_repair_actions(action_status);
    CREATE INDEX idx_ra_performed_at ON spare_part_repair_actions(performed_at);
END
GO
