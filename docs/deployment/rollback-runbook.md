# Rollback Runbook

## Overview

This runbook describes the rollback procedure for reverting an ATsoft ERP deployment to a previous version. Rollbacks use the versioned release structure and symlink mechanism to switch between versions without downtime.

## Rollback Architecture

```
C:\ATsoftERP\App\
├── 1.0.0-20260701-aaa1111\     # Older release
├── 1.2.0-20260710-bbb2222\     # Previous release
├── 1.2.1-20260716-ccc3333\     # Current release (failed)
├── 1.0.0-20260701-aaa1111\     # Symlink target after rollback
└── current -> 1.0.0-20260701-aaa1111\   # Active symlink
```

## Script: `tools/deploy/rollback-local-windows.ps1`

### List Available Versions

```powershell
.\tools\deploy\rollback-local-windows.ps1 -DeployRoot "C:\ATsoftERP\App" -List
```

**Output example:**
```
=== AVAILABLE VERSIONS ===
Current:
  C:\ATsoftERP\App\1.2.1-20260716-ccc3333
Releases:
  1.2.0-20260710-bbb2222  [245.32MB]  07/10/2026 14:30:00
  1.0.0-20260701-aaa1111  [238.15MB]  07/01/2026 09:15:00
```

### Rollback to Previous Version

```powershell
# Rollback to the _previous backup (automatically saved during deploy)
.\tools\deploy\rollback-local-windows.ps1 -DeployRoot "C:\ATsoftERP\App"
```

### Rollback to a Specific Version

```powershell
.\tools\deploy\rollback-local-windows.ps1 -DeployRoot "C:\ATsoftERP\App" -Version "1.0.0-20260701-aaa1111"
```

### Dry Run

```powershell
.\tools\deploy\rollback-local-windows.ps1 -DeployRoot "C:\ATsoftERP\App" -Version "1.0.0-20260701-aaa1111" -DryRun
```

## Rollback Procedure

### Standard Rollback

1. **Identify the issue** (via monitoring, smoke test, or user report)

2. **List available versions:**
   ```powershell
   .\tools\deploy\rollback-local-windows.ps1 -List
   ```

3. **Perform rollback:**
   ```powershell
   .\tools\deploy\rollback-local-windows.ps1 -Version "1.0.0-20260701-aaa1111"
   ```
   This switches the `current` symlink and restarts services.

4. **Verify:**
   ```powershell
   .\tools\health\smoke-check.ps1
   ```

### Database Rollback

If the deployment included a database migration that needs reversal:

1. **Check current migration state:**
   ```pwsh
   npx prisma migrate status
   ```

2. **Roll back the migration:**
   ```pwsh
   npx prisma migrate reset --force
   ```
   or manually revert with a down migration script.

3. **Re-run the previous deploy:**
   ```pwsh
   .\tools\deploy\deploy-local-windows.ps1 -ReleaseZip "C:\ATsoftERP\App\_previous\*.zip"
   ```

## Emergency Rollback

For critical failures:

```powershell
# 1. List versions and identify the last known-good
.\tools\deploy\rollback-local-windows.ps1 -List

# 2. Rollback (includes service restart)
.\tools\deploy\rollback-local-windows.ps1 -Version "1.0.0-20260701-aaa1111"

# 3. Check services came up
Get-Service ATsoftERP_API, ATsoftERP_Web | Format-Table Name, Status

# 4. Run health check
.\tools\health\health-check.ps1

# 5. Run smoke check
.\tools\health\smoke-check.ps1
```

## Troubleshooting

| Scenario | Action |
|----------|--------|
| `_previous` directory missing | Use `-List` to find available versions, then `-Version` to target one |
| Symlink won't update | Run PowerShell as Administrator |
| Service won't restart after rollback | Check `C:\ATsoftERP\Logs\*.log` for startup errors |
| Database schema incompatible | Run `npx prisma migrate deploy` to apply the correct schema version |
| Rollback script fails | Manually: `Remove-Item current -Force; New-Item -ItemType SymbolicLink -Path current -Target "path\to\version"` |
