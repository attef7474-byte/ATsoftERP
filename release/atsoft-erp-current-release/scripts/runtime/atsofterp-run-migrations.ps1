param(
  [string]$ConfigPath = "$PSScriptRoot\atsofterp-config.example.json",
  [switch]$SkipBackup,
  [switch]$ConfirmMigrate,
  [switch]$DryRun
)

$ErrorActionPreference = "Stop"

if (-not $ConfirmMigrate -and -not $DryRun) {
  Write-Host "ERROR: Use -ConfirmMigrate to proceed, or -DryRun to preview." -ForegroundColor Red
  exit 1
}

$cfg = @{}
if (Test-Path $ConfigPath) {
  $cfg = Get-Content $ConfigPath -Raw | ConvertFrom-Json
}
$releaseDir = if ($cfg.currentReleasePath) { $cfg.currentReleasePath } else { "" }
$apiDir = if ($releaseDir) { Join-Path $releaseDir "api" } else { "C:\Users\attef\PycharmProjects\Trae\ATsofterp\apps\api" }

Write-Host "=== ATsoft ERP — Run Migrations ===" -ForegroundColor Cyan

# 1. Create backup first (unless skipped)
if (-not $SkipBackup) {
  Write-Host "Step 1: Creating database backup before migration..." -ForegroundColor Cyan
  if ($DryRun) {
    Write-Host "  [DRY-RUN] Would create backup before migration" -ForegroundColor Yellow
  } else {
    & "$PSScriptRoot\atsofterp-backup-now.ps1" -CopyOnly -DryRun:$DryRun
    if ($LASTEXITCODE -ne 0) {
      Write-Host "  Backup failed. Migration aborted (use -SkipBackup to force)." -ForegroundColor Red
      exit 1
    }
    Write-Host "  Backup created successfully." -ForegroundColor Green
  }
}

# 2. Validate Prisma schema
Write-Host "Step 2: Validating Prisma schema..." -ForegroundColor Cyan
if ($DryRun) {
  Write-Host "  [DRY-RUN] Would validate Prisma schema" -ForegroundColor Yellow
} else {
  Push-Location $apiDir
  $out = npx prisma validate 2>&1
  if ($LASTEXITCODE -ne 0) {
    Write-Host "  Prisma validation FAILED: $out" -ForegroundColor Red
    Pop-Location
    exit 1
  }
  Pop-Location
  Write-Host "  Schema valid." -ForegroundColor Green
}

# 3. Check DATABASE_URL
Write-Host "Step 3: Checking DATABASE_URL..." -ForegroundColor Cyan
$envFile = Join-Path $apiDir ".env"
if (-not (Test-Path $envFile)) {
  Write-Host "  ERROR: .env file not found at $envFile" -ForegroundColor Red
  exit 1
}
$envContent = Get-Content $envFile -Raw
if ($envContent -notmatch 'DATABASE_URL=') {
  Write-Host "  ERROR: DATABASE_URL not found in .env" -ForegroundColor Red
  exit 1
}
Write-Host "  DATABASE_URL present (not printed for security)." -ForegroundColor Green

# 4. Run prisma migrate deploy
Write-Host "Step 4: Running prisma migrate deploy..." -ForegroundColor Cyan
if ($DryRun) {
  Write-Host "  [DRY-RUN] Would run: prisma migrate deploy" -ForegroundColor Yellow
} else {
  Push-Location $apiDir
  $out = npx prisma migrate deploy 2>&1
  $exitCode = $LASTEXITCODE
  Pop-Location

  if ($exitCode -eq 0) {
    Write-Host "  Migrations applied successfully." -ForegroundColor Green
  } else {
    Write-Host "  Migration output: $out" -ForegroundColor Yellow
    Write-Host "  WARN: Migration may have had issues. Check above." -ForegroundColor Yellow
    exit 1
  }
}

Write-Host "`nMigrations complete." -ForegroundColor Green
