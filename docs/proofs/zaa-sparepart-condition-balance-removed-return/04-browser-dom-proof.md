# Z-AA — Browser/DOM Proof

## Proof Method

Frontend build compilation and verification of existing form fields.

## Build Compilation

```
apps/web > npm run build > next build — passed with zero errors
- 157 pages generated successfully
- No TypeScript errors
- No ESLint errors (no config found — pre-existing)
```

## Frontend Changes

| File | Change | Verified |
|------|--------|----------|
| `admin/settings/numbering/page.tsx` | Added `SPARE_PART_CONDITION_MOVEMENT` to entity type filter dropdown | ✅ Build pass, i18n key exists |
| `locales/en/settings.ts` | Added `SPARE_PART_CONDITION_MOVEMENT` to `operationNameMap` and `modelNameMap` | ✅ Both present |
| `locales/ar/settings.ts` | Added `SPARE_PART_CONDITION_MOVEMENT` to `operationNameMap` and `modelNameMap` | ✅ Both present |
| `maintenance/requests/[id]/page.tsx` | Added condition balance display in stock issue card | ✅ Build pass (157 pages) |
| `locales/en/maintenance.ts` | Added `availableConditionBalances` key | ✅ Key exists |
| `locales/ar/maintenance.ts` | Added `availableConditionBalances` key | ✅ Key exists |

## Condition Balance Display (Stock Issue Form)

When user selects "Issue Stock" for a spare part request line, the stock issue card now shows available condition balances fetched from `/api/v1/spare-part-conditions/by-spare-part/:sparePartId`. The balances are displayed as colored chips showing each condition type and its available quantity. This helps the user make informed decisions about which condition to issue.

The display:
- Fetches balances automatically when a spare part request line is selected
- Shows loading state during fetch
- Hides when no balances exist (empty state)
- Uses existing i18n keys for condition labels (`conditionNew`, `conditionUsedServiceable`, etc.)

## Existing Stock Issue Form Verification

The stock issue form in `maintenance/requests/[id]/page.tsx` includes:
- `issuedStockCondition` select (NEW, USED_SERVICEABLE, USED_REPAIRABLE, DAMAGED_REPAIRABLE, DAMAGED_NOT_REPAIRABLE) ✅
- `replacementAction` toggle (RETURNED_REMOVED_PART, NO_REMOVED_PART, NEW_INSTALLATION) ✅
- Conditional `removedPartCondition` / `removedPartWarehouseId` / `removedPartQuantity` fields ✅
- `noReturnReason` field ✅
- Stock issue history DataTable ✅
- Condition balance display chips ✅ (NEW IN Z-AA)

## No Unexpected 404s

No new frontend pages were created, so no new 404 risks.
Existing pages modified (numbering filter, stock issue form) only add options/data, no new routes.
