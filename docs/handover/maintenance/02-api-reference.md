# Handover Document 2: API Reference

## 1. Base URL

- **Development**: `http://localhost:3000/api`
- **Authentication**: Bearer JWT token in `Authorization` header
- **Request/Response format**: JSON (`Content-Type: application/json`)
- **i18n headers**: `x-locale` or `Accept-Language` (resolution: `x-locale` > `Accept-Language` > user preference > fallback `ar`)

## 2. Authentication

```
Authorization: Bearer <jwt_token>
```

Obtain token via `POST /auth/login` with credentials. All protected endpoints return `401 Unauthorized` or `403 Forbidden` on invalid/missing permissions.

## 3. Common Response Format

### Success
```json
{
  "data": { ... },
  "meta": {
    "total": 100,
    "page": 1,
    "limit": 20,
    "totalPages": 5
  }
}
```

### Error
```json
{
  "statusCode": 400,
  "messageKey": "validation.error.fieldRequired",
  "message": "هذا الحقل مطلوب",
  "details": { "field": "machineId" },
  "timestamp": "2026-07-29T04:00:00.000Z",
  "path": "/api/maintenance/requests"
}
```

## 4. Pagination, Filtering, Sorting

- **Pagination**: `?page=1&limit=20` (default page=1, limit=20, max limit=100)
- **Filtering**: `?field=value`, `?search=term` (varies by endpoint)
- **Sorting**: `?sortBy=createdAt&sortOrder=desc`
- **Date range**: `?from=2026-01-01&to=2026-12-31`

## 5. Endpoint Reference

### 5.1 Machine Management (~49 endpoints)

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| GET | /maintenance/machines | List machines | Yes |
| GET | /maintenance/machines/:id | Get machine detail | Yes |
| POST | /maintenance/machines | Create machine | Yes |
| PATCH | /maintenance/machines/:id | Update machine | Yes |
| DELETE | /maintenance/machines/:id | Delete machine | Yes |
| GET | /maintenance/machine-categories | List categories | Yes |
| POST | /maintenance/machine-categories | Create category | Yes |
| PATCH | /maintenance/machine-categories/:id | Update category | Yes |
| DELETE | /maintenance/machine-categories/:id | Delete category | Yes |
| GET | /maintenance/machine-parts | List parts | Yes |
| POST | /maintenance/machine-parts | Create part | Yes |
| PATCH | /maintenance/machine-parts/:id | Update part | Yes |
| DELETE | /maintenance/machine-parts/:id | Delete part | Yes |
| GET | /maintenance/machine-components | List components | Yes |
| POST | /maintenance/machine-components | Create component | Yes |
| PATCH | /maintenance/machine-components/:id | Update component | Yes |
| DELETE | /maintenance/machine-components/:id | Delete component | Yes |
| GET | /maintenance/machine-documents | List documents | Yes |
| POST | /maintenance/machine-documents | Upload document | Yes |
| DELETE | /maintenance/machine-documents/:id | Delete document | Yes |
| GET | /maintenance/machine-spare-parts | List machine-spare links | Yes |
| POST | /maintenance/machine-spare-parts | Link spare to machine | Yes |
| DELETE | /maintenance/machine-spare-parts/:id | Unlink spare | Yes |

### 5.2 Spare Parts (~30 endpoints)

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| GET | /maintenance/spare-parts | List spare parts | Yes |
| GET | /maintenance/spare-parts/:id | Get spare part detail | Yes |
| POST | /maintenance/spare-parts | Create spare part | Yes |
| PATCH | /maintenance/spare-parts/:id | Update spare part | Yes |
| DELETE | /maintenance/spare-parts/:id | Delete spare part | Yes |
| GET | /maintenance/component-spare-parts | List component-spare links | Yes |
| POST | /maintenance/component-spare-parts | Link spare to component | Yes |
| DELETE | /maintenance/component-spare-parts/:id | Unlink spare | Yes |
| GET | /maintenance/spare-parts/:id/condition-balance | Get condition balance | Yes |
| GET | /maintenance/spare-parts/:id/movements | Get condition movements | Yes |

### 5.3 Maintenance Requests (~59 endpoints)

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| GET | /maintenance/requests | List requests | Yes |
| GET | /maintenance/requests/:id | Get request detail | Yes |
| POST | /maintenance/requests | Create request | Yes |
| PATCH | /maintenance/requests/:id | Update request | Yes |
| DELETE | /maintenance/requests/:id | Delete request | Yes |
| PATCH | /maintenance/requests/:id/status | Change status | Yes |
| GET | /maintenance/requests/:id/parts | List request parts | Yes |
| POST | /maintenance/requests/:id/parts | Add part to request | Yes |
| DELETE | /maintenance/requests/:id/parts/:partId | Remove part | Yes |
| GET | /maintenance/requests/:id/costs | List request costs | Yes |
| POST | /maintenance/requests/:id/costs | Add cost | Yes |
| GET | /maintenance/tasks | List tasks | Yes |
| GET | /maintenance/tasks/:id | Get task detail | Yes |
| POST | /maintenance/tasks | Create task | Yes |
| PATCH | /maintenance/tasks/:id | Update task | Yes |
| DELETE | /maintenance/tasks/:id | Delete task | Yes |
| PATCH | /maintenance/tasks/:id/status | Change task status | Yes |

### 5.4 Checklists (~16 endpoints)

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| GET | /maintenance/checklist-items | List checklist items | Yes |
| POST | /maintenance/checklist-items | Create item | Yes |
| PATCH | /maintenance/checklist-items/:id | Update item | Yes |
| DELETE | /maintenance/checklist-items/:id | Delete item | Yes |
| GET | /maintenance/checklist-executions | List executions | Yes |
| POST | /maintenance/checklist-executions | Execute checklist | Yes |
| GET | /maintenance/checklist-executions/:id | Get execution detail | Yes |

### 5.5 Schedules / Preventive Maintenance (~35 endpoints)

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| GET | /maintenance/schedules | List schedules | Yes |
| POST | /maintenance/schedules | Create schedule | Yes |
| PATCH | /maintenance/schedules/:id | Update schedule | Yes |
| DELETE | /maintenance/schedules/:id | Delete schedule | Yes |
| GET | /maintenance/preventive-maintenance | List PM plans | Yes |
| POST | /maintenance/preventive-maintenance | Create PM plan | Yes |
| PATCH | /maintenance/preventive-maintenance/:id | Update PM plan | Yes |
| DELETE | /maintenance/preventive-maintenance/:id | Delete PM plan | Yes |
| POST | /maintenance/preventive-maintenance/:id/generate-tasks | Generate tasks | Yes |
| GET | /maintenance/preventive-maintenance/:id/calendar | Get calendar view | Yes |

### 5.6 Stock / Inventory (~17 endpoints)

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| POST | /maintenance/stock-issue | Issue spare parts | Yes |
| GET | /maintenance/stock-issue/history | Issue history | Yes |
| GET | /maintenance/stock-issue/:id | Get issue detail | Yes |
| GET | /inventory/movements?warehouseType=SPARE_PART | Filtered movements | Yes |
| GET | /inventory/balances?productType=SPARE_PART | Filtered balances | Yes |

### 5.7 Repair Orders (~17 endpoints)

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| GET | /maintenance/repair-orders | List repair orders | Yes |
| GET | /maintenance/repair-orders/:id | Get detail | Yes |
| POST | /maintenance/repair-orders | Create repair order | Yes |
| PATCH | /maintenance/repair-orders/:id/status | Transition status | Yes |
| PATCH | /maintenance/repair-orders/:id/complete | Complete (serviceable) | Yes |
| PATCH | /maintenance/repair-orders/:id/scrap | Scrap part | Yes |
| GET | /maintenance/repair-orders/:id/actions | List repair actions | Yes |
| POST | /maintenance/repair-orders/:id/actions | Add repair action | Yes |

### 5.8 BOM / Planning (~30 endpoints)

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| GET | /maintenance/boms | List BOMs | Yes |
| POST | /maintenance/boms | Create BOM | Yes |
| PATCH | /maintenance/boms/:id | Update BOM | Yes |
| DELETE | /maintenance/boms/:id | Delete BOM | Yes |
| GET | /maintenance/bom-versions | List BOM versions | Yes |
| POST | /maintenance/bom-versions | Create version | Yes |
| PATCH | /maintenance/bom-versions/:id/approve | Approve version | Yes |
| GET | /maintenance/preventive-spare-part-plans | List plans | Yes |
| POST | /maintenance/preventive-spare-part-plans | Create plan | Yes |
| PATCH | /maintenance/preventive-spare-part-plans/:id | Update plan | Yes |
| DELETE | /maintenance/preventive-spare-part-plans/:id | Delete plan | Yes |

### 5.9 Reports / KPIs (~24 endpoints)

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| GET | /maintenance/dashboard/summary | Dashboard summary | Yes |
| GET | /maintenance/dashboard/kpis | KPI data | Yes |
| GET | /maintenance/reliability/mtbf | MTBF calculation | Yes |
| GET | /maintenance/reliability/mttr | MTTR calculation | Yes |
| GET | /maintenance/reliability/availability | Availability % | Yes |
| GET | /maintenance/reports/cost-summary | Cost summary report | Yes |
| GET | /maintenance/reports/parts-consumption | Parts consumption | Yes |
| GET | /maintenance/reports/labor-hours | Labor hours report | Yes |
| GET | /maintenance/reports/downtime | Downtime analysis | Yes |
| GET | /maintenance/reports/backlog | Maintenance backlog | Yes |

### 5.10 Personnel / Assignments (~24 endpoints)

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| GET | /maintenance/personnel | List personnel | Yes |
| POST | /maintenance/personnel | Add personnel | Yes |
| PATCH | /maintenance/personnel/:id | Update personnel | Yes |
| DELETE | /maintenance/personnel/:id | Remove personnel | Yes |
| GET | /maintenance/responsibility-assignments | List assignments | Yes |
| POST | /maintenance/responsibility-assignments | Create assignment | Yes |
| DELETE | /maintenance/responsibility-assignments/:id | Remove assignment | Yes |
| GET | /maintenance/request-assignments | List request assignments | Yes |
| POST | /maintenance/request-assignments | Assign request | Yes |
| PATCH | /maintenance/request-assignments/:id/complete | Complete assignment | Yes |

### 5.11 Config / Settings (~24 endpoints)

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| GET | /maintenance/operation-types | List operation types | Yes |
| POST | /maintenance/operation-types | Create operation type | Yes |
| PATCH | /maintenance/operation-types/:id | Update operation type | Yes |
| DELETE | /maintenance/operation-types/:id | Delete operation type | Yes |
| GET | /maintenance/cost-centers | List cost centers | Yes |
| POST | /maintenance/cost-centers | Create cost center | Yes |
| PATCH | /maintenance/cost-centers/:id | Update cost center | Yes |
| DELETE | /maintenance/cost-centers/:id | Delete cost center | Yes |
| GET | /maintenance/production-lines | List production lines | Yes |
| POST | /maintenance/production-lines | Create production line | Yes |
| PATCH | /maintenance/production-lines/:id | Update production line | Yes |
| DELETE | /maintenance/production-lines/:id | Delete production line | Yes |
| GET | /maintenance/sla | List SLAs | Yes |
| POST | /maintenance/sla | Create SLA | Yes |
| PATCH | /maintenance/sla/:id | Update SLA | Yes |
| DELETE | /maintenance/sla/:id | Delete SLA | Yes |

## 6. API Versioning

The API is currently **versionless** (no `/v1/` prefix). All endpoints live under `/api/`. Future versioning can be introduced when needed via URL prefix or header negotiation.

## 7. Rate Limiting

No rate limiting is currently implemented. This is a known gap for future enhancement.
