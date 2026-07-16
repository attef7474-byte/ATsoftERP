param(
  [string]$ReleaseZip,
  [string]$DeployRoot = "C:\ATsoftERP\App",
  [string]$Version = "",
  [string]$ConfigDir = "C:\ATsoftERP\Config",
  [switch]$DryRun,
  [switch]$SkipServices
)

$ErrorActionPreference = "Stop"

if (-not $ReleaseZip -or -not (Test-Path $ReleaseZip)) {
  Write-Host "ERROR: Provide a valid release zip via -ReleaseZip." -ForegroundColor Red
  exit 1
}

if (-not $Version) {
  $baseName = [System.IO.Path]::GetFileNameWithoutExtension($ReleaseZip)
  $Version = ($baseName -replace '^atsoft-erp-', '') + "_" + (Get-Date -Format "yyyyMMdd_HHmmss")
}

$targetDir = Join-Path $DeployRoot $Version
$currentLink = Join-Path $DeployRoot "current"
$backupDir = Join-Path $DeployRoot "_previous"

Write-Host "=== LOCAL WINDOWS DEPLOY ===" -ForegroundColor Cyan
Write-Host "Release zip : $ReleaseZip"
Write-Host "Target dir  : $targetDir"
Write-Host "Current link: $currentLink"
Write-Host "Version     : $Version"
Write-Host ""

if ($DryRun) {
  Write-Host "[DRY-RUN] Deployment steps:" -ForegroundColor Yellow
  Write-Host "  1. Extract $ReleaseZip -> $targetDir"
  Write-Host "  2. Rename $currentLink -> $backupDir (if exists)"
  Write-Host "  3. Create $currentLink -> $targetDir"
  Write-Host "  4. Copy config from $ConfigDir"
  Write-Host "  5. Run post-deploy steps (prisma migrate, service restart)"
  exit 0
}

# Step 1: Extract
Write-Host "Extracting release..." -ForegroundColor Cyan
if (Test-Path $targetDir) { Remove-Item $targetDir -Recurse -Force }
New-Item -ItemType Directory -Path $targetDir -Force | Out-Null
Expand-Archive -Path $ReleaseZip -DestinationPath $targetDir -Force
Write-Host "  Extracted to: $targetDir" -ForegroundColor Green

# Step 2: Backup current
if (Test-Path $currentLink) {
  $realCurrent = (Get-Item $currentLink).Target
  if (Test-Path $backupDir) { Remove-Item $backupDir -Recurse -Force }
  if ($realCurrent -and (Test-Path $realCurrent)) {
    Move-Item -Path $realCurrent -Destination $backupDir -Force
    Write-Host "  Previous version backed up to: $backupDir" -ForegroundColor Yellow
  }
  Remove-Item $currentLink -Force
}

# Step 3: Create current symlink
New-Item -ItemType SymbolicLink -Path $currentLink -Target $targetDir -Force | Out-Null
Write-Host "  Symlink created: $currentLink -> $targetDir" -ForegroundColor Green

# Step 4: Copy runtime config
$configFiles = @(".env", ".env.local", "service-config.json")
foreach ($cf in $configFiles) {
  $src = Join-Path $ConfigDir $cf
  $dst = Join-Path $targetDir $cf
  if (Test-Path $src) {
    Copy-Item -Path $src -Destination $dst -Force
    Write-Host "  Config copied: $cf" -ForegroundColor Green
  }
}

# Step 5: Install dependencies and migrate
Write-Host "Running post-deploy steps..." -ForegroundColor Cyan
Push-Location $targetDir

if (Test-Path "package.json") {
  Write-Host "  Installing production dependencies..." -ForegroundColor Cyan
  $out = npm install --production 2>&1
  if ($LASTEXITCODE -ne 0) { Write-Host "  WARNING: npm install failed: $out" -ForegroundColor Yellow }
}

if (Test-Path "prisma/schema.prisma") {
  Write-Host "  Running prisma migrate..." -ForegroundColor Cyan
  Push-Location "$targetDir/api"
  $out = npx prisma migrate deploy 2>&1
  if ($LASTEXITCODE -ne 0) { Write-Host "  WARNING: prisma migrate failed: $out" -ForegroundColor Yellow }
  Pop-Location
}

Pop-Location

# Step 6: Restart services
if (-not $SkipServices) {
  Write-Host "Restarting services..." -ForegroundColor Cyan
  $services = @("ATsoftERP_API", "ATsoftERP_Web")
  foreach ($svc in $services) {
    try {
      Restart-Service -Name $svc -ErrorAction Stop
      Write-Host "  Service $svc restarted." -ForegroundColor Green
    } catch {
      Write-Host "  WARNING: Could not restart $svc : $_" -ForegroundColor Yellow
    }
  }
}

Write-Host "`nDeployment completed successfully!" -ForegroundColor Green
Write-Host "Version: $Version" -ForegroundColor Green
Write-Host "Target : $targetDir" -ForegroundColor Green
exit 0
