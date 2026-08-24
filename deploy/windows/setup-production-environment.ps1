<#
.SYNOPSIS
  One-click production environment setup for ATsoftERP on Windows.

.DESCRIPTION
  Orchestrates all production operational requirements:
    1. Creates C:\ATsoftERP directory structure
    2. Verifies builds exist
    3. Installs NSSM services (API + Web auto-start)
    4. Installs Caddy HTTPS reverse proxy (optional)
    5. Installs log rotation scheduled task
    6. Installs backup scheduled task

  MUST be run as Administrator.

.PARAMETER SkipHttps
  Skip HTTPS/Caddy setup (if you don't need TLS termination).

.PARAMETER DryRun
  Show what would be done without making changes.
#>
param(
  [switch]$SkipHttps,
  [switch]$DryRun
)

$ErrorActionPreference = "Stop"

# --- Admin check ---
$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
  Write-Host "ERROR: This script must be run as Administrator." -ForegroundColor Red
  Write-Host "Right-click PowerShell -> Run as Administrator" -ForegroundColor Yellow
  exit 1
}

$scriptDir = $PSScriptRoot
$appDir = Resolve-Path "$scriptDir\..\.."

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "  ATsoftERP Production Environment Setup  " -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "AppDir : $appDir"
Write-Host "HTTPS  : $(-not $SkipHttps)"
Write-Host "DryRun : $DryRun"
Write-Host ""

# --- Step 1: Create directory structure ---
Write-Host "--- Step 1/6: Directory Structure ---" -ForegroundColor Yellow

$dirs = @(
  "C:\ATsoftERP",
  "C:\ATsoftERP\App",
  "C:\ATsoftERP\Config",
  "C:\ATsoftERP\Logs",
  "C:\ATsoftERP\Backups",
  "C:\ATsoftERP\Temp",
  "C:\ATsoftERP\Logs\archive"
)

foreach ($dir in $dirs) {
  if (-not (Test-Path $dir)) {
    if ($DryRun) {
      Write-Host "  [DRY-RUN] Would create: $dir" -ForegroundColor Gray
    } else {
      New-Item -ItemType Directory -Path $dir -Force | Out-Null
      Write-Host "  Created: $dir" -ForegroundColor Green
    }
  } else {
    Write-Host "  Exists: $dir" -ForegroundColor Gray
  }
}

# --- Step 2: Verify builds ---
Write-Host ""
Write-Host "--- Step 2/6: Build Verification ---" -ForegroundColor Yellow

$apiEntry = Join-Path $appDir "apps\api\dist\src\main.js"
$webBuild = Join-Path $appDir "apps\web\.next\BUILD_ID"

$apiOk = Test-Path $apiEntry
$webOk = Test-Path $webBuild

if ($apiOk) {
  Write-Host "  API build: OK ($apiEntry)" -ForegroundColor Green
} else {
  Write-Host "  API build: MISSING" -ForegroundColor Red
  Write-Host "  Run: npm run build:api" -ForegroundColor Yellow
}

if ($webOk) {
  Write-Host "  Web build: OK" -ForegroundColor Green
} else {
  Write-Host "  Web build: MISSING" -ForegroundColor Red
  Write-Host "  Run: npm run build:web" -ForegroundColor Yellow
}

if (-not $apiOk -or -not $webOk) {
  Write-Host ""
  $answer = Read-Host "Builds are missing. Continue anyway? (services may fail to start) [y/N]"
  if ($answer -ne "y" -and $answer -ne "Y") {
    exit 1
  }
}

# --- Step 3: NSSM Services ---
Write-Host ""
Write-Host "--- Step 3/6: NSSM Services (Auto-Start) ---" -ForegroundColor Yellow

$installServices = Join-Path $scriptDir "install-nssm-services.ps1"
& $installServices -AppDir $appDir -DryRun:$DryRun

# --- Step 4: HTTPS (optional) ---
if (-not $SkipHttps) {
  Write-Host ""
  Write-Host "--- Step 4/6: HTTPS Reverse Proxy (Caddy) ---" -ForegroundColor Yellow

  $installHttps = Join-Path $scriptDir "install-caddy-https.ps1"
  & $installHttps -DryRun:$DryRun
} else {
  Write-Host ""
  Write-Host "--- Step 4/6: HTTPS (SKIPPED) ---" -ForegroundColor Gray
}

# --- Step 5: Log Rotation ---
Write-Host ""
Write-Host "--- Step 5/6: Log Rotation ---" -ForegroundColor Yellow

$installLogRotation = Join-Path $scriptDir "install-log-rotation.ps1"
& $installLogRotation -DryRun:$DryRun

# --- Step 6: Backup Schedule ---
Write-Host ""
Write-Host "--- Step 6/6: Backup Schedule ---" -ForegroundColor Yellow

$installBackup = Join-Path $scriptDir "install-backup-schedule.ps1"
& $installBackup -DryRun:$DryRun

# --- Final Summary ---
Write-Host ""
Write-Host "==========================================" -ForegroundColor Green
Write-Host "  Setup Complete!" -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Services:" -ForegroundColor Cyan
Write-Host "  ATsoftERP_API   - NestJS API (port 4000) - Auto-start"
Write-Host "  ATsoftERP_Web   - Next.js Web (port 3000) - Auto-start"
if (-not $SkipHttps) {
  Write-Host "  ATsoftERP_Caddy - HTTPS Proxy (port 443) - Auto-start"
}
Write-Host ""
Write-Host "Scheduled Tasks:" -ForegroundColor Cyan
Write-Host "  ATsoftERP-LogRotation  - Daily at 03:00"
Write-Host "  ATsoftERP-DailyBackup  - Daily at 02:00"
Write-Host ""
Write-Host "Directories:" -ForegroundColor Cyan
Write-Host "  Config   : C:\ATsoftERP\Config"
Write-Host "  Logs     : C:\ATsoftERP\Logs"
Write-Host "  Backups  : C:\ATsoftERP\Backups"
Write-Host ""
Write-Host "Management Commands:" -ForegroundColor Cyan
Write-Host "  Get-Service ATsoftERP_*"
Write-Host "  Start-Service ATsoftERP_API"
Write-Host "  Stop-Service ATsoftERP_API"
Write-Host "  Get-ScheduledTask ATsoftERP*"
Write-Host ""
Write-Host "Uninstall:" -ForegroundColor Yellow
Write-Host "  .\uninstall-all-services.ps1"
