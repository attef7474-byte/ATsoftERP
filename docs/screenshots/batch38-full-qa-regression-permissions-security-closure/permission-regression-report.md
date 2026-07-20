# Permission & Authorization Regression Report

> Batch 38 — Full permission and authorization verification

## Part A: Unauthenticated Access (Expected 401/403)

46 protected endpoints tested without JWT token. All correctly returned 401.

| Group | Endpoints | Blocked |
|-------|-----------|---------|
| Dashboard | /dashboard/summary, /dashboard/kpis | 2/2 |
| Alerts | /alerts, /alerts/summary | 2/2 |
| Notifications | /notifications/inbox, /notifications/unread-count | 2/2 |
| Settings | /settings, /settings/groups/general | 2/2 |
| Audit | /audit-logs, /audit-logs/summary | 2/2 |
| Attachments | /attachments | 1/1 |
| Inventory | warehouses, locations, products, balances, movements, counts, adjustments | 7/7 |
| Maintenance | machines, categories, parts, documents, requests, tasks, schedules, downtime, dashboard | 13/13 |
| Barcodes | /barcodes, /barcodes/templates, /barcodes/scans | 3/3 |
| Reports | /reports/assets, /reports/inventory/overview, /reports/maintenance/overview | 3/3 |
| Search | /search/entities | 1/1 |
| Core | /companies, /branches, /departments, /payment-terms, /numbering | 5/5 |
| Access Control | /users, /roles, /permissions | 3/3 |
| Business | /business-partners, /business-partner-groups | 2/2 |
| **TOTAL** | | **46/46 BLOCKED** |

## Part B: Authenticated Admin Access (Expected 200)

46 endpoints tested with admin JWT. All returned 200.

**Admin pass: 46/46**

## Part C: Public Allowlist

Only endpoints that should be public:
- POST /api/v1/auth/login — ✅ returns expected response (200 or validation error)

**Public allowlist: 1/1 OK**

## Summary: 93/93 PASS

| Check | Count | Result |
|-------|-------|--------|
| Unauthenticated blocked | 46/46 | ✅ PASS |
| Admin endpoints pass | 46/46 | ✅ PASS |
| Public allowlist | 1/1 | ✅ PASS |
| Unexpectedly public endpoints | 0 | ✅ PASS |
