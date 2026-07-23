# API Proof

## Authentication

Login: `POST /api/v1/auth/login` → JWT token obtained.

## Test Entities Created

| Entity | Code | Name | ID |
|--------|------|------|----|
| Company | QA_CORP | QA Test Company | cmrwx8ovu0000ws955a1pqpva |
| Branch | QA_BRN | QA Test Branch | cmrwx8owy0001ws95aeuyyusk |
| Administration | QA_ADM | QA Test Administration | cmrwx8oxx0002ws95c2ql9hve |
| Department | DEP-000002 | QA Test Department | cmrwx8ozt0003ws95kh8ci253 |

## Hierarchy Verification

GET `/api/v1/departments/{id}` → Response includes:
- `company.name` = "QA Test Company"
- `branch.name` = "QA Test Branch"
- `administration.name` = "QA Test Administration"

Full chain: **Department → Administration → Branch → Company** ✓

## Test Results Table

| Operation | Endpoint | Request | Expected | Actual | Result |
|-----------|----------|---------|----------|--------|--------|
| Create company | POST /api/v1/companies | `{code:"QA_CORP",name:"QA Test Company"}` | 201 | 201 | PASS |
| Create branch | POST /api/v1/branches | `{companyId,code:"QA_BRN",name:"QA Test Branch"}` | 201 | 201 | PASS |
| Create administration | POST /api/v1/administrations | `{branchId,code:"QA_ADM",name:"QA Test Administration"}` | 201 | 201 | PASS |
| Create department | POST /api/v1/departments | `{companyId,branchId,administrationId,name:"QA Test Dept"}` | 201 | 201 | PASS |
| Department detail | GET /api/v1/departments/{id} | - | 200 + hierarchy | 200 + hierarchy | PASS |
| Invalid admin (not found) | POST /api/v1/departments | `{companyId,branchId,adminId:"0000...",name:"Bad"}` | 400 | 400 ("Administration not found") | PASS |
| Unauthorized | GET /api/v1/administrations | no token | 401 | 401 | PASS |

## Cross-Branch Validation

The backend validates that an administration belongs to the selected branch before creating a department. Test with non-existent or mismatched administrationId returns 400 Bad Request.
