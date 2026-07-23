# API Proof — Batch C Machines

## Results Table

| # | Operation | Endpoint | Expected | Actual | Result |
|---|-----------|----------|----------|--------|--------|
| 1 | List machines | GET /machines?limit=10 | 200 + data array | 200, 1 machine | PASS |
| 2 | Machine detail | GET /machines/:id | 200 + relations | 200, all relations present | PASS |
| 3 | Invalid productionLineId | POST /machines | 400 | 400 | PASS |
| 4 | Unauthorized (no token) | GET /machines | 401 | 401 | PASS |
| 5 | Update name | PATCH /machines/:id | 200 | 200, name updated, relations preserved | PASS |
| 6 | Update productionLineId | PATCH /machines/:id | 200 | 200, PL updated | PASS |
| 7 | Update operationTypeId | PATCH /machines/:id | 200 | 200, OT updated | PASS |
| 8 | Invalid operationTypeId | PATCH /machines/:id | 400 | 400 | PASS |
| 9 | Update defaultCostCenterId | PATCH /machines/:id | 200 | 200, CC updated | PASS |
| 10 | Duplicate code | POST /machines | 409 | 409 | PASS |
| 11 | Machine card (asset card) | GET /machines/:id/card | 200 + all fields | 200, all 5 new fields present | PASS |
| 12 | Filter by productionLineId | GET /machines?productionLineId=X | 200 + filtered | 200, correct count | PASS |
| 13 | Filter by operationTypeId | GET /machines?operationTypeId=X | 200 + filtered | 200, correct count | PASS |
| 14 | Update technicalAdministrationId | PATCH /machines/:id | 200 | 200, TA updated | PASS |
| 15 | Update technicalDepartmentId | PATCH /machines/:id | 200 | 200, TD updated | PASS |
| 16 | Cross-admin mismatch | PATCH /machines/:id | 400 | 400 | PASS |
| 17 | Reset fields to null | PATCH /machines/:id | 200, null | 200, all null | PASS |
| 18 | Create with all 5 fields | POST /machines | 200, all filled | 200, all relations resolved | PASS |
| 19 | ProductionLine company mismatch | PATCH /machines/:id | 400 | 400 | PASS |
| 20 | Invalid costCenterId | PATCH /machines/:id | 400 | 400 | PASS |
| 21 | Invalid technicalAdministrationId | PATCH /machines/:id | 400 | 400 | PASS |
| 22 | Update preserves unrelated fields | PATCH /machines/:id | Preserved | PL/OT preserved after name PATCH | PASS |
