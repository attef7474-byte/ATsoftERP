# Regression Baseline

> Reference for regression testing in future batches

## API Regression (Batch 38)

**Result**: 99/99 PASS

All 99 endpoints tested successfully. Any new batch should re-run the full API regression before release.

## Permission Regression (Batch 38)

**Result**: 93/93 PASS

All permission checks for all roles passed. Permission matrix should be re-validated when new roles or endpoints are added.

## Browser Page Regression (Batch 38)

**Result**: 14/14 PASS

| Page | Route |
|------|-------|
| Login | /login |
| Dashboard | /dashboard |
| Alerts | /alerts |
| Notifications | /notifications |
| Warehouse List | /warehouses |
| Products | /products |
| Product Categories | /product-categories |
| Inventory Balances | /inventory/balances |
| Inventory Movements | /inventory/movements |
| Maintenance Machines | /maintenance/machines |
| Maintenance Requests | /maintenance/requests |
| Maintenance Tasks | /maintenance/tasks |
| Barcodes | /barcodes |
| Reports | /reports |

## Health Check Baseline (Batch 38)

**Result**: 4/4 PASS

1. API health endpoint
2. Database connectivity
3. Prisma client
4. Overall status

## Smoke Test Baseline (Batch 38)

**Result**: 8/8 PASS

- Login flow
- Dashboard load
- Product listing
- Warehouse listing
- Machine listing
- Request listing
- Barcode listing
- Report access
