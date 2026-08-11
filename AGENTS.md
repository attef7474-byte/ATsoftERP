# ATsofterp Permanent Engineering Instructions

## 0. Authority and Reference Order

The authoritative engineering contract for every future change is:

**`docs/architecture/atsoft-erp-engineering-constitution-v1.0.md`**

Read it for any task that touches architecture, tenancy, database, backend, frontend, i18n, permissions, tests, proof, or release validation. This file is only a concise operating summary.

Reference priority on conflict:

1. The Engineering Constitution (`docs/architecture/atsoft-erp-engineering-constitution-v1.0.md`).
2. Domain rule files in `docs/agent-rules/` (load only the relevant ones per task).
3. The Permanent Development Contract (`docs/architecture/atsoft-erp-development-contract-v1.0.md`) — read it fully at the start of every implementation session; its section 17 is the task execution template.
4. UI / i18n / appearance / access baseline protection (`docs/governance/ui-baseline-protection.md` + machine-readable manifest `docs/governance/accepted-ui-i18n-baseline.json` + `scripts/check-ui-baseline.mjs`).
5. This file (concise summary).
6. `docs/proofs/atsofterp-current-architecture-discovery-report.md` (discovery aid, not design authority).

Domain rule files (load the relevant subset, never all):

* Architecture / organization / cross-module: `docs/agent-rules/architecture-and-tenancy.md`
* Prisma / SQL Server / models / migrations: `docs/agent-rules/database-and-migrations.md`
* NestJS / API / permissions / audit / business rules: `docs/agent-rules/backend-and-security.md`
* Next.js / forms / tables / Arabic-English / F9 / UX: `docs/agent-rules/frontend-and-ux.md`
* Tests / builds / browser proof / release validation: `docs/agent-rules/testing-and-proof.md`
* Maintenance: `docs/agent-rules/domain-rules/maintenance.md`
* Inventory / spare parts: `docs/agent-rules/domain-rules/inventory.md`
* Production: `docs/agent-rules/domain-rules/production.md`

If a referenced rule file does not exist: do not invent it, do not create it unless asked, continue with the Constitution, and report the missing file.

---

## 1. Project Identity

Project name: `ATsofterp`

ATsofterp is a production-grade, multi-company system for maintenance, production, assets, inventory, spare parts, operational costing, factory organization, and daily factory operations.

* Windows local runtime, SQL Server, Prisma, NestJS API, Next.js App Router frontend, TypeScript.
* Arabic and English UIs with RTL and LTR support.
* JWT and permission-based authorization.
* No Docker for the approved baseline unless explicitly changed.

The repository already contains substantial implemented maintenance, inventory, asset, reporting, settings, audit, notification, attachment, barcode, and administrative functionality.

The current code is the final source of truth. Do not treat the repository as a new project. Do not rebuild working modules without a justified, approved migration. Previous reports are discovery aids only.

---

## 2. Non-Negotiable Reality Rule

ATsofterp must contain real, connected, production-capable functionality.

Prohibited: mock operational data; fake/demo pages presented as complete; static success responses; buttons without real handlers; forms that do not save through a real API; APIs not connected to real database operations; empty services/controllers/DTOs/tests/pages; hard-coded operational records; silent fallbacks hiding missing backend functionality; catch blocks that suppress errors; disabling validation or tests to pass a build; claiming completion based only on compilation.

A feature is complete only when its database, backend, permissions, frontend, translations, tests, and runtime flow are connected and verified.

---

## 3. Tenancy and Multi-Company Invariants

Multi-company isolation is a mandatory security boundary, never an optional frontend filter.

For every create/read/update/delete/search/report/export/print/attachment/notification/audit/background operation:

* Enforce company scope in the backend.
* Enforce branch scope when applicable.
* Never rely on a frontend header or hidden field.
* Never trust a client-provided company/branch without authorization validation.
* Never fetch tenant-owned records by `id` alone.
* Validate that referenced records belong to compatible company/branch contexts.
* Prevent cross-company and unauthorized cross-branch relationships.
* Scope unique constraints, numbering, search, exports, attachments, and audit appropriately.

For write operations the active operational context must be valid and authorized; a missing context must never silently broaden access.

SUPER_ADMIN behavior must be explicit and audited. Do not use SUPER_ADMIN to hide missing tenant enforcement for normal roles.

---

## 4. Scope Control

Modify only files required by the current task.

Do not: refactor unrelated modules; rename unrelated models/routes; reformat the whole repo; activate rejected or empty modules; add Finance, Sales, Purchasing, HR payroll, AI, IoT, BI, forecasting, or other unapproved scopes unless explicitly requested; create speculative future modules; create files not used by the implemented runtime.

Avoid both extremes: no incomplete one-file patch when an end-to-end change is required, and no repository-wide restructuring for a localized requirement.

Preserve and extend existing working modules (maintenance, inventory, machines, spare parts, installed parts, replacement history, repair orders, reporting, search, numbering, settings, notifications, audit, attachments). Never create parallel duplicates of existing concepts unless a migration plan is explicitly approved.

---

## 5. Minimum Data Entry and Smart Defaults

Enter information once, reuse it everywhere safely.

Automatically derive and populate company, branch, facility, organizational unit, area, section, line, machine, component, operation type, cost center, warehouse, shift, current user/employee, date/time, document number, initial status, responsible groups, product/machine defaults, and related order data. Editing must load the same existing record and prefill all editable fields. Editing must never create a new record.

Automatically derived fields must not be duplicated as independent manual inputs. Overrides of auto-populated fields require authorization, visibility, and audit (with reason when sensitive).

Use progressive disclosure, searchable lookups, the unified F9/search patterns, loading/empty/error/permission states, duplicate-submission prevention, and confirmation for destructive actions.

---

## 6. Database Safety

SQL Server contains important existing data. Never execute or recommend: `prisma migrate reset`, database deletion, table truncation, destructive reset, unreviewed `prisma db push`, editing an applied migration, deleting migration history, recreating the database to fix a schema issue, or unscoped delete/update.

Use reviewed migrations. For sensitive schema changes use phased migrations (nullable structure → backfill → verify → constraints → application behavior → deprecation in a separate task). Use transactions for multi-record operations; inventory, costing, installation, replacement, production posting, and workflow transitions must be atomic. Use `Decimal` for money and precise quantities. Add indexes only for real query paths with understood write/storage impact.

Do not store the same business amount as separate facts at every hierarchy level; record the atomic transaction once with all dimensions, then aggregate in reports.

---

## 7. Backend Standards

Every new or changed backend operation must include: authentication, backend permission enforcement, tenant/branch validation, DTO validation, unknown-field rejection, business-rule validation, clear service boundaries, proper transactions, stable error contracts, audit logging for sensitive actions, idempotency where repeated submission is possible, pagination, filtering/sorting, and consistent status-transition enforcement.

Controllers remain thin. Do not trust frontend validation. Do not expose secrets. Do not return raw database exceptions. Use consistent localized error keys. A state transition must validate current state, requested next state, permission, tenant scope, required data, related-record state, inventory/production impact, and audit metadata. Do not update status through unrestricted generic edit endpoints when a dedicated transition is required.

---

## 8. Frontend Standards

Every frontend operation must use the real backend API. A complete CRUD flow requires real list, details, create, edit of the same record, delete/deactivate where allowed, real permission checks, loading/error/empty states, and Arabic/English with RTL/LTR verification.

Use `POST` for creation and the project's `PATCH /:id` pattern for updating the same record. Reuse existing shared components (error modal, toasts, unified F9 lookup, search adapters, admin action patterns, data-grid patterns, entity components, operational-context components). Do not create a second competing UI pattern without explicit approval.

---

## 9. Arabic, English, RTL, LTR

Every user-facing feature must support Arabic and English. Do not hard-code user-facing text in components, controllers, services, reports, or validation responses. Add matching translation keys for both languages and keep key sets synchronized. Arabic must be tested in RTL, English in LTR. Never return raw translation keys to users.

---

## 10. Permissions, Audit, Accountability

Every sensitive action requires a stable, seeded permission key. Search existing permission definitions before creating new ones; avoid synonyms. A permission is incomplete until defined, seeded, required, enforced in backend, used in frontend, translated where displayed, and tested for allowed and denied roles.

Audit sensitive actions (create/update/delete/approval/rejection/cancellation/status transitions/inventory posting/spare-part issue/installation and removal/cost override/tenant-branch override/assignment changes/production posting/downtime ownership changes) with user, employee where available, company, branch, entity type/id, action, timestamp, previous/new values, and reason where required.

---

## 11. Maintenance and Inventory Protection

Do not weaken existing maintenance and inventory transactional behavior. Preserve request history, assignments, downtime records, parts accountability, installed-part/replacement history, preventive schedules and checklists, numbering, and stock issue transactions.

For spare-part issue/installation: validate tenant/warehouse/machine/component/work-order compatibility, validate available quantity, prevent negative inventory, create inventory movement, update balance, record requester/approver/issuer/receiver/installer/source document and cost ownership, record installation and replaced part, all atomically. Never edit an inventory balance without an authorized source transaction.

---

## 12. Production Module

Production does not exist yet as a complete operational domain. Build it incrementally as tested vertical slices (master data → shifts/assignments → capacity standards → orders → runs → output → downtime/loss reasons → waste/rework → material consumption → finished-goods receipt → quality → cost → OEE/reporting). Integrate with existing companies, branches, org structure, lines, machines, components, warehouses, products, cost centers, maintenance, downtime, notifications, audit, numbering, search, attachments. Do not duplicate existing entities.

---

## 13. Tests Are Mandatory

Every operational change must add meaningful tests appropriate to its risk: business-rule unit tests, service/database integration tests, API authorization tests, tenant-isolation tests, permission allow/deny tests, status-transition tests, inventory atomicity tests, duplicate-submission tests, invalid-reference tests, regression tests, and frontend/browser tests for critical workflows.

For tenant-owned entities test at minimum: Company A accesses its record; Company B cannot read/edit it by id; Company B cannot reference it in a new transaction; unauthorized branch access is rejected; search/export do not leak it.

Do not add empty specs, skip failing tests, delete tests to pass validation, weaken assertions, or mock away the business rule under test. Report actual results.

---

## 14. Validation Order

1. Inspect changed files.
2. Focused unit tests.
3. Focused integration/API tests.
4. Prisma validation when schema-related.
5. Prisma generation when required.
6. API type checking / build.
7. Web type checking.
8. Web build.
9. i18n consistency check.
10. UI / appearance baseline integrity check (`npm run ui-baseline:check` or `node scripts/check-ui-baseline.mjs`, which reads `docs/governance/accepted-ui-i18n-baseline.json`).
11. Focused browser proof.
12. `git diff --check`.
13. Final `git status`.

Never hide pre-existing failures. Separate new failures, pre-existing failures, warnings, and unverified areas.

---

## 15. Runtime Proof

A build passing is not proof of a feature. For critical workflows prove the real path `Frontend → API → Permission → Service → Database → Audit → Result`. Verify create, read, edit same record, status transition, permission denial, tenant denial, inventory effect, cost effect, audit event, Arabic UI, English UI, error handling, duplicate prevention. Report honestly: `COMPLETE` / `PARTIAL` / `BLOCKED` / `NOT_VERIFIED`.

---

## 16. Git and Secrets Safety

Do not perform Git write operations (commit/push/merge/rebase/reset/clean/delete/branch/tag) unless the task explicitly requests them. Before work record current branch, commit, modified files, and untracked files. Do not overwrite pre-existing user changes. Do not include generated, build, cache, log, secret, or temporary artifacts in commits. Never force-push.

Never expose or commit database credentials, JWT secrets, API keys, SMTP passwords, tokens, private certificates, user passwords, or production connection strings. Use `REDACTED`. Read `.env.example` when needed. Do not modify environment files without explicit instruction.

---

## 17. Performance

Avoid unbounded list queries; use pagination and targeted field selection; prevent N+1; align indexes with real filters; do not load full attachment bodies or large histories in list endpoints; do not compute large aggregates in the browser; no caching before defining invalidation and tenant isolation; apply tenant filters, date limits, and streaming/pagination for large report exports.

---

## 18. Definition of Done

A feature is complete only when applicable: existing implementation inspected; no duplicate domain; safe model/migration; data preserved; tenant isolation enforced; branch scope enforced; real backend API; complete DTO validation; permissions defined/seeded/enforced in backend and applied in frontend; audit implemented; frontend connected to real API; create/details/edit-same-record/status actions work; loading/empty/error states work; minimum daily input; safe auto-population; Arabic and English complete; RTL and LTR work; tests meaningful and passing; runtime workflow proven; no unrelated files changed; no mock data or placeholders; final diff reviewed; status honestly reported.

---

## 19. Final Response Format

Report at the end of an implementation task: 1) task status, 2) exact scope completed, 3) files created, 4) files modified, 5) database models/migrations changed, 6) API endpoints added/changed, 7) frontend routes added/changed, 8) permissions added/changed, 9) tests added and results, 10) build and validation results, 11) runtime proof results, 12) tenant-isolation proof, 13) known limitations, 14) pre-existing issues encountered, 15) git status, 16) commit/tag status only when explicitly requested.

Do not use vague statements such as "everything should work", "likely complete", "tests appear fine", or "production ready" without evidence.
