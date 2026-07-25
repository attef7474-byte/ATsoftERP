# Validation Report — Batch G

## Results

| Step | Status |
|------|--------|
| prisma validate | PASS |
| prisma generate | PASS |
| build:api | PASS |
| typecheck | PASS |
| build:web | PASS |
| i18n check | PASS |
| health check | 4/4 PASS |
| smoke check | 8/8 PASS |
| API proof — individual filter acceptance | 13/13 PASS |
| API proof — costs all filters | **200 FIXED** (was DEFECT) |
| API proof — parts-usage sparePartId | **200 FIXED** (was DEFECT) |
| SQL Server runtime proof | **PASS** |
| Playwright browser proof | **42/42 PASS** |
| Data integrity | PASS |
| Security | PASS |

## Notes
- All compile-time validations pass.
- Both runtime defects are **CLOSED**.
  - **Defect 1**: Costs endpoint with all 7 filters → 500. **Root cause**: `MaintenanceRequestPartUsage` has `productId` not `sparePartId`. **Fix**: Resolve `sparePartId → productId` via SparePart lookup.
  - **Defect 2**: Parts-usage endpoint with `sparePartId` → 500. **Root cause**: Same as above. **Fix**: Same fix applied.
- Docker/PostgreSQL was NOT used as acceptance proof.
- No stock movement, no stock balance change, no finance entry created.
- Batch G is **ACCEPTED**.

## Details

### prisma validate
```
Prisma schema loaded from apps\api\prisma\schema.prisma.
The schema at apps\api\prisma\schema.prisma is valid 🚀
```

### build:api
```
> api@0.1.0 build
> tsc
```

### typecheck
```
> api@0.1.0 typecheck
> tsc --noEmit
```

### build:web
```
✓ Compiled successfully
✓ Generating static pages (132/132)
```

### i18n
```
i18n check passed. 2287 keys in en.ts, 2287 keys in ar.ts, fully synchronized.
```

### Health (against SQL Server runtime)
```
PASS: API reachable on :4000
PASS: Web reachable on :3000
PASS: Swagger docs reachable
PASS: SQL Server port 50079 open
Passed: 4 | Failed: 0
```

### Smoke (against SQL Server runtime)
```
PASS: Web homepage (200, 12182B)
PASS: Web login page (200)
PASS: Login (token received)
PASS: Users endpoint (3 users)
PASS: Products endpoint (4 products)
PASS: Roles endpoint (4 roles)
PASS: Profile endpoint (admin@atsofterp.com)
PASS: Swagger docs (200)
Passed: 8 | Failed: 0
```

### Playwright (42/42)
```
42 passed (3.1m)
```

### Data Integrity
```
Stock movements: 0
Users: 3
Products: 4
Spare parts: 2
Maintenance operation types: 10
Production lines: 4
Machines: 2
```
