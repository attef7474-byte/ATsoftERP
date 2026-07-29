# 14 — Final Acceptance Report

## Status

**RELEASE_READY_FULL_RUNTIME_VERIFIED**

## Repository

- Branch: `main`.
- Starting commit: `64ba3c2`.
- Final commit: the commit containing this report (`Runtime UI reports i18n final proof patch`); exact hash is reported from Git after commit creation.
- Starting remote state: `origin/main` at `64ba3c2`, clean.
- Push/tags: performed only after all gates and recorded in the final handoff.

## Scope and proof

- P0 machine detail, installed parts, repair orders and BOM runtime/query failures: fixed.
- Reports, maintenance, navigation, barcode, inventory and shared enum/status/action/unit translations: fixed.
- API runtime: 134/134 PASS, unexpected 404/500 = 0.
- Browser DOM: 36/36 routes, 360/360 checks, console errors = 0.
- Required screenshot routes: 21/21 PASS.
- Business operations: 51/51 PASS; controlled company update restored exactly.
- Health: 4/4 PASS.
- Smoke: 8/8 PASS.
- API build, Web build, Web TypeScript, Prisma validate/generate and EN/AR parity: PASS.

## Limitations

- No functional release limitation remains in the tested active scope.
- A safe spare-part issue mutation was not run because no isolated test stock/request/warehouse context existed. Read-only balance and condition movement verification was used, as explicitly allowed by the task.
- Existing lack of an ESLint configuration remains a non-blocking project tooling warning.

## Safety

- No schema or migration.
- No Prisma push/migrate/reset.
- No Docker/PostgreSQL.
- No destructive seed/delete.
- No forbidden module activation.
- No mock API, placeholder page, fake rows or fake proof.
- No secret/token included in proof.
- No force push or overwritten tag.
