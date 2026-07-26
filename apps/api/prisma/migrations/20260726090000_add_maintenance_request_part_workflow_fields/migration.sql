-- Add workflow fields to maintenance_request_required_parts
ALTER TABLE maintenance_request_required_parts ADD reason NVARCHAR(MAX);
ALTER TABLE maintenance_request_required_parts ADD requestedQuantity FLOAT;
ALTER TABLE maintenance_request_required_parts ADD approvedQuantity FLOAT;
ALTER TABLE maintenance_request_required_parts ADD reservedQuantity FLOAT;
ALTER TABLE maintenance_request_required_parts ADD usedQuantity FLOAT;
ALTER TABLE maintenance_request_required_parts ADD requestedByUserId NVARCHAR(1000);
ALTER TABLE maintenance_request_required_parts ADD approvedByUserId NVARCHAR(1000);
ALTER TABLE maintenance_request_required_parts ADD rejectedByUserId NVARCHAR(1000);
ALTER TABLE maintenance_request_required_parts ADD reservedByUserId NVARCHAR(1000);
ALTER TABLE maintenance_request_required_parts ADD usedByUserId NVARCHAR(1000);
ALTER TABLE maintenance_request_required_parts ADD cancelledByUserId NVARCHAR(1000);
ALTER TABLE maintenance_request_required_parts ADD failureCauseId NVARCHAR(1000);
ALTER TABLE maintenance_request_required_parts ADD requestedAt DATETIME2;
ALTER TABLE maintenance_request_required_parts ADD approvedAt DATETIME2;
ALTER TABLE maintenance_request_required_parts ADD rejectedAt DATETIME2;
ALTER TABLE maintenance_request_required_parts ADD reservedAt DATETIME2;
ALTER TABLE maintenance_request_required_parts ADD usedAt DATETIME2;
ALTER TABLE maintenance_request_required_parts ADD cancelledAt DATETIME2;

-- Fix column types to match users.id (NVARCHAR(1000))
ALTER TABLE maintenance_request_required_parts ALTER COLUMN requestedByUserId NVARCHAR(1000);
ALTER TABLE maintenance_request_required_parts ALTER COLUMN approvedByUserId NVARCHAR(1000);
ALTER TABLE maintenance_request_required_parts ALTER COLUMN rejectedByUserId NVARCHAR(1000);
ALTER TABLE maintenance_request_required_parts ALTER COLUMN reservedByUserId NVARCHAR(1000);
ALTER TABLE maintenance_request_required_parts ALTER COLUMN usedByUserId NVARCHAR(1000);
ALTER TABLE maintenance_request_required_parts ALTER COLUMN cancelledByUserId NVARCHAR(1000);
ALTER TABLE maintenance_request_required_parts ALTER COLUMN failureCauseId NVARCHAR(1000);

-- Foreign keys for user relations
ALTER TABLE maintenance_request_required_parts ADD CONSTRAINT FK_required_part_requestedBy FOREIGN KEY (requestedByUserId) REFERENCES users(id);
ALTER TABLE maintenance_request_required_parts ADD CONSTRAINT FK_required_part_approvedBy FOREIGN KEY (approvedByUserId) REFERENCES users(id);
ALTER TABLE maintenance_request_required_parts ADD CONSTRAINT FK_required_part_rejectedBy FOREIGN KEY (rejectedByUserId) REFERENCES users(id);
ALTER TABLE maintenance_request_required_parts ADD CONSTRAINT FK_required_part_reservedBy FOREIGN KEY (reservedByUserId) REFERENCES users(id);
ALTER TABLE maintenance_request_required_parts ADD CONSTRAINT FK_required_part_usedBy FOREIGN KEY (usedByUserId) REFERENCES users(id);
ALTER TABLE maintenance_request_required_parts ADD CONSTRAINT FK_required_part_cancelledBy FOREIGN KEY (cancelledByUserId) REFERENCES users(id);
ALTER TABLE maintenance_request_required_parts ADD CONSTRAINT FK_required_part_failureCause FOREIGN KEY (failureCauseId) REFERENCES downtime_logs(id);

-- Indexes for new FK columns
CREATE INDEX idx_required_part_requestedBy ON maintenance_request_required_parts(requestedByUserId);
CREATE INDEX idx_required_part_approvedBy ON maintenance_request_required_parts(approvedByUserId);
CREATE INDEX idx_required_part_reservedBy ON maintenance_request_required_parts(reservedByUserId);
CREATE INDEX idx_required_part_usedBy ON maintenance_request_required_parts(usedByUserId);
CREATE INDEX idx_required_part_failureCause ON maintenance_request_required_parts(failureCauseId);
