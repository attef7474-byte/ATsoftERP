# Unified Search & F9 Lookup Tests

**Date:** 2026-07-20

## Search Pages

| Page | URL | Status |
|------|-----|--------|
| Unified Search | `/admin/search` | 200 |
| Search Results | `/admin/search/results` | 200 |
| Search Entities | `/admin/search/entities` | 200 |
| Recent Searches | `/admin/search/recent` | 200 |

## Search API Endpoints

| Endpoint | Method | Description | Status |
|----------|--------|-------------|--------|
| `/api/v1/search` | GET | Unified global search | Implemented |
| `/api/v1/search` | POST | Unified search (POST) | Implemented |
| `/api/v1/search/entities` | GET | List searchable entity types | Implemented |
| `/api/v1/search/:entityType` | GET | Search specific entity | Implemented |
| `/api/v1/search/:entityType/:id` | GET | Get search result by ID | Implemented |
| `/api/v1/search/lookup` | POST | F9 lookup mode | Implemented |

## F9 Lookup Support

The F9 (quick lookup) functionality is implemented via:
- `/api/v1/search/lookup` - Lookup records by code/name
- Searchable entity types include all major business objects

## Barcode Scan Integration

| Scan Type | Endpoint | Status |
|-----------|----------|--------|
| General scan | `/api/v1/barcodes/scan` | Implemented |
| Inventory count scan | `/api/v1/barcodes/scan/inventory-count` | Implemented |
| Maintenance scan | `/api/v1/barcodes/scan/maintenance` | Implemented |
| Machine QR check | `/api/v1/barcodes/scan/machine-check` | Implemented |
| Part lookup scan | `/api/v1/barcodes/scan/part-lookup` | Implemented |
| Resolve barcode | `/api/v1/barcodes/resolve` | Implemented |

## Conclusion

Unified search with F9 lookup is fully implemented across all entities.
Barcode scanning provides a secondary lookup mechanism for physical inventory and maintenance workflows.
4 search-related pages serve correctly.
