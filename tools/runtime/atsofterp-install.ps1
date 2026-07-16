param(
  [string]$ConfigPath = "$PSScriptRoot\atsofterp-config.example.json",
  [string]$PackagePath = "",
  [switch]$NoServices,
  [switch]$NoShortcuts,
  [switch]$NoMigrations,
  [switch]$ConfirmInstall,
  [switch]$DryRun
)

$ErrorActionPreference = "Stop"

Write-Host "=== ATsoft ERP — One-Click Install ===" -ForegroundColor Cyan
Write-Host ""

# 1. Load config
function ConvertFrom-JsonToHashtable {
  param([string]$Path)
  $obj = Get-Content $Path -Raw | ConvertFrom-Json
  $ht = @{}
  $obj.PSObject.Properties | ForEach-Object { $ht[$_.Name] = $_.Value }
  return $ht
}

$cfg = @{}
if (Test-Path $ConfigPath) {
  $cfg = ConvertFrom-JsonToHashtable -Path $ConfigPath
  Write-Host "Config loaded from: $ConfigPath" -ForegroundColor Green
}

$installRoot = if ($cfg["installRoot"]) { $cfg["installRoot"] } else { "C:\ATsoftERP" }

# 2. Prerequisite check
Write-Host "Step 1: Checking prerequisites..." -ForegroundColor Cyan
& "$PSScriptRoot\..\installer\check-prerequisites.ps1"
if ($LASTEXITCODE -ne 0 -and -not $DryRun) {
  Write-Host "Prerequisites check failed. Review above." -ForegroundColor Red
  exit 1
}
Write-Host ""

# 3. Install runtime
Write-Host "Step 2: Installing runtime..." -ForegroundColor Cyan
$installArgs = @{
  InstallRoot = $installRoot
  ReleasePackagePath = $PackagePath
  ConfirmInstall = $ConfirmInstall
  DryRun = $DryRun
}
if (-not $NoShortcuts) { $installArgs.CreateShortcuts = $true }
if (-not $NoServices) { $installArgs.InstallServices = $true }
& "$PSScriptRoot\..\installer\install-runtime.ps1" @installArgs
Write-Host ""

# 4. Validate environment
Write-Host "Step 3: Validating environment..." -ForegroundColor Cyan
if ($DryRun) {
  Write-Host "  [DRY-RUN] Would validate environment" -ForegroundColor Yellow
} elseif (Test-Path "$PSScriptRoot\..\deploy\validate-env.ps1") {
  & "$PSScriptRoot\..\deploy\validate-env.ps1" -Quiet
  Write-Host "  Environment validated." -ForegroundColor Green
}
Write-Host ""

# 5. Run migrations
if (-not $NoMigrations) {
  Write-Host "Step 4: Running database migrations..." -ForegroundColor Cyan
  if ($DryRun) {
    Write-Host "  [DRY-RUN] Would run: prisma migrate deploy" -ForegroundColor Yellow
  } else {
    Push-Location "$PSScriptRoot\..\..\apps\api"
    if (Test-Path ".env") {
      $out = npx prisma migrate deploy 2>&1
      if ($LASTEXITCODE -eq 0) {
        Write-Host "  Migrations applied." -ForegroundColor Green
      } else {
        Write-Host "  WARN: Migration had issues (already up-to-date?): $out" -ForegroundColor Yellow
      }
    } else {
      Write-Host "  WARN: No .env found. Skipping migrations." -ForegroundColor Yellow
    }
    Pop-Location
  }
  Write-Host ""
}

# 6. Print next steps
Write-Host "=== INSTALLATION SUMMARY ===" -ForegroundColor Cyan
if ($DryRun) {
  Write-Host "Mode: DRY-RUN (no changes made)" -ForegroundColor Yellow
} else {
  Write-Host "Install root: $installRoot" -ForegroundColor Green
}
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "  Start app : .\tools\runtime\atsofterp-start.ps1" -ForegroundColor White
Write-Host "  Check status: .\tools\runtime\atsofterp-status.ps1" -ForegroundColor White
Write-Host "  Stop app  : .\tools\runtime\atsofterp-stop.ps1" -ForegroundColor White
Write-Host "  Backup now: .\tools\runtime\atsofterp-backup-now.ps1" -ForegroundColor White
Write-Host "  Open app  : .\tools\runtime\atsofterp-open.ps1" -ForegroundColor White
Write-Host ""
