# Session 5: Admin, Security, and Backup

> Training session for administrators — 2 hours

## Objectives

By the end of this session, you will be able to:
- Manage users, roles, and permissions
- Understand the security model
- Start and stop API/Web services
- Run health and smoke checks
- Understand backup procedures

## User Management

1. Navigate to **Users**
2. View the list of users
3. Each user has email, name, status, and assigned roles

## Roles

1. Navigate to **Roles**
2. View available roles
3. Each role has a set of permissions
4. SUPER_ADMIN has full access

## Permissions

1. Navigate to **Permissions**
2. View all permission strings
3. Permissions are in format: `module:action`
4. Matrix view shows all permissions at once

## Security Model

- JWT tokens for authentication
- bcrypt for password hashing
- Two guards: JwtAuthGuard + PermissionsGuard
- Only login endpoint is public
- All other endpoints require authentication

## Starting Services

```powershell
# Start API
npm run start:dev --workspace apps/api

# Start Web
npm run dev --workspace apps/web
```

## Health Checks

```powershell
powershell -ExecutionPolicy Bypass -File tools/health/health-check.ps1
powershell -ExecutionPolicy Bypass -File tools/health/smoke-check.ps1
```

## Backup

Back up the SQL Server database:
```powershell
sqlcmd -S localhost,50079 -U username -P password -Q "BACKUP DATABASE [ATsoftERP_DB] TO DISK='C:\backups\atsofterp_backup.bak'"
```

## Security Do's and Don'ts

| Do | Don't |
|----|-------|
| Use strong passwords | Commit .env to git |
| Run health checks regularly | Share JWT tokens |
| Back up the database | Run prisma db push |
| Monitor logs | Run migrate reset |

## Practical Exercise

1. List all users via the API
2. Check the health check output
3. View the Swagger documentation
4. Identify the public endpoints

## Summary

You now know how to:
- Manage users, roles, permissions
- Start/stop services
- Run health checks
- Understand backup procedures
- Follow security best practices
