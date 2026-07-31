# Database and Migration Rules

## 1. SQL Server Only

* The database is SQL Server. Never introduce PostgreSQL, MySQL, SQLite, or in-memory substitutes for the real runtime.
* Never recommend or execute `prisma migrate reset`, database deletion, table truncation, destructive reset, `prisma db push` without review, editing an already-applied migration, or deleting migration history.
* Recreating the database to solve a schema issue is forbidden.
* The previous `AGENTS.md` forbade `prisma migrate reset` and `prisma db push`; these prohibitions remain in force.

## 2. Migration Safety

All schema changes use reviewed Prisma migrations (`prisma migrate dev` to create, `prisma migrate deploy` to apply in deployment).

Never:

* Run `prisma migrate reset`.
* Delete or truncate tables.
* Edit an already-applied migration.
* Delete migration history.
* Execute unscoped delete or update operations.

### Phased Migration Strategy for Sensitive Changes

1. Add nullable or backward-compatible structure.
2. Backfill existing records.
3. Verify the backfill.
4. Add required constraints.
5. Update application behavior.
6. Remove deprecated structure only in a separately approved task.

Every migration must document:

* Existing-data impact.
* Default or backfill behavior.
* Rollback or recovery approach.
* Index impact.
* Tenant impact.
* Runtime compatibility.

## 3. Decimal Usage

* Use `Decimal`-appropriate storage for money and precise quantities.
* Never use floating-point values for monetary truth.
* Keep units (weight, pieces, length, volume) consistent per item or document; do not mix unit systems in the same numeric column without a documented unit dimension.

## 4. Transactions

* Use database transactions for multi-record operations.
* Inventory, costing, installation, replacement, production posting, and workflow transitions must be atomic where partial completion would corrupt data.
* A failed transaction must not leave partial movements, balances, or status changes.

## 5. Indexing

* Add indexes for real query paths: tenant filters, foreign keys, status filters, date ranges.
* Do not add indexes without understanding write and storage impact.
* Prefer composite indexes that include the tenant column for tenant-scoped queries.

## 6. Tenant-Aware Constraints

* Unique constraints must include the tenant scope where the business rule is per-company (or per-company-branch).
* Numbering sequences must be scoped per tenant.
* Foreign-key relationships must not allow cross-company references; enforce compatibility in the service layer and validate in tests.

## 7. Soft-Delete Consistency

* Prefer soft deletes (deactivate, `isActive`) for operational records where history must be preserved.
* Soft-deleted records must be excluded from all operational lists, search, and reporting queries.
* Related operational aggregates (movements, requests, installations) must never reference soft-deleted parents for new transactions.

## 8. Audit Fields

* Every sensitive entity must record the user, employee (where available), company, branch, entity type, entity ID, action, timestamp, previous values, and new values where relevant.
* Audit records are tenant-scoped.
* Never store passwords, hashes of secrets, tokens, or raw connection strings in audit tables.

## 9. Migration Evidence

* Every migration must be provable: name, purpose, before/after impact, backfill script (if any), and validation query results.
* Record the migration evidence in the task's proof documentation.

## 10. Recovery and Rollback Planning

* Before applying a schema change, define the rollback path (revert migration + data restoration).
* Never overwrite or drop existing data without an approved, documented backfill and rollback plan.
* Do not claim data safety without executing and showing the validation.

## 11. Existing-Data Preservation

* Current production data is valuable; do not drop, truncate, or bulk-delete it.
* When a field changes type or domain, provide and execute a safe conversion/backfill.
* Verify existing rows after any data-impacting migration and report counts.
