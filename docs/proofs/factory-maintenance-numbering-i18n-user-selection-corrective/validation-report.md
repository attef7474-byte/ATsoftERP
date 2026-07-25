# Build Validation Report

## Status: PENDING

This report is a placeholder for the CI/CD build validation output.

## Required Checks

The following validations should be run before deployment:

| Check | Command | Expected Result | Status |
|---|---|---|---|
| Backend compile | `nest build` | No errors | ⏳ PENDING |
| Frontend build | `next build` | No errors | ⏳ PENDING |
| Lint (backend) | `npm run lint` (api/) | No errors | ⏳ PENDING |
| Lint (frontend) | `npm run lint` (web/) | No errors | ⏳ PENDING |
| Type check | `npx tsc --noEmit` | No type errors | ⏳ PENDING |
| Unit tests | `npm run test` | All passing | ⏳ PENDING |
| API e2e tests | `npm run test:e2e` | All passing | ⏳ PENDING |
| Prisma validate | `npx prisma validate` | Schema valid | ⏳ PENDING |
| Build production | `npm run build` (api + web) | Exit code 0 | ⏳ PENDING |

## Notes

- Fill this report with actual build output before final acceptance.
- All validation commands should be executed from the repository root or respective subdirectories (`api/`, `web/`).
- Record any warnings or deprecation notices that appear during builds.
