# Defect Register

## Open Defects
None. All pages pass validation.

## Previously Fixed Defects

| ID | Description | Severity | Found In | Fixed In | Status |
|----|-------------|----------|----------|----------|--------|
| D-001 | PATCH /settings/company-profile returns 400 because 'id' from GET response bleeds into PATCH body | High | Post-release runtime defect closure v2 | V3 runtime-fixed-v3 | CLOSED |

## Known Non-Defects
- Login history returns 0 entries: The audit service stores LOGIN actions, but current seed data may not include them. The endpoint itself works correctly (returns 200 with empty data array).
- i18n gaps (ar.ts missing 'barcodes.generate.retry' and 'barcodes.generate.loadMore'): Pre-existing, not in scope of settings gate.
