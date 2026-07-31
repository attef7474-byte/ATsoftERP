# ATsofterp Permanent Engineering Instructions

## 1. Project Identity

Project name: `ATsofterp`

ATsofterp is a production-grade, multi-company system for maintenance, production, assets, inventory, spare parts, operational costing, factory organization, and daily factory operations.

Current primary technologies:

* Windows local runtime.
* SQL Server.
* Prisma.
* NestJS API.
* Next.js App Router frontend.
* TypeScript.
* Arabic and English user interfaces.
* RTL and LTR support.
* JWT and permission-based authorization.
* No Docker for the approved current development baseline unless explicitly changed later.

The repository already contains substantial implemented maintenance, inventory, asset, reporting, settings, audit, notification, attachment, barcode, and administrative functionality.

Do not treat the repository as a new project.

Do not rebuild existing working modules unless a task explicitly requires a justified migration or replacement.

The current code is the final source of truth. Previous reports may be used as discovery aids but must not override the current implementation.

The current architecture discovery report is located at:

`docs/proofs/atsofterp-current-architecture-discovery-report.md`

Use it to reduce unnecessary repository-wide scanning, but verify every task-relevant fact against the current code before changing it.

---

## 2. Primary Product Goals

Every implementation must contribute to these goals:

1. Real operational use in companies and factories.
2. Strong multi-company and multi-branch isolation.
3. Minimum daily manual data entry.
4. Automatic reuse of previously stored information.
5. Clear and simple workflows for non-technical users.
6. Flexible configuration for companies with different structures.
7. Full traceability of operational and financial-impacting actions.
8. Reliable maintenance, inventory, spare-parts, and production integration.
9. Accurate reporting without duplicated totals.
10. Safe extension without breaking existing working modules.

Do not optimize only for code generation speed.

Optimize for:

* Operational correctness.
* Data integrity.
* User effort reduction.
* Maintainability.
* Testability.
* Security.
* Traceability.
* Long-term extensibility.

---

## 3. Non-Negotiable Reality Rule

ATsofterp must contain real, connected, production-capable functionality.

The following are prohibited:

* Mock operational data.
* Fake pages.
* Demonstration-only pages presented as completed work.
* Static success responses.
* Buttons without real handlers.
* Forms that do not save through a real API.
* APIs that are not connected to real database operations.
* Empty services, controllers, DTOs, tests, or page files.
* Placeholder modules presented as implemented.
* Hard-coded operational records.
* Silent fallbacks that hide missing backend functionality.
* Catch blocks that suppress errors.
* Disabling validation or tests to make a build pass.
* Claiming completion based only on compilation.

A feature is not complete because files exist.

A feature is complete only when its database, backend, permissions, frontend, translations, tests, and runtime flow are connected and verified.

---

## 4. Task Execution Discipline

For every implementation task:

1. Read the user's scope carefully.
2. Inspect only the relevant current code first.
3. Identify the existing implementation and reuse its established patterns.
4. Detect duplicate or legacy implementations before creating new files.
5. Define the smallest safe implementation boundary that fully satisfies the requested outcome.
6. Implement the complete vertical slice.
7. Run focused validation first.
8. Run the required broader validation.
9. inspect the final diff.
10. Report exact evidence.

Do not repeatedly scan the whole repository when the relevant structure is already known.

Do not stop after planning when the task requests implementation.

Do not ask unnecessary questions that can be resolved from:

* Existing code.
* Existing naming patterns.
* Database relationships.
* Existing pages.
* Existing API behavior.
* Existing reports.
* The current task specification.

Ask a question only when an unresolved decision would materially risk:

* Data loss.
* Cross-company data exposure.
* Destructive migration.
* Incorrect accounting.
* Irreversible workflow behavior.
* Breaking existing production data.

When safe assumptions are available, use them and document them.

Do not pause after every minor file change.

Complete a coherent batch, verify it, and then report.

---

## 5. Scope Control

Modify only the files required by the current task.

Do not:

* Refactor unrelated modules.
* Rename unrelated models or routes.
* Reformat the entire repository.
* Enable rejected or inactive domains.
* Activate empty modules merely because they exist on disk.
* Add Finance, Sales, Purchasing, HR payroll, AI, IoT, BI, forecasting, or other unapproved scopes unless explicitly requested.
* Create speculative future modules.
* create files that are not used by the implemented runtime.

When adjacent changes are required for correctness, explain why they are necessary.

Avoid both extremes:

* Do not make an incomplete one-file patch when an end-to-end change is required.
* Do not perform repository-wide restructuring for a localized requirement.

---

## 6. Preserve and Extend Existing Working Modules

The existing maintenance, inventory, machines, spare parts, installed parts, replacement history, repair orders, reporting, search, numbering, settings, notifications, audit, and attachment modules contain significant implemented work.

Before changing an existing domain:

* Trace the current frontend-to-database path.
* Identify current permissions.
* Identify current status transitions.
* Identify current numbering behavior.
* Identify current audit behavior.
* Identify current integrations.
* Identify existing data that may require migration.
* Add regression tests before or with risky changes.

Prefer safe extension over replacement.

Do not create parallel replacements for existing concepts unless the task explicitly approves a migration plan.

Examples of prohibited duplication:

* A second maintenance-request model.
* A second installed-part workflow.
* A second inventory balance system.
* A second numbering service.
* A second unified search system.
* A second error handling system.
* Duplicate permission keys for the same action.
* Duplicate status vocabularies for the same entity.

---

## 7. Multi-Company and Multi-Branch Invariants

Multi-company isolation is a mandatory security boundary, not an optional frontend filter.

Every tenant-owned operational aggregate must have a clear owning company.

Every branch-owned aggregate must have a clear owning branch.

Direct ownership fields are preferred for critical operational records, even when ownership can be inferred through relationships.

Global/shared records are allowed only when intentionally designed, documented, and approved.

For every create, read, update, delete, search, report, export, print, attachment, notification, audit, and background operation:

* Enforce company scope in the backend.
* Enforce branch scope when applicable.
* Never rely only on a frontend header or hidden field.
* Never trust a client-provided company or branch without authorization validation.
* Never fetch by `id` alone for tenant-owned records.
* Include tenant scope in direct record queries.
* Validate that all referenced records belong to compatible company and branch contexts.
* Prevent cross-company and unauthorized cross-branch relationships.
* Scope unique constraints appropriately.
* Scope numbering sequences appropriately.
* Scope search results and exports.
* Scope attachments and audit records.
* Test cross-company ID manipulation.

For write operations, the active operational context must be valid and authorized.

A missing context must not silently broaden access.

SUPER_ADMIN behavior must be explicit and audited. Do not use SUPER_ADMIN behavior to hide missing tenant enforcement for normal roles.

---

## 8. Organizational and Factory Flexibility

Keep these structures conceptually separate:

1. Legal and administrative organization.
2. Factory and operational topology.
3. Workforce assignments and supervision.
4. Cost-center hierarchy.
5. User authorization and data scope.

Do not overload a single table to represent all five structures.

The system must support different companies with different depths and names.

Do not hard-code assumptions such as:

* Every company has exactly four branches.
* Every factory has only chips and puffed-corn sections.
* Every area has exactly manufacturing and packaging.
* Every line has exactly six machines.
* Every administration has exactly two departments.
* Every company uses the same reporting hierarchy.

The structure must allow:

* Variable numbers of companies and branches.
* Variable organizational depth.
* Recursive departments or approved recursive organizational units.
* Variable factory areas and process sections.
* Variable numbers of production lines.
* Variable numbers of machines and components.
* Temporary and permanent employee assignments.
* Multiple responsibility scopes.
* Company-specific terminology and configuration.

Configuration flexibility must not weaken transactional integrity.

Use configurable reference data for:

* Types.
* Categories.
* Reasons.
* priorities.
* classifications.
* templates.
* thresholds.
* schedules.
* optional fields.
* display settings.

Keep critical transactional rules strongly typed and validated in code.

Do not convert stock, production, maintenance, costing, or approval integrity into uncontrolled JSON configuration.

---

## 9. Minimum Data Entry and Automatic Field Population

The fundamental UX rule is:

> Enter information once, reuse it everywhere safely.

Daily operational forms must request only information that the system cannot derive reliably.

Automatically derive and populate where possible:

* Company.
* Branch.
* Facility.
* Organizational unit.
* Production area.
* Process section.
* Production line.
* Machine.
* Machine component.
* Operation type.
* Cost center.
* Warehouse.
* Shift.
* Current user.
* Current employee.
* Date and time.
* Document number.
* Initial status.
* Responsible maintenance group.
* Assigned line responsibility.
* Product unit.
* Product or machine defaults.
* Related order or request data.
* Known spare-part compatibility.
* Existing machine and component metadata.

Examples:

* Selecting a machine should populate its company, branch, line, area, section, default cost center, operation type, and relevant maintenance scope.
* Opening a maintenance request from a machine page should prefill the machine and its hierarchy.
* Opening a request from a production interruption should prefill the active production run, product, shift, line, machine, and interruption start time.
* Selecting a spare part should show compatible machines/components, available stock, warehouse, condition, and recent usage.
* Selecting a production order should populate product, approved routing, BOM, target quantity, target rate, line, and unit.
* Editing a record must load the same existing record and prefill all editable fields.
* Repeated transactions should support templates, copy-from-previous, and controlled defaults.

Automatically generated or derived fields must not be duplicated as independent manual inputs.

When an auto-populated field may be changed:

* Only authorized users may override it.
* The override must be visible.
* A reason may be required for sensitive overrides.
* The previous and new values must be audited.

Do not auto-populate stale data from a previously opened unrelated record.

Defaults must be scoped to the current user, company, branch, workflow, and entity.

---

## 10. Form and Workflow UX Standards

Use progressive disclosure.

Show only fields required for the current operation and status.

Separate:

* Essential fields.
* Optional details.
* Advanced fields.
* Audit and system-generated fields.

Do not display system-generated IDs as user-facing values when readable names or codes exist.

Use searchable lookups for large reference datasets.

Reuse the project's unified F9 and search patterns instead of creating inconsistent selectors.

Every operational page must include, where applicable:

* Loading state.
* Empty state.
* Error state.
* Permission state.
* Disabled-state explanation.
* Success feedback.
* Search.
* Filtering.
* Pagination or virtualization for large datasets.
* Clear current status.
* Allowed next actions.
* Audit or history access.
* Attachments where operationally relevant.

Prevent duplicate submissions.

Disable action buttons while requests are running.

Preserve entered data when a recoverable API error occurs.

Use confirmation for destructive or irreversible actions.

Do not require users to re-enter information already stored in the selected machine, line, product, request, order, employee, warehouse, or operational context.

---

## 11. Database Safety

The database is SQL Server and contains important existing data.

Never execute or recommend:

* `prisma migrate reset`
* Database deletion.
* Table truncation.
* Destructive reset.
* Unreviewed `prisma db push`.
* Editing an already-applied migration.
* Deleting migration history.
* Recreating the database to solve a schema issue.
* Unscoped delete or update operations.

Use reviewed migrations.

For sensitive schema changes, use phased migrations:

1. Add nullable or backward-compatible structure.
2. Backfill existing records.
3. Verify the backfill.
4. Add required constraints.
5. Update application behavior.
6. Remove deprecated structure only in a separately approved task.

Every migration must explain:

* Existing-data impact.
* Default or backfill behavior.
* Rollback or recovery approach.
* Index impact.
* Tenant impact.
* Runtime compatibility.

Use database transactions for multi-record operations.

Inventory, costing, installation, replacement, production posting, and workflow transitions must be atomic where partial completion would corrupt data.

Use `Decimal`-appropriate storage for money and precise quantities. Do not use floating-point values for monetary truth.

Add indexes for real query paths, tenant filters, foreign keys, status filters, and date ranges.

Do not add indexes without understanding write and storage impact.

---

## 12. Data Integrity and Derived Values

Do not store the same business amount as separate independent facts at every hierarchy level.

Record the atomic transaction once with all required dimensions, then aggregate it in reports.

Examples:

* One spare-part cost transaction may be reportable by machine, line, section, area, branch, and maintenance administration.
* Do not create six separate cost transactions for the same physical issue.
* Production output from sequential machines must not be summed as if each machine produced separate final goods.
* Final line output must come from an approved measurement point or defined aggregation rule.
* Manufacturing output and packaging output must not be double-counted as the same finished product.

Derived totals must come from authoritative source records.

Cached totals are allowed only with a documented reconciliation strategy.

Every quantity, cost, downtime duration, and status transition must have a clear source of truth.

---

## 13. Backend Standards

Every new or changed backend operation must include:

* Authentication unless explicitly public.
* Backend permission enforcement.
* Tenant and branch validation.
* DTO validation.
* Unknown-field rejection.
* Business-rule validation.
* Clear service boundaries.
* Proper transactions.
* Stable error contracts.
* Audit logging for sensitive actions.
* Idempotency or duplicate prevention where repeated submission is possible.
* Pagination for potentially large lists.
* Filtering and sorting where operationally required.
* Consistent status transition enforcement.

Controllers must remain thin.

Business rules belong in services or dedicated domain policies, not duplicated across controllers.

Do not trust frontend validation.

Do not expose secret, password, token, or internal security values.

Do not return raw database exceptions to users.

Use consistent localized error keys or the established API error format.

A state transition must validate:

* Current state.
* Requested next state.
* User permission.
* Tenant scope.
* Required data.
* Related-record state.
* Inventory or production impact.
* Audit metadata.

Do not update status through unrestricted generic edit endpoints when a dedicated transition is required.

---

## 14. Frontend Standards

Every frontend operation must use the real backend API.

A complete CRUD flow requires:

* Real list.
* Real details.
* Real create.
* Real edit of the same record.
* Real delete/deactivate where allowed.
* Real permission checks.
* Real loading and error handling.
* Real empty states.
* Arabic and English translations.
* RTL and LTR verification.

Use `POST` for creation and the project's established `PATCH /:id` pattern for updating the same record.

Edit pages must fetch the existing record and map it into the form.

Editing must never create a new record.

Do not use hard-coded operational options when an API or configurable reference table exists.

Do not show actions that the current user cannot perform.

Frontend permission hiding does not replace backend permission enforcement.

Reuse existing shared components:

* Error modal.
* Toasts.
* Unified F9 lookup.
* Search adapters.
* Admin action patterns.
* Data-grid patterns.
* Entity components.
* Operational-context components.

Do not create a second competing UI pattern without explicit approval.

---

## 15. Arabic, English, RTL, and LTR

Every user-facing feature must support Arabic and English.

Do not hard-code user-facing text in components, controllers, services, reports, or validation responses.

Add matching translation keys for both languages.

Translation key sets must remain synchronized.

Arabic must be tested in RTL.

English must be tested in LTR.

Verify:

* Form alignment.
* Table alignment.
* Modal direction.
* Icons.
* Numbers.
* Dates.
* Pagination.
* Side panels.
* Print layouts.
* Export labels.
* Error messages.
* Empty states.
* Status labels.
* Action labels.

Do not return raw translation keys to the user.

---

## 16. Permissions, Audit, and Accountability

Every sensitive action requires a stable, seeded permission key.

Before creating a permission:

* Search existing permission definitions.
* Search controllers.
* Search frontend usage.
* Search seed files.
* Avoid synonyms and mismatches.

A permission is incomplete until:

* Defined.
* Seeded.
* Assigned as required.
* Enforced in backend.
* Used correctly in frontend.
* Translated where displayed.
* Tested for allowed and denied roles.

Audit sensitive actions, including:

* Create.
* Update.
* Delete or deactivate.
* Approval.
* Rejection.
* Cancellation.
* Status transitions.
* Inventory posting.
* Spare-part issue.
* Part installation and removal.
* Cost override.
* Tenant or branch override.
* Assignment changes.
* Production posting.
* Downtime ownership changes.

Audit data should include:

* User.
* Employee where available.
* Company.
* Branch.
* Entity type.
* Entity ID.
* Action.
* Timestamp.
* Previous values when relevant.
* New values when relevant.
* Reason where required.

---

## 17. Maintenance and Inventory Protection

Do not weaken the existing maintenance and inventory transactional behavior.

For maintenance work:

* Preserve request history.
* Preserve assignments.
* Preserve downtime records.
* Preserve parts accountability.
* Preserve installed-part and replacement history.
* Preserve preventive schedules and checklists.
* Preserve numbering.
* Preserve stock issue transactions.

For spare-part issue and installation:

* Validate compatible tenant, warehouse, machine, component, and work order.
* Validate available quantity.
* Prevent negative inventory.
* Create inventory movement.
* Update inventory balance.
* Record requester, approver, issuer, receiver, installer, machine, component, and source document as applicable.
* Record cost ownership.
* Record installation and replaced part.
* Perform dependent updates atomically.

Do not directly edit an inventory balance without an authorized source transaction.

---

## 18. Production Module Principles

The production module does not currently exist as a complete operational domain.

Build it incrementally as tested vertical slices.

Do not create the entire production domain in one uncontrolled batch.

Recommended implementation order:

1. Production master data required by execution.
2. Shifts and operational assignments.
3. Product capacity standards.
4. Production orders.
5. Production execution sessions or runs.
6. Machine and line output recording.
7. Downtime and loss reasons.
8. Waste and rework.
9. Material issue and consumption.
10. Finished-goods receipt.
11. Quality integration.
12. Cost integration.
13. OEE and performance reporting.

Production must integrate with existing:

* Companies.
* Branches.
* Organizational structure.
* Production lines.
* Machines.
* Machine components.
* Warehouses.
* Products.
* Cost centers.
* Maintenance requests.
* Downtime.
* Notifications.
* Audit.
* Numbering.
* Search.
* Attachments.

Do not duplicate existing entities only to make production development easier.

---

## 19. Tests Are Mandatory

The existence of an empty test file is not a test.

Every operational change must add meaningful tests appropriate to its risk.

Required test categories include:

* Business-rule unit tests.
* Service/database integration tests.
* API authorization tests.
* Tenant-isolation tests.
* Permission allow/deny tests.
* Status-transition tests.
* Inventory atomicity tests.
* Duplicate-submission tests.
* Invalid-reference tests.
* Regression tests for fixed defects.
* Frontend interaction or browser tests for critical workflows.

For tenant-owned entities, test at minimum:

* Company A can access its record.
* Company B cannot read it by ID.
* Company B cannot edit it by ID.
* Company B cannot reference it in a new transaction.
* Unauthorized branch access is rejected.
* Search and export do not leak the record.

Do not:

* Add empty specs.
* Skip failing tests without documented approval.
* Delete tests to pass validation.
* weaken assertions.
* mock away the business rule under test.
* claim success without showing actual results.

---

## 20. Validation Order

Use focused validation first to reduce wasted time.

Then run the broader required checks.

Typical order:

1. Inspect changed files.
2. Run focused unit tests.
3. Run focused integration/API tests.
4. Run Prisma validation when schema-related.
5. Run Prisma generation when required.
6. Run API type checking or build.
7. Run Web type checking.
8. Run Web build.
9. Run i18n consistency check.
10. Run focused browser proof.
11. Inspect `git diff --check`.
12. Inspect final `git status`.

Do not repeatedly run the full build after every small edit.

Run it when the coherent implementation batch is ready.

Never hide pre-existing failures.

Clearly separate:

* New failures caused by the task.
* Pre-existing failures.
* Warnings.
* Unverified areas.

---

## 21. Runtime Proof

A build passing is not sufficient proof of an operational feature.

For a critical workflow, prove the real path:

`Frontend → API → Permission → Service → Database → Audit → Result`

Where applicable, verify:

* Create.
* Read.
* Edit same record.
* Status transition.
* Permission denial.
* Tenant denial.
* Inventory effect.
* Cost effect.
* Audit event.
* Arabic UI.
* English UI.
* Error handling.
* Duplicate prevention.

Do not report `COMPLETE` when runtime wiring was not verified.

Use:

* `COMPLETE`
* `PARTIAL`
* `BLOCKED`
* `NOT_VERIFIED`

honestly.

---

## 22. Git and Repository Safety

Do not perform Git write operations unless the current task explicitly requests them.

Do not automatically:

* Commit.
* Push.
* Merge.
* Rebase.
* Reset.
* Clean.
* Delete untracked files.
* Create or move tags.
* Switch branches.

Before work, record:

* Current branch.
* Current commit.
* Existing modified files.
* Existing untracked files.

Do not overwrite pre-existing user changes.

Do not claim a clean tree when task-created proof files are present.

Do not include generated, build, cache, log, secret, or temporary artifacts in commits.

Never force-push.

---

## 23. Secrets and Environment Files

Never expose or commit:

* Database credentials.
* JWT secrets.
* API keys.
* SMTP passwords.
* Tokens.
* Private certificates.
* User passwords.
* Production connection strings.

Do not display secret values in reports.

Use `REDACTED`.

Read `.env.example` where needed.

Do not read real `.env` files unless the task explicitly requires a safe configuration diagnosis and permission allows it.

Do not modify environment files without explicit instruction.

---

## 24. Performance and Scalability

Avoid unbounded list queries.

Use pagination and targeted field selection.

Prevent N+1 query patterns.

Use indexes aligned with real filters.

Do not load complete attachment bodies or large histories in normal list endpoints.

Do not calculate large aggregates in the browser when they belong in the backend or database.

Do not add caching before defining invalidation and tenant isolation.

For reports:

* Apply tenant filters.
* Apply date limits.
* Stream or paginate large exports where needed.
* Avoid loading all operational history into memory.

Performance changes must preserve correctness.

---

## 25. Definition of Done

A requested feature is complete only when all applicable items are satisfied:

* Existing implementation inspected.
* No duplicate domain created.
* Database model and migration are safe.
* Existing data is preserved.
* Tenant isolation is enforced.
* Branch scope is enforced where applicable.
* Backend API is real.
* DTO validation is complete.
* Permissions are defined and seeded.
* Backend permissions are enforced.
* Frontend permissions are applied.
* Audit is implemented.
* Frontend is connected to the real API.
* Create works.
* Details work.
* Edit updates the same record.
* Status actions work.
* Loading, empty, and error states work.
* Daily input is minimized.
* Existing data auto-populates safely.
* Arabic is complete.
* English is complete.
* RTL works.
* LTR works.
* Tests are meaningful and passing.
* Runtime workflow is proven where required.
* No unrelated files changed.
* No mock data or placeholders were introduced.
* Documentation is updated only where necessary.
* Final diff is reviewed.
* Final status is honestly reported.

---

## 26. Final Response Format

At the end of an implementation task, report:

1. Task status.
2. Exact scope completed.
3. Files created.
4. Files modified.
5. Database models or migrations changed.
6. API endpoints added or changed.
7. Frontend routes added or changed.
8. Permissions added or changed.
9. Tests added and results.
10. Build and validation results.
11. Runtime proof results.
12. Tenant-isolation proof.
13. Known limitations.
14. Pre-existing issues encountered.
15. Git status.
16. Commit and tag status only when explicitly requested.

Do not use vague statements such as:

* "Everything should work."
* "The feature is likely complete."
* "Tests appear fine."
* "Production ready" without evidence.

---

## 27. Task-Specific Rule Loading

Do not load all detailed rule files for every task.

Load only the relevant files:

* Architecture, organization, or cross-module changes:
  `docs/agent-rules/architecture-and-tenancy.md`

* Prisma, SQL Server, models, indexes, or migrations:
  `docs/agent-rules/database-and-migrations.md`

* NestJS, API, permissions, auditing, or business rules:
  `docs/agent-rules/backend-and-security.md`

* Next.js, forms, tables, Arabic/English, F9, or user experience:
  `docs/agent-rules/frontend-and-ux.md`

* Tests, builds, browser proof, or release validation:
  `docs/agent-rules/testing-and-proof.md`

* Maintenance changes:
  `docs/agent-rules/domain-rules/maintenance.md`

* Inventory or spare-parts changes:
  `docs/agent-rules/domain-rules/inventory.md`

* Production changes:
  `docs/agent-rules/domain-rules/production.md`

When a referenced file does not exist:

* Do not invent its contents.
* Continue using this `AGENTS.md`.
* Report the missing rule file.
* Do not create it unless the task explicitly requests rule-file creation.

Treat loaded rule files as mandatory extensions of this document.

When a task-specific prompt conflicts with this file, follow the task-specific prompt only when it explicitly overrides the relevant rule and does not cause data loss, security failure, or destructive database behavior.
