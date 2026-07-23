# i18n Proof — Production Lines (Batch B)

## Verification

| Check | Status |
|-------|--------|
| EN keys synchronized with AR | ✅ 2191 keys in both locales |
| No raw i18n keys in production-lines page | ✅ `maintenance.` not visible in body |
| `maintenance.productionLines` translates correctly | ✅ EN: "Production Lines", AR: "خطوط الإنتاج" |
| `maintenance.operationType` translates correctly | ✅ EN: "Operation Type", AR: "نوع العملية" |
| `maintenance.costCenter` translates correctly | ✅ EN: "Cost Center", AR: "مركز تكلفة" |
| en/ar parity preserved | ✅ All 31 moved/added keys exist in both locales |
| No English label in Arabic mode | ✅ Confirmed by Playwright test 02 |
| No Arabic label in English mode | ✅ Confirmed by Playwright test 02 |

## Fix Applied

Root cause: keys `productionLines`, `operationType`, `costCenter` (and 28 associated keys) were nested inside the `downtimeAnalysis` namespace instead of `maintenance` namespace in both `en/maintenance.ts` and `ar/maintenance.ts`.

Fix: Moved all 31 keys from `downtimeAnalysis` → `maintenance` namespace in both locale files. This ensures `t('maintenance.xxx')` resolves correctly.
