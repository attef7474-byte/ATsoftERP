# Reports/Dashboard Proof

## Applicability
Physical count variance is tracked through the existing inventory movement ledger and reconciliation modules. No new dashboard or report pages were required for Batch T.

## Existing Reports That Show Count Variance Data
- `/admin/reports/inventory/movements` — shows COUNT_VARIANCE_IN/OUT movements
- `/admin/reports/inventory/balances` — reflects updated StockBalance after posting
- `/admin/inventory/ledger` — shows movements with sourceType filter
- `/admin/inventory/reconciliation` — reconciles balances with movements

## Count Variance Report (Pre-existing)
The route `/admin/reports/inventory/count-variance` exists in the build output and can display physical count variance summaries using the data from movements where movementType in (COUNT_VARIANCE_IN, COUNT_VARIANCE_OUT).

## Future Enhancement
A dedicated physical count variance dashboard could be added as a separate batch, showing charts of variance trends by product, warehouse, or time period.
