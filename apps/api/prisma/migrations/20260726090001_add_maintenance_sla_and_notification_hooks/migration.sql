-- Add SLA fields to maintenance_requests (if not already present)
IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'maintenance_requests' AND COLUMN_NAME = 'response_due_at')
    ALTER TABLE maintenance_requests ADD response_due_at DATETIME2 NULL;
IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'maintenance_requests' AND COLUMN_NAME = 'start_due_at')
    ALTER TABLE maintenance_requests ADD start_due_at DATETIME2 NULL;
IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'maintenance_requests' AND COLUMN_NAME = 'complete_due_at')
    ALTER TABLE maintenance_requests ADD complete_due_at DATETIME2 NULL;
IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'maintenance_requests' AND COLUMN_NAME = 'sla_status')
    ALTER TABLE maintenance_requests ADD sla_status NVARCHAR(50) NULL DEFAULT 'ON_TRACK';
IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'maintenance_requests' AND COLUMN_NAME = 'escalation_level')
    ALTER TABLE maintenance_requests ADD escalation_level NVARCHAR(50) NULL DEFAULT 'NONE';
IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'maintenance_requests' AND COLUMN_NAME = 'last_escalated_at')
    ALTER TABLE maintenance_requests ADD last_escalated_at DATETIME2 NULL;

-- MaintenanceSlaRule
IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'maintenance_sla_rules')
BEGIN
    CREATE TABLE maintenance_sla_rules (
        id NVARCHAR(1000) NOT NULL PRIMARY KEY,
        name NVARCHAR(1000) NOT NULL,
        priority NVARCHAR(50) NULL DEFAULT 'MEDIUM',
        type NVARCHAR(50) NULL DEFAULT 'BOTH',
        response_hours FLOAT NULL,
        start_hours FLOAT NULL,
        complete_hours FLOAT NULL,
        escalation_delay_hours FLOAT NULL DEFAULT 0,
        escalation_levels INT NULL DEFAULT 1,
        is_active BIT NOT NULL DEFAULT 1,
        created_at DATETIME2 NOT NULL DEFAULT GETDATE(),
        updated_at DATETIME2 NOT NULL DEFAULT GETDATE()
    );
    CREATE INDEX idx_maintenance_sla_rules_priority ON maintenance_sla_rules (priority);
    CREATE INDEX idx_maintenance_sla_rules_type ON maintenance_sla_rules (type);
    CREATE INDEX idx_maintenance_sla_rules_is_active ON maintenance_sla_rules (is_active);
END;

-- MaintenanceSlaState
IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'maintenance_sla_states')
BEGIN
    CREATE TABLE maintenance_sla_states (
        id NVARCHAR(1000) NOT NULL PRIMARY KEY,
        maintenance_request_id NVARCHAR(1000) NOT NULL,
        response_due_at DATETIME2 NULL,
        start_due_at DATETIME2 NULL,
        complete_due_at DATETIME2 NULL,
        sla_status NVARCHAR(50) NOT NULL DEFAULT 'ON_TRACK',
        escalation_level NVARCHAR(50) NOT NULL DEFAULT 'NONE',
        last_escalated_at DATETIME2 NULL,
        response_actual_at DATETIME2 NULL,
        start_actual_at DATETIME2 NULL,
        complete_actual_at DATETIME2 NULL,
        response_overdue_min INT NULL,
        start_overdue_min INT NULL,
        complete_overdue_min INT NULL,
        created_at DATETIME2 NOT NULL DEFAULT GETDATE(),
        updated_at DATETIME2 NOT NULL DEFAULT GETDATE(),
        CONSTRAINT FK_maintenance_sla_states_request FOREIGN KEY (maintenance_request_id) REFERENCES maintenance_requests(id)
    );
    CREATE UNIQUE INDEX idx_maintenance_sla_states_request ON maintenance_sla_states (maintenance_request_id);
    CREATE INDEX idx_maintenance_sla_states_sla_status ON maintenance_sla_states (sla_status);
    CREATE INDEX idx_maintenance_sla_states_escalation_level ON maintenance_sla_states (escalation_level);
END;

-- Add indexes for new SLA fields on maintenance_requests (if not exist)
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'idx_maintenance_requests_sla_status')
    CREATE INDEX idx_maintenance_requests_sla_status ON maintenance_requests (sla_status);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'idx_maintenance_requests_escalation_level')
    CREATE INDEX idx_maintenance_requests_escalation_level ON maintenance_requests (escalation_level);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'idx_maintenance_requests_response_due_at')
    CREATE INDEX idx_maintenance_requests_response_due_at ON maintenance_requests (response_due_at);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'idx_maintenance_requests_complete_due_at')
    CREATE INDEX idx_maintenance_requests_complete_due_at ON maintenance_requests (complete_due_at);
