-- Batch O: Add stock issue integration fields
-- Drops all conflicting columns and recreates with camelCase names (no @map in schema).

-- Drop default constraints
IF EXISTS (SELECT 1 FROM sys.default_constraints WHERE name = 'DF_mrrp_issued_quantity') EXEC('ALTER TABLE maintenance_request_required_parts DROP CONSTRAINT DF_mrrp_issued_quantity')
IF EXISTS (SELECT 1 FROM sys.default_constraints WHERE name = 'DF_mrrp_returned_quantity') EXEC('ALTER TABLE maintenance_request_required_parts DROP CONSTRAINT DF_mrrp_returned_quantity')
IF EXISTS (SELECT 1 FROM sys.default_constraints WHERE name = 'DF_mrrp_stock_issue_status') EXEC('ALTER TABLE maintenance_request_required_parts DROP CONSTRAINT DF_mrrp_stock_issue_status')
IF EXISTS (SELECT 1 FROM sys.default_constraints WHERE name = 'DF_mrrp_issuedQuantity') EXEC('ALTER TABLE maintenance_request_required_parts DROP CONSTRAINT DF_mrrp_issuedQuantity')
IF EXISTS (SELECT 1 FROM sys.default_constraints WHERE name = 'DF_mrrp_returnedQuantity') EXEC('ALTER TABLE maintenance_request_required_parts DROP CONSTRAINT DF_mrrp_returnedQuantity')
IF EXISTS (SELECT 1 FROM sys.default_constraints WHERE name = 'DF_mrrp_stockIssueStatus') EXEC('ALTER TABLE maintenance_request_required_parts DROP CONSTRAINT DF_mrrp_stockIssueStatus')
IF EXISTS (SELECT 1 FROM sys.default_constraints WHERE name = 'DF_mrrp_issued_qty') EXEC('ALTER TABLE maintenance_request_required_parts DROP CONSTRAINT DF_mrrp_issued_qty')
IF EXISTS (SELECT 1 FROM sys.default_constraints WHERE name = 'DF_mrrp_returned_qty') EXEC('ALTER TABLE maintenance_request_required_parts DROP CONSTRAINT DF_mrrp_returned_qty')
IF EXISTS (SELECT 1 FROM sys.default_constraints WHERE name = 'DF_mrrp_stock_status') EXEC('ALTER TABLE maintenance_request_required_parts DROP CONSTRAINT DF_mrrp_stock_status')

-- Drop stale indexes FIRST (before dropping columns they reference)
IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_mrrp_warehouse_id') DROP INDEX IX_mrrp_warehouse_id ON maintenance_request_required_parts
IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_mrrp_stock_issue_status') DROP INDEX IX_mrrp_stock_issue_status ON maintenance_request_required_parts
IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_mrrp_warehouseId') DROP INDEX IX_mrrp_warehouseId ON maintenance_request_required_parts
IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_mrrp_stockIssueStatus') DROP INDEX IX_mrrp_stockIssueStatus ON maintenance_request_required_parts

-- Drop all possible column name variants
IF EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'maintenance_request_required_parts' AND COLUMN_NAME = 'issued_quantity') ALTER TABLE maintenance_request_required_parts DROP COLUMN issued_quantity
IF EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'maintenance_request_required_parts' AND COLUMN_NAME = 'returned_quantity') ALTER TABLE maintenance_request_required_parts DROP COLUMN returned_quantity
IF EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'maintenance_request_required_parts' AND COLUMN_NAME = 'stock_issue_status') ALTER TABLE maintenance_request_required_parts DROP COLUMN stock_issue_status
IF EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'maintenance_request_required_parts' AND COLUMN_NAME = 'warehouse_id') ALTER TABLE maintenance_request_required_parts DROP COLUMN warehouse_id
IF EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'maintenance_request_required_parts' AND COLUMN_NAME = 'last_issue_at') ALTER TABLE maintenance_request_required_parts DROP COLUMN last_issue_at
IF EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'maintenance_request_required_parts' AND COLUMN_NAME = 'last_issue_by_user_id') ALTER TABLE maintenance_request_required_parts DROP COLUMN last_issue_by_user_id
IF EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'maintenance_request_required_parts' AND COLUMN_NAME = 'issuedQuantity') ALTER TABLE maintenance_request_required_parts DROP COLUMN issuedQuantity
IF EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'maintenance_request_required_parts' AND COLUMN_NAME = 'returnedQuantity') ALTER TABLE maintenance_request_required_parts DROP COLUMN returnedQuantity
IF EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'maintenance_request_required_parts' AND COLUMN_NAME = 'stockIssueStatus') ALTER TABLE maintenance_request_required_parts DROP COLUMN stockIssueStatus
IF EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'maintenance_request_required_parts' AND COLUMN_NAME = 'warehouseId') ALTER TABLE maintenance_request_required_parts DROP COLUMN warehouseId
IF EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'maintenance_request_required_parts' AND COLUMN_NAME = 'lastIssueAt') ALTER TABLE maintenance_request_required_parts DROP COLUMN lastIssueAt
IF EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'maintenance_request_required_parts' AND COLUMN_NAME = 'lastIssueByUserId') ALTER TABLE maintenance_request_required_parts DROP COLUMN lastIssueByUserId

-- Add columns with camelCase names (matching Prisma defaults, no @map)
ALTER TABLE maintenance_request_required_parts ADD issuedQuantity FLOAT NULL CONSTRAINT DF_mrrp_issuedQuantity DEFAULT 0
ALTER TABLE maintenance_request_required_parts ADD returnedQuantity FLOAT NULL CONSTRAINT DF_mrrp_returnedQuantity DEFAULT 0
ALTER TABLE maintenance_request_required_parts ADD stockIssueStatus NVARCHAR(50) NULL CONSTRAINT DF_mrrp_stockIssueStatus DEFAULT 'NOT_ISSUED'
ALTER TABLE maintenance_request_required_parts ADD warehouseId NVARCHAR(1000) NULL
ALTER TABLE maintenance_request_required_parts ADD lastIssueAt DATETIME2 NULL
ALTER TABLE maintenance_request_required_parts ADD lastIssueByUserId NVARCHAR(1000) NULL

-- Add indexes
CREATE INDEX IX_mrrp_warehouseId ON maintenance_request_required_parts(warehouseId)
CREATE INDEX IX_mrrp_stockIssueStatus ON maintenance_request_required_parts(stockIssueStatus)

PRINT 'Batch O: Clean migration applied successfully';
