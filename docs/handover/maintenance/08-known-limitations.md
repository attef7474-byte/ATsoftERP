# Handover Document 8: Known Limitations

## 1. Frontend: No Nested Layouts

**Issue**: The frontend uses flat route structure under `/admin/maintenance/`. There are no nested layouts for sections (e.g., a shared layout for all settings pages).

**Impact**: Each page must independently handle headers, breadcrumbs, and navigation. Inconsistent UX.

**Recommended fix**: Implement nested layouts for sections (machines, requests, settings, etc.) to share common UI elements.

## 2. Frontend: Only 7 Test Spec Files

**Issue**: Across the entire project (~250 pages, ~45-55 maintenance pages), there are only 7 test spec files.

**Impact**: Minimal test coverage. Regressions may go undetected.

**Recommended fix**: Add Playwright component tests for critical flows (create machine, create request, stock issue, repair order lifecycle).

## 3. Frontend: Inconsistent CRUD Pattern

**Issue**: Two competing CRUD patterns exist:
- Modal-based (`useCrudList` + `FormDialog`) — used in older/core entities
- Standalone pages (`/new`, `/[id]`) — used in newer entities

**Impact**: Developer confusion, inconsistent UX, duplicated patterns.

**Recommended fix**: Standardize on one pattern (standalone pages recommended). Next planned batch (UI-QA) aims to address this.

## 4. Frontend: Inconsistent Grid Components

**Issue**: Mix of `AdminDataGrid` (rich) and `DataTable` (simple) with no clear criteria for choosing one over the other.

**Impact**: Inconsistent feature availability across pages. Some pages have inline editing, export, column visibility; others do not.

**Recommended fix**: Define and document criteria for which grid to use. Migrate to single grid component if feasible.

## 5. i18n: 5 Unimplemented Namespaces

**Issue**: The following i18n namespaces are defined in the config but have **no translation files**:

| Namespace | Status |
|-----------|--------|
| `inventoryCounting` | Not implemented |
| `maintenanceDashboard` | Not implemented |
| `preventiveMaintenance` | Not implemented |
| `downtimeAnalysis` | Not implemented |
| `sparePartRequest` | Not implemented |

**Impact**: Pages in these areas may show raw keys instead of translated text.

**Recommended fix**: Create translation files for each namespace in both EN and AR.

## 6. Tests: No Automated Browser Tests

**Issue**: Screenshots are disabled by the user. There are no Playwright automated browser tests.

**Impact**: All browser/DOM proofing is manual. No CI/CD test automation possible.

**Recommended fix**: Implement Playwright assertions (not screenshots) for critical user journeys.

## 7. Backend: MaintenanceNotification Module (0 Endpoints)

**Issue**: `MaintenanceNotification` module is registered in `app.module.ts` but has **0 controller endpoints**. It exists as infrastructure only.

**Impact**: Notifications from maintenance flows are not functional.

**Recommended fix**: Implement notification triggers for key events (request created, repair order completed, stock low, etc.).

## 8. InventoryBalance: Product-Based Only

**Issue**: `InventoryBalance` tracks quantities at the Product level only. Spare part condition tracking uses separate side-ledger models (`SparePartConditionBalance`, `SparePartConditionMovement`).

**Impact**:
- No single view of total stock by condition
- Reconciling product balance vs condition balances requires joining two data sources
- Reporting must aggregate from both models

**Design Decision**: This was intentional — `InventoryBalance` is not changed to avoid breaking existing inventory flows.

## 9. BOM: Inactive in Current Release

**Issue**: The BOM module (MaintenanceBom, MaintenanceBomVersion) was created in batch AH-AI with full infrastructure (schema, backend, frontend pages) but is **not activated** for production use.

**Status**: BOM pages exist in routes but are hidden from sidebar. No actual approval/activation has occurred.

**Recommended fix**: Activate BOM when the user explicitly approves it in a future batch.

## 10. No Accounting Integration

**Issue**: Maintenance stock issues do not create accounting journals. Cost reporting is operational only, not financial/accounting.

**Impact**: Financial reports will not reflect maintenance costs. Accounting team cannot trace costs to maintenance operations.

**Design Decision**: This was intentional — Finance module is excluded from current release. Accounting integration is planned for future scope.

## 11. No Purchasing Integration

**Issue**: When spare parts are out of stock, there is no automatic or manual purchase order creation from maintenance flows.

**Impact**: Users must manually switch to Purchasing module (if available) to reorder stock. No procurement trigger from maintenance.

**Design Decision**: This was intentional — Purchasing module is excluded from current release.

## 12. Orphan Numbering Sequences

**Issue**: The following 11 numbering sequences are seeded (`ACTIVE`) but not consumed by any service:

MACHINE_ASSET, MACHINE_DOCUMENT, MAINTENANCE_TASK, DOWNTIME, PREVENTIVE_MAINTENANCE, QR_LABEL, BARCODE_RECORD, BARCODE_PRINT_JOB, REPORT_EXPORT_JOB, ATTACHMENT, NOTIFICATION_RULE

**Impact**: These sequences consume sequence IDs but serve no current purpose. They may cause confusion about which codes are actually generated by the system.

**Recommended fix**: Either implement the services that consume these sequences, or mark them as DISABLED until needed.

## 13. Permissions: Not Fully Tested

**Issue**: While all maintenance permissions are seeded, some permission seeds have not been fully tested against actual endpoint guards.

**Impact**: Some permissions may be defined but not enforced, or enforced but not defined.

**Recommended fix**: Conduct a full permission audit — verify every `@RequirePermission()` decorator against the seed data and vice versa.
