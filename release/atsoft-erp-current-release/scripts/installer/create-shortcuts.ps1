param(
  [string]$InstallRoot = "C:\ATsoftERP",
  [string]$ScriptsDir = "$PSScriptRoot\..\runtime",
  [switch]$StartMenu,
  [switch]$DryRun,
  [switch]$Confirm
)

$ErrorActionPreference = "Stop"

if (-not $Confirm -and -not $DryRun) {
  Write-Host "ERROR: Use -Confirm to create shortcuts, or -DryRun to preview." -ForegroundColor Red
  exit 1
}

$desktop = [Environment]::GetFolderPath("Desktop")
$startMenuDir = "$env:ProgramData\Microsoft\Windows\Start Menu\Programs\ATsoft ERP"
$psExe = "powershell.exe"
$psArgs = "-NoProfile -ExecutionPolicy Bypass -File"

$shortcuts = @(
  @{ Name = "ATsoft ERP Start"; Target = "$psExe"; Args = "$psArgs `"$ScriptsDir\atsofterp-start.ps1`""; Icon = "" }
  @{ Name = "ATsoft ERP Stop"; Target = "$psExe"; Args = "$psArgs `"$ScriptsDir\atsofterp-stop.ps1`""; Icon = "" }
  @{ Name = "ATsoft ERP Status"; Target = "$psExe"; Args = "$psArgs `"$ScriptsDir\atsofterp-status.ps1`""; Icon = "" }
  @{ Name = "ATsoft ERP Open"; Target = "$psExe"; Args = "$psArgs `"$ScriptsDir\atsofterp-open.ps1`""; Icon = "" }
  @{ Name = "ATsoft ERP Backup Now"; Target = "$psExe"; Args = "$psArgs `"$ScriptsDir\atsofterp-backup-now.ps1`""; Icon = "" }
)

$shell = New-Object -ComObject WScript.Shell

Write-Host "=== Create Shortcuts ===" -ForegroundColor Cyan

# Desktop
Write-Host "Desktop: $desktop" -ForegroundColor Cyan
foreach ($s in $shortcuts) {
  $path = "$desktop\$($s.Name).lnk"
  if ($DryRun) {
    Write-Host "  [DRY-RUN] Would create: $path" -ForegroundColor Yellow
  } else {
    $shortcut = $shell.CreateShortcut($path)
    $shortcut.TargetPath = $s.Target
    $shortcut.Arguments = $s.Args
    $shortcut.WorkingDirectory = $ScriptsDir
    if ($s.Icon -and (Test-Path $s.Icon)) { $shortcut.IconLocation = $s.Icon }
    $shortcut.Save()
    Write-Host "  Created: $path" -ForegroundColor Green
  }
}

# Start Menu
if ($StartMenu) {
  if (-not (Test-Path $startMenuDir)) {
    if ($DryRun) {
      Write-Host "  [DRY-RUN] Would create Start Menu folder: $startMenuDir" -ForegroundColor Yellow
    } else {
      New-Item -ItemType Directory -Path $startMenuDir -Force | Out-Null
    }
  }
  foreach ($s in $shortcuts) {
    $path = "$startMenuDir\$($s.Name).lnk"
    if ($DryRun) {
      Write-Host "  [DRY-RUN] Would create: $path" -ForegroundColor Yellow
    } else {
      $shortcut = $shell.CreateShortcut($path)
      $shortcut.TargetPath = $s.Target
      $shortcut.Arguments = $s.Args
      $shortcut.WorkingDirectory = $ScriptsDir
      $shortcut.Save()
      Write-Host "  Created: $path" -ForegroundColor Green
    }
  }
}

Write-Host "Shortcut creation complete." -ForegroundColor Green
