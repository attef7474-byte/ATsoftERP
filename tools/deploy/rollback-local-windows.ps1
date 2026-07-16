param(
  [string]$DeployRoot = "C:\ATsoftERP\App",
  [string]$Version = "",
  [switch]$List,
  [switch]$DryRun
)

$ErrorActionPreference = "Stop"
$currentLink = Join-Path $DeployRoot "current"

if (-not (Test-Path $DeployRoot)) {
  Write-Host "ERROR: Deploy root not found: $DeployRoot" -ForegroundColor Red
  exit 1
}

# List available versions
$versions = Get-ChildItem $DeployRoot -Directory | Where-Object { $_.Name -ne "_previous" -and $_.Name -ne "current" -and -not (Get-Item $_.FullName).LinkType } | Sort-Object CreationTime -Descending

if ($List) {
  Write-Host "=== AVAILABLE VERSIONS ===" -ForegroundColor Cyan
  Write-Host "Current:"
  if (Test-Path $currentLink) {
    $linkTarget = (Get-Item $currentLink).Target
    Write-Host "  $linkTarget" -ForegroundColor Green
  } else {
    Write-Host "  (none)" -ForegroundColor Yellow
  }
  Write-Host "`nReleases:"
  if ($versions.Count -eq 0) {
    Write-Host "  (none)" -ForegroundColor Yellow
  } else {
    foreach ($v in $versions) {
      $size = "{0:N2}MB" -f ((Get-ChildItem $v.FullName -Recurse -File | Measure-Object Length -Sum).Sum / 1MB)
      Write-Host "  $($v.Name)  [$size]  $($v.CreationTime)"
    }
  }
  exit 0
}

if (-not $Version) {
  # Rollback to previous backup
  $backupDir = Join-Path $DeployRoot "_previous"
  if (-not (Test-Path $backupDir)) {
    Write-Host "ERROR: No _previous backup found. Use -Version to specify a target version." -ForegroundColor Red
    exit 1
  }
  $targetDir = $backupDir
} else {
  $targetDir = Join-Path $DeployRoot $Version
  if (-not (Test-Path $targetDir)) {
    Write-Host "ERROR: Version not found: $targetDir" -ForegroundColor Red
    exit 1
  }
}

Write-Host "=== ROLLBACK ===" -ForegroundColor Cyan
Write-Host "Target: $targetDir"
Write-Host ""

if ($DryRun) {
  Write-Host "[DRY-RUN] Would rollback current symlink to: $targetDir" -ForegroundColor Yellow
  exit 0
}

# Perform rollback
if (Test-Path $currentLink) {
  Remove-Item $currentLink -Force
}
New-Item -ItemType SymbolicLink -Path $currentLink -Target $targetDir -Force | Out-Null

Write-Host "Rollback completed. Current now points to: $targetDir" -ForegroundColor Green

# Restart services
$services = @("ATsoftERP_API", "ATsoftERP_Web")
foreach ($svc in $services) {
  try {
    Restart-Service -Name $svc -ErrorAction Stop
    Write-Host "  Service $svc restarted." -ForegroundColor Green
  } catch {
    Write-Host "  WARNING: Could not restart $svc : $_" -ForegroundColor Yellow
  }
}

Write-Host "`nRollback completed." -ForegroundColor Green
exit 0
