# Database Integrity Counters Proof

**Date:** 2026-07-27
**Status:** PASS (20/20)

## Test Summary

| # | Check | Result |
|---|-------|--------|
| 1 | Stock receipt balance updated (+100) | PASS |
| 2 | Issued quantity = 7 | PASS |
| 3 | Stock issue status = PARTIALLY_ISSUED (after 7/20) | PASS |
| 4 | MAINTENANCE_ISSUE movements incremented | PASS |
| 5 | Movement sourceType = MAINTENANCE_PART_LINE | PASS |
| 6 | Movement sourceId = lineId | PASS |
| 7 | Movement status = POSTED | PASS |
| 8 | Stock balance after issue correct (221 - 7 = 214) | PASS |
| 9 | Returned quantity = 3 | PASS |
| 10 | Stock issue status = PARTIALLY_ISSUED (net 17/20) | PASS |
| 11 | Final issuedQuantity = 20 | PASS |
| 12 | Final returnedQuantity = 3 | PASS |
| 13 | Final stockIssueStatus = PARTIALLY_ISSUED | PASS |
| 14 | Final stock balance correct (204 = 121+100-20+3) | PASS |
| 15 | MAINTENANCE_RETURN movements incremented | PASS |
| 16 | Unrelated product balance query works | PASS |
| 17 | Finance/Accounting module NOT affected | PASS |
| 18 | HR module NOT affected | PASS |
| 19 | Sales module NOT affected | PASS |
| 20 | Purchasing module NOT affected | PASS |

**Total: 20 passed, 0 failed**

## Audit Trail

- **Initial balance:** 121 units (pre-existing stock from earlier proofs)
- **Receipt:** +100 units → balance 221
- **Issue #1 (7 units):** → balance 214, status PARTIALLY_ISSUED
- **Issue #2 (13 units):** → balance 201, total issued 20/20
- **Return (3 units):** → balance 204, returnedQuantity=3, net issued=17/20 → PARTIALLY_ISSUED (correct: net < approved)
- **Movement count:** MAINTENANCE_ISSUE 8→10, MAINTENANCE_RETURN 4→5
- **No cross-module contamination:** Finance, HR, Sales, Purchasing all return 404/403/empty

## Script Location
`C:\Users\attef\AppData\Local\Temp\opencode\db-integrity-proof.ps1`
