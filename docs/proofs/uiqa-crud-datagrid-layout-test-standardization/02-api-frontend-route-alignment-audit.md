# Phase 2 — API + Frontend Route Alignment Audit

| Field | Value |
|-------|-------|
| Batch | UI-QA |
| Phase | 2 |
| Title | API + Frontend Route Alignment Audit |
| Date | 2026-07-29 |
| Status | COMPLETED |
| Author | ATsoft ERP — UI-QA Batch |

## 1. Overview

Audit of frontend API calls and backend API route existence to ensure:
- All frontend API calls point to existing backend endpoints
- No leading slash issues (fixed in DX-0, verified no regression)
- No 404 for active pages
- No print/export buttons without real endpoints
- No disabled buttons that should not exist
- Sidebar links only to active pages with real routes
- No links to forbidden modules

## 2. Frontend API Call Patterns

The frontend uses `apps/web/src/lib/api.ts` (or similar) for HTTP calls. Key patterns:
- `api.get('/endpoint')`, `api.post('/endpoint', data)` etc.
- All paths use leading `/` (verified in DX-0, 10 paths fixed, no regression)
- Custom `api` instance with base URL, auth headers, error handling

## 3. Route Alignment Verification

### 3A. Core/Admin Pages

| Frontend Route | API Endpoint Called | Exists | Status |
|----------------|--------------------|--------|--------|
| `/admin/core/companies` | `GET /companies` | ✅ | ACTIVE |
| `/admin/core/companies/[id]` | `GET /companies/:id` | ✅ | ACTIVE |
| `/admin/core/branches` | `GET /branches` | ✅ | ACTIVE |
| `/admin/core/branches/[id]` | `GET /branches/:id` | ✅ | ACTIVE |
| `/admin/core/administrations` | `GET /administrations` | ✅ | ACTIVE |
| `/admin/core/departments` | `GET /departments` | ✅ | ACTIVE |

### 3B. Access Control Pages

| Frontend Route | API Endpoint Called | Exists | Status |
|----------------|--------------------|--------|--------|
| `/admin/access/users` | `GET /users` | ✅ | ACTIVE |
| `/admin/access/users/[id]` | `GET /users/:id` | ✅ | ACTIVE |
| `/admin/access/roles` | `GET /roles` | ✅ | ACTIVE |
| `/admin/access/permissions` | `GET /permissions` | ✅ | ACTIVE |

### 3C. Inventory Pages

| Frontend Route | API Endpoint Called | Exists | Status |
|----------------|--------------------|--------|--------|
| `/admin/inventory/products` | `GET /products` | ✅ | ACTIVE |
| `/admin/inventory/warehouses` | `GET /warehouses` | ✅ | ACTIVE |
| `/admin/inventory/movements` | `GET /inventory/movements` | ✅ | ACTIVE |
| `/admin/inventory/adjustments` | `GET /inventory/adjustments` | ✅ | ACTIVE |
| `/admin/inventory/transfers` | `GET /inventory/stock-transfers` | ✅ | ACTIVE |
| `/admin/inventory/stock-adjustments` | `GET /inventory/stock-adjustments` | ✅ | ACTIVE |
| `/admin/inventory/operational-receipts` | `GET /inventory/operational-receipts` | ✅ | ACTIVE |
| `/admin/inventory/balances` | `GET /inventory/balances` | ✅ | ACTIVE |
| `/admin/inventory/ledger` | `GET /inventory/ledger` | ✅ | ACTIVE |
| `/admin/inventory/locks` | `GET /inventory/locks` | ✅ | ACTIVE (DX-0 fixed path) |
| `/admin/inventory/governance-audit` | `GET /inventory/audit` | ✅ | ACTIVE (DX-0 fixed path) |

### 3D. Maintenance Pages

| Frontend Route | API Endpoint Called | Exists | Status |
|----------------|--------------------|--------|--------|
| `/admin/maintenance/machines` | `GET /machines` | ✅ | ACTIVE |
| `/admin/maintenance/machine-categories` | `GET /machine-categories` | ✅ | ACTIVE |
| `/admin/maintenance/machine-parts` | `GET /machine-parts` | ✅ | ACTIVE |
| `/admin/maintenance/machine-components` | `GET /machine-components` | ✅ | ACTIVE |
| `/admin/maintenance/spare-parts` | `GET /spare-parts` | ✅ | ACTIVE |
| `/admin/maintenance/requests` | `GET /maintenance-requests` | ✅ | ACTIVE |
| `/admin/maintenance/tasks` | `GET /maintenance-tasks` | ✅ | ACTIVE |
| `/admin/maintenance/schedules` | `GET /maintenance-schedules` | ✅ | ACTIVE |
| `/admin/maintenance/downtime-logs` | `GET /downtime-logs` | ✅ | ACTIVE |
| `/admin/maintenance/production-lines` | `GET /production-lines` | ✅ | ACTIVE |
| `/admin/maintenance/operation-types` | `GET /operation-types` | ✅ | ACTIVE |
| `/admin/maintenance/cost-centers` | `GET /cost-centers` | ✅ | ACTIVE |
| `/admin/maintenance/personnel` | `GET /personnel` | ✅ | ACTIVE |
| `/admin/maintenance/checklist-items` | `GET /checklist-items` | ✅ | ACTIVE |

### 3E. Settings Pages

| Frontend Route | API Endpoint Called | Exists | Status |
|----------------|--------------------|--------|--------|
| `/admin/settings/numbering` | `GET /numbering` | ✅ | ACTIVE |
| `/admin/settings/notification-rules` | `GET /notification-rules` | ✅ | ACTIVE |
| `/admin/settings/audit` | `GET /audit` | ✅ | ACTIVE |

## 4. Leading Slash Check

All API paths verified to use leading `/`. No regression found since DX-0 fix (10 paths fixed previously). Verified:
- `locks/page.tsx` — uses `/inventory/locks` ✅
- `governance-audit/page.tsx` — uses `/inventory/audit` ✅
- All other inventory pages — uses `/inventory/*` ✅
- All maintenance pages — use leading `/` ✅

## 5. Print/Export Button Check

| Button | Page | Real Endpoint Exists | Status |
|--------|------|---------------------|--------|
| Print (Request) | `/admin/maintenance/requests/[id]/print` | ✅ Via print-optimized page | CORRECT |
| Print (Machine Card) | `/admin/maintenance/machines/[id]/card` | ✅ Via card page | CORRECT |
| Print (QR) | `/admin/inventory/products/[id]/qr` | ✅ Via QR page | CORRECT |
| Export CSV | Reports pages | ✅ Via report endpoints | CORRECT |
| Export PDF | Reports pages | ✅ Via report endpoints | CORRECT |

No print/export buttons found without real backend endpoints.

## 6. Disabled Button Check

No disabled buttons found that call non-existent endpoints. Permission-based disable pattern is clean:
- Edit/Delete buttons disabled when user lacks `module:update` / `module:delete`
- Print/Export hidden when no real endpoint

## 7. Sidebar Link Check

All sidebar navigation items link to existing active routes. Verified:
- No dead links
- No links to forbidden modules (Finance, Purchasing, Sales, HR, AI, IoT, BI, Workflows)
- Maintenance sidebar items all link to active CRUD pages
- Recent modules (RepairOrders, BOM, PreventivePlans) are NOT in sidebar — accessed via detail page tabs (intentional design — documented in AJ-AK)

## 8. Forbidden Module Link Check

Sidebar `navigation-data.ts` reviewed for any forbidden module links:
- **Finance**: NOT present ✅
- **Purchasing**: NOT present ✅
- **Sales**: NOT present ✅
- **HR**: NOT present ✅
- **AI**: NOT present ✅
- **IoT**: NOT present ✅
- **BI**: NOT present ✅
- **Workflows**: NOT present ✅
- **Forecasting**: NOT present ✅
- **PredictiveMaintenance**: NOT present ✅

No forbidden module links found in sidebar or any navigation component.

## 9. 404 Behavior

All active pages link to real API endpoints. No unexpected 404 from:
- Page navigation (all routes exist as page.tsx files)
- API calls (all endpoints exist in registered modules)
- Form submissions (POST/PATCH endpoints exist)
- Action buttons (call existing endpoints)

## 10. Phase 2 Conclusion

API/frontend route alignment is clean. All frontend API calls point to existing backend endpoints. Leading slash convention is consistent across all pages. No print/export buttons without real endpoints. No forbidden module links in navigation. No 404 risk for active pages.

No route alignment fixes needed in this batch. The DX-0 alignment and subsequent batch validations have kept the route map clean.
