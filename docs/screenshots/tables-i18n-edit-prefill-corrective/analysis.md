# Analysis — Tables / i18n / Edit Prefill Corrective

## Root Cause Analysis

### 1. Table Unification
The codebase has two table patterns:
- **AdminDataGrid** (standard): Used by core pages (Companies, Branches, Departments, Users, Roles, Permissions, Notification Rules, etc.). Features green header `bg-[#1a5632]`, RTL/LTR support, toolbar with search/filter/refresh, actions dropdown menu.
- **DataTable** (legacy): Used by inventory and maintenance pages. Features gray header `bg-gray-50`, no RTL support, no standardized toolbar, inline action buttons instead of dropdown.
- **Custom `<table>`** : Used by barcode records and scans pages. Manual table markup with gray headers.

### 2. Raw i18n Keys
The `t()` function in `i18n-provider.tsx` falls back to the raw key string if not found. Dynamic template literal keys `t(\`namespace.${variable}\`)` risk showing raw keys when the variable doesn't match any translation key. Specific cases:
- **Key case mismatch**: `barcodes/scan/page.tsx` uses `p.toLowerCase()` but locale keys use camelCase (`generalLookup` vs `general_lookup`)
- **Missing locale keys**: `status.INFO`, `status.WARNING`, `status.ERROR` keys didn't exist in any locale
- **Hardcoded English strings**: Notification rules page uses `'Active'` / `'Inactive'` directly
- **Channel labels**: Channel dropdown shows raw `IN_APP`, `EMAIL`, etc. without translation

### 3. Edit Prefill
Pages using inline modals for editing populate form fields from list data directly instead of fetching the full record by ID. This risks:
- Missing relation fields not returned by list endpoint
- Missing calculated/default fields
- Form shows incomplete/empty data
- Save partially overwrites with empty values

### Affected Areas
- 19 distinct issues identified
- 3 BLOCKER/HIGH categories: raw i18n keys, edit prefill, table format
- Fixes applied to: i18n:check script, alerts page, barcode scans page, notification rules page, StatusBadge, locale files (en and ar)
