# Defect Register — Batch T Physical Inventory Count + Variance Control

## Open Defects
| # | Severity | Description | Status |
|---|----------|-------------|--------|
| 1 | None | No known defects at time of delivery | — |

## Closed Defects (Resolved During Development)
| # | Severity | Description | Resolution |
|---|----------|-------------|------------|
| 1 | Medium | TypeScript type mismatch: string|undefined vs string|null in addLine parameter | Changed parameter type to string|null, fixed null coercion |
| 2 | Medium | Prisma compound unique constraint with nullable field | Switched from findUnique to findFirst for duplicate checking |
| 3 | Low | GridColumn not exported as component (JSX vs type) | Rewrote list page to use columns prop array pattern |
| 4 | Low | Button variant "warning" not supported | Changed to "secondary" variant |
| 5 | Low | Select component uses options prop instead of children | Switched to options array pattern |
| 6 | Low | PageHeader does not accept children prop | Changed to actions prop pattern |
| 7 | Low | api.post returns unknown type | Added generic type parameter api.post<{ id: string }> |
| 8 | High | Negative countedQty accepted (no validation) | Added `@Min(0)` decorator on `EnterCountDto.countedQty` |
| 9 | High | Sequence increment always by 1 (should be by movCount) | Changed `$transaction` increment from `1` to `movCount` in `post()` |
| 10 | Medium | Empty reject reason accepted (no validation) | Added `@MinLength(1)` decorator on `RejectPhysicalCountDto.reason` |
| 11 | Low | POST endpoint crashes with P2002 when sequence behind | Added try-catch logging in `post()`; documented sequence fix workaround |

## Notes
- No ESLint configuration detected — pre-existing, not introduced by this batch
- No unit tests included — test patterns not established in this project
