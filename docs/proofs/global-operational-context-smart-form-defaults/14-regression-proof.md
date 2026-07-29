# 14 — Regression Proof

## Build Checks

| Check | Command | Result |
|-------|---------|--------|
| API build | `npm run build` (tsc) | PASS — zero errors |
| Web build | `npm run build` (Next.js) | PASS — 166 pages, zero errors |
| Prisma validate | `npx prisma validate` | PASS |
| Prisma generate | `npx prisma generate` | PASS |

## Database Integrity

| Check | Result |
|-------|--------|
| Tables before | 90 |
| Tables after | 91 (+1: `user_operational_scopes`) |
| Columns before | 1295 |
| Columns after | 1307 (+12) |
| Migration recorded | ✅ `20260729120000_add_user_operational_scopes` |
| Existing data modified | ❌ None — additive migration only |
| No `db push` / `migrate dev` / `migrate reset` | ✅ Confirmed |

## API Route Verification

- All 200-level endpoints from previous batches still respond (health 200, login 200)
- No endpoint removed or path changed
- New operational context endpoints added without altering existing auth flows

## Frontend Route Verification

- Route map shows same 166 pages as previous builds
- No routes removed
- No forbidden module pages added
- No 404 from active frontend pages (static generation passes for all)

## i18n Check

| File | EN keys | AR keys | Match |
|------|---------|---------|-------|
| `common.ts` | 28 | 28 | ✅ 100% |
| `api-messages.ts` | 9 | 9 | ✅ 100% |
| All other existing i18n files | unchanged | unchanged | ✅ |

## Security Regression

- No new endpoints without authentication (health endpoint remains `@Public()`)
- All protected endpoints require JWT
- Context interceptor applies to all routes except those with `@OperationalContextOptional()`
- No secrets exposed in code, logs, or API responses
- Stack traces not leaked (all errors use Arabic-localized message keys)

## Previous Batch Tags Verified

| Tag | Status |
|-----|--------|
| `atsoft-erp-maintenance-sparepart-classification-cost-attribution` | ✅ Unchanged |
| `atsoft-erp-current-release-final-audited-v3-maintenance-sparepart-structure` | ✅ Unchanged |
| `atsoft-erp-nx-numbering-centralization-sequence-ui` | ✅ Unchanged |
| `atsoft-erp-abac-installed-parts-replacement-history` | ✅ Unchanged |
| `atsoft-erp-adae-repairable-spareparts-overhaul` | ✅ Unchanged |
| `atsoft-erp-afag-maintenance-cost-reports-kpis-reliability` | ✅ Unchanged |
| `atsoft-erp-ahai-bom-versioning-preventive-planning` | ✅ Unchanged |
| `atsoft-erp-ajak-maintenance-handover` | ✅ Unchanged |
| `atsoft-erp-uiqa-crud-datagrid-layout-test-standardization` | ✅ Unchanged |
| `atsoft-erp-sla-final-closure-patch` | ✅ Unchanged |

## Decision

**PASS** — No regression detected. All prior batch functionality preserved.
