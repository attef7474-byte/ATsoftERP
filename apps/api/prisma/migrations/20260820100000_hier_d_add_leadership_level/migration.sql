-- HIER-D: Add leadershipLevel to OperationalPersonAssignment
-- Additive-only migration: new column with safe default NONE
-- No destructive operations, no dropped columns/tables

ALTER TABLE [dbo].[operational_person_assignments] ADD [leadershipLevel] NVARCHAR(50) NOT NULL DEFAULT 'NONE';

CREATE INDEX [operational_person_assignments_leadershipLevel_idx] ON [dbo].[operational_person_assignments] ([leadershipLevel]);
