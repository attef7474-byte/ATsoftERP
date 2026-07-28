# Z-AA — Spare Part Condition Balance + Removed Part Return

**Status**: ACCEPTED
**Date**: 2026-07-28
**Branch**: current (based on UX-0 at e52a1a6)
**Tags**: `atsoft-erp-zaa-sparepart-condition-balance-removed-return`, `atsoft-erp-current-release-final-audited-v3-zaa-condition-balance`, `atsoft-erp-zaa-condition-balance-proof`

## Summary

Implemented a side ledger for tracking spare part inventory by condition (`NEW`, `USED_SERVICEABLE`, `USED_REPAIRABLE`, `DAMAGED_REPAIRABLE`, `DAMAGED_NOT_REPAIRABLE`) and automated removed part return as condition IN via the maintenance stock issue flow — all without modifying the Product-based `InventoryBalance`.

### Key Outcomes

- **2 new database tables** (additive migration, no existing table changes)
- **1 new backend module** (`SparePartConditionModule`) with full CRUD + condition balance query endpoints
- **Integration** into `MaintenanceStockIssueService.issue()` — condition OUT for issued parts, condition IN for removed parts
- **Numbering**: `SPARE_PART_CONDITION_MOVEMENT` sequence added to constants, seed, and UI
- **i18n**: 4 new API error message keys (EN+AR), frontend numbering entity type labels (EN+AR)
- **Zero** changes to `InventoryBalance` / `InventoryMovementLine` / `InventoryMovement` structure
- **Zero** changes to `app.module.ts` module registration (following existing pattern)
- **Zero** forbidden module activation
- **Zero** placeholder pages

---

