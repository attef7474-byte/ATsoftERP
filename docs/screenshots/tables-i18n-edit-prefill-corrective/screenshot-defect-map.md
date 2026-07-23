# Screenshot Defect Map — Tables / i18n / Edit Prefill Defects

## Defect Inventory

| # | Route/Page | Category | Visible Issue | Expected | Actual | Severity | Fix Target |
|---|-----------|----------|--------------|----------|--------|----------|------------|
| 1 | `/admin/alerts` | RAW_I18N_KEY | `t(alerts.${item.type} as any)` may show raw key | Translated type label | Raw key if API returns unknown type | HIGH | `alerts/page.tsx:57` — add fallback |
| 2 | `/admin/barcodes/scans` | RAW_I18N_KEY | Purpose dropdown shows raw snake_case keys | `generalLookup` → "General Lookup" | Shows `general_lookup` (wrong case) | BLOCKER | `barcodes/scans/page.tsx:71` — fix key mapping |
| 3 | `/admin/settings/notification-rules` | RAW_I18N_KEY | Channel labels show raw enum values | "In-App", "Email" | Shows "IN_APP", "EMAIL" | HIGH | `notification-rules/page.tsx:143,166` — add translations |
| 4 | `/admin/settings/notification-rules` | RAW_I18N_KEY | Severity labels show raw values | "Info", "Warning", "Error" | Shows "INFO", "WARNING", "ERROR" | HIGH | Add `status.INFO/WARNING/ERROR` keys |
| 5 | `/admin/settings/notification-rules` | RAW_I18N_KEY | Enabled column shows raw "Active"/"Inactive" | Translated labels | Hardcoded English | MEDIUM | Use `t('common.active/inactive')` |
| 6 | `/admin/inventory/adjustments` | EDIT_PREFILL | OpenEdit uses list data, no detail GET | Full record detail | Only list fields available | HIGH | Add `api.get` by ID in `openEdit` |
| 7 | `/admin/inventory/movements` | EDIT_PREFILL | OpenEdit uses list data, no detail GET | Full record detail | Only list fields available | HIGH | Add `api.get` by ID in `openEdit` |
| 8 | `/admin/inventory/product-categories` | EDIT_PREFILL | OpenEdit uses item directly from list | Full record detail | Only list fields available | HIGH | Add `api.get` by ID in `openEdit` |
| 9 | `/admin/maintenance/schedules` | EDIT_PREFILL | OpenEdit uses list data, no detail GET | Full record detail | Only list fields available | HIGH | Add `api.get` by ID in `openEdit` |
| 10 | `/admin/maintenance/tasks` | EDIT_PREFILL | OpenEdit uses list data, no detail GET | Full record detail | Only list fields available | HIGH | Add `api.get` by ID in `openEdit` |
| 11 | `/admin/maintenance/checklist-items` | EDIT_PREFILL | OpenEdit uses list data, no detail GET | Full record detail | Only list fields available | HIGH | Add `api.get` by ID in `openEdit` |
| 12 | `/admin/maintenance/machine-documents` | EDIT_PREFILL | OpenEdit uses list data, no detail GET | Full record detail | Only list fields available | HIGH | Add `api.get` by ID in `openEdit` |
| 13 | `/admin/maintenance/machine-parts` | EDIT_PREFILL | OpenEdit uses list data, no detail GET | Full record detail | Only list fields available | HIGH | Add `api.get` by ID in `openEdit` |
| 14 | `/admin/core/companies` | TABLE_FORMAT | Uses AdminDataGrid (green header) | Unified | OK — uses standard grid | N/A | No fix needed |
| 15 | `/admin/barcodes/records` | TABLE_FORMAT | Custom `<table>` (gray `bg-gray-50` header) | AdminDataGrid green header | Non-standard gray header | MEDIUM | Convert to AdminDataGrid |
| 16 | `/admin/barcodes/scans` | TABLE_FORMAT | Custom `<table>` (gray header) | AdminDataGrid green header | Non-standard gray header | MEDIUM | Convert to AdminDataGrid |
| 17 | `/admin/inventory/adjustments` | TABLE_FORMAT | Uses `DataTable` (gray header) | AdminDataGrid green header | Non-standard gray header | MEDIUM | Convert to AdminDataGrid |
| 18 | `/admin/inventory/movements` | TABLE_FORMAT | Uses `DataTable` (gray header) | AdminDataGrid green header | Non-standard gray header | MEDIUM | Convert to AdminDataGrid |
| 19 | `/admin/maintenance/schedules` | TABLE_FORMAT | Uses `DataTable` (gray header) | AdminDataGrid green header | Non-standard gray header | MEDIUM | Convert to AdminDataGrid |

## Status

- **BLOCKER defects**: 1 (#2)
- **HIGH defects**: 11 (#1, #3, #4, #6–#13)
- **MEDIUM defects**: 7 (#5, #15–#19)
- **N/A**: 1 (#14)
