# 01 — Current i18n Audit

## Frontend i18n

| Metric | Value |
|--------|-------|
| EN locale files | 13 TS files (common.ts, navigation.ts, grid.ts, core.ts, access.ts, settings.ts, inventory.ts, maintenance.ts, barcodes.ts, reports.ts, validation.ts, system.ts + index.ts) |
| AR locale files | 13 TS files (same structure) |
| EN keys total | ~2,977 (all in TS files) |
| AR keys total | ~2,977 (all in TS files) |
| EN/AR parity | 100% — identical key structure across all files |
| Provider | React Context (`I18nProvider`) → returns raw key if not found |
| Orphan JSON | `en-numbering.json` + `ar-numbering.json` — NOT imported by index.ts, content duplicated in settings.ts |

### Known Issues (Before Fix)

1. **`OperationalPerson` in Arabic settings**: 2 occurrences in `ar/settings.ts` lines 83, 214 — should be `'موظفي الصيانة'` (already used correctly in `operationNameMap`)
2. **Orphan JSON files**: `en-numbering.json` and `ar-numbering.json` — not imported, content duplicated in settings.ts
3. **Login hardcoded placeholder**: `placeholder="admin@atsofterp.com"` in `login/page.tsx:59`
4. **Missing namespaces**: 5 namespaces defined in `types.ts` but never implemented: `inventoryCounting`, `maintenanceDashboard`, `preventiveMaintenance`, `downtimeAnalysis`, `sparePartRequest`. Search confirmed no code uses these namespaces.

## API i18n

| Metric | Value |
|--------|-------|
| `api-messages.ts` | Exists but EMPTY (0 bytes) |
| `get-request-language.ts` | Exists but EMPTY (0 bytes) |
| Current error pattern | English-only `throw new UnauthorizedException('Invalid credentials')` |
| Exception filter | Exists at `common/filters/http-exception.filter.ts` — returns `{ success, statusCode, message[], timestamp }` |
| Filter registration | NOT registered in `main.ts` (was missing `app.useGlobalFilters()`) |

### Current English-Only API Errors Found

| File | Line | Error |
|------|------|-------|
| `auth/auth.service.ts` | 17 | `'Invalid credentials'` |
| `auth/auth.service.ts` | 19 | `'Account is inactive'` |
| `auth/auth.service.ts` | 22 | `'Invalid credentials'` |
| `auth/guards/jwt-auth.guard.ts` | 22 | `'Invalid or expired token'` |
| `auth/guards/permissions.guard.ts` | 20 | `'No user found'` |
| `auth/guards/permissions.guard.ts` | 45 | `'Insufficient permissions'` |
| `auth/strategies/jwt.strategy.ts` | 24 | `'User not found or inactive'` |
| `numbering/numbering.service.ts` | 40,46,65 | `'Number sequence not found'` |

## Summary
Frontend i18n is 100% balanced with 3 specific bugs to fix. API i18n files exist but are empty — foundation needs to be filled in.
