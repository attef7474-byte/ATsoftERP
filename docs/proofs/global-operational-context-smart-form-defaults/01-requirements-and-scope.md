# 01 — Requirements and Scope

## Objective

Implement a validated operational context for company, branch, optional administration, and optional department across the active ATsoft ERP release. The context must be selected after authentication, visible in the top bar, attached to API requests, validated by the backend, and used to simplify forms and filter F9/search results.

## Mandatory sequence

1. Read `AGENTS.md`.
2. Capture clean preflight and current runtime status.
3. Discover every active page, form, Prisma model, registered API controller, DTO and lookup.
4. Create `00-full-forms-coverage-matrix.md` before application-code changes.
5. Decide whether the current User relationship is sufficient or an additive scope model is required.
6. Implement backend authorization before relying on frontend filtering.
7. Implement frontend selection, headers, top-bar display and smart defaults.
8. Validate real API, browser, business and rejection paths.

## Active scope

- Auth, access control, companies, branches, administrations and departments.
- Inventory and warehouse operational flows.
- Maintenance/CMMS operational flows.
- Barcode/QR, audit, reports, notifications, attachments, messaging and active settings.
- All active admin pages and registered API modules discovered from the current checkout.

## Forbidden scope

Finance, Purchasing, Sales, HR, AI, IoT, BI, Forecasting, Predictive Maintenance, Workflows, Universal Requests, Import/Export Designer, Dynamic Engine and Print Template Designer remain inactive. They are inventoried separately and will not be registered, linked or used as completion evidence.

## Safety

- Windows local runtime and SQL Server only.
- No Docker or PostgreSQL.
- No Prisma db push, migrate dev/reset, database reset, destructive seed or data wipe.
- Any schema change must be additive, SQL Server-safe, manually migrated and proven with pre/post integrity checks.
- No mock API, fake data, placeholder page, fake browser proof, package upgrade, force push or tag overwrite.

