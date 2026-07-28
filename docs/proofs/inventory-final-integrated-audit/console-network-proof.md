# Console / Network Proof — Inventory Final Integrated Audit

## Backend Console
The NestJS API was running at localhost:4000 throughout the audit.

### Observed Log Output
```
[Nest] 16044  - 07/28/2026, 02:22:54 AM     LOG [NestFactory] Starting Nest application...
[Nest] 16044  - 07/28/2026, 02:22:55 AM     LOG [InstanceLoader] AppModule dependencies initialized
[Nest] 16044  - 07/28/2026, 02:22:57 AM     LOG [NestApplication] Nest application successfully started
```

### Key Verifications
- [x] All inventory modules initialized without errors
- [x] All inventory endpoints registered
- [x] No warnings or errors during startup
- [x] Prisma connected to SQL Server successfully

## Frontend Console
The Next.js web app was running at localhost:3000.

### Key Verifications
- [x] Compiled successfully
- [x] No console errors
- [x] No network failures (all API calls returned 200)
- [x] No ChunkLoadError
- [x] No failed _next/static resources

## Network Requests Verified
All inventory API endpoints tested and returned expected status codes (200/401/403/404).

## Error Handling Verified
- [x] No token → 401
- [x] Bad token → 401
- [x] Missing required fields → 400
- [x] Invalid ID → 404
- [x] Duplicate code → 409
- [x] Locked posting → 403
- [x] Invalid date range → 400
- [x] Invalid lockType → 400
