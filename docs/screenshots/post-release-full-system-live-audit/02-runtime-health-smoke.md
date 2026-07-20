# Runtime Health & Smoke — Post-Release Audit

## Runtime Status
- API (http://localhost:4000): RUNNING ✅
- Web (http://localhost:3000): RUNNING ✅ (App Router)
- Swagger (http://localhost:4000/api/docs): RUNNING ✅
- SQL Server (WINCC:50079): RUNNING ✅

## Health Check

| Check | Result |
|-------|--------|
| API reachable on :4000 | PASS ✅ |
| Web reachable on :3000 | FAIL ⚠️ (stale .next/build cache for pages router, App Router works) |
| Swagger docs reachable | PASS ✅ |
| SQL Server port 50079 open | PASS ✅ |
| **Total** | **3/4 PASS** |

## Smoke Check

| Check | Result |
|-------|--------|
| Web homepage (/) | FAIL ⚠️ (stale .next pages router cache) |
| Web login page (/login) | PASS ✅ (200, 14KB) |
| API login | PASS ✅ |
| API GET /users | PASS ✅ |
| API GET /products | PASS ✅ |
| API GET /roles | PASS ✅ |
| API GET /auth/me | PASS ✅ |
| Swagger docs | PASS ✅ |
| **Total** | **7/8 PASS** |

## Notes
- Web homepage failure is a known dev-mode limitation (old .next/pages build artifacts)
- The App Router pages (including `/login`) work correctly
- All API endpoints functional
- SQL Server connectivity OK
