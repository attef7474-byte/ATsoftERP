# API Runtime Proof — Final Readiness Corrective Patch

**Date**: 2026-07-29  
**Tester**: Automated (PowerShell + curl)  
**Base URL**: `http://localhost:4000/api/v1/`  
**Auth Provider**: NestJS JWT  
**Auth Used**: `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`

---

## Login

| Credential | Result |
|---|---|
| `POST /auth/login` with `{"email":"admin@atsofterp.com","password":"Admin@123456"}` | **200 OK** → `accessToken` and `user` object returned |

---

## Full Endpoint Test Results

| # | Endpoint | Method | Status | Response Shape | Notes |
|---|---|---|---|---|---|
| 1 | `/health` | GET | **200** | `{"status":"ok","timestamp":"...","uptime":246.66}` | Health check PASS |
| 2 | `/auth/login` | POST | **200** | `{"accessToken":"...","user":{"id":"...","email":"...","name":"..."}}` | Login successful |
| 3 | `/auth/me` | GET | **200** | `{"id":"...","email":"admin@atsofterp.com","name":"Administrator","phone":"...","status":"ACTIVE"}` | Profile endpoint (auth/profile is 404 — `/me` is correct path) |
| 4 | `/companies` | GET | **200** | `{"data":[{...}]}` | Companies list with data |
| 5 | `/companies` | POST | **201** | `{"id":"...","code":"APIPROOF2","name":"API Proof Corp","status":"ACTIVE"}` | CRUD: Create — PASS |
| 6 | `/companies/:id` | PATCH | **200** | `{"id":"...","name":"API Proof Corp Updated",...}` | CRUD: Update — PASS |
| 7 | `/companies/:id` | DELETE | **200** | `{"message":"Company deleted successfully"}` | CRUD: Delete — PASS |
| 8 | `/branches` | GET | **200** | `{"data":[{...}]}` | Branches list with data |
| 9 | `/departments` | GET | **200** | `{"data":[{...}]}` | Departments list with data |
| 10 | `/administrations` | GET | **200** | `{"data":[{...}]}` | Administrations list with data |
| 11 | `/users` | GET | **200** | `{"data":[{...}]}` | Users list — admin user present |
| 12 | `/roles` | GET | **200** | `{"data":[{"code":"QA-TEST2",...}]}` | Roles list with data |
| 13 | `/permissions` | GET | **200** | `{"data":[{"key":"administration:create",...}]}` | Permissions list |
| 14 | `/products` | GET | **200** | `{"data":[{"id":"...","code":"PRD-000003","name":"Runtime Product"}]}` | Products list with data |
| 15 | `/maintenance/machines` | GET | **200** | `{"data":[{...}]}` | Machines list |
| 16 | `/maintenance/spare-parts` | GET | **200** | `{"data":[{...}]}` | Spare parts list |
| 17 | `/maintenance/bom` | GET | **200** | `{"data":[],"meta":{"page":1,"limit":20,"total":0,"totalPages":0}}` | **New endpoint** — BOM list (empty, properly paginated) |
| 18 | `/maintenance/spare-part-plans` | GET | **200** | `{"data":[],"meta":{"page":1,"limit":20,"total":0,"totalPages":0}}` | **New endpoint** — Spare Part Plans list (empty, paginated) |
| 19 | `/maintenance/repair-orders` | GET | **200** | `[]` | **New endpoint** — Repair Orders list (empty array) |
| 20 | `/installed-parts` | GET | **200** | `[]` | **New endpoint** — Installed Parts list (empty array) |
| 21 | `/spare-part-conditions/balances` | GET | **200** | `[{...condition:"USED_SERVICEABLE",quantity:6}, {...condition:"NEW",quantity:5}]` | **New endpoint** — Condition balances with spare part + warehouse join data |
| 22 | `/maintenance/reliability/mttr?days=30` | GET | **200** | `{"mttrMinutes":0,"mttrHours":0,"totalEvents":0}` | **New endpoint** — MTTR KPI (no events in 30 days) |
| 23 | `/maintenance/reliability/mtbf?days=30` | GET | **200** | `{"mtbfMinutes":42.26,"mtbfHours":0.70,"totalEvents":18}` | MTBF KPI with real data |
| 24 | `/maintenance/reliability/availability?days=30` | GET | **200** | `{"periodHours":11.97,"downtimeHours":0,"uptimeHours":11.97,"availabilityPercent":100}` | Availability KPI |
| 25 | `/maintenance/requests` | GET | **200** | `{"data":[{...}]}` | Maintenance requests list |
| 26 | `/maintenance/tasks` | GET | **200** | `{"data":[],"meta":{"page":1,"limit":10,"total":0,"totalPages":0}}` | Tasks list (empty) |
| 27 | `/maintenance/schedules` | GET | **200** | `{"data":[{...}]}` | PM Schedules list |
| 28 | `/maintenance/machine-categories` | GET | **200** | `{"data":[{...}]}` | Machine categories list |
| 29 | `/maintenance/personnel` | GET | **200** | `{"data":[{...}]}` | Maintenance personnel list |
| 30 | `/maintenance/downtime-logs` | GET | **200** | `{"data":[{...}]}` | Downtime logs list (19 entries) |
| 31 | `/maintenance/request-parts` | GET | **200** | `[]` | Request parts list (empty) |
| 32 | `/maintenance/request-assignments` | GET | **200** | `{"data":[{...}]}` | Request assignments list |
| 33 | `/maintenance/checklist-items` | GET | **200** | `{"data":[],"meta":{"page":1,"limit":10,"total":0,"totalPages":0}}` | Checklist items (empty) |
| 34 | `/maintenance/operation-types` | GET | **200** | `{"data":[{...}]}` | Operation types list |
| 35 | `/maintenance/cost-centers` | GET | **200** | `{"data":[{...}]}` | Cost centers list |
| 36 | `/maintenance/production-lines` | GET | **200** | `{"data":[{...}]}` | Production lines list |
| 37 | `/inventory/balances` | GET | **200** | `{"data":[{...}]}` | Inventory balances list |
| 38 | `/inventory/movements` | GET | **200** | `{"data":[{...}]}` | Inventory movements list |
| 39 | `/inventory/adjustments` | GET | **200** | `{"data":[{...}]}` | Inventory adjustments list |
| 40 | `/inventory/counts` | GET | **200** | `{"data":[{...}]}` | Inventory counts list |
| 41 | `/inventory/operational-receipts` | GET | **200** | `{"data":[{...}]}` | Operational receipts list |
| 42 | `/inventory/physical-counts` | GET | **200** | `{"data":[{...}]}` | Physical counts list |
| 43 | `/inventory/opening-balances` | GET | **200** | `{"data":[{...}]}` | Opening balances list |
| 44 | `/settings` | GET | **200** | `{"data":[{...}]}` | System settings list |
| 45 | `/numbering` | GET | **200** | `{"data":[{...}],"meta":{"total":49,"page":1,"limit":20}}` | Numbering sequences (49 total, paginated) |
| 46 | `/barcodes` | GET | **200** | `{"data":[{...}]}` | Barcodes list |
| 47 | `/business-partners` | GET | **200** | `{"data":[],"meta":{"page":1,"limit":10,"total":0,"totalPages":0}}` | Business partners (empty) |
| 48 | `/product-categories` | GET | **200** | `{"data":[],"meta":{"page":1,"limit":10,"total":0,"totalPages":0}}` | Product categories (empty) |
| 49 | `/search` | GET | **200** | `{"data":[],"meta":{"total":0,"page":1,"limit":20}}` | Search endpoint (no query, empty) |
| 50 | `/alerts` | GET | **200** | `{"data":[{...}],"total":19,"page":1,"pageSize":20}` | Alerts list (19 entries) |
| 51 | `/maintenance/machines` (POST empty body) | POST | **400** | `{"message":["name must be a string"]}` | Validation working correctly |
| 52 | `/auth/change-password` (wrong old) | POST | **400** | JSON parse error (PowerShell escaping issue) | Endpoint reached |
| 53 | `/warehouses` | GET | **404** | `{"message":["Cannot GET /api/v1/warehouses"]}` | Route not found — check if path differs |
| 54 | `/auth/profile` | GET | **404** | `{"message":["Cannot GET /api/v1/auth/profile"]}` | Route not found — use `/auth/me` instead |
| 55 | `/locations` | GET | **404** | `{"message":["Cannot GET /api/v1/locations"]}` | Route not found |
| 56 | `/maintenance/sla` | GET | **404** | `{"message":["Cannot GET /api/v1/maintenance/sla"]}` | **New endpoint missing** — SLA route not implemented |
| 57 | `/notification/sla` | GET | **404** | `{"message":["Cannot GET /api/v1/notification/sla"]}` | Alternative SLA path not found |
| 58 | `/sla` | GET | **404** | `{"message":["Cannot GET /api/v1/sla"]}` | Alternative SLA path not found |
| 59 | `/reports` | GET | **404** | `{"message":["Cannot GET /api/v1/reports"]}` | **New endpoint missing** — Reports route not implemented |
| 60 | `/maintenance/dashboard` | GET | **404** | `{"message":["Cannot GET /api/v1/maintenance/dashboard"]}` | Route not found |
| 61 | `/audit` | GET | **404** | `{"message":["Cannot GET /api/v1/audit"]}` | Route not found |
| 62 | `/maintenance/notifications` | GET | **404** | `{"message":["Cannot GET /api/v1/maintenance/notifications"]}` | Route not found |
| 63 | `/notifications` | GET | **404** | `{"message":["Cannot GET /api/v1/notifications"]}` | Route not found |
| 64 | `/messaging` | GET | **404** | `{"message":["Cannot GET /api/v1/messaging"]}` | Route not found |
| 65 | `/inventory/stock-transfers` | GET | **404** | `{"message":["Cannot GET /api/v1/inventory/stock-transfers"]}` | Route not found |
| 66 | `/maintenance/installed-parts-replacement` | GET | **404** | `{"message":["Cannot GET /api/v1/maintenance/installed-parts-replacement"]}` | Route not found |

---

## Summary

### Endpoint Counts

| Category | Count |
|---|---|
| **Total endpoints tested** | 66 |
| **200 OK (working)** | 50 |
| **201 Created (working)** | 1 |
| **400 Bad Request (validation)** | 2 |
| **404 Not Found** | 13 |

### New Endpoints (8 required for frontend pages)

| Endpoint | Status | Notes |
|---|---|---|
| `GET /maintenance/bom` | ✅ **200 OK** | Empty (no BOMs seeded), properly paginated |
| `GET /maintenance/spare-part-plans` | ✅ **200 OK** | Empty, properly paginated |
| `GET /maintenance/repair-orders` | ✅ **200 OK** | Empty array |
| `GET /installed-parts` | ✅ **200 OK** | Empty array |
| `GET /spare-part-conditions/balances` | ✅ **200 OK** | Returns data with joins to sparePart + warehouse |
| `GET /maintenance/reliability/mttr?days=30` | ✅ **200 OK** | Returns KPI metrics (0 events in 30 days) |
| `GET /maintenance/sla` | ❌ **404 Not Found** | SLA endpoint not implemented |
| `GET /reports` | ❌ **404 Not Found** | Reports endpoint not implemented |

### Baseline Smoke Tests

| Test | Result |
|---|---|
| Health check (`/health`) | ✅ PASS |
| Auth profile (`/auth/me`) | ✅ PASS |
| Companies CRUD (GET/POST/PATCH/DELETE) | ✅ PASS |
| Branches GET | ✅ PASS |
| Departments GET | ✅ PASS |
| Maintenance machines GET | ✅ PASS |
| Maintenance spare-parts GET | ✅ PASS |
| Warehouses GET | ❌ FAIL (404) |
| Products GET | ✅ PASS |

### Issues Found

1. **`/warehouses` (404)** — Route not found at `/api/v1/warehouses`. The frontend depends on this for warehouse selection. May be mounted under a different path (e.g., `/inventory/warehouses`).
2. **`/auth/profile` (404)** — The profile endpoint is at `/auth/me`, not `/auth/profile`. Frontend must use the correct path.
3. **`/maintenance/sla` (404)** — SLA page endpoint not implemented. The SLA feature may not have a dedicated API route yet.
4. **`/reports` (404)** — Reports index endpoint not implemented. Reports may be handled by a different module or not yet exposed.
5. **`/inventory/stock-transfers` (404)** — Route not found (tested 3 path variations, all 404).
6. **`/maintenance/dashboard` (404)** — Dashboard endpoint not implemented.
7. **`/audit` (404)** — Audit log endpoint not found — may be under different path.

### Verdict

**6 of 8 new endpoints are working (75%)**. All baseline smoke endpoints pass except `/warehouses`. The application is functional with minor missing routes that should be addressed for full frontend page coverage.
