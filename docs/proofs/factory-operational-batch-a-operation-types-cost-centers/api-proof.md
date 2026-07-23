# API Proof: Operation Types + Cost Centers

## Test Environment
- API Base: `http://localhost:4000/api/v1/maintenance`
- Auth: JWT Bearer token (admin@atsofterp.com)
- Date: 2026-07-23

## Operation Types

| Test | Method | Endpoint | Status | Result |
|------|--------|----------|--------|--------|
| LIST (with seed data) | GET | `/operation-types` | 200 | 9 records returned (MANUFACTURING, PREPARATION, MIXING, FILLING, PACKAGING, UTILITIES, MAINTENANCE, QUALITY, PROJECT) |
| CREATE | POST | `/operation-types` | 201 | Created `TEST-OP` with status ACTIVE |
| GET by ID | GET | `/operation-types/{id}` | 200 | Full record returned matching creation |
| UPDATE | PATCH | `/operation-types/{id}` | 200 | Name changed to "Updated Test Operation" |
| DEACTIVATE | PATCH | `/operation-types/{id}/deactivate` | 200 | Status changed to INACTIVE |
| DUPLICATE CODE | POST | `/operation-types` | 409 | `code "TEST-OP" already exists` — properly rejected |

## Cost Centers

| Test | Method | Endpoint | Status | Result |
|------|--------|----------|--------|--------|
| LIST (with seed data) | GET | `/cost-centers` | 200 | 6 records returned (PRODUCTION, MAINTENANCE, PROJECT, DEVELOPMENT, UTILITIES, QUALITY) |
| CREATE | POST | `/cost-centers` | 201 | Created `TEST-CC` with type OTHER, status ACTIVE |
| GET by ID | GET | `/cost-centers/{id}` | 200 | Full record returned matching creation |
| UPDATE | PATCH | `/cost-centers/{id}` | 200 | Name + type updated successfully |
| DEACTIVATE | PATCH | `/cost-centers/{id}/deactivate` | 200 | Status changed to INACTIVE |
| DUPLICATE CODE | POST | `/cost-centers` | 409 | `code "TEST-CC" already exists` — properly rejected |
| INVALID TYPE | POST | `/cost-centers` | 400 | `type must be one of: PRODUCTION, MAINTENANCE, PROJECT, DEVELOPMENT, QUALITY, UTILITIES, ADMIN, OTHER` — validated |

## Unauthorized Access

| Test | Endpoint | Status | Result |
|------|----------|--------|--------|
| No token - LIST operation types | GET `/operation-types` | 401 | `"Invalid or expired token"` |
| No token - LIST cost centers | GET `/cost-centers` | 401 | `"Invalid or expired token"` |

## Summary
All 15 API tests PASS. Authentication enforced. Input validation active. Duplicate blocking works.
