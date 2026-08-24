<#
.SYNOPSIS
  Remove all ATsoftERP Windows services and scheduled tasks.

.DESCRIPTION
  Stops and removes:
    - ATsoftERP_API service (NSSM)
    - ATsoftERP_Web service (NSSM)
    - ATsoftERP_Caddy service (NSSM)
    - ATsoftERP-LogRotation scheduled task
    - ATsoftERP-DailyBackup scheduled task

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

Write-Host "=== ATsoftERP Service Uninstaller ===" -ForegroundColor Cyan

$nssmPath = "C:\nssm-2.24\win64\nssm.exe"

# --- Remove NSSM Services ---
$services = @("ATsoftERP_API", "ATsoftERP_Web", "ATsoftERP_Caddy")

foreach ($svcName in $services) {
  $existing = & sc.exe query $svcName 2>&1
  if ($LASTEXITCODE -eq 0) {
    Write-Host "Removing service: $svcName" -ForegroundColor Yellow
    if ($DryRun) {
      Write-Host "  [DRY-RUN] Would stop and delete '$svcName'" -ForegroundColor Gray
    } else {
      & net stop $svcName 2>&1 | Out-Null
      if (Test-Path $nssmPath) {
        & $nssmPath remove $svcName confirm 2>&1 | Out-Null
      } else {
        & sc.exe delete $svcName 2>&1 | Out-Null
      }
      Write-Host "  Removed: $svcName" -ForegroundColor Green
    }
  } else {
    Write-Host "  Service '$svcName' not found (OK)" -ForegroundColor Gray
  }
}

# --- Remove Scheduled Tasks ---
$tasks = @("ATsoftERP-LogRotation", "ATsoftERP-DailyBackup")

foreach ($taskName in $tasks) {
  $existingTask = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
  if ($existingTask) {
    Write-Host "Removing scheduled task: $taskName" -ForegroundColor Yellow
    if ($DryRun) {
      Write-Host "  [DRY-RUN] Would remove task '$taskName'" -ForegroundColor Gray
    } else {
      Unregister-ScheduledTask -TaskName $taskName -Confirm:$false
      Write-Host "  Removed: $taskName" -ForegroundColor Green
    }
  } else {
    Write-Host "  Task '$taskName' not found (OK)" -ForegroundColor Gray
  }
}

# --- Remove firewall rule ---
$fwRule = Get-NetFirewallRule -DisplayName "ATsoftERP HTTPS (443)" -ErrorAction SilentlyContinue
if ($fwRule) {
  Write-Host "Removing firewall rule: ATsoftERP HTTPS (443)" -ForegroundColor Yellow
  if ($DryRun) {
    Write-Host "  [DRY-RUN] Would remove firewall rule" -ForegroundColor Gray
  } else {
    Remove-NetFirewallRule -DisplayName "ATsoftERP HTTPS (443)"
    Write-Host "  Removed." -ForegroundColor Green
  }
}

Write-Host ""
Write-Host "=== All ATsoftERP services and tasks removed ===" -ForegroundColor Green
Write-Host "Config files preserved at: C:\ATsoftERP\Config" -ForegroundColor Gray
Write-Host "Logs preserved at: C:\ATsoftERP\Logs" -ForegroundColor Gray
Write-Host "Done." -ForegroundColor Green
