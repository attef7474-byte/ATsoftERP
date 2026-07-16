param(
  [string[]]$ServiceNames = @("ATsoftERP_API", "ATsoftERP_Web"),
  [switch]$DryRun
)

$ErrorActionPreference = "Stop"

Write-Host "=== Uninstall Services ===" -ForegroundColor Cyan

foreach ($svc in $ServiceNames) {
  $existing = Get-Service -Name $svc -ErrorAction SilentlyContinue
  if (-not $existing) {
    Write-Host "  Service '$svc' does not exist. Skipping." -ForegroundColor Yellow
    continue
  }

  if ($DryRun) {
    Write-Host "[DRY-RUN] Would stop and delete service: $svc" -ForegroundColor Yellow
    continue
  }

  Write-Host "Stopping service '$svc'..." -NoNewline
  try {
    Stop-Service -Name $svc -Force -ErrorAction Stop
    Write-Host " STOPPED" -ForegroundColor Green
  } catch {
    Write-Host " WARN ($_)" -ForegroundColor Yellow
  }

  Write-Host "Deleting service '$svc'..." -NoNewline
  $out = sc.exe delete $svc 2>&1
  if ($LASTEXITCODE -eq 0) {
    Write-Host " DELETED" -ForegroundColor Green
  } else {
    Write-Host " FAILED: $out" -ForegroundColor Red
  }
}

Write-Host "Service uninstall complete." -ForegroundColor Green
exit 0
