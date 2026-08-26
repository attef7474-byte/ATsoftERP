# ATsoftERP Production Operations Runbook

## Overview

This runbook covers day-to-day operations for the ATsoftERP production deployment on Windows: service management, HTTPS, authentication recovery, log rotation, backup, monitoring, and troubleshooting.

The approved production entry point is **https://DELL**. Ports 3000 and 4000
are internal upstreams and are not user-facing entry points.

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

# HTTPS health (via the trusted production name)
Invoke-WebRequest -Uri "https://DELL" -UseBasicParsing | Select-Object StatusCode
Invoke-WebRequest -Uri "https://DELL/api/v1/health" -UseBasicParsing | Select-Object StatusCode
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
    handle /api/* { reverse_proxy localhost:4000 }
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

## Authentication and administrator recovery

### Normal self-service password change

1. Sign in at `https://DELL`.
2. Open **My Profile → Change Password**.
3. Enter the current password, then the new password twice.
4. The API enforces the active security policy, updates the credential and
   audit event atomically, increments the user's `authVersion`, and ends all
   previously issued sessions for that user.
5. Sign in again with the new password.

Do not use the administrator reset flow for the caller's own account.

### Authenticated administrator reset for another user

The supported route is `POST /api/v1/users/:id/reset-password`. The normal
operator path is **Access → Users → User details → Reset Password**. The action
is shown only to `SUPER_ADMIN` or callers with `user:reset-password`, and never
for the caller's own record.

The backend always:

- requires a valid JWT and active operational context;
- scopes the target to the active company and branch;
- requires a `SUPER_ADMIN` caller when the target is `SUPER_ADMIN`;
- changes only the credential, password-change timestamp, and session version;
- preserves identity, roles, permissions, and tenant assignments;
- writes `ADMIN_PASSWORD_RESET` with the real authenticated actor inside the
  same transaction;
- never returns or logs the password or hash.

### Last-administrator local break-glass recovery

Use this only when every administrator password is unavailable. It is a local
application-layer command for the canonical existing account
`admin@atsofterp.com`; it does not start an HTTP listener and cannot be reached
through Caddy.

Prerequisites:

- an interactive local PowerShell session on the production server;
- current source and dependencies installed;
- `C:\ATsoftERP\Config\backup-credentials.json` readable only by the service
  operator, or Windows integrated SQL authentication available;
- at least one non-empty `.bak` in `C:\ATsoftERP\Backups`.

Run from the repository root:

```powershell
npm run auth:break-glass --workspace apps/api
```

The command accepts no arguments. It first selects the newest non-empty backup
and independently runs `RESTORE VERIFYONLY WITH CHECKSUM`, `HEADERONLY`, and
`FILELISTONLY`. Only after that gate passes does it request the literal local
confirmation `RECOVER`, followed by two hidden password entries. The password
is never accepted through chat, a command-line argument, an environment
variable, or a file.

The transaction revalidates that the exact target is active and still has an
active `SUPER_ADMIN` role, changes exactly that credential, increments its
session version, and writes `ADMIN_PASSWORD_RECOVERY`. Because nobody is
authenticated during break-glass recovery, `AuditLog.userId` is deliberately
`NULL`; `actorType=SYSTEM`, the source, and target are recorded separately in
non-secret metadata. This avoids falsely attributing recovery to the target.
Current tenant audit screens intentionally hide null-actor rows; local security
review can verify the event by its action and target ID.

Never use any of these as password recovery:

- `seed.ts` or `SEED_ADMIN_PASSWORD`;
- a direct SQL `UPDATE` of `passwordHash`;
- a second `SUPER_ADMIN` account;
- an unauthenticated network endpoint.

### Recovery verification

After either reset path:

1. Confirm the command/API reports success and audit creation.
2. Confirm user ID, `SUPER_ADMIN` role, permissions, and operational scopes are
   unchanged.
3. Confirm a token issued before reset receives HTTP 401.
4. Sign in at `https://DELL/login` with the new password.
5. Load the authenticated dashboard, one representative protected page, and a
   safe authenticated API read.
6. Log out and confirm the just-issued token receives HTTP 401 and the UI
   returns to the login screen.
7. Review API/Caddy logs for unexpected 5xx, CORS, or TLS errors without
   printing authorization headers.

### Recovery failure and rollback behavior

- Backup, target, confirmation, policy, role, and generated-hash validation
  failures occur before mutation.
- Credential update and audit creation are one transaction; audit failure rolls
  back the credential update.
- Do not retry with seed or raw SQL. Correct the reported non-secret failure
  code, re-run backup verification, then run the supported command once.
- Never restore a backup over production merely to retry password recovery.
  If a post-condition fails after a committed transaction, preserve logs and
  follow the reviewed database recovery procedure before any restore decision.

---

## Database Backup

The `ATsoftERP-DailyBackup` scheduled task runs daily at 02:00.

### Backup Configuration

Database connection material is stored in
`C:\ATsoftERP\Config\backup-credentials.json`, outside Git, with filesystem
access restricted to the service/operator account. Never print or paste this
file into a terminal transcript, ticket, chat, or proof document.

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
# RESTORE VERIFYONLY (safe, no restore and no password process argument)
.\tools\backup\verify-backup.ps1 -BackupFile "C:\ATsoftERP\Backups\file.bak"

# Full restore to a test database (SAFE - uses random name)
.\tools\backup\restore-test-sqlserver.ps1 -BackupFile "C:\ATsoftERP\Backups\file.bak"

# Production restore (DANGEROUS - only in emergencies)
# See: docs/backup/sqlserver-backup-restore-runbook.md
```

---

## Backup Credentials Setup

Before the scheduled backup can run, configure its SQL Server identity locally:

1. Open `C:\ATsoftERP\Config\backup-credentials.json`
2. Configure the database identity without displaying it in terminal output,
   or configure Windows integrated authentication
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
# Verify the newest backup without putting a password in process arguments
$latest = Get-ChildItem "C:\ATsoftERP\Backups" -Filter "*.bak" |
  Sort-Object LastWriteTime -Descending | Select-Object -First 1
.\tools\backup\verify-backup.ps1 -BackupFile $latest.FullName
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
