# API Proof — Full Test Results

**Total Tests**: 31 | **PASS**: 31 | **FAIL**: 0

## Numbering Module

| # | Test | Endpoint | Expected | Actual | Result |
|---|---|---|---|---|---|
| 1 | List all number sequences | GET /api/v1/numbering | 200, array length 39 | 200, 39 sequences | ✅ PASS |
| 2 | MACHINE_CATEGORY exists | GET /api/v1/numbering | key=MACHINE_CATEGORY, prefix=MCAT- | Found, ACTIVE | ✅ PASS |
| 3 | SPARE_PART exists | GET /api/v1/numbering | key=SPARE_PART, prefix=SP- | Found, ACTIVE | ✅ PASS |
| 4 | MAINTENANCE_PERSONNEL exists | GET /api/v1/numbering | key=MAINTENANCE_PERSONNEL, prefix=MP- | Found, ACTIVE | ✅ PASS |

## Machine Categories

| # | Test | Endpoint | Expected | Actual | Result |
|---|---|---|---|---|---|
| 5 | Create MC (auto-code) | POST /api/v1/maintenance/machine-categories | 201, code starts with MCAT- | MCAT-00001 | ✅ PASS |
| 6 | Create MC #2 (increment) | POST /api/v1/maintenance/machine-categories | 201, code MCAT-00002 | MCAT-00002 | ✅ PASS |
| 7 | List MCs | GET /api/v1/maintenance/machine-categories | 200, array | 200, 2 items | ✅ PASS |
| 8 | Get single MC | GET /api/v1/maintenance/machine-categories/:id | 200, valid object | 200, correct code | ✅ PASS |
| 9 | Update MC | PATCH /api/v1/maintenance/machine-categories/:id | 200, updated | 200 | ✅ PASS |
| 10 | Delete MC | DELETE /api/v1/maintenance/machine-categories/:id | 200 | 200 | ✅ PASS |

## Spare Parts

| # | Test | Endpoint | Expected | Actual | Result |
|---|---|---|---|---|---|
| 11 | Create SP (auto-code) | POST /api/v1/maintenance/spare-parts | 201, code starts with SP- | SP-00001 | ✅ PASS |
| 12 | Create SP #2 (increment) | POST /api/v1/maintenance/spare-parts | 201, code SP-00002 | SP-00002 | ✅ PASS |
| 13 | List SPs | GET /api/v1/maintenance/spare-parts | 200, array | 200, 2 items | ✅ PASS |
| 14 | Get single SP | GET /api/v1/maintenance/spare-parts/:id | 200, valid object | 200 | ✅ PASS |
| 15 | Update SP | PATCH /api/v1/maintenance/spare-parts/:id | 200 | 200 | ✅ PASS |
| 16 | Delete SP | DELETE /api/v1/maintenance/spare-parts/:id | 200 | 200 | ✅ PASS |

## Maintenance Personnel

| # | Test | Endpoint | Expected | Actual | Result |
|---|---|---|---|---|---|
| 17 | Create MP (auto-code, no userId) | POST /api/v1/maintenance/personnel | 201, MP-00001, userId null | MP-00001 | ✅ PASS |
| 18 | Create MP with userId | POST /api/v1/maintenance/personnel | 201, userId set | userId = 1 | ✅ PASS |
| 19 | Duplicate userId | POST /api/v1/maintenance/personnel | 409 Conflict | 409 | ✅ PASS |
| 20 | Multiple null userIds | POST /api/v1/maintenance/personnel | 201, both null | both null | ✅ PASS |
| 21 | List MPs | GET /api/v1/maintenance/personnel | 200, array with linked column | 200 | ✅ PASS |
| 22 | Get single MP | GET /api/v1/maintenance/personnel/:id | 200, includes userId | 200 | ✅ PASS |
| 23 | Update MP | PATCH /api/v1/maintenance/personnel/:id | 200 | 200 | ✅ PASS |
| 24 | Delete MP | DELETE /api/v1/maintenance/personnel/:id | 200 | 200 | ✅ PASS |

## Auth & Security

| # | Test | Endpoint | Expected | Actual | Result |
|---|---|---|---|---|---|
| 25 | Login valid credentials | POST /api/v1/auth/login | 200, returns JWT | 200, token | ✅ PASS |
| 26 | Login invalid credentials | POST /api/v1/auth/login | 401 Unauthorized | 401 | ✅ PASS |
| 27 | Auth/me with token | GET /api/v1/auth/me | 200, user object | 200 | ✅ PASS |
| 28 | Password hash not exposed | GET /api/v1/auth/me | No passwordHash field | Not present | ✅ PASS |
| 29 | Unauthenticated access blocked | GET /api/v1/maintenance/machine-categories | 401 | 401 | ✅ PASS |
| 30 | Unauthenticated access blocked | GET /api/v1/maintenance/personnel | 401 | 401 | ✅ PASS |
| 31 | Unauthenticated access blocked | GET /api/v1/numbering | 401 | 401 | ✅ PASS |

## Summary

| Category | Tests | Pass | Fail |
|---|---|---|---|
| Numbering | 4 | 4 | 0 |
| Machine Categories | 6 | 6 | 0 |
| Spare Parts | 6 | 6 | 0 |
| Maintenance Personnel | 8 | 8 | 0 |
| Auth & Security | 7 | 7 | 0 |
| **Total** | **31** | **31** | **0** |
