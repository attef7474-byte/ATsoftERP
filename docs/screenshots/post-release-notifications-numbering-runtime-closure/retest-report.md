# Retest Report

## Validation Results
| Check | Result |
|-------|:------:|
| prisma validate | PASS |
| prisma generate | PASS |
| build:api | PASS |
| typecheck | PASS |
| build:web | PASS |
| i18n:check | PASS (2109 keys synchronized) |

## Security
| Check | Result |
|-------|:------:|
| ValidationPipe | SECURE |
| Guards on create endpoints | SECURE |
| Guards on notification endpoints | SECURE |
| Unauthenticated notification | 401 |
| passwordHash exposure | 0 |
| JWT/token exposure | 0 |
| Secrets exposure | 0 |
| Stack traces | 0 |
| Rejected domains (11) | INACTIVE |

## Auto Code Generation (Code Analysis)
All 12 approved entities with code/reference fields now have backend
auto-generation via NumberingService or existing manual logic.

## Known Limitation
Full runtime API retest (creating records and verifying generated codes
via HTTP) cannot be performed in this environment because background
processes are killed between commands. Manual verification required.
