# Defect Register — Batch Y

## Known Issues

| # | Severity | Description | Status |
|---|----------|-------------|--------|
| 1 | Low | `POST /maintenance/requests/:id/required-parts` returns 500 on certain edge cases (pre-existing bug, not introduced by Batch Y) | Pre-existing |
| 2 | Low | No frontend page for creating/editing maintenance request part lines with new cost fields — cost attribution only available via API | Not in scope |
| 3 | Low | Classification field validation is minimal (`@IsString`) — no enum-level check on backend (trusted UI) | Intentional |

## Closed Issues

| # | Severity | Description | Resolution |
|---|----------|-------------|------------|
| 1 | Medium | Prisma enum types not supported by SQL Server 2016 | Changed to String fields |
| 2 | Medium | Ambiguous Prisma relation errors with cost FK fields | Changed to scalar-only columns (no `@relation`) |
| 3 | Medium | Migration P3018 error (NVARCHAR length) | Fixed by removing CREATE TYPE, using `NVARCHAR(1000)` |
