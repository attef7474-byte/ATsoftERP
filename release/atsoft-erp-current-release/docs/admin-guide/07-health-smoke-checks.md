# Health and Smoke Checks

> Admin Guide — Section 7

## Purpose

Monitor system status after deployment and during operation.

## Health Check

The health check verifies core services are reachable.

### Run

```powershell
powershell -ExecutionPolicy Bypass -File tools/health/health-check.ps1
```

### Expected Output

```
=== Health Check ===
  PASS: API reachable on :4000
  PASS: Web reachable on :3000
  PASS: Swagger docs reachable
  PASS: SQL Server port 50079 open
=== RESULTS ===
Passed: 4 | Failed: 0
```

All 4 checks must pass for the system to be considered healthy.

## Smoke Test

The smoke test verifies critical user-facing functions work.

### Run

```powershell
powershell -ExecutionPolicy Bypass -File tools/health/smoke-check.ps1
```

### Expected Output

```
=== RESULTS ===
Passed: 8 | Failed: 0
```

All 8 checks must pass.

## What the Checks Verify

| Check | Type | What It Tests |
|-------|------|---------------|
| API reachable | Health | NestJS backend is running on port 4000 |
| Web reachable | Health | Next.js frontend is running on port 3000 |
| Swagger docs | Health | API documentation is accessible |
| SQL Server port | Health | Database instance WINCC:50079 is open |
| Web homepage | Smoke | Web returns 200 on root |
| Login page | Smoke | Login page renders correctly |
| API login | Smoke | Authentication produces valid JWT |
| Users endpoint | Smoke | Authenticated user list works |
| Products endpoint | Smoke | Authenticated product list works |
| Roles endpoint | Smoke | Authenticated role list works |
| Profile endpoint | Smoke | Authenticated user profile works |
| Swagger docs | Smoke | Swagger UI loads |

## API Health Endpoint

You can also check the API health directly:

```
GET http://localhost:4000/api/v1/health
```

Response: `{"status":"ok","timestamp":"...","uptime":...}`
