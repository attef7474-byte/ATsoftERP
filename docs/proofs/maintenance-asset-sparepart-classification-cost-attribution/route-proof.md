# Route Proof — Batch Y

## API Routes

| Method | Route | Status |
|--------|-------|--------|
| GET | `/maintenance/spare-parts` | ✅ |
| GET | `/maintenance/spare-parts/:id` | ✅ |
| POST | `/maintenance/spare-parts` | ✅ |
| PATCH | `/maintenance/spare-parts/:id` | ✅ |
| DELETE | `/maintenance/spare-parts/:id` | ✅ |
| PATCH | `/maintenance/spare-parts/:id/activate` | ✅ |
| PATCH | `/maintenance/spare-parts/:id/deactivate` | ✅ |
| GET | `/inventory/warehouses` | ✅ |
| GET | `/inventory/warehouses/:id` | ✅ |
| POST | `/inventory/warehouses` | ✅ |
| PATCH | `/inventory/warehouses/:id` | ✅ |
| DELETE | `/inventory/warehouses/:id` | ✅ |
| POST | `/maintenance/requests/:id/parts/:lineId/issue` | ✅ |
| GET | `/maintenance/requests/:id/parts/:lineId/issues` | ✅ |
| POST | `/maintenance/requests/:id/parts/:lineId/return` | ✅ |

## Frontend Routes

| Route | Status |
|-------|--------|
| `/admin/maintenance/spare-parts` | ✅ |
| `/admin/maintenance/spare-parts/:id` | ✅ |
| `/admin/maintenance/spare-parts/:id/edit` | ✅ |
| `/admin/inventory/warehouses` | ✅ |
| `/admin/inventory/warehouses/:id` | ✅ |
| `/admin/inventory/warehouses/:id/edit` | ✅ |
| `/admin/inventory/warehouses/new` | ✅ |
