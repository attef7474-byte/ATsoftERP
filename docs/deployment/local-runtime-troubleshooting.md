# Local Runtime Troubleshooting

## Common Issues

### API won't start

**Check:**
```powershell
.\tools\runtime\atsofterp-status.ps1
```

**Causes:**
- Port 4000 already in use → `netstat -ano | findstr :4000`
- Missing Prisma client → `cd apps/api && npx prisma generate`
- DATABASE_URL incorrect → check `apps/api/.env`
- Node.js version < 20 → `node --version`

### Web won't start

**Causes:**
- Port 3000 already in use → `netstat -ano | findstr :3000`
- Build missing → `npm run build:web`
- API unreachable → verify API is running first

### Prerequisites check fails

```powershell
.\tools\installer\check-prerequisites.ps1 -Verbose
```

**Common failures:**
- **PowerShell version**: Need 7+. Run `winget install Microsoft.PowerShell` to upgrade.
- **sqlcmd not found**: Install SQL Server Management Studio or use `choco install sqlserver-cmdlineutils`.
- **SQL Server unreachable**: Verify SQL Server Browser service is running. Check port 50079.
- **Port conflict**: Stop the process using port 3000 or 4000.

### Database connection errors

**Verify connectivity:**
```powershell
sqlcmd -S tcp:localhost,50079 -U atsofterp_app -P "<password>" -Q "SELECT 1"
```

**Check SQL Server is running:**
```powershell
Get-Service MSSQLSERVER
```

### Backup fails

**Causes:**
- Invalid credentials → verify password
- Disk space → check `C:\ATsoftERP\Backups\` free space
- Permission → ensure SQL Server has write access to backup directory

**Manual backup:**
```powershell
.\tools\backup\backup-sqlserver.ps1 -Server "tcp:localhost,50079" -Database "ATsoftERP_DB" -User "atsofterp_app" -Password "<pwd>"
```

### Migration fails

```powershell
.\tools\runtime\atsofterp-run-migrations.ps1 -ConfirmMigrate -SkipBackup
```

**Common causes:**
- Pending migrations that can't be applied → check `prisma migrate status`
- Schema validation error → fix schema in `apps/api/prisma/schema.prisma`
- Database permissions → ensure user has DDL rights

### Shortcuts not working

**Regenerate:**
```powershell
.\tools\installer\remove-shortcuts.ps1 -Confirm
.\tools\installer\create-shortcuts.ps1 -Confirm
```

### Process won't stop

**Force kill:**
```powershell
Get-Process -Name "node" -ErrorAction SilentlyContinue | Stop-Process -Force
```

Or:
```powershell
Stop-Process -Id (Get-Content C:\ATsoftERP\Temp\api.pid -ErrorAction SilentlyContinue) -Force
```

## Log Files

| File | What it contains |
|------|-----------------|
| `C:\ATsoftERP\Logs\api-stdout.log` | API stdout |
| `C:\ATsoftERP\Logs\api-stderr.log` | API stderr |
| `C:\ATsoftERP\Logs\web-stdout.log` | Web stdout |
| `C:\ATsoftERP\Logs\web-stderr.log` | Web stderr |
| `C:\ATsoftERP\Logs\runtime.log` | Runtime script output |

## Diagnostic Commands

```powershell
# Quick health check
npm run health:check

# Full smoke test
npm run smoke:check

# Prerequisites validation
npm run installer:check

# Runtime status
npm run runtime:status

# Deploy validation
npm run deploy:validate
```
