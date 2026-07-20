param(
  [switch]$StartMenu,
  [switch]$DryRun,
  [switch]$Confirm
)

$ErrorActionPreference = "Stop"

if (-not $Confirm -and -not $DryRun) {
  Write-Host "ERROR: Use -Confirm to remove shortcuts, or -DryRun to preview." -ForegroundColor Red
  exit 1
}

$desktop = [Environment]::GetFolderPath("Desktop")
$startMenuDir = "$env:ProgramData\Microsoft\Windows\Start Menu\Programs\ATsoft ERP"

$shortcutNames = @(
  "ATsoft ERP Start.lnk",
  "ATsoft ERP Stop.lnk",
  "ATsoft ERP Status.lnk",
  "ATsoft ERP Open.lnk",
  "ATsoft ERP Backup Now.lnk"
)

Write-Host "=== Remove Shortcuts ===" -ForegroundColor Cyan

# Desktop
Write-Host "Desktop: $desktop" -ForegroundColor Cyan
foreach ($name in $shortcutNames) {
  $path = "$desktop\$name"
  if (Test-Path $path) {
    if ($DryRun) {
      Write-Host "  [DRY-RUN] Would remove: $path" -ForegroundColor Yellow
    } else {
      Remove-Item $path -Force
      Write-Host "  Removed: $path" -ForegroundColor Red
    }
  } else {
    Write-Host "  Not found: $path" -ForegroundColor Gray
  }
}

# Start Menu
if ($StartMenu -and (Test-Path $startMenuDir)) {
  Write-Host "Start Menu: $startMenuDir" -ForegroundColor Cyan
  foreach ($name in $shortcutNames) {
    $path = "$startMenuDir\$name"
    if (Test-Path $path) {
      if ($DryRun) {
        Write-Host "  [DRY-RUN] Would remove: $path" -ForegroundColor Yellow
      } else {
        Remove-Item $path -Force
        Write-Host "  Removed: $path" -ForegroundColor Red
      }
    }
  }
  if (-not $DryRun -and -not (Get-ChildItem $startMenuDir -ErrorAction SilentlyContinue)) {
    Remove-Item $startMenuDir -Force -ErrorAction SilentlyContinue
    Write-Host "  Removed empty folder: $startMenuDir" -ForegroundColor Gray
  }
}

Write-Host "Shortcut removal complete." -ForegroundColor Green
