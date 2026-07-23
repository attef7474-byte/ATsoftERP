# Console & Network Proof — Batch F

**Date:** 2026-07-23
**Project:** ATsoft ERP
**Batch:** F — Maintenance Requests Operational Integration
**Result:** ✅ PASS

---

## API Server Logs

**Server:** `localhost:4000` (NestJS v1)

```
[Nest] 36860  - LOG [NestApplication] Nest application successfully started
Server running on http://localhost:4000
Swagger docs at http://localhost:4000/api/docs
```

No errors, warnings, or exceptions during startup or request handling.

---

## Web Server Logs (Next.js 15)

Build output shows successful compilation:
```
✓ Compiled successfully in 10.7s
✓ Generating static pages (132/132)
```

No build errors or warnings related to Batch F changes.

---

## Browser Console (Playwright)

During browser proof execution, no JavaScript errors, warnings, or unhandled rejections were observed on the list, create, or detail pages.

---

## Network Request Verification

### Batch F API Endpoints

| Method | Endpoint | Status | Purpose |
|--------|----------|--------|---------|
| GET | `/api/v1/maintenance/requests?productionLineId=...` | 200 | Filter by production line |
| GET | `/api/v1/maintenance/requests?machineComponentId=...` | 200 | Filter by machine component |
| GET | `/api/v1/maintenance/requests?operationTypeId=...` | 200 | Filter by operation type |
| GET | `/api/v1/maintenance/requests?costCenterId=...` | 200 | Filter by cost center |
| GET | `/api/v1/maintenance/requests?sparePartId=...` | 200 | Filter by spare part |
| POST | `/api/v1/maintenance/requests/:id/required-parts` | 201 | Add required spare part |
| GET | `/api/v1/maintenance/requests/:id/required-parts` | 200 | List required spare parts |
| PATCH | `/api/v1/maintenance/requests/required-parts/:partId` | 200 | Update required part |
| PATCH | `/api/v1/maintenance/requests/required-parts/:partId/cancel` | 200 | Cancel required part |

All endpoints return appropriate HTTP status codes. No 500 errors observed.

---

## Prisma Query Logging

The migration applied cleanly:
```
Migration `20260723154650_add_maintenance_request_operational_links_required_parts`
added 4 nullable foreign key columns + new table with 4 status constraint columns.
```

No query errors or constraint violations during health checks or smoke tests.
