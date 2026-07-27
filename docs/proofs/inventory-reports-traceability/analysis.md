# Analysis: Inventory Reports & Traceability (Batch U)

## Objective
Implement a read-only inventory reporting and traceability layer across all accepted inventory modules (Batches O through T), providing stock card (item ledger), movement traceability, exception detection, and aggregated dashboard insights.

## Scope
- **Read-only**: Reports must NOT create InventoryMovement, modify StockBalance, activate NumberSequence, or touch Finance/Accounting/HR/Sales/Purchasing.
- **New endpoints**: 12 report endpoints under `/reports/inventory/` covering stock card, movement types, warehouse/location summaries, product detail, source traceability, movement traceability, exceptions, top-moving items, dashboard cards, negative balances, and reconciliation differences.
- **Frontend pages**: 4 new pages under `/admin/inventory/reports/` (dashboard, stock-card, traceability, exceptions) using existing ShadCN/Next.js patterns.
- **Permissions**: 15 new `inventory:reports:*` permissions, all linked to SUPER_ADMIN.
- **i18n**: ~35 new keys each in English and Arabic `reports.ts`.

## Dependencies
- All prior inventory batches (O–T) must be accepted and tagged.
- Prisma schema is read-only (queries only, no writes).
- Filter DTO extended with `direction`, `sourceType`, `status`.

## Risk Assessment
- **Read-only violation**: Mitigated by strict `SELECT`-only service methods and API proof verifying StockBalance/Movement counts unchanged.
- **Performance**: Dashboard cards query multiple aggregates; mitigated with optimized Prisma queries and optional date range filtering.
- **i18n gaps**: 2846/2846 keys confirmed synchronized.

## Acceptance Criteria
1. API proof: ≥80 tests, 0 FAIL
2. Browser proof: ≥35 tests, 0 FAIL
3. DB integrity counters: PASS
4. Health check: 4/4 services UP
5. Smoke test: 8/8 modules OK
6. Full validation pipeline: typecheck, build, i18n all PASS
7. Git: clean, 3 tags pushed
