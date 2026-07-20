# API Request/Response Proof

## Endpoint Summary

| # | Endpoint | Method | Status | Auth Required | Extra Field 400 |
|---|----------|--------|--------|---------------|-----------------|
| 1 | /api/v1/settings/company-profile | GET | 200 | Yes | N/A |
| 2 | /api/v1/settings/company-profile | PATCH | 200 | Yes | 400 |
| 3 | /api/v1/settings/language | GET | 200 | Yes | N/A |
| 4 | /api/v1/settings/language | PATCH | 200 | Yes | 400 |
| 5 | /api/v1/settings/appearance | GET | 200 | Yes | N/A |
| 6 | /api/v1/settings/appearance | PATCH | 200 | Yes | 400 |
| 7 | /api/v1/settings/security | GET | 200 | Yes | N/A |
| 8 | /api/v1/settings/security | PATCH | 200 | Yes | 400 |
| 9 | /api/v1/numbering | GET | 200 | Yes | N/A |
| 10 | /api/v1/numbering/:id/preview | GET | 200 | Yes | N/A |
| 11 | /api/v1/numbering/:id | PATCH | 200 | Yes | 400 |
| 12 | /api/v1/numbering/generate | POST | 200 | Yes | N/A |
| 13 | /api/v1/notifications/rules | GET | 200 | Yes | N/A |
| 14 | /api/v1/notifications/rules | POST | 201 | Yes | N/A |
| 15 | /api/v1/notifications/rules/:id | PATCH | 200 | Yes | 400 |
| 16 | /api/v1/notifications/rules/:id | DELETE | 200 | Yes | N/A |
| 17 | /api/v1/notifications/rules/:id/activate | PATCH | 200 | Yes | N/A |
| 18 | /api/v1/notifications/rules/:id/deactivate | PATCH | 200 | Yes | N/A |
| 19 | /api/v1/audit-logs | GET | 200 | Yes | N/A |
| 20 | /api/v1/audit-logs/summary | GET | 200 | Yes | N/A |
| 21 | /api/v1/audit-logs/user-activity | GET | 200 | Yes | N/A |
| 22 | /api/v1/audit-logs/login-history | GET | 200 | Yes | N/A |

## Invalid Extra Field 400 Proof

All PATCH endpoints were tested with `{ "totallyInvalidField": "should fail" }`:
- Company Profile: 400 - "property totallyInvalidField should not exist"
- Language: 400 - "property totallyInvalidField should not exist"
- Appearance: 400 - "property totallyInvalidField should not exist"
- Security: 400 - "property totallyInvalidField should not exist"
- Number Sequences: 400 - "property totallyInvalidField should not exist"
- Notification Rules: 400 - "property totallyInvalidField should not exist"

## Unauthenticated 401/403 Proof

All PATCH endpoints return 401 when called without Bearer token.

## Data Shape

- Audit logs return 40 total records with paginated data array
- User activity returns data (same endpoint as audit-logs with user filter)
- Login history returns empty array (no LOGIN action records in current dataset)
- Number sequences: 11 sequences with full details (code, prefix, padding, currentNumber, etc.)
- Notification rules: 0 pre-existing, but create/PATCH/delete cycle works correctly
