# Architecture and Tenancy Rules

## 1. Modular-Monolith Preservation

ATsofterp is a modular monolith: one NestJS API, one Next.js App Router frontend, one SQL Server database.

Do not:

* Split the API into microservices.
* Introduce a separate database per module.
* Create parallel domain models for concepts that already exist.
* Replace working modules with new implementations unless the task explicitly approves a migration plan.

The current code is the final source of truth. The architecture discovery report (`docs/proofs/atsofterp-current-architecture-discovery-report.md`) is a discovery aid only — verify every fact against the current code before acting.

## 2. Multi-Company and Multi-Branch Ownership

Tenant isolation is a mandatory security boundary enforced in the backend, never only in the frontend.

Every tenant-owned operational aggregate must have a clear owning company.

Every branch-owned aggregate must have a clear owning branch.

Prefer direct ownership fields on critical operational records, even when ownership could be inferred through relationships.

Global/shared records are allowed only when intentionally designed, documented, and approved.

For every create, read, update, delete, search, report, export, print, attachment, notification, audit, and background operation:

* Enforce company scope in the backend.
* Enforce branch scope when applicable.
* Never trust a client-provided company or branch without authorization validation.
* Never fetch tenant-owned records by `id` alone — always include tenant scope in the query.
* Validate that all referenced records belong to compatible company and branch contexts.
* Prevent cross-company and unauthorized cross-branch relationships.
* Scope unique constraints and numbering sequences per tenant.
* Scope search results, exports, attachments, and audit records.
* Test cross-company ID manipulation.

### Active Operational Context

The API uses the active operational context enforced by `ActiveContextInterceptor` via `x-active-company-id` and `x-active-branch-id` headers.

* A missing context must not silently broaden access.
* Write operations require a valid and authorized context.
* Cross-context reads are rejected; surface the localized error instead of returning stale or wrong data.
* `SUPER_ADMIN` behavior must be explicit and audited. Do not use SUPER_ADMIN to hide missing tenant enforcement for normal roles.

## 3. Separation of Organizational Structures

Keep these structures conceptually separate and in separate models:

1. Legal and administrative organization (companies, branches, administrations, departments).
2. Factory and operational topology (areas, process sections, production lines, machines, components).
3. Workforce assignments and supervision (employees, assignments, responsibilities).
4. Cost-center hierarchy.
5. User authorization and data scope (users, roles, permissions, scopes).

Do not overload a single table to represent two or more of these structures.

## 4. Flexible Hierarchy Design

The system must support companies with different depths and names. Do not hard-code:

* A fixed number of companies or branches.
* Chips or puffed-corn as the only factory areas.
* Manufacturing and packaging as the only sections.
* A fixed number of machines per line.
* A fixed organizational depth.
* A fixed number of shifts.
* A fixed reporting hierarchy.

Support variable depth through recursive organizational units where approved, and company-specific terminology through configurable reference data.

## 5. Tenant-Safe Relations

When creating or updating a record that references other records:

* All referenced records must belong to the same company context.
* Branch-owned references must belong to a compatible branch.
* Do not allow creating a record in company A that references an entity owned by company B.
* Reject mismatched references with a localized, stable error key.

## 6. Tenant-Safe Reporting and Search

* Every report and search query applies tenant filters in the backend.
* Results, exports, and print output never include records from other companies.
* Aggregations are computed from authoritative source records with tenant scope applied at query time.
* Do not compute large aggregates in the browser when they belong in the backend.

## 7. Cross-Module Integration Rules

Integration between modules (maintenance, inventory, production, assets) must:

* Reuse existing models and services instead of duplicating them.
* Use the owning module's service or a dedicated policy layer for its invariants.
* Perform multi-record updates atomically in a database transaction.
* Preserve existing audit and notification behavior.

## 8. Backward Compatibility

* Do not rename existing models, routes, or permission keys without a justified, approved migration.
* Extend existing models with nullable or backward-compatible fields before enforcing new constraints.
* Keep existing API responses compatible; add fields rather than removing them unless approved.

## 9. Cross-Company Tests

For every tenant-owned entity, test at minimum:

* Company A can access its own record.
* Company B cannot read it by ID.
* Company B cannot edit it by ID.
* Company B cannot reference it in a new transaction.
* Unauthorized branch access is rejected.
* Search and export do not leak the record across companies.
