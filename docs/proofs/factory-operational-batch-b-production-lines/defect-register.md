# Defect Register — Factory Foundation Batch B (Production Lines)

## D-001: i18n keys in wrong namespace

| Field | Value |
|-------|-------|
| **Status** | FIXED |
| **Severity** | Medium |
| **Discovered** | Batch B Browser Test 02 |
| **Root Cause** | i18n keys `productionLines`, `operationType`, `costCenter` (and 28 associated keys) were nested inside `downtimeAnalysis` namespace instead of `maintenance` namespace in both `en/maintenance.ts` and `ar/maintenance.ts`. This caused `t('maintenance.productionLines')` etc. to return the raw key instead of the translated value. |
| **Impact** | Column headers in production-lines page showed raw i18n keys instead of translated labels. |
| **Fix** | Moved all 31 keys from `downtimeAnalysis` → `maintenance` namespace in both locale files. Verified by Playwright test 02 passing (15/15). |
| **Prevention** | Review namespace placement when adding new i18n keys. Ensure keys intended for `t('maintenance.xxx')` are placed inside the `maintenance` namespace object, not after its closing brace. |

## D-002: Cost center type icon (pre-existing)

| Field | Value |
|-------|-------|
| **Status** | NOT FIXED (Batch A known issue) |
| **Severity** | Low |
| **Note** | The `type` key and `parent` key were also in wrong namespace (same root cause as D-001). Moved along with the fix. |
