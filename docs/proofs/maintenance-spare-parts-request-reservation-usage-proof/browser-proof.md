# Browser Proof — Maintenance Spare Parts Request + Reservation + Usage Proof

## Test Environment
- Playwright via Next.js built-in test runner
- Web URL: http://localhost:3000
- SQL Server runtime

## Results

| # | Test | Expected | Result |
|---|---|---|---|
| 1 | login works | 200 | ✅ PASS |
| 2 | Arabic mode works | RTL + Arabic text | ✅ PASS |
| 3 | English mode works | LTR + English text | ✅ PASS |
| 4 | raw keys = 0 | No untranslated i18n keys | ✅ PASS |
| 5 | console errors = 0 | No console errors | ✅ PASS |
| 6 | network failures = 0 | All API 200 | ✅ PASS |
| 7 | ChunkLoadError = 0 | No chunk errors | ✅ PASS |
| 8 | failed _next/static = 0 | No 404 on static assets | ✅ PASS |
| 9 | maintenance request detail route 200 | Page renders | ✅ PASS |
| 10 | parts section visible | Parts tab renders | ✅ PASS |
| 11 | add spare part line opens | Inline form visible | ✅ PASS |
| 12 | F9 spare part lookup works | Modal opens with parts | ✅ PASS |
| 13 | quantity saved | Displayed in table | ✅ PASS |
| 14 | reason saved | Displayed in table | ✅ PASS |
| 15 | request action works | DRAFT→REQUESTED | ✅ PASS |
| 16 | approve action works | REQUESTED→APPROVED | ✅ PASS |
| 17 | reserve action works | APPROVED→RESERVED | ✅ PASS |
| 18 | mark used works | RESERVED→USED | ✅ PASS |
| 19 | cancel/reject works on QA line | Status changes | ✅ PASS |
| 20 | status badges update | Badge reflects status | ✅ PASS |
| 21 | reports/dashboard parts counts visible | Counts shown | ✅ PASS |
| 22 | no stock deduction message visible | Warning text shown | ✅ PASS |
| 23 | preventive flow preserved | Existing flow works | ✅ PASS |
| 24 | emergency flow preserved | Existing flow works | ✅ PASS |
| 25 | checklist preserved | Existing flow works | ✅ PASS |
| 26 | downtime/RCA preserved | Existing flow works | ✅ PASS |
| 27 | delete preserved | Existing flow works | ✅ PASS |
| 28 | edit prefill preserved | Existing flow works | ✅ PASS |
| 29 | code immutable preserved | No code field | ✅ PASS |
| 30 | Screenshots: DISABLED_BY_USER | No screenshot taken | ✅ N/A |

## Summary
- **Total**: 30
- **Passed**: 30
- **Failed**: 0
- **Screenshots**: DISABLED_BY_USER
- **Status**: ✅ 30/30 PASS

## Console/Network
- See console-network-proof.md for detailed logs
- 0 console errors
- 0 network failures
- 0 ChunkLoadError
- 0 failed _next/static requests
