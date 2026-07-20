param(
  [string]$InstallRoot = "C:\ATsoftERP",
  [switch]$RemoveServices,
  [switch]$RemoveShortcuts,
  [switch]$RemoveAppFiles,
  [switch]$RemoveBackups,
  [switch]$RemoveLogs,
  [switch]$ConfirmUninstall,
  [switch]$DryRun
)

$ErrorActionPreference = "Stop"

if (-not $ConfirmUninstall -and -not $DryRun) {
  Write-Host "ERROR: Use -ConfirmUninstall to proceed, or -DryRun to preview." -ForegroundColor Red
  exit 1
}

Write-Host "=== Uninstall Runtime ===" -ForegroundColor Cyan
if ($DryRun) { Write-Host "Mode: DRY-RUN" -ForegroundColor Yellow }
Write-Host ""

# Safety warnings
if (-not $DryRun -and $RemoveAppFiles) {
  Write-Host "WARNING: You are about to delete application files from: $InstallRoot\App" -ForegroundColor Red
  Write-Host "WARNING: Database (ATsoftERP_DB) will NOT be affected." -ForegroundColor Yellow
  Write-Host "WARNING: Backups will NOT be deleted unless -RemoveBackups is also specified." -ForegroundColor Yellow
  Write-Host ""
}

# Step 1: Remove services
if ($RemoveServices) {
  Write-Host "Removing services..." -ForegroundColor Cyan
  $svcScript = "$PSScriptRoot\..\..\deploy\windows\uninstall-services.ps1"
  if ($DryRun) {
    Write-Host "  [DRY-RUN] Would run: $svcScript" -ForegroundColor Yellow
  } else {
    & $svcScript
  }
}

# Step 2: Remove shortcuts
if ($RemoveShortcuts) {
  Write-Host "Removing shortcuts..." -ForegroundColor Cyan
  $shortcutScript = "$PSScriptRoot\remove-shortcuts.ps1"
  if ($DryRun) {
    Write-Host "  [DRY-RUN] Would run: $shortcutScript" -ForegroundColor Yellow
  } else {
    & $shortcutScript -Confirm
  }
}

# Step 3: Remove app files
if ($RemoveAppFiles) {
  $appDir = Join-Path $InstallRoot "App"
  if (Test-Path $appDir) {
    if ($DryRun) {
      Write-Host "  [DRY-RUN] Would remove: $appDir" -ForegroundColor Yellow
    } else {
      Remove-Item $appDir -Recurse -Force
      Write-Host "  Removed: $appDir" -ForegroundColor Red
    }
  }
}

# Step 4: Remove backups (only if explicitly requested)
if ($RemoveBackups) {
  $backupDir = Join-Path $InstallRoot "Backups"
  if (Test-Path $backupDir) {
    if ($DryRun) {
      Write-Host "  [DRY-RUN] Would remove: $backupDir" -ForegroundColor Yellow
    } else {
      Remove-Item $backupDir -Recurse -Force
      Write-Host "  Removed: $backupDir" -ForegroundColor Red
    }
  }
}

# Step 5: Remove logs (only if explicitly requested)
if ($RemoveLogs) {
  $logDir = Join-Path $InstallRoot "Logs"
  if (Test-Path $logDir) {
    if ($DryRun) {
      Write-Host "  [DRY-RUN] Would remove: $logDir" -ForegroundColor Yellow
    } else {
      Remove-Item $logDir -Recurse -Force
      Write-Host "  Removed: $logDir" -ForegroundColor Red
    }
  }
}

# Step 6: Remove Temp
$tempDir = Join-Path $InstallRoot "Temp"
if (Test-Path $tempDir) {
  if ($DryRun) {
    Write-Host "  [DRY-RUN] Would remove: $tempDir" -ForegroundColor Yellow
  } else {
    Remove-Item $tempDir -Recurse -Force
    Write-Host "  Removed: $tempDir" -ForegroundColor Red
  }
}

# Step 7: Remove Config
$configDir = Join-Path $InstallRoot "Config"
if (Test-Path $configDir) {
  if ($DryRun) {
    Write-Host "  [DRY-RUN] Would remove: $configDir" -ForegroundColor Yellow
  } else {
    Remove-Item $configDir -Recurse -Force
    Write-Host "  Removed: $configDir" -ForegroundColor Red
  }
}

Write-Host "`nUninstall complete." -ForegroundColor Green
if (-not $RemoveBackups) {
  Write-Host "Backups were NOT removed (use -RemoveBackups to delete)." -ForegroundColor Yellow
}
Write-Host "Database was NOT affected." -ForegroundColor Green
