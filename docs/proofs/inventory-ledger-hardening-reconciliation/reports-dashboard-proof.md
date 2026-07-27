# Reports / Dashboard Proof

## Inventory Ledger Hardening + Stock Balance Reconciliation (Batch P)

### Reports Impact

Batch P does not add or modify any report endpoints. All existing report and dashboard functionality continues to work unchanged.

| Report | Pre-Batch P | Post-Batch P | Evidence |
|--------|-------------|--------------|----------|
| Inventory Movements Report | Working | Working | API compatibility test C03 |
| Inventory Balances Report | Working | Working | Reconciliation data available via API |
| Maintenance Requests Report | Working | Working | API compatibility test C03 |
| Downtime/RCA Reports | Working | Working | API compatibility test C07 |
| Spare Parts Report | Working | Working | API compatibility test C08 |
| Notifications Report | Working | Working | API compatibility test C09 |
| Dashboard KPIs | Working | Working | Browser proof B24 |

### Reconciliation Data Feed

The reconciliation endpoints provide data that can be used by reports:

| Endpoint | Data | Report Use |
|----------|------|------------|
| `GET /inventory/reconciliation/summary` | Aggregated counts (matched, differences, negative balances, totals) | Dashboard KPI cards |
| `GET /inventory/reconciliation/details` | Per-product/warehouse line items with current/expected/difference | Detailed reconciliation report |
| `GET /inventory/reconciliation/differences` | Filtered difference lines | Exception report |
| `GET /inventory/reconciliation/orphans` | Orphan movements and balances | Data integrity report |
| `GET /inventory/reconciliation/negative-balances` | Negative balance items | Negative stock report |

### Dashboard

The dashboard was verified to load correctly in browser proof B24. No dashboard changes were introduced by Batch P.

### Conclusion

All existing reports and dashboards continue to function. The reconciliation endpoints provide additional data sources for future reporting.
