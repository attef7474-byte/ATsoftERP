# API Proof — Operational Stock Receiving

## Test Results
*To be filled after running API tests*

| Test | Endpoint | Expected | Actual | Status |
|------|----------|----------|--------|--------|
| 01 | POST /inventory/operational-receipts | 201 Created | — | ⏳ |
| 02 | GET /inventory/operational-receipts | 200 + list | — | ⏳ |
| 03 | GET /inventory/operational-receipts/:id | 200 + detail | — | ⏳ |
| 04 | PATCH /inventory/operational-receipts/:id | 200 Updated | — | ⏳ |
| 05 | POST .../:id/submit | 200 SUBMITTED | — | ⏳ |
| 06 | POST .../:id/approve | 200 APPROVED | — | ⏳ |
| 07 | POST .../:id/post | 200 POSTED + movement | — | ⏳ |
| 08 | POST .../:id/reject | 200 REJECTED | — | ⏳ |
| 09 | POST .../:id/cancel | 200 CANCELLED | — | ⏳ |
| 10 | DELETE .../:id | 200 Deleted (DRAFT) | — | ⏳ |
| ... | (60 more) | — | — | ⏳ |
