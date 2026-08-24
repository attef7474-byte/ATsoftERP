# ATsoftERP Production Operations Runbook

## Overview

This runbook covers day-to-day operations for the ATsoftERP production deployment on Windows: service management, HTTPS, log rotation, backup, monitoring, and troubleshooting.

## Architecture

```
Clients (HTTPS:443)
        │
        ▼
   Caddy (TLS termination)
        │
        ├─ /api/*  → localhost:4000 (NestJS API)
        └─ /*      → localhost:3000 (Next.js Web)
        
Windows Services (auto-start):
  ATsoftERP_API   → node dist\src\main.js  (apps\api)
  ATsoftERP_Web   → next start -p 3000     (apps\web)
  ATsoftERP_Caddy → caddy run --config     (C:\ATsoftERP\Config\Caddyfile)

Scheduled Tasks:
  ATsoftERP-LogRotation → Daily 03:00 (rotate, compress, clean logs)
  ATsoftERP-DailyBackup → Daily 02:00 (SQL Server backup + verify)

Directories:
  C:\ATsoftERP\App\       → Application binaries
  C:\ATsoftERP\Config\    → Configuration files (Caddyfile, credentials, env)
  C:\ATsoftERP\Logs\      → Application and service logs
  C:\ATsoftERP\Backups\   → SQL Server .bak files
  C:\ATsoftERP\Temp\      → Temporary files (PID files, etc.)
```

---

## Service Management

### Check Status

```powershell
Get-Service ATsoftERP_*
Get-ScheduledTask ATsoftERP*
```

### Start / Stop / Restart

```powershell
# Individual services
Start-Service ATsoftERP_API
Stop-Service ATsoftERP_API
Restart-Service ATsoftERP_API

Start-Service ATsoftERP_Web
Stop-Service ATsoftERP_Web
Restart-Service ATsoftERP_Web

Start-Service ATsoftERP_Caddy
Stop-Service ATsoftERP_Caddy
Restart-Service ATsoftERP_Caddy

# All at once
Get-Service ATsoftERP_* | Restart-Service
```

### Health Checks

```powershell
# API health
(Invoke-WebRequest -Uri "http://localhost:4000/api/v1/health" -UseBasicParsing).Content

# Web health
Invoke-WebRequest -Uri "http://localhost:3000" -UseBasicParsing | Select-Object StatusCode

# HTTPS health (via Caddy)
Invoke-WebRequest -Uri "https://localhost" -UseBasicParsing -SkipCertificateCheck | Select-Object StatusCode
```

### View Logs

```powershell
# Service logs (NSSM stdout/stderr)
Get-Content "C:\ATsoftERP\Logs\ATsoftERP_API.stdout.log" -Tail 50
Get-Content "C:\ATsoftERP\Logs\ATsoftERP_API.stderr.log" -Tail 50

# Caddy access log
Get-Content "C:\ATsoftERP\Logs\caddy-access.log" -Tail 50

# Application logs in project root
Get-Content "api-output.log" -Tail 50
```

---

## HTTPS / TLS

Caddy manages TLS certificates automatically using its internal PKI (self-signed for local/LAN).

### Edit Caddyfile

```powershell
notepad C:\ATsoftERP\Config\Caddyfile
Restart-Service ATsoftERP_Caddy
```

### Common Caddyfile Changes

**Add a domain (with real ACME certificate):**
```
https://erp.mycompany.com {
    # Remove 'tls internal' to get real Let's Encrypt cert
    handle_path /api/* { reverse_proxy localhost:4000 }
    handle { reverse_proxy localhost:3000 }
}
```

**Add WebSocket support:**
```
handle_path /ws/* {
    reverse_proxy localhost:4000 {
        header_up Connection {>Connection}
        header_up Upgrade {>Upgrade}
    }
}
```

### Certificate Renewal

Self-signed certificates via `tls internal` are managed by Caddy automatically. No manual renewal needed.

For production ACME (Let's Encrypt) certificates:
- Caddy auto-renews 30 days before expiry
- Logs renewal attempts to `C:\ATsoftERP\Logs\caddy-access.log`
- Verify: `caddy validate --config C:\ATsoftERP\Config\Caddyfile`

---

## Log Rotation

The `ATsoftERP-LogRotation` scheduled task runs daily at 03:00.

### What it does:
1. Rotates NSSM stdout/stderr logs > 10MB to `C:\ATsoftERP\Logs\archive\`
2. Truncates project root `.log` files > 10MB (keeps last 1000 lines)
3. Compresses archived logs older than 7 days (gzip)
4. Deletes logs older than 30 days

### Manual Run

```powershell
Start-ScheduledTask -TaskName "ATsoftERP-LogRotation"
```

### Adjust Retention

Edit `C:\ATsoftERP\Config\rotate-logs.ps1`:
- `$retentionDays = 30` → Change to desired retention
- `$compressAfterDays = 7` → Change compression age

### Check Disk Usage

```powershell
(Get-ChildItem "C:\ATsoftERP\Logs" -Recurse -File | Measure-Object -Property Length -Sum).Sum / 1MB
```

---

## Database Backup

The `ATsoftERP-DailyBackup` scheduled task runs daily at 02:00.

### Backup Configuration

Credentials are stored in `C:\ATsoftERP\Config\backup-credentials.json`:
```json
{
  "server": "tcp:localhost,50079",
  "database": "ATsoftERP_DB",
  "user": "sa",
  "password": "YOUR_PASSWORD"
}
```

### What it does:
1. Full database backup to `C:\ATsoftERP\Backups\`
2. RESTORE VERIFYONLY with CHECKSUM
3. Retention cleanup (default: 30 days)
4. Writes metadata sidecar (.meta.json)
5. Logs to `C:\ATsoftERP\Logs\backup-scheduler.log`

### Manual Backup

```powershell
Start-ScheduledTask -TaskName "ATsoftERP-DailyBackup"
# Or directly:
.\tools\runtime\atsofterp-backup-now.ps1
```

### Verify Latest Backup

```powershell
$latest = Get-ChildItem "C:\ATsoftERP\Backups" -Filter "*.bak" | Sort-Object LastWriteTime -Descending | Select-Object -First 1
Write-Host "Latest: $($latest.Name) ($([math]::Round($latest.Length/1MB, 2))MB)"
.\tools\backup\verify-backup.ps1 -BackupFile $latest.FullName
```

### Restore from Backup

```powershell
# RESTORE VERIFYONLY (safe, no changes)
sqlcmd -S "tcp:localhost,50079" -U sa -P "PASSWORD" -Q "RESTORE VERIFYONLY FROM DISK = N'C:\ATsoftERP\Backups\file.bak' WITH CHECKSUM"

# Full restore to a test database (SAFE - uses random name)
.\tools\backup\restore-test-sqlserver.ps1 -BackupFile "C:\ATsoftERP\Backups\file.bak"

# Production restore (DANGEROUS - only in emergencies)
# See: docs/backup/sqlserver-backup-restore-runbook.md
```

---

## Backup Credentials Setup

Before the scheduled backup can run, you must configure the SQL Server password:

1. Open `C:\ATsoftERP\Config\backup-credentials.json`
2. Set the `password` field to the actual SQL Server password
3. Save the file

The file is excluded from Git (in `.gitignore` or equivalent).

---

## Disk Space Monitoring

```powershell
# Check all ATsoftERP directories
$dirs = @("C:\ATsoftERP\App", "C:\ATsoftERP\Config", "C:\ATsoftERP\Logs", "C:\ATsoftERP\Backups")
foreach ($d in $dirs) {
  $size = if (Test-Path $d) { (Get-ChildItem $d -Recurse -File | Measure-Object -Property Length -Sum).Sum / 1MB } else { 0 }
  Write-Host "$d : $([math]::Round($size, 2))MB"
}
```

---

## Uninstall / Cleanup

```powershell
# Remove all services, tasks, and firewall rules
.\deploy\windows\uninstall-all-services.ps1

# Or manually:
Stop-Service ATsoftERP_API -Force
Stop-Service ATsoftERP_Web -Force
Stop-Service ATsoftERP_Caddy -Force
sc.exe delete ATsoftERP_API
sc.exe delete ATsoftERP_Web
sc.exe delete ATsoftERP_Caddy
Unregister-ScheduledTask -TaskName "ATsoftERP-LogRotation" -Confirm:$false
Unregister-ScheduledTask -TaskName "ATsoftERP-DailyBackup" -Confirm:$false
Remove-NetFirewallRule -DisplayName "ATsoftERP HTTPS (443)"
```

---

## Troubleshooting

### Service won't start

```powershell
# Check logs
Get-Content "C:\ATsoftERP\Logs\ATsoftERP_API.stderr.log" -Tail 30

# Check NSSM configuration
& "C:\nssm-2.24\win64\nssm.exe" dump ATsoftERP_API

# Verify entry point exists
Test-Path "C:\Users\attef\PycharmProjects\Trae\ATsofterp\apps\api\dist\src\main.js"
```

### Port conflict

```powershell
# Find what's using port 4000 or 3000
netstat -ano | Select-String ":4000"
netstat -ano | Select-String ":3000"

# Kill offending process
Stop-Process -Id <PID> -Force
```

### Caddy not starting

```powershell
# Validate Caddyfile
& caddy validate --config C:\ATsoftERP\Config\Caddyfile

# Check Caddy logs
Get-Content "C:\ATsoftERP\Logs\ATsoftERP_Caddy.stderr.log" -Tail 30
```

### Backup fails

```powershell
# Test SQL Server connectivity
sqlcmd -S "tcp:localhost,50079" -U sa -P "PASSWORD" -Q "SELECT 1"

# Check backup credentials
Get-Content "C:\ATsoftERP\Config\backup-credentials.json"

# Manual backup with verbose output
.\tools\backup\backup-sqlserver.ps1 -Server "tcp:localhost,50079" -Database "ATsoftERP_DB" -User "sa" -Password "PASSWORD" -OutputDir "C:\ATsoftERP\Backups" -DryRun
```

### Scheduled task not running

```powershell
# Check task history
Get-ScheduledTaskInfo -TaskName "ATsoftERP-DailyBackup"
Get-ScheduledTaskInfo -TaskName "ATsoftERP-LogRotation"

# Verify task is registered
Get-ScheduledTask -TaskName "ATsoftERP-*" | Format-Table TaskName, State, LastRunTime
```

---

## Quick Reference

| Component | Service/Task | Port | Config | Logs |
|-----------|-------------|------|--------|------|
| API | ATsoftERP_API | 4000 | apps/api/.env | C:\ATsoftERP\Logs\ |
| Web | ATsoftERP_Web | 3000 | apps/web/.env | C:\ATsoftERP\Logs\ |
| HTTPS | ATsoftERP_Caddy | 443 | C:\ATsoftERP\Config\Caddyfile | C:\ATsoftERP\Logs\caddy-access.log |
| Log Rotation | ATsoftERP-LogRotation | — | C:\ATsoftERP\Config\rotate-logs.ps1 | — |
| Backup | ATsoftERP-DailyBackup | — | C:\ATsoftERP\Config\backup-credentials.json | C:\ATsoftERP\Logs\backup-scheduler.log |
