# UX-0 — Scope & Rules

## Scope
- Organization Context Lite: frontend AuthProvider + login flow
- Machine auto-fill: productionLineId, costCenterId from selected machine
- Backend derivation: auto-fill missing operational context from machine defaults
- No schema/migration changes
- No new entities or tables

## Explicitly Not in Scope
- `UserCompanyBranch` table or multi-company switching UI
- Organization tree management page
- `SparePart.companyId` or inventory schema changes
- Finance/Purchasing/Sales/HR/AI/IoT/BI module activation
- `app.module.ts` changes
- Placeholder pages or mock APIs
- `prisma db push` / `migrate dev` / `migrate reset`

## Forbidden Rules Enforced
- No Docker (Windows local runtime)
- No PostgreSQL (SQL Server only)
- No database reset or destructive operations
- No English-only API errors
- No hardcoded i18n keys in browser output
- No double-deduction or direct balance edits
- No mock responses for missing endpoints
