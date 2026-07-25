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
| API proof — costs all filters | 500 DEFECT |
| API proof — parts-usage sparePartId | 500 DEFECT |
| SQL Server runtime proof | PENDING |
| Playwright browser proof | PENDING |

## Notes
- All compile-time validations pass.
- Two runtime defects remain open (costs + parts-usage 500 errors).
- Docker/PostgreSQL was NOT used as acceptance proof.
- No stock movement, no stock balance change, no finance entry created.
- Batch G is NOT ACCEPTED. Status: **IMPLEMENTED_WITH_OPEN_RUNTIME_DEFECTS**.

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

### Health
```
Passed: 4 | Failed: 0
```

### Smoke
```
Passed: 8 | Failed: 0
```
