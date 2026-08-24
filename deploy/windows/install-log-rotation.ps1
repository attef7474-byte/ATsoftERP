<#
.SYNOPSIS
  Install a Windows Scheduled Task for ATsoftERP log rotation.

.DESCRIPTION
  Creates a daily scheduled task that:
    - Rotates application logs in C:\ATsoftERP\Logs
    - Rotates project root log files (*.log)
    - Compresses logs older than 7 days
    - Deletes logs older than 30 days

  MUST be run as Administrator.

.PARAMETER DryRun
  Show what would be done without making changes.
#>
param(
  [switch]$DryRun
)

$ErrorActionPreference = "Stop"

# --- Admin check ---
$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
  Write-Host "ERROR: This script must be run as Administrator." -ForegroundColor Red
  exit 1
}

Write-Host "=== ATsoftERP Log Rotation Scheduler ===" -ForegroundColor Cyan

# --- Step 1: Create the log rotation script ---
$logRotationScript = "C:\ATsoftERP\Config\rotate-logs.ps1"
$configDir = "C:\ATsoftERP\Config"
if (-not (Test-Path $configDir)) { New-Item -ItemType Directory -Path $configDir -Force | Out-Null }

$rotateScript = @'
<#
  ATsoftERP Log Rotation Script
  Run daily via Task Scheduler.
  Rotates, compresses, and cleans log files.
#>

$ErrorActionPreference = "Continue"

$logsDir = "C:\ATsoftERP\Logs"
$projectDir = "C:\Users\attef\PycharmProjects\Trae\ATsofterp"
$retentionDays = 30
$compressAfterDays = 7

function Write-Log {
  param([string]$Message)
  $ts = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
  Write-Output "[$ts] $Message"
}

Write-Log "=== Log Rotation Started ==="

# --- 1. Rotate NSSM stdout/stderr logs ---
$nssmLogs = Get-ChildItem $logsDir -Filter "*.stdout.log" -ErrorAction SilentlyContinue
$nssmLogs += Get-ChildItem $logsDir -Filter "*.stderr.log" -ErrorAction SilentlyContinue

foreach ($log in $nssmLogs) {
  if ($log.Length -gt 10MB) {
    $archiveName = "$($log.BaseName)_$(Get-Date -Format 'yyyyMMdd_HHmmss')$($log.Extension)"
    $archivePath = Join-Path $logsDir "archive" $archiveName
    $archiveDir = Join-Path $logsDir "archive"
    if (-not (Test-Path $archiveDir)) { New-Item -ItemType Directory -Path $archiveDir -Force | Out-Null }

    Move-Item -Path $log.FullName -Destination $archivePath -Force
    Write-Log "Rotated: $($log.Name) -> archive\$archiveName ($([math]::Round($log.Length/1KB))KB)"
  }
}

# --- 2. Rotate project root log files ---
$rootLogs = Get-ChildItem $projectDir -Filter "*.log" -ErrorAction SilentlyContinue
foreach ($log in $rootLogs) {
  if ($log.Length -gt 10MB) {
    $archiveDir = Join-Path $logsDir "archive"
    if (-not (Test-Path $archiveDir)) { New-Item -ItemType Directory -Path $archiveDir -Force | Out-Null }
    $archiveName = "root_$($log.BaseName)_$(Get-Date -Format 'yyyyMMdd_HHmmss')$($log.Extension)"
    $archivePath = Join-Path $archiveDir $archiveName

    Copy-Item -Path $log.FullName -Destination $archivePath -Force
    # Truncate original (keep last 1000 lines)
    $lastLines = Get-Content $log.FullName -Tail 1000 -ErrorAction SilentlyContinue
    $lastLines | Set-Content $log.FullName -Encoding UTF8
    Write-Log "Truncated: $($log.Name) -> kept last 1000 lines, archive: archive\$archiveName"
  }
}

# --- 3. Compress archived logs older than compressAfterDays ---
$archiveDir = Join-Path $logsDir "archive"
if (Test-Path $archiveDir) {
  $oldArchives = Get-ChildItem $archiveDir -File | Where-Object {
    $_.LastWriteTime -lt (Get-Date).AddDays(-$compressAfterDays) -and $_.Extension -ne ".gz"
  }

  foreach ($file in $oldArchives) {
    $gzipPath = "$($file.FullName).gz"
    try {
      $content = [System.IO.File]::ReadAllBytes($file.FullName)
      $output = [System.IO.File]::Create($gzipPath)
      $gzip = New-Object System.IO.Compression.GzipStream($output, [System.IO.Compression.CompressionLevel]::Optimal)
      $gzip.Write($content, 0, $content.Length)
      $gzip.Close()
      $output.Close()
      Remove-Item $file.FullName -Force
      Write-Log "Compressed: $($file.Name) -> $($file.Name).gz"
    } catch {
      Write-Log "WARN: Failed to compress $($file.Name): $_"
    }
  }
}

# --- 4. Delete logs older than retentionDays ---
$deleted = 0
foreach ($dir in @($logsDir, $archiveDir)) {
  if (-not (Test-Path $dir)) { continue }
  $oldFiles = Get-ChildItem $dir -File -Recurse | Where-Object {
    $_.LastWriteTime -lt (Get-Date).AddDays(-$retentionDays)
  }
  foreach ($file in $oldFiles) {
    Remove-Item $file.FullName -Force -ErrorAction SilentlyContinue
    $deleted++
  }
}
Write-Log "Deleted $deleted file(s) older than $retentionDays days."

# --- 5. Summary ---
$totalSize = if (Test-Path $logsDir) {
  (Get-ChildItem $logsDir -Recurse -File | Measure-Object -Property Length -Sum).Sum
} else { 0 }
$totalSizeMB = [math]::Round($totalSize / 1MB, 2)
Write-Log "Total logs directory size: ${totalSizeMB}MB"
Write-Log "=== Log Rotation Completed ==="
'@

if ($DryRun) {
  Write-Host "[DRY-RUN] Would write log rotation script to: $logRotationScript" -ForegroundColor Gray
} else {
  $rotateScript | Set-Content -Path $logRotationScript -Encoding UTF8 -Force
  Write-Host "Log rotation script: $logRotationScript" -ForegroundColor Green
}

# --- Step 2: Create Scheduled Task ---
$taskName = "ATsoftERP-LogRotation"

if ($DryRun) {
  Write-Host "[DRY-RUN] Would create scheduled task '$taskName'" -ForegroundColor Gray
  Write-Host "  Trigger: Daily at 03:00" -ForegroundColor Gray
  Write-Host "  Action: powershell.exe -ExecutionPolicy Bypass -File $logRotationScript" -ForegroundColor Gray
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
    -Argument "-ExecutionPolicy Bypass -NoProfile -File `"$logRotationScript`""

  # Create daily trigger at 03:00
  $trigger = New-ScheduledTaskTrigger -Daily -At "03:00"

  # Settings
  $settings = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -StartWhenAvailable `
    -ExecutionTimeLimit (New-TimeSpan -Minutes 15) `
    -RestartCount 3 `
    -RestartInterval (New-TimeSpan -Minutes 1)

  # Register the task
  Register-ScheduledTask `
    -TaskName $taskName `
    -Action $action `
    -Trigger $trigger `
    -Settings $settings `
    -Description "ATsoft ERP daily log rotation: compress old logs, delete expired logs" `
    -RunLevel Highest | Out-Null

  Write-Host "Scheduled task '$taskName' created successfully." -ForegroundColor Green
}

# --- Step 3: Verify ---
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
Write-Host "Script : $logRotationScript"
Write-Host "Task   : $taskName"
Write-Host "Schedule: Daily at 03:00"
Write-Host "Retains logs for 30 days, compresses after 7 days"
Write-Host "Done." -ForegroundColor Green
