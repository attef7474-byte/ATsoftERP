# Import migration map

## Compatibility barrels (public import paths retained)

| Old import path | New directory/file | Barrel re-export |
|---|---|---|
| `@/lib/admin-types` | `@/lib/admin-types/` | `@/lib/admin-types/index.ts` re-exports all domain types |
| `@/components/admin/ui` | `@/components/admin/ui/` | `@/components/admin/ui/index.ts` re-exports all UI components |
| `@/components/admin/admin-data-grid` | `@/components/admin/datagrid/` | `@/components/admin/datagrid/index.ts` re-exports grid sub-components |
| `@/components/admin/admin-shell` | `@/components/admin/shell/` | `@/components/admin/shell/index.ts` re-exports shell sub-components |
| `@/lib/i18n/locales/ar` | `@/lib/i18n/locales/ar/` | `@/lib/i18n/locales/ar/index.ts` re-exports all Arabic namespaces |
| `@/lib/i18n/locales/en` | `@/lib/i18n/locales/en/` | `@/lib/i18n/locales/en/index.ts` re-exports all English namespaces |
| `reports.service.ts` | `reports.service.ts` (facade) | Delegates to `services/*.service.ts` — no barrel change |

## Compatibility wrappers (original files retain re-exports)

- `apps/web/src/lib/admin-types.ts` → re-exports from `@/lib/admin-types`
- `apps/web/src/components/admin/ui.tsx` → re-exports from `@/components/admin/ui`
- `apps/web/src/components/admin/admin-data-grid.tsx` → re-exports from `@/components/admin/datagrid`
- `apps/web/src/components/admin/admin-shell.tsx` → re-exports from `@/components/admin/shell`
- `apps/web/src/lib/i18n/locales/ar.ts` → re-exports from `@/lib/i18n/locales/ar`
- `apps/web/src/lib/i18n/locales/en.ts` → re-exports from `@/lib/i18n/locales/en`

## Reports service (NestJS DI — no import change)

- `reports.service.ts` facade delegates to `services/*.service.ts`
- `ReportsModule` registers all 8 providers
- Controller import unchanged (`ReportsService` from `./reports.service`)
