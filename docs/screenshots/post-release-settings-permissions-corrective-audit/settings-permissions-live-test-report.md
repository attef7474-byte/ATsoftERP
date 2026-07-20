# Settings and Permissions Live Test Report

## Settings

| Endpoint | Method | Status | Notes |
|----------|--------|--------|-------|
| /api/v1/settings/appearance | GET | 200 OK | Initial fetch |
| /api/v1/settings/appearance | PATCH | 200 OK | themeMode=dark saved |
| /api/v1/settings/appearance | GET | 200 OK | theme=dark verified |
| /api/v1/settings/language | PATCH | 200 OK | defaultLocale=ar saved |
| /api/v1/settings/language | GET | 200 OK | locale=ar verified |
| /api/v1/settings/security | PATCH | 200 OK | passwordMinLength=10 saved |
| /api/v1/settings/security | GET | 200 OK | minLen=10 verified |
| /api/v1/settings/company-profile | GET | 200 OK | |
| /api/v1/settings | GET | 200 OK | Generic settings list |

## Permissions

| Endpoint | Method | Status | Notes |
|----------|--------|--------|-------|
| /api/v1/permissions/matrix | GET | 200 OK | |
| /api/v1/permissions/grouped | GET | 200 OK | |
| /api/v1/roles | GET | 200 OK | |
| /api/v1/roles | POST | 201 OK | Created QA-TEST2 |
| /api/v1/roles/:id | GET | 200 OK | Role verified |
| /api/v1/permissions/modules | GET | 200 OK | 36 modules listed |

## Branch / Department / Warehouse

| Endpoint | Method | Status | Notes |
|----------|--------|--------|-------|
| /api/v1/branches | GET | 200 OK | |
| /api/v1/departments | GET | 200 OK | |
| /api/v1/inventory/warehouses | GET | 200 OK | |

## Other

| Endpoint | Method | Status | Notes |
|----------|--------|--------|-------|
| /api/v1/auth/login | POST | 201 OK | JWT obtained |
| /api/v1/auth/me | GET | 200 OK | Admin user verified |
| /api/v1/users | GET | 200 OK | No passwordHash |
| /api/v1/numbering | GET | 200 OK | |
| /api/v1/notifications/rules | GET | 200 OK | |
| /api/v1/audit-logs | GET | 200 OK | |
| /api/v1/alerts | GET | 200 OK | |
| /api/v1/dashboard/summary | GET | 200 OK | |
| /api/v1/search/entities | GET | 200 OK | |

**All tests PASS.**
