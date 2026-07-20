# Static Validation Notes

> Commands and results for static code validation

## Validation Commands

```powershell
# Prisma validation
npx prisma validate --schema apps/api/prisma/schema.prisma

# API build
npm run build:api

# TypeScript check
npm run typecheck

# Web build
npm run build:web

# i18n check
npm run i18n:check
```

## Batch 38 Results

| Command | Result |
|---------|--------|
| Prisma validate | PASS |
| API build | PASS |
| Typecheck | PASS |
| Web build | PASS |
| i18n check | PASS |

## Notes

- Prisma validation checks the schema for configuration issues
- Typecheck catches TypeScript errors across all apps
- Web build is the most comprehensive check (prisma generate + typecheck + lint + i18n + next build)
- Always run `build:web` before releasing even if only web code changed

## Batch 39 Validation

Since Batch 39 has no code changes, static validation results are identical to Batch 38.
