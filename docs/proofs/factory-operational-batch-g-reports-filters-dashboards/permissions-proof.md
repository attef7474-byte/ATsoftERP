# Permissions Proof — Batch G

## Existing Permissions
- `reports.maintenance:read` — already seeded in `apps/api/prisma/seed/seed.ts`
- No new permissions were needed — the existing permission covers all maintenance report endpoints

## Guard Protection
All report endpoints in `apps/api/src/modules/reports/reports.controller.ts` use:
- `@UseGuards(JwtAuthGuard, PermissionsGuard)`
- `@Permissions('reports.maintenance:read')`

## Unauthorized Access
- Requests without valid JWT return 401
- Requests without required permission return 403
