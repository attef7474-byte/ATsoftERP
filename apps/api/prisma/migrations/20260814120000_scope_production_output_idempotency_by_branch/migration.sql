-- Production output request identifiers are idempotent within the active branch.
-- The original company-wide unique constraint incorrectly made the same client
-- request identifier conflict across two independent branches of one company.
--
-- This transition preserves every row and only replaces the stronger legacy
-- unique key with the intended company + branch + request key. Existing data
-- already satisfies the new key because it satisfies the old, stricter key.
-- No backfill or default is required.
--
-- Tenant/index impact: one unique nonclustered index is replaced by one unique
-- nonclustered index with branchId added to the key. This removes false conflicts
-- across branches while retaining duplicate prevention inside each branch.
--
-- Runtime compatibility: deploy the branch-scoped lookup code before (or in the
-- same release as) this migration. The new code is safe under the old stronger
-- key; old company-only lookup code must not run after the key is relaxed.
--
-- Recovery: restoring the old company-wide key is data-preserving only while no
-- (companyId, requestId) duplicates exist across branches. Verify that condition
-- before a rollback; otherwise keep the branch-scoped key and roll forward.

ALTER TABLE [dbo].[production_output_events]
  DROP CONSTRAINT [production_output_events_tenant_request_key];

ALTER TABLE [dbo].[production_output_events]
  ADD CONSTRAINT [production_output_events_tenant_branch_request_key]
  UNIQUE NONCLUSTERED ([companyId], [branchId], [requestId]);
