# Handover Document 6: Deployment Guide

## 1. Prerequisites

| Dependency | Version | Notes |
|------------|---------|-------|
| Node.js | 18+ | LTS recommended |
| npm | 9+ | Comes with Node.js |
| SQL Server | 2016 Express | With `sqlcmd` CLI |
| Git | Latest | For version control |
| VS Code | Latest | Recommended IDE |

## 2. Clone Repository

```powershell
git clone <repository-url> ATsofterp
cd ATsofterp
```

## 3. Install Dependencies

```powershell
# Install all workspace dependencies (API + Web)
npm install
```

This installs dependencies for both `apps/api` and `apps/web` via npm workspaces.

## 4. Environment Setup

### API Environment
```powershell
cd apps/api
copy .env.example .env
# Edit .env with your database credentials:
# DATABASE_URL="sqlserver://127.0.0.1:50079;database=ATsoftERP_DB;user=atsofterp_app;password=<your-password>;trustServerCertificate=true"
# JWT_SECRET=<your-secret>
# JWT_EXPIRES_IN=3600
# PORT=3000
```

### Frontend Environment
```powershell
cd apps/web
copy .env.local.example .env.local
# Edit .env.local:
# NEXT_PUBLIC_API_URL=http://localhost:3000/api
# NEXT_PUBLIC_APP_NAME=ATsoft ERP
```

## 5. Database Setup

### Verify SQL Server is running
```powershell
sqlcmd -S 127.0.0.1,50079 -U atsofterp_app -P <password> -Q "SELECT @@VERSION"
```

### Run migrations (if any)
```powershell
sqlcmd -S 127.0.0.1,50079 -U atsofterp_app -P <password> -d ATsoftERP_DB -i path\to\migration.sql
```

### Generate Prisma client
```powershell
cd apps/api
npx prisma generate
```

### Validate schema
```powershell
npx prisma validate
```

## 6. Seed Database

```powershell
cd apps/api
npx prisma db seed
```

This seeds:
- Companies
- Branches
- Departments
- Users and roles
- Permissions
- Numbering sequences
- Configuration data

**Note**: `prisma db seed` is allowed. It does not drop or alter tables.

## 7. Build

### API
```powershell
cd apps/api
npm run build
```

### Frontend
```powershell
cd apps/web
npm run build
```

Both builds include TypeScript type checking. Fix any type errors before proceeding.

## 8. Run

### Start API (development with hot reload)
```powershell
cd apps/api
npm run start:dev
```

### Start Frontend (development)
```powershell
cd apps/web
npm run dev
```

### Production Build & Run
```powershell
cd apps/api && npm run build && npm run start:prod
cd apps/web && npm run build && npm run start
```

## 9. Health Checks

After starting the API, verify:

```powershell
# Health check
curl http://localhost:3000/api/health
# Expected: { "status": "ok", "timestamp": "...", "database": "connected" }

# Auth check
curl -H "Authorization: Bearer <token>" http://localhost:3000/api/auth/profile
# Expected: { "id": "...", "email": "...", "roles": [...] }
```

## 10. Smoke Tests

Run these smoke tests to verify the system is operational:

```powershell
# GET - List companies
curl -H "Authorization: Bearer <token>" http://localhost:3000/api/companies

# POST - Create company (then delete)
curl -X POST -H "Authorization: Bearer <token>" -H "Content-Type: application/json" -d '{"name":"Test","code":"TST"}' http://localhost:3000/api/companies

# PATCH - Update company
curl -X PATCH -H "Authorization: Bearer <token>" -H "Content-Type: application/json" -d '{"name":"Test Updated"}' http://localhost:3000/api/companies/:id

# DELETE - Delete company
curl -X DELETE -H "Authorization: Bearer <token>" http://localhost:3000/api/companies/:id

# GET - Branches
curl -H "Authorization: Bearer <token>" http://localhost:3000/api/branches

# GET - Departments
curl -H "Authorization: Bearer <token>" http://localhost:3000/api/departments
```

## 11. Troubleshooting Common Issues

| Issue | Solution |
|-------|----------|
| `ECONNREFUSED` on port 50079 | SQL Server not running — start SQL Server service |
| `Invalid Prisma Client` | Run `npx prisma generate` |
| `Table not found` | Migration not applied — run migration script |
| Port 3000 already in use | Change port in `.env` or kill existing process |
| `Module not found` | Run `npm install` in the specific workspace |
| Build fails with type errors | Fix reported TypeScript errors |
| `401 Unauthorized` | JWT expired — login again |
| `403 Forbidden` | Missing permission — check user roles |
