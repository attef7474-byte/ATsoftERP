# API Proof — Batch D Machine Components

## Results Table

| # | Operation | Endpoint | Expected | Actual | Result |
|---|-----------|----------|----------|--------|--------|
| 1 | Create component | POST /machine-components | 201 + component data | 201, MOTOR-001 created | PASS |
| 2 | Create child component | POST /machine-components | 201 + parentComponentId | 201, BEARING-001 with parent | PASS |
| 3 | List components | GET /machine-components | 200 + data array + meta | 200, 2 components, _count.children | PASS |
| 4 | Component detail | GET /machine-components/:id | 200 + children included | 200, 1 child (Drive Motor Bearing) | PASS |
| 5 | Update description | PATCH /machine-components/:id | 200, description changed | 200, description updated | PASS |
| 6 | Deactivate | PATCH /machine-components/:id/deactivate | 200, status INACTIVE | 200, INACTIVE | PASS |
| 7 | Activate | PATCH /machine-components/:id/activate | 200, status ACTIVE | 200, ACTIVE | PASS |
| 8 | Machine components list | GET /machines/:id/components | 200 + components array | 200, 2 components | PASS |
| 9 | Duplicate code | POST /machine-components | 409 | 409 | PASS |
| 10 | Invalid machineId | POST /machine-components | 400 | 400 | PASS |
