<#
.SYNOPSIS
  Install ATsoftERP_API and ATsoftERP_Web as auto-start Windows services via NSSM.

.DESCRIPTION
  Creates two Windows services using NSSM (Non-Sucking Service Manager):
    - ATsoftERP_API: NestJS API on port 4000
    - ATsoftERP_Web: Next.js web on port 3000
  Both services auto-start on boot and auto-restart on failure.

  MUST be run as Administrator.

.PARAMETER AppDir
  Path to the ATsofterp repository root. Defaults to the script's grandparent.

.PARAMETER NssmPath
  Path to nssm.exe. Defaults to C:\nssm-2.24\win64\nssm.exe.

.PARAMETER DryRun
  Show what would be done without making changes.
#>
param(
  [string]$AppDir = (Resolve-Path "$PSScriptRoot\..\..").Path,
  [string]$NssmPath = "C:\nssm-2.24\win64\nssm.exe",
  [switch]$DryRun
)

$ErrorActionPreference = "Stop"

# --- Admin check ---
$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
  Write-Host "ERROR: This script must be run as Administrator." -ForegroundColor Red
  Write-Host "Right-click PowerShell -> Run as Administrator, then re-run this script." -ForegroundColor Yellow
  exit 1
}

# --- Validate NSSM ---
if (-not (Test-Path $NssmPath)) {
  Write-Host "ERROR: NSSM not found at $NssmPath" -ForegroundColor Red
  Write-Host "Install: choco install nssm -y  OR  download from https://nssm.cc/download" -ForegroundColor Yellow
  exit 1
}

# --- Validate app directories ---
$apiDir = Join-Path $AppDir "apps\api"
$webDir = Join-Path $AppDir "apps\web"
$apiEntry = Join-Path $apiDir "dist\src\main.js"
$webBin = Join-Path $webDir "node_modules\next\dist\bin\next"

if (-not (Test-Path $apiEntry)) {
  Write-Host "ERROR: API entry point not found: $apiEntry" -ForegroundColor Red
  Write-Host "Run 'npm run build:api' first." -ForegroundColor Yellow
  exit 1
}
if (-not (Test-Path $webBin)) {
  Write-Host "ERROR: Next.js binary not found: $webBin" -ForegroundColor Red
  Write-Host "Run 'npm run build:web' first." -ForegroundColor Yellow
  exit 1
}

$nodePath = (Get-Command node).Source

Write-Host "=== ATsoftERP NSSM Service Installer ===" -ForegroundColor Cyan
Write-Host "AppDir    : $AppDir"
Write-Host "Node      : $nodePath"
Write-Host "API Dir   : $apiDir"
Write-Host "API Entry : $apiEntry"
Write-Host "Web Dir   : $webDir"
Write-Host "NSSM      : $NssmPath"
Write-Host ""

# --- Service definitions ---
$services = @(
  @{
    Name        = "ATsoftERP_API"
    DisplayName = "ATsoftERP API Server"
    Description = "NestJS API server for ATsoft ERP (port 4000)"
    AppDir      = $apiDir
    Exe         = $nodePath
    Arguments   = "dist\src\main.js"
    EnvVars     = @{ PORT = "4000" }
  },
  @{
    Name        = "ATsoftERP_Web"
    DisplayName = "ATsoftERP Web Server"
    Description = "Next.js web server for ATsoft ERP (port 3000)"
    AppDir      = $webDir
    Exe         = $nodePath
    Arguments   = "node_modules\next\dist\bin\next start -p 3000"
    EnvVars     = @{}
  }
)

foreach ($svc in $services) {
  $name = $svc.Name
  Write-Host "--- Installing $name ---" -ForegroundColor Yellow

  # Check if already exists
  $existing = & sc.exe query $name 2>&1
  if ($LASTEXITCODE -eq 0) {
    Write-Host "  Service '$name' already exists. Removing first..." -ForegroundColor Yellow
    if (-not $DryRun) {
      & net stop $name 2>&1 | Out-Null
      & sc.exe delete $name 2>&1 | Out-Null
      Start-Sleep -Seconds 2
    } else {
      Write-Host "  [DRY-RUN] Would stop and delete existing '$name'" -ForegroundColor Gray
    }
  }

  if ($DryRun) {
    Write-Host "  [DRY-RUN] Would create service:" -ForegroundColor Gray
    Write-Host "    Name: $($svc.Name)"
    Write-Host "    Exe:  $($svc.Exe) $($svc.Arguments)"
    Write-Host "    Dir:  $($svc.AppDir)"
    Write-Host "    Start: Automatic"
    Write-Host "    Recovery: restart/30000/restart/60000/restart/120000"
  } else {
    # Install via NSSM
    & $NssmPath install $name $svc.Exe $svc.Arguments
    if ($LASTEXITCODE -ne 0) {
      Write-Host "  ERROR: Failed to install service '$name'" -ForegroundColor Red
      exit 1
    }

    # Set working directory
    & $NssmPath set $name AppDirectory $svc.AppDir

    # Set display name and description
    & $NssmPath set $name DisplayName $svc.DisplayName
    & $NssmPath set $name Description $svc.Description

    # Set startup type to automatic
    & $NssmPath set $name Start SERVICE_AUTO_START

    # Set environment variables (inherit system env + overrides)
    & $NssmPath set $name AppEnvironmentExtra `
      "PORT=4000" `
      "NODE_ENV=production"

    # Set logging to C:\ATsoftERP\Logs
    $logDir = "C:\ATsoftERP\Logs"
    if (-not (Test-Path $logDir)) { New-Item -ItemType Directory -Path $logDir -Force | Out-Null }
    & $NssmPath set $name AppStdout "$logDir\$name.stdout.log"
    & $NssmPath set $name AppStderr "$logDir\$name.stderr.log"

    # Rotate logs daily, keep 30 days, max 50MB per file
    & $NssmPath set $name AppRotateFiles 1
    & $NssmPath set $name AppRotateBytes 52428800
    & $NssmPath set $name AppRotateOnline 1

    # Set failure recovery: restart after 30s, 60s, 120s; reset counter after 1 day
    & sc.exe failure $name reset= 86400 actions= restart/30000/restart/60000/restart/120000 | Out-Null

    Write-Host "  Service '$name' installed successfully." -ForegroundColor Green
  }
}

Write-Host ""
Write-Host "=== Summary ===" -ForegroundColor Cyan
Write-Host "Services installed: ATsoftERP_API, ATsoftERP_Web"
Write-Host "Start API:  Start-Service ATsoftERP_API"
Write-Host "Start Web:  Start-Service ATsoftERP_Web"
Write-Host "Start Both: Start-Service ATsoftERP_API; Start-Service ATsoftERP_Web"
Write-Host "Status:     Get-Service ATsoftERP_*"
Write-Host "Logs:       C:\ATsoftERP\Logs\"
Write-Host ""
Write-Host "Start services now? (They will auto-start on next boot regardless.)" -ForegroundColor Yellow
$answer = Read-Host "Start now? [Y/n]"
if ($answer -ne "n" -and $answer -ne "N") {
  Write-Host "Starting ATsoftERP_API..." -ForegroundColor Cyan
  Start-Service ATsoftERP_API
  Start-Sleep -Seconds 3
  Write-Host "Starting ATsoftERP_Web..." -ForegroundColor Cyan
  Start-Service ATsoftERP_Web
  Start-Sleep -Seconds 5

  Write-Host ""
  Write-Host "=== Health Check ===" -ForegroundColor Cyan
  try {
    $apiHealth = Invoke-WebRequest -Uri "http://localhost:4000/api/v1/health" -TimeoutSec 10 -UseBasicParsing
    Write-Host "API: $($apiHealth.StatusCode) - $($apiHealth.Content.Substring(0, [Math]::Min(80, $apiHealth.Content.Length)))" -ForegroundColor Green
  } catch {
    Write-Host "API: FAILED - $($_.Exception.Message)" -ForegroundColor Red
  }
  try {
    $webHealth = Invoke-WebRequest -Uri "http://localhost:3000" -TimeoutSec 10 -UseBasicParsing
    Write-Host "Web: $($webHealth.StatusCode)" -ForegroundColor Green
  } catch {
    Write-Host "Web: FAILED - $($_.Exception.Message)" -ForegroundColor Red
  }
}

Write-Host ""
Write-Host "Done." -ForegroundColor Green
