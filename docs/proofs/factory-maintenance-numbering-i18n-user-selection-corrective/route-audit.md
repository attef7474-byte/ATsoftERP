# API Route Audit — Factory Maintenance Module

## Verified Correct Routes

All routes listed below are confirmed working against `localhost:4000`. Routes are prefixed with `/api/v1`.

| Route | Method | Purpose | Auth Required | Status |
|---|---|---|---|---|
| `/api/v1/numbering` | GET | List all number sequences | Yes | ✅ Verified |
| `/api/v1/maintenance/machine-categories` | GET | List machine categories | Yes | ✅ Verified |
| `/api/v1/maintenance/machine-categories` | POST | Create machine category | Yes | ✅ Verified |
| `/api/v1/maintenance/machine-categories/:id` | GET | Get single machine category | Yes | ✅ Verified |
| `/api/v1/maintenance/machine-categories/:id` | PATCH | Update machine category | Yes | ✅ Verified |
| `/api/v1/maintenance/machine-categories/:id` | DELETE | Delete machine category | Yes | ✅ Verified |
| `/api/v1/maintenance/spare-parts` | GET | List spare parts | Yes | ✅ Verified |
| `/api/v1/maintenance/spare-parts` | POST | Create spare part | Yes | ✅ Verified |
| `/api/v1/maintenance/spare-parts/:id` | GET | Get single spare part | Yes | ✅ Verified |
| `/api/v1/maintenance/spare-parts/:id` | PATCH | Update spare part | Yes | ✅ Verified |
| `/api/v1/maintenance/spare-parts/:id` | DELETE | Delete spare part | Yes | ✅ Verified |
| `/api/v1/maintenance/personnel` | GET | List maintenance personnel | Yes | ✅ Verified |
| `/api/v1/maintenance/personnel` | POST | Create personnel (with auto-code, userId optional) | Yes | ✅ Verified |
| `/api/v1/maintenance/personnel/:id` | GET | Get single personnel | Yes | ✅ Verified |
| `/api/v1/maintenance/personnel/:id` | PATCH | Update personnel | Yes | ✅ Verified |
| `/api/v1/maintenance/personnel/:id` | DELETE | Delete personnel | Yes | ✅ Verified |
| `/api/v1/users` | GET | List users (for F9 lookup) | Yes | ✅ Verified |
| `/api/v1/auth/login` | POST | Authenticate and get JWT | No | ✅ Verified |
| `/api/v1/auth/me` | GET | Get current user profile | Yes | ✅ Verified |

## Path Traversal Check

| Attempt | Result |
|---|---|
| `../prisma` appended to route | ❌ Blocked — 404 / 401 as expected |
| Directory traversal in query params | ❌ Blocked |

## Summary

All Factory Maintenance routes are correctly mapped under `/api/v1/maintenance/`. Numbering routes are under `/api/v1/numbering`. Auth uses `/api/v1/auth/login`. No incorrect or dangling routes exist.
