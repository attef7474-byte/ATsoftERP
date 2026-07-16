# SQL Server Backup & Restore Runbook

## Overview

This runbook documents the automated backup and restore procedures for the ATsoft ERP SQL Server database. All operations target the production database `ATsoftERP_DB` on `localhost:50079`.

## Prerequisites

- PowerShell 7+
- `sqlcmd.exe` (SQL Server client tools)
- SQL Server credentials (sa account or equivalent)
- Write access to backup directory (default: `C:\ATsoftERP\Backups`)

## Configuration

Copy the example config and customize:

```powershell
cp tools\backup\backup-config.example.json tools\backup\backup-config.json
```

Edit `tools/backup/backup-config.json`:

```json
{
  "server": "localhost:50079",
  "database": "ATsoftERP_DB",
  "user": "sa",
  "password": "YourPassword",
  "outputDir": "C:\\ATsoftERP\\Backups",
  "retentionDays": 14,
  "copyOnly": false
}
```

## Scripts Reference

### 1. Full Backup (`tools/backup/backup-sqlserver.ps1`)

Creates a full SQL Server backup with compression, checksum validation, and optional copy-only mode.

**Usage:**

```powershell
# Using config file
.\tools\backup\backup-sqlserver.ps1

# All parameters inline
.\tools\backup\backup-sqlserver.ps1 -Server "localhost:50079" -Database "ATsoftERP_DB" -User "sa" -Password "YourPassword" -OutputDir "D:\Backups" -CopyOnly -RetentionDays 7

# Dry run (see what would happen)
.\tools\backup\backup-sqlserver.ps1 -DryRun
```

**What it does:**
1. Executes `BACKUP DATABASE ... WITH COMPRESSION, CHECKSUM, FORMAT, INIT`
2. Runs `RESTORE VERIFYONLY ... WITH CHECKSUM` to validate the backup
3. Records backup file metadata (size, timestamp) to a `.meta.json` file
4. Cleans up backups older than `retentionDays`

**Automation (scheduled task):**

```powershell
$action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-NoProfile -ExecutionPolicy Bypass -File `"C:\ATsoftERP\App\current\tools\backup\backup-sqlserver.ps1`""
$trigger = New-ScheduledTaskTrigger -Daily -At 02:00AM
Register-ScheduledTask -TaskName "ATsoftERP-Backup" -Action $action -Trigger $trigger -RunLevel Highest
```

### 2. Verify Backup (`tools/backup/verify-backup.ps1`)

Validates a backup file without restoring it.

```powershell
.\tools\backup\verify-backup.ps1 -BackupFile "C:\ATsoftERP\Backups\ATsoftERP_DB_20260716_020000.bak" -Server "localhost:50079" -User "sa" -Password "YourPassword"
```

**Checks performed:**
- File existence and non-zero size
- `RESTORE VERIFYONLY` with `CHECKSUM`
- `RESTORE HEADERONLY` (readable metadata)
- `RESTORE FILELISTONLY` (logical file layout)

### 3. Restore Test (`tools/backup/restore-test-sqlserver.ps1`)

Restores a backup to a disposable test database (never touches the production database name).

```powershell
# Restore to ATsoftERP_DB_RESTORE_TEST_<random> and leave it for inspection
.\tools\backup\restore-test-sqlserver.ps1 -BackupFile "C:\ATsoftERP\Backups\ATsoftERP_DB_20260716_020000.bak" -Server "localhost:50079" -User "sa" -Password "YourPassword"

# Restore and auto-drop
.\tools\backup\restore-test-sqlserver.ps1 -BackupFile "C:\ATsoftERP\Backups\ATsoftERP_DB_20260716_020000.bak" -Server "localhost:50079" -User "sa" -Password "YourPassword" -DropTestDb
```

**Safety guarantees:**
- Test database name always includes a random suffix
- Uses `MOVE` to temp directory — never touches production data files
- Verifies test DB is accessible after restore

### 4. Cleanup Backups (`tools/backup/cleanup-backups.ps1`)

Removes backup files older than a retention period.

```powershell
# Dry run (preview)
.\tools\backup\cleanup-backups.ps1 -BackupDir "C:\ATsoftERP\Backups" -RetentionDays 14 -DryRun

# Execute
.\tools\backup\cleanup-backups.ps1 -BackupDir "C:\ATsoftERP\Backups" -RetentionDays 14
```

## Recovery Procedure (Production Restore)

In case of data loss or corruption, follow these steps:

1. **Stop application services:**
   ```powershell
   .\deploy\windows\uninstall-services.ps1
   ```

2. **Identify the latest valid backup:**
   ```powershell
   Get-ChildItem C:\ATsoftERP\Backups -Filter *.bak | Sort-Object CreationTime -Descending | Select-Object -First 5
   ```

3. **Verify the backup:**
   ```powershell
   .\tools\backup\verify-backup.ps1 -BackupFile "C:\ATsoftERP\Backups\ATsoftERP_DB_*.bak" -Server "localhost:50079" -User "sa" -Password "YourPassword"
   ```

4. **Restore production database:**
   ```sql
   RESTORE DATABASE [ATsoftERP_DB]
   FROM DISK = N'C:\ATsoftERP\Backups\ATsoftERP_DB_20260716_020000.bak'
   WITH REPLACE, STATS = 10;
   ```

5. **Restart services:**
   ```powershell
   Start-Service ATsoftERP_API
   Start-Service ATsoftERP_Web
   ```

6. **Verify restoration:**
   ```powershell
   .\tools\health\smoke-check.ps1
   ```

## Retention Policy

- **Daily backups**: retained for 14 days
- **Weekly/monthly**: manual archival to external storage
- **Automated cleanup**: runs as part of the backup script

## Monitoring

- Check backup success via event log or scheduled task history
- Verify backup file size is non-zero after each run
- Run `verify-backup.ps1` weekly as a separate scheduled task
