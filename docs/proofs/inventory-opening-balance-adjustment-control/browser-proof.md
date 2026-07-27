# Browser Proof — Batch Q: Opening Balance + Stock Adjustment Control

**Status:** NOT RUN (browser environment unavailable)
**Date:** 2026-07-27

## Pages Created

| Page | Route | Status |
|------|-------|--------|
| Opening Balances List | `/admin/inventory/opening-balances` | Built ✅ |
| Stock Adjustments List | `/admin/inventory/stock-adjustments` | Built ✅ |

## Navigation Entries
Both pages are registered in `navigation-data.ts` under the Inventory section.

## i18n Labels (Inventory namespace)
6 new keys added to both `en/inventory.ts` and `ar/inventory.ts`:
- `openingBalance`, `openingBalances`, `openingBalanceNumber`
- `stockAdjustment`, `stockAdjustments`, `stockAdjustmentNumber`

## Build Verification
- `npm run build --workspace apps/web` — PASS (146 pages, no errors)
- 2 new page components are included in the build output

## Manual Verification Steps (if browser available)
1. Log in as admin
2. Navigate to Inventory → Opening Balances
3. Verify list page renders with table headers
4. Click "Create" — verify form renders
5. Navigate to Inventory → Stock Adjustments
6. Verify list page renders
7. Click "Create" — verify form renders
8. Verify navigation labels appear in both EN and AR locales
