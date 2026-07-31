# Backend and Security Rules

## 1. NestJS Conventions

* Controllers must remain thin: parse the request, validate DTOs, call a service, return the result.
* Business rules live in services or dedicated domain policies, not duplicated across controllers.
* Keep the established API error format: localized `messageKey`, stable status codes, no raw database exceptions exposed to users.

## 2. Authentication and Permissions

* Every endpoint requires authentication unless explicitly public (documented exception).
* Permission enforcement is done in the backend with stable, seeded permission keys; never rely on frontend hiding.
* Before creating a permission key, search existing definitions, controllers, frontend usage, and seed files to avoid synonyms and mismatches.

A permission is incomplete until it is: defined, seeded, assigned as required, enforced in backend, used correctly in frontend, translated where displayed, and tested for allowed and denied roles.

## 3. DTO Validation

* Use class-validator DTOs with `whitelist: true` (unknown-field rejection).
* Validate types, formats, ranges, and required fields at the boundary.
* Do not trust frontend validation.
* Do not expose secret, password, token, or internal security values in DTOs or responses.

## 4. Tenant Enforcement

* Every tenant-owned operation enforces company scope and, where applicable, branch scope in the backend.
* Never fetch by `id` alone for tenant-owned records; include tenant scope in direct queries.
* Validate that all referenced records belong to compatible company and branch contexts.
* The active operational context (`x-active-company-id`, `x-active-branch-id` handled by `ActiveContextInterceptor`) must be valid for write operations; a missing context must not silently broaden access.
* `SUPER_ADMIN` behavior must be explicit and audited, not a cover for missing tenant enforcement.

## 5. Audit Requirements

Audit sensitive actions, including create, update, delete/deactivate, approval, rejection, cancellation, status transitions, inventory posting, spare-part issue, installation/removal, cost overrides, tenant/branch overrides, assignment changes, production posting, and downtime ownership changes.

Audit records include: user, employee where available, company, branch, entity type, entity ID, action, timestamp, previous values, new values, and reason where required.

## 6. Status Transition Rules

* Do not update status through unrestricted generic edit endpoints when a dedicated transition is required.
* A transition must validate: current state, requested next state, user permission, tenant scope, required data, related-record state, inventory or production impact, and audit metadata.

## 7. Error Contracts

* Use consistent localized error keys or the established API error format.
* Do not return raw database exceptions to users.
* Map errors in `api-messages`/`messageKey` format consistently; frontend `useApiErrorHandler` expects this contract.

## 8. Duplicate Prevention and Idempotency

* Prevent duplicate submissions where repeated submission is possible (idempotency keys, unique constraints, or state guards).
* Reject double-posting of inventory movements, double installation of the same part, and duplicate workflow transitions.

## 9. Pagination and Large Data

* All potentially large lists support pagination, filtering, and sorting where operationally required.
* Avoid unbounded list queries and N+1 query patterns.
* Do not load complete attachment bodies or large histories in list endpoints.

## 10. Transactions

* Multi-record operations (inventory posting, installation, replacement, production posting, workflow transitions) run in database transactions.
* Partial completion that would corrupt data is forbidden; roll back atomically.

## 11. Cross-Company Authorization Tests

For every tenant-owned entity, test at minimum:

* Company A can access its record.
* Company B cannot read it by ID.
* Company B cannot edit it by ID.
* Company B cannot reference it in a new transaction.
* Unauthorized branch access is rejected.
* Search and export do not leak the record.

Include both allowed and denied role tests for every permission key.
