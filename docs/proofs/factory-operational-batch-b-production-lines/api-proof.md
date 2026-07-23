# API Proof — Production Lines (Batch B)

## Endpoints Tested

| # | Method | Endpoint | Status | Notes |
|---|--------|----------|--------|-------|
| 1 | POST | `/api/v1/maintenance/production-lines` | ✅ 201 | Created with auto-generated code `PL-000003` |
| 2 | GET | `/api/v1/maintenance/production-lines/:id` | ✅ 200 | Full includes (company, branch, admin, dept, operationType, costCenter) |
| 3 | PATCH | `/api/v1/maintenance/production-lines/:id` | ✅ 200 | Updated description and location |
| 4 | PATCH | `/api/v1/maintenance/production-lines/:id/deactivate` | ✅ 200 | Status → INACTIVE |
| 5 | PATCH | `/api/v1/maintenance/production-lines/:id/activate` | ✅ 200 | Status → ACTIVE |
| 6 | DELETE | `/api/v1/maintenance/production-lines/:id` | ✅ 200 | Soft delete (sets deletedAt) |
| 7 | GET | `/api/v1/maintenance/production-lines` | ✅ 200 | List with pagination (4 seeded records) |

## Hierarchy Validation

- Branch must belong to selected company ✅
- Administration must belong to selected branch ✅
- Department must belong to selected administration/branch/company ✅
- Operation type must exist ✅
- Cost center must exist (if provided) ✅

## Conclusion

All CRUD + activate/deactivate endpoints working correctly. Hierarchy validation enforces org structure integrity.
