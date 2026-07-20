# Backup, Restore, and Runtime Tools

> Admin Guide — Section 6

## Backup

### SQL Server Backup

Use SQL Server Management Studio (SSMS) or sqlcmd:

```powershell
sqlcmd -S localhost,50079 -U your_user -P your_password -Q "BACKUP DATABASE [ATsoftERP_DB] TO DISK='C:\backups\atsofterp_backup.bak'"
```

### Application Backup

The application code is managed via git. To back up the code:

```powershell
git clone https://github.com/attef7474-byte/ATsoftERP.git
```

## Restore

### SQL Server Restore

```powershell
sqlcmd -S localhost,50079 -U your_user -P your_password -Q "RESTORE DATABASE [ATsoftERP_DB] FROM DISK='C:\backups\atsofterp_backup.bak'"
```

**Caution**: Restore overwrites the current database. Ensure you have a recent backup before restoring.

## Runtime Tools

### Health Check

```powershell
powershell -ExecutionPolicy Bypass -File tools/health/health-check.ps1
```

Checks:
1. API reachable on :4000
2. Web reachable on :3000
3. Swagger docs reachable
4. SQL Server port 50079 open

### Smoke Test

```powershell
powershell -ExecutionPolicy Bypass -File tools/health/smoke-check.ps1
```

Tests:
1. Web homepage (200)
2. Login page (200)
3. API login (200 + JWT)
4. GET /users
5. GET /products
6. GET /roles
7. GET /auth/me
8. Swagger docs (200)

## Runtime Scripts Directory

The `tools/` directory contains:
- `tools/health/` — Health and smoke check scripts
- `tools/runtime/` — Runtime startup scripts
- `tools/installer/` — Windows installer support

## Important Notes

- **Do not** run destructive SQL commands
- **Do not** run `prisma db push` or `migrate reset`
- Keep regular backups of the ATsoftERP_DB database
- Store backups in a secure location separate from the application
