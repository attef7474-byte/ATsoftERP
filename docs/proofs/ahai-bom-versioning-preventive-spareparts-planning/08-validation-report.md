# Validation Report — AH-AI

## Build Checks

| Check | Command | Result |
|-------|---------|--------|
| Prisma validate | `npx prisma validate` | PASS |
| Prisma generate | `npx prisma generate` | PASS |
| API build (typecheck) | `npm run build` (api) | PASS |
| Web build (typecheck) | `npm run build` (web) | PASS |

## Seed

| Check | Result |
|-------|--------|
| Seed execution | PASS (49 sequences, 474 permissions) |
| New permissions | 8 created |
| New number sequences | 2 created (MAINTENANCE_BOM, PREVENTIVE_SPARE_PART_PLAN) |

## Database

| Check | Result |
|-------|--------|
| Migration (5 tables) | PASS |
| Foreign keys | PASS (8 FKs) |
| Indexes | PASS (15 indexes) |
| Unique constraints | PASS (3 unique) |

## API Routes

| Check | Result |
|-------|--------|
| BOM endpoints registered | PASS (18/18) |
| Plan endpoints registered | PASS (15/15) |
| Swagger/Route visibility | PASS (via NestJS RouterExplorer logs) |

## Security

| Check | Result |
|-------|--------|
| No secrets printed | PASS |
| No SQL leakage | PASS |
| No stack trace leakage | PASS |
| Permission guards | PASS (all endpoints have @Permissions) |

## Forbidden Rules Compliance

| Rule | Status |
|------|--------|
| No Docker | ✅ |
| No PostgreSQL | ✅ |
| No prisma db push | ✅ |
| No prisma migrate dev | ✅ |
| No destructive migration | ✅ |
| No forbidden modules activated | ✅ |
| No mock APIs | ✅ |
| Numbering uses NumberingService | ✅ |
| No English-only API messages | ✅ |

## Validation: PASS ✅
