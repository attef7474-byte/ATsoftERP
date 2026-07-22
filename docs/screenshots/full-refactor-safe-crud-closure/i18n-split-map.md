# i18n split map

Both `ar.ts` and `en.ts` remain compatibility wrappers and explicitly export
their corresponding `ar/index.ts` or `en/index.ts` module.

| File | Preserved top-level namespaces |
| --- | --- |
| `common.ts` | `common`, `auth`, `dashboard`, `actions`, `status` |
| `navigation.ts` | `navigation`, `f9`, `workspace`, `search`, `unifiedSearch` |
| `grid.ts` | `grid` |
| `core.ts` | `core`, `details`, `companyProfile`, `attachments` |
| `access.ts` | `access`, `users`, `roles`, `permissions`, `profile`, `userActivity`, `loginHistory` |
| `settings.ts` | `settings`, `notifications`, `messaging`, `languageSettings`, `appearanceSettings`, `securitySettings`, `notificationRules` |
| `inventory.ts` | `inventory`, `inventoryCounting`, `inventoryCountWorkflow` |
| `maintenance.ts` | `maintenance`, `cmms`, `maintenanceWorkflow`, `maintenanceDashboard`, `preventiveMaintenance`, `downtimeAnalysis` |
| `barcodes.ts` | `barcodes` |
| `reports.ts` | `reports` |
| `validation.ts` | `validation`, `errors`, `complexForms` |
| `system.ts` | `alerts` |

The split is mechanical: every original namespace object is moved once, with
no key removal, rename, or value rewrite. The index files compose the same
`LocaleTranslations` object shape consumed by the provider and literals helper.
