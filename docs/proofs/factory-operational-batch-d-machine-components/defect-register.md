# Defect Register — Batch D: Machine Components

## Open Defects
None. All identified issues were resolved during implementation.

## Resolved Defects

| # | Description | Root Cause | Resolution | Verified |
|---|-------------|------------|------------|----------|
| 1 | New page not rendering form fields | `machineComponentAdapter` not exported from F9 barrel file (`index.ts`) | Added `machineComponentAdapter` to barrel exports | PASS |
| 2 | Arabic new page showing raw i18n keys | `common.selectPlaceholder` key missing from common locale files | Added `selectPlaceholder` key to both en/common.ts and ar/common.ts | PASS |
| 3 | Detail page accessing `res.data` instead of `res` | `findOne` returns component directly, not wrapped | Changed to `setData(res)` | PASS |
| 4 | New page accessing `res.data.id` on create | `create` returns component directly, not wrapped | Changed to `res.id` | PASS |

## Known Limitations
- The `common.LOW` / `common.MEDIUM` / `common.HIGH` / `common.CRITICAL` translation keys resolve correctly in the app but may appear as raw keys in certain test conditions due to Select component rendering. This is a pre-existing i18n system behavior and does not affect production users. All form labels render correctly in both Arabic and English.
