<#
.SYNOPSIS
  Install a Windows Scheduled Task for ATsoftERP database backup.

.DESCRIPTION
  Creates a daily scheduled task that runs the existing backup-sqlserver.ps1
  with a pre-configured password file.

  MUST be run as Administrator.

.PARAMETER BackupDir
  Directory for backup files. Defaults to C:\ATsoftERP\Backups.

.PARAMETER RetentionDays
  Days to keep backups. Defaults to 30.

.PARAMETER DryRun
  Show what would be done without making changes.
#>
param(
  [string]$BackupDir = "C:\ATsoftERP\Backups",
  [int]$RetentionDays = 30,
  [switch]$DryRun
)

$ErrorActionPreference = "Stop"

# --- Admin check ---
$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
  Write-Host "ERROR: This script must be run as Administrator." -ForegroundColor Red
  exit 1
}

Write-Host "=== ATsoftERP Backup Scheduler ===" -ForegroundColor Cyan

# --- Step 1: Create backup directory ---
if (-not (Test-Path $BackupDir)) {
  if ($DryRun) {
    Write-Host "[DRY-RUN] Would create backup directory: $BackupDir" -ForegroundColor Gray
  } else {
    New-Item -ItemType Directory -Path $BackupDir -Force | Out-Null
    Write-Host "Created backup directory: $BackupDir" -ForegroundColor Green
  }
}

# --- Step 2: Create a wrapper script that handles password securely ---
$configDir = "C:\ATsoftERP\Config"
if (-not (Test-Path $configDir)) { New-Item -ItemType Directory -Path $configDir -Force | Out-Null }

$wrapperScript = Join-Path $configDir "scheduled-backup.ps1"
$backupScript = (Resolve-Path "$PSScriptRoot\..\..\tools\backup\backup-sqlserver.ps1").Path

$wrapperContent = @"
<#
  ATsoftERP Scheduled Backup Wrapper
  Called by Task Scheduler. Reads password from secure config.
#>

`$ErrorActionPreference = "Continue"

`$logFile = "C:\ATsoftERP\Logs\backup-scheduler.log"
`$configFile = "C:\ATsoftERP\Config\backup-credentials.json"
`$backupScript = "$backupScript"

function Write-Log {
  param([string]`$Message, [string]`$Level = "INFO")
  `$ts = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
  `$line = "[`$ts] [`$Level] `$Message"
  Add-Content -Path `$logFile -Value `$line -Encoding UTF8
  Write-Output `$line
}

Write-Log "=== Scheduled Backup Started ==="

# Read credentials from config file
if (-not (Test-Path `$configFile)) {
  Write-Log "ERROR: Backup credentials file not found: `$configFile" "ERROR"
  Write-Log "Run this script manually once to create it, or create it with:" "ERROR"
  Write-Log '  @{ server = "tcp:localhost,50079"; database = "ATsoftERP_DB"; user = "sa"; password = "YOUR_PASSWORD" } | ConvertTo-Json | Set-Content "C:\ATsoftERP\Config\backup-credentials.json"' "ERROR"
  exit 1
}

`$creds = Get-Content `$configFile -Raw | ConvertFrom-Json

if (-not `$creds.server -or -not `$creds.database -or -not `$creds.password) {
  Write-Log "ERROR: Incomplete credentials in `$configFile" "ERROR"
  exit 1
}

# Run the backup
`$params = @{
  Server      = `$creds.server
  Database    = `$creds.database
  User        = `$creds.user
  Password    = `$creds.password
  OutputDir   = "$BackupDir"
  RetentionDays = $RetentionDays
}

Write-Log "Running backup: `$(`$creds.database) on `$(`$creds.server)"

try {
  & `$backupScript @`$params 2>&1 | ForEach-Object { Write-Log `$_ }
  if (`$LASTEXITCODE -eq 0) {
    Write-Log "Backup completed successfully." "INFO"
  } else {
    Write-Log "Backup script returned exit code `$LASTEXITCODE" "WARN"
  }
} catch {
  Write-Log "EXCEPTION: `$_" "ERROR"
}

# Log disk usage
`$backupSize = if (Test-Path "$BackupDir") {
  (Get-ChildItem "$BackupDir" -File | Measure-Object -Property Length -Sum).Sum
} else { 0 }
`$sizeMB = [math]::Round(`$backupSize / 1MB, 2)
Write-Log "Backup directory total size: `${sizeMB}MB"

Write-Log "=== Scheduled Backup Completed ==="
"@

if ($DryRun) {
  Write-Host "[DRY-RUN] Would write wrapper script: $wrapperScript" -ForegroundColor Gray
  Write-Host "[DRY-RUN] Would create credential config file at: C:\ATsoftERP\Config\backup-credentials.json" -ForegroundColor Gray
} else {
  $wrapperContent | Set-Content -Path $wrapperScript -Encoding UTF8 -Force
  Write-Host "Wrapper script: $wrapperScript" -ForegroundColor Green
}

# --- Step 3: Create credential template (first-time setup) ---
$credFile = Join-Path $configDir "backup-credentials.json"
if (-not (Test-Path $credFile)) {
  $template = @{
    server      = "tcp:localhost,50079"
    database    = "ATsoftERP_DB"
    user        = "sa"
    password    = "CHANGE_ME"
  }
  if ($DryRun) {
    Write-Host "[DRY-RUN] Would create credential template: $credFile" -ForegroundColor Gray
  } else {
    $template | ConvertTo-Json | Set-Content -Path $credFile -Encoding UTF8 -Force
    Write-Host ""
    Write-Host "!! ACTION REQUIRED !!" -ForegroundColor Red
    Write-Host "Edit $credFile and set the SQL Server password." -ForegroundColor Yellow
    Write-Host 'Current content:' -ForegroundColor Yellow
    Write-Host (Get-Content $credFile -Raw) -ForegroundColor Gray
    Write-Host ""
    $answer = Read-Host "Have you set the password? [y/N]"
    if ($answer -ne "y" -and $answer -ne "Y") {
      Write-Host "Please set the password and re-run this script." -ForegroundColor Yellow
      exit 0
    }
  }
}

# --- Step 4: Create Scheduled Task ---
$taskName = "ATsoftERP-DailyBackup"

if ($DryRun) {
  Write-Host "[DRY-RUN] Would create scheduled task '$taskName'" -ForegroundColor Gray
  Write-Host "  Trigger: Daily at 02:00" -ForegroundColor Gray
  Write-Host "  Action: powershell.exe -ExecutionPolicy Bypass -File $wrapperScript" -ForegroundColor Gray
} else {
  # Remove existing task if present
  $existingTask = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
  if ($existingTask) {
    Unregister-ScheduledTask -TaskName $taskName -Confirm:$false
    Write-Host "Removed existing task '$taskName'." -ForegroundColor Yellow
  }

  # Create the task action
  $action = New-ScheduledTaskAction `
    -Execute "powershell.exe" `
    -Argument "-ExecutionPolicy Bypass -NoProfile -File `"$wrapperScript`""

  # Create daily trigger at 02:00
  $trigger = New-ScheduledTaskTrigger -Daily -At "02:00"

  # Settings
  $settings = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -StartWhenAvailable `
    -ExecutionTimeLimit (New-TimeSpan -Minutes 30) `
    -RestartCount 2 `
    -RestartInterval (New-TimeSpan -Minutes 5)

  # Register the task
  Register-ScheduledTask `
    -TaskName $taskName `
    -Action $action `
    -Trigger $trigger `
    -Settings $settings `
    -Description "ATsoft ERP daily database backup with verification and retention cleanup" `
    -RunLevel Highest | Out-Null

  Write-Host "Scheduled task '$taskName' created successfully." -ForegroundColor Green
}

# --- Step 5: Verify ---
if (-not $DryRun) {
  $task = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
  if ($task) {
    Write-Host ""
    Write-Host "=== Task Verification ===" -ForegroundColor Cyan
    Write-Host "Task Name  : $($task.TaskName)"
    Write-Host "State      : $($task.State)"
    Write-Host "Triggers   : $($task.Triggers.Count)"
    Write-Host "Actions    : $($task.Actions.Count)"
    Write-Host ""
    Write-Host "To test now: Start-ScheduledTask -TaskName '$taskName'" -ForegroundColor Gray
  }
}

Write-Host ""
Write-Host "=== Summary ===" -ForegroundColor Cyan
Write-Host "Script    : $wrapperScript"
Write-Host "Task      : $taskName"
Write-Host "Schedule  : Daily at 02:00"
Write-Host "Retention : $RetentionDays days"
Write-Host "Backups   : $BackupDir"
Write-Host "Credentials: $credFile"
Write-Host "Log       : C:\ATsoftERP\Logs\backup-scheduler.log"
Write-Host "Done." -ForegroundColor Green
