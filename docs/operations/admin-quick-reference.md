# Admin Quick Reference

> Daily operations for system administrators

## Service Management

| Task | Command |
|------|---------|
| Start API | `npm run start:dev --workspace apps/api` |
| Start Web | `npm run dev --workspace apps/web` |
| Health Check | `powershell -ExecutionPolicy Bypass -File tools/health/health-check.ps1` |
| Smoke Test | `powershell -ExecutionPolicy Bypass -File tools/health/smoke-check.ps1` |
| Prisma Generate | `npx prisma generate --schema apps/api/prisma/schema.prisma` |
| API Build | `npm run build:api` |
| Web Build | `npm run build:web` |

## URLs

| Service | URL |
|---------|-----|
| API | http://localhost:4000 |
| API + prefix | http://localhost:4000/api/v1 |
| Swagger | http://localhost:4000/api/docs |
| Web | http://localhost:3000 |

## User Management

| Task | API Route |
|------|-----------|
| List users | `GET /api/v1/users` |
| List roles | `GET /api/v1/roles` |
| List permissions | `GET /api/v1/permissions` |
| Permission matrix | `GET /api/v1/permissions/matrix` |

## Quick Troubleshooting

| Problem | Solution |
|---------|----------|
| Port 4000/3000 in use | Kill process: `Stop-Process -Id (Get-NetTCPConnection -LocalPort <PORT>).OwningProcess -Force` |
| Web shows errors | Clear `.next`: `Remove-Item -Path "apps/web/.next" -Recurse -Force` and restart |
| Prisma error | Run `npx prisma generate --schema apps/api/prisma/schema.prisma` |
| Health check fails | Verify SQL Server, API, Web are running |

## Security

- **Do not** commit `.env`
- **Do not** share JWT tokens
- **Do not** run `prisma db push` or `migrate reset`
- All operational endpoints require authentication
- Only login is public
