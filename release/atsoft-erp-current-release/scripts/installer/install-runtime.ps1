param(
  [string]$InstallRoot = "C:\ATsoftERP",
  [string]$ConfigPath = "",
  [string]$ReleasePackagePath = "",
  [string]$NodePath = "",
  [switch]$CreateShortcuts,
  [switch]$InstallServices,
  [switch]$ConfirmInstall,
  [switch]$DryRun
)

$ErrorActionPreference = "Stop"

if (-not $ConfirmInstall -and -not $DryRun) {
  Write-Host "ERROR: Use -ConfirmInstall to proceed, or -DryRun to preview." -ForegroundColor Red
  exit 1
}

$logDir = Join-Path $InstallRoot "Logs"
$appDir = Join-Path $InstallRoot "App"
$releasesDir = Join-Path $appDir "releases"
$backupDir = Join-Path $InstallRoot "Backups"
$configDir = Join-Path $InstallRoot "Config"
$tempDir = Join-Path $InstallRoot "Temp"
$currentLink = Join-Path $appDir "current"

if (-not $NodePath) { $NodePath = (Get-Command node).Source }

Write-Host "=== Install Runtime ===" -ForegroundColor Cyan
Write-Host "Install root: $InstallRoot"
if ($ReleasePackagePath) { Write-Host "Package     : $ReleasePackagePath" }
if ($DryRun) { Write-Host "Mode        : DRY-RUN" -ForegroundColor Yellow }
Write-Host ""

# Step 1: Create folder structure
$folders = @($logDir, $appDir, $releasesDir, $backupDir, $configDir, $tempDir)
foreach ($f in $folders) {
  if ($DryRun) {
    Write-Host "  [DRY-RUN] Would create: $f" -ForegroundColor Yellow
  } else {
    New-Item -ItemType Directory -Path $f -Force | Out-Null
    Write-Host "  Created: $f" -ForegroundColor Green
  }
}

# Step 2: Copy config example
$configExampleSrc = "$PSScriptRoot\..\runtime\atsofterp-config.example.json"
$configExampleDst = Join-Path $configDir "atsofterp-config.example.json"
if (Test-Path $configExampleSrc) {
  if ($DryRun) {
    Write-Host "  [DRY-RUN] Would copy config example to: $configExampleDst" -ForegroundColor Yellow
  } elseif (-not (Test-Path $configExampleDst)) {
    Copy-Item $configExampleSrc $configExampleDst -Force
    Write-Host "  Config example copied: $configExampleDst" -ForegroundColor Green
  } else {
    Write-Host "  Config example already exists (not overwritten): $configExampleDst" -ForegroundColor Gray
  }
}

# Step 3: Extract release package
if ($ReleasePackagePath -and (Test-Path $ReleasePackagePath)) {
  $baseName = [System.IO.Path]::GetFileNameWithoutExtension($ReleasePackagePath)
  $targetDir = Join-Path $releasesDir $baseName
  if ($DryRun) {
    Write-Host "  [DRY-RUN] Would extract $ReleasePackagePath -> $targetDir" -ForegroundColor Yellow
    Write-Host "  [DRY-RUN] Would set current symlink: $currentLink -> $targetDir" -ForegroundColor Yellow
  } else {
    if (Test-Path $targetDir) { Remove-Item $targetDir -Recurse -Force }
    Expand-Archive -Path $ReleasePackagePath -DestinationPath $targetDir -Force
    Write-Host "  Extracted: $targetDir" -ForegroundColor Green

    if (Test-Path $currentLink) { Remove-Item $currentLink -Force }
    New-Item -ItemType SymbolicLink -Path $currentLink -Target $targetDir -Force | Out-Null
    Write-Host "  Current symlink: $currentLink -> $targetDir" -ForegroundColor Green
  }
} elseif ($ReleasePackagePath) {
  Write-Host "  WARN: Release package not found: $ReleasePackagePath" -ForegroundColor Yellow
}

# Step 4: Create shortcuts
if ($CreateShortcuts) {
  if ($DryRun) {
    Write-Host "  [DRY-RUN] Would create shortcuts on Desktop" -ForegroundColor Yellow
  } else {
    & "$PSScriptRoot\create-shortcuts.ps1" -InstallRoot $InstallRoot -Confirm
    Write-Host "  Shortcuts created." -ForegroundColor Green
  }
}

# Step 5: Install services
if ($InstallServices) {
  $isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
  if (-not $isAdmin) {
    Write-Host "  WARN: Cannot install services — not running as Administrator." -ForegroundColor Yellow
  } elseif (Test-Path (Join-Path $currentLink "api\main.js")) {
    if ($DryRun) {
      Write-Host "  [DRY-RUN] Would install API and Web services" -ForegroundColor Yellow
    } else {
      & "$PSScriptRoot\..\..\deploy\windows\install-api-service.ps1" -DeployPath $currentLink -NodePath $NodePath
      & "$PSScriptRoot\..\..\deploy\windows\install-web-service.ps1" -DeployPath $currentLink -NodePath $NodePath
      Write-Host "  Services installed." -ForegroundColor Green
    }
  } else {
    Write-Host "  WARN: Release not deployed yet (no current/api/main.js). Cannot install services." -ForegroundColor Yellow
  }
}

Write-Host "`nInstall runtime preparation complete." -ForegroundColor Green
if (-not $DryRun) {
  Write-Host "Run 'atsofterp-start.ps1' to start the application." -ForegroundColor Cyan
}
