# Defect Register

## Defects Found and Fixed

| # | Defect | Entity | Severity | Status |
|---|--------|--------|----------|--------|
| 1 | Delete endpoint uses `:deactivate` permission instead of `:delete` | Machine Categories | Medium | FIXED |
| 2 | Delete endpoint uses `:deactivate` permission instead of `:delete` | Machine Parts | Medium | FIXED |
| 3 | Invalid UUID returns 500 instead of 400 | All delete endpoints | Medium | FIXED (ParseUUIDPipe) |
| 4 | Missing dependency check before hard delete | Checklist Items | High | FIXED |

## Known Limitations

| # | Limitation | Impact | Mitigation |
|---|-----------|--------|------------|
| 1 | No Playwright test suite | Manual browser test required | Manual verification documented |
| 2 | No dedicated API E2E tests | Runtime behavior not continuously verified | Documented endpoint analysis |
| 3 | /login page returns 500 | Smoke check 7/8 | SPA pattern, no standalone login route |
